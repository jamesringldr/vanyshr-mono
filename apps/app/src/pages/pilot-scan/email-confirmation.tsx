import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { cx } from "@/utils/cx";

export type EmailConfirmationModalProps = {
  initialEmails: string[];
  onConfirm: (emails: string[]) => void;
  onCancel: () => void;
  isOpen?: boolean;
};

type EmailItem = {
  id: string;
  value: string;
};

/** A quickscan runs the dark-web check on at most this many addresses. */
const MAX_SELECTED = 3;

const LIMIT_MESSAGE =
  "QuickScans only include 3 emails for darkweb scans. Sign up for a free forever plan to monitor unlimited emails";

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  і: "i",
  ѕ: "s",
  һ: "h",
  ԁ: "d",
  ӏ: "l",
  ⅿ: "m",
};

export function canonicalizeEmail(raw: string): string {
  const folded = raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/mailto:/g, "")
    .replace(/[\u0400-\u04FF]/g, (ch) => CYRILLIC_TO_LATIN[ch] ?? "");
  return folded.replace(/[^a-z0-9@._+-]/g, "");
}

export function uniqueEmailValues(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const text =
      typeof item === "string"
        ? item
        : item && typeof item === "object" && "email" in item
          ? String((item as { email: unknown }).email ?? "")
          : String(item ?? "");
    for (const part of text.split(/[,;|\s]+/)) {
      const key = canonicalizeEmail(part);
      if (!key.includes("@") || !key.includes(".") || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

function toItems(values: string[]): EmailItem[] {
  return values.map((value, i) => ({ id: `email-${i}-${value}`, value }));
}

/**
 * Email selection — mounted only while open, so the list is seeded once from a
 * unique-d set. Dupes cannot survive as two rows.
 *
 * Selection scopes the dark-web check, it does not say which addresses are the
 * user's. Everything the brokers surfaced stays on the profile and on the
 * report whether it is picked or not; leaving one unselected only keeps it out
 * of Holehe and Leakcheck. Nothing starts selected — running someone's address
 * through a breach check is the kind of thing you opt into.
 */
export function EmailConfirmationModal({
  initialEmails,
  onConfirm,
  onCancel,
  isOpen = true,
}: EmailConfirmationModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const [emails, setEmails] = useState<EmailItem[]>(() => toItems(uniqueEmailValues(initialEmails)));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newEmailInput, setNewEmailInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The limit notice is a reaction to a tap, not a persistent state — leaving
  // it up makes the next tap ambiguous about which one it answered.
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(t);
  }, [error]);

  if (!isOpen) return null;

  const atLimit = selectedIds.length >= MAX_SELECTED;

  const toggleEmail = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((s) => s !== id));
      setError(null);
      return;
    }
    if (atLimit) {
      setError(LIMIT_MESSAGE);
      return;
    }
    setSelectedIds([...selectedIds, id]);
    setError(null);
  };

  const handleAddEmail = () => {
    const added = canonicalizeEmail(newEmailInput);
    if (!added) {
      setError("Email cannot be empty");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(added)) {
      setError("Please enter a valid email address");
      return;
    }
    if (emails.some((e) => canonicalizeEmail(e.value) === added)) {
      setError("This email is already in the list");
      return;
    }
    // A typed-in address is one the user wants checked, so it arrives
    // selected — which means adding a 4th is the same overreach as picking one.
    if (atLimit) {
      setError(LIMIT_MESSAGE);
      return;
    }
    const id = `email-${Date.now()}`;
    setEmails([...emails, { id, value: added }]);
    setSelectedIds([...selectedIds, id]);
    setNewEmailInput("");
    setError(null);
  };

  const handleConfirm = () => {
    const byId = new Map(emails.map((e) => [e.id, e.value]));
    onConfirm(uniqueEmailValues(selectedIds.map((id) => byId.get(id) ?? "")));
  };

  const selectedCount = selectedIds.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-page/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
        className="relative w-full max-w-md rounded-xl border border-border-subtle bg-bg-surface"
      >
        <div className="border-b border-border-subtle px-5 py-5">
          <h2 className="text-[20px] font-semibold leading-tight tracking-tight text-text-primary">
            Choose emails for the dark-web scan
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-text-secondary">
            We&apos;ll search breach databases and leak announcements for the addresses you pick.
          </p>
        </div>

        <div className="max-h-[40vh] overflow-y-auto px-5 py-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
              Select up to {MAX_SELECTED}
            </span>
            <span
              className={cx(
                "text-[13px] font-medium tabular-nums",
                atLimit ? "text-accent-primary" : "text-text-tertiary",
              )}
            >
              {selectedCount} of {MAX_SELECTED}
            </span>
          </div>
          <p className="mb-3 text-[13px] text-text-tertiary">Registered plans include unlimited emails</p>

          {emails.length > 0 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Emails to include">
              {emails.map((email) => {
                const isSelected = selectedIds.includes(email.id);
                return (
                  <button
                    key={email.id}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => toggleEmail(email.id)}
                    className={cx(
                      // Chips size to their content and wrap naturally --
                      // two short emails share a row, a long one takes its
                      // own rather than being forced to fit and cut off.
                      "max-w-full break-words rounded-full px-3.5 py-2 text-left text-[13px] font-medium transition-colors duration-150",
                      "outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                      isSelected
                        ? "bg-accent-primary text-brand-ink"
                        : "border border-border-subtle bg-bg-page text-text-primary hover:bg-bg-surface-secondary",
                      !isSelected && atLimit && "opacity-60",
                    )}
                  >
                    {email.value}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-border-subtle px-4 py-3 text-[14px] text-text-tertiary">
              We didn't find any emails on your broker profiles. Add one below to scan it.
            </p>
          )}
        </div>

        {/* Always visible -- not part of the scrollable email list above. */}
        <div className="border-t border-border-subtle px-5 py-4">
          <label
            htmlFor="add-email"
            className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary"
          >
            Add another email
          </label>
          <div className="flex gap-2">
            <input
              id="add-email"
              type="email"
              value={newEmailInput}
              onChange={(e) => setNewEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddEmail();
              }}
              placeholder="another@email.com"
              className={cx(
                "h-12 flex-1 rounded-lg border px-3 text-[15px]",
                "border-border-subtle bg-bg-page text-text-primary placeholder:text-text-tertiary",
                "outline-none transition-colors duration-150",
                "focus:border-accent-primary focus:ring-1 focus:ring-accent-primary",
              )}
            />
            <button
              type="button"
              onClick={handleAddEmail}
              disabled={!newEmailInput.trim()}
              className={cx(
                "flex h-12 w-12 items-center justify-center rounded-lg font-semibold transition-colors duration-150",
                newEmailInput.trim()
                  ? "bg-accent-primary text-brand-ink hover:bg-accent-hover"
                  : "cursor-not-allowed bg-disabled text-text-tertiary",
              )}
              aria-label="Add email"
            >
              <Plus size={18} />
            </button>
          </div>

          <AnimatePresence>
            {error ? (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="mt-3 rounded-lg border border-warning/40 p-3 text-[14px] text-warning"
                role="alert"
              >
                {error}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="flex gap-3 border-t border-border-subtle px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg border border-border-subtle bg-bg-page px-4 text-[15px] font-semibold text-text-primary transition-colors duration-150 hover:bg-bg-surface-secondary"
          >
            Skip breach scan
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className={cx(
              "inline-flex min-h-12 flex-1 items-center justify-center rounded-lg px-4 text-[15px] font-semibold transition-colors duration-150",
              selectedCount > 0
                ? "bg-accent-primary text-brand-ink hover:bg-accent-hover"
                : "cursor-not-allowed bg-disabled text-text-tertiary",
            )}
          >
            Scan dark web
          </button>
        </div>
      </motion.div>
    </div>
  );
}
