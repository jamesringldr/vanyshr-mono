import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sheet } from "konsta/react";
import { Check, Plus, ThumbsUp } from "lucide-react";
import { qsModal } from "@vanyshr/ui/components/application/qs-result-modals/qs-modal";
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
 * Email selection — a bottom drawer (Konsta Sheet), mounted only while the
 * step is active, so the list is seeded once from a unique-d set. Dupes cannot survive as two rows.
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
  // Emails the scan surfaced — fixed at open, so addresses the user types in don't count as "found".
  const [foundCount] = useState(() => uniqueEmailValues(initialEmails).length);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newEmailInput, setNewEmailInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Konsta's Sheet only slides when `opened` flips, so it mounts closed and opens a frame later.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  // The limit notice is a reaction to a tap, not a persistent state — leaving
  // it up makes the next tap ambiguous about which one it answered.
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(t);
  }, [error]);

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

  // The add button stays off until the input is shaped like an email (same test handleAddEmail applies).
  const canAdd = /\S+@\S+\.\S+/.test(canonicalizeEmail(newEmailInput));

  const selectedCount = selectedIds.length;
  const noneFound = foundCount === 0;

  // Selected (and newly added, which arrive selected) emails float to the top in the order they
  // were picked; unselected ones keep their original order, so a deselected email drops back to
  // where it started.
  const byId = new Map(emails.map((e) => [e.id, e]));
  const orderedEmails = [
    ...selectedIds.map((id) => byId.get(id)).filter((e): e is EmailItem => e !== undefined),
    ...emails.filter((e) => !selectedIds.includes(e.id)),
  ];

  return createPortal(
    <Sheet
      opened={isOpen && mounted}
      role="dialog"
      aria-modal="true"
      aria-label="Dark Web Scan"
      aria-hidden={!isOpen}
      inert={!isOpen}
      // No backdrop dismiss: leaving is a choice (Skip breach scan), same as the modal this replaces.
      className="flex max-h-9/10 flex-col rounded-t-lg! shadow-xl motion-reduce:transition-none"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6">
        <h2 className="m-0 text-xl font-semibold tracking-tight text-text-primary">Dark Web Scan</h2>
        <p className="m-0 mt-1 text-md text-text-secondary">
          Select emails to scan billions of records from dark web breach databases for credential &amp; account leaks
        </p>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-text-primary">
            {noneFound ? "Add" : "Include"} up to {MAX_SELECTED} emails
          </span>
          <span className="text-sm font-medium tabular-nums text-text-primary">
            {selectedCount} of {MAX_SELECTED}
          </span>
        </div>

        {emails.length > 0 ? (
          <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0" role="group" aria-label="Emails to include">
            {orderedEmails.map((email) => {
              const isSelected = selectedIds.includes(email.id);
              return (
                <motion.li
                  key={email.id}
                  layout={!prefersReducedMotion}
                  transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => toggleEmail(email.id)}
                    className={cx(
                      "flex min-h-14 w-full items-center gap-3 rounded-lg border-2 bg-bg-elevated px-4 py-3 text-left text-md font-medium transition-colors duration-fast",
                      "outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
                      isSelected ? "border-primary text-text-primary" : "border-border text-text-secondary",
                      !isSelected && atLimit && "opacity-60",
                    )}
                  >
                    <span className="min-w-0 flex-1 break-all">{email.value}</span>
                    <span
                      className={cx(
                        "flex size-6 shrink-0 items-center justify-center rounded-full",
                        isSelected ? "bg-primary text-primary-on" : "border-2 border-border-strong",
                      )}
                      aria-hidden
                    >
                      {isSelected && <Check className="size-4" strokeWidth={3} />}
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center px-4 py-3 text-center">
            <ThumbsUp className="size-8 text-status-success" aria-hidden="true" />
            <p className="m-0 mt-2 text-md font-bold text-text-primary">
              Great News! Our scan didn&apos;t find any of your emails
            </p>
            <p className="m-0 mt-1 text-sm text-text-secondary">Add emails for the dark web scan</p>
          </div>
        )}

      </div>

      {/* Pinned: the add-email field and the two actions stay in view while the list scrolls. */}
      <div className="shrink-0 border-t border-border-subtle px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <label
          htmlFor="add-email"
          className="mb-2 block text-xs font-medium uppercase tracking-widest text-text-secondary"
        >
          {noneFound ? "Add Email" : "Add another email"}
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
              // 16px like the find-my-data drawer inputs — iOS Safari zooms in on focus below 16px.
              "h-11 min-w-0 flex-1 rounded-md border px-3 text-[16px]",
              "border-border bg-bg-elevated text-text-primary placeholder:text-text-tertiary",
              "outline-none transition-colors duration-fast",
              "focus:border-border-focus focus-visible:ring-2 focus-visible:ring-border-focus",
            )}
          />
          <button
            type="button"
            onClick={handleAddEmail}
            disabled={!canAdd}
            className={cx(
              "flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-fast",
              "outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
              canAdd
                ? "bg-primary text-primary-on hover:bg-primary-hover"
                : "cursor-not-allowed bg-state-disabled-bg text-state-disabled-fg",
            )}
            aria-label="Add email"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>

        <AnimatePresence>
          {error ? (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="mt-3 rounded-md border border-status-danger-border bg-status-danger-muted p-3 text-sm text-status-danger"
              role="alert"
            >
              {error}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onCancel} className={cx(qsModal.secondaryBtn, "flex-1 whitespace-nowrap px-3")}>
            Skip breach scan
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className={cx(qsModal.primaryBtn, "flex-1 whitespace-nowrap px-3")}
          >
            Scan dark web
          </button>
        </div>
      </div>
    </Sheet>,
    document.body,
  );
}
