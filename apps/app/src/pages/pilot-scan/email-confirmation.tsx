import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X, Plus, Mail, Check } from "lucide-react";
import { cx } from "@/utils/cx";

export type EmailConfirmationModalProps = {
  initialEmails: string[];
  onConfirm: (emails: string[]) => void;
  onCancel: () => void;
};

type EmailItem = {
  id: string;
  value: string;
  isNew?: boolean;
};

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
  if (values.length === 0) return [{ id: "email-new-0", value: "", isNew: true }];
  return values.map((value, i) => ({ id: `email-${i}-${value}`, value }));
}

/**
 * Email confirmation — mounted only while open, so the list is seeded once
 * from a unique-d set. Dupes cannot survive as two rows.
 */
export function EmailConfirmationModal({
  initialEmails,
  onConfirm,
  onCancel,
}: EmailConfirmationModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const [emails, setEmails] = useState<EmailItem[]>(() => toItems(uniqueEmailValues(initialEmails)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newEmailInput, setNewEmailInput] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    setEmails([...emails.filter((e) => e.value.trim()), { id: `email-${Date.now()}`, value: added }]);
    setNewEmailInput("");
    setError(null);
  };

  const handleStartEdit = (id: string, value: string) => {
    setEditingId(id);
    setEditValue(value);
    setError(null);
  };

  const handleSaveEdit = () => {
    const edited = canonicalizeEmail(editValue);
    if (!edited) {
      setError("Email cannot be empty");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(edited)) {
      setError("Please enter a valid email address");
      return;
    }
    if (emails.some((e) => e.id !== editingId && canonicalizeEmail(e.value) === edited)) {
      setError("This email is already in the list");
      return;
    }
    setEmails(emails.map((e) => (e.id === editingId ? { ...e, value: edited } : e)));
    setEditingId(null);
    setError(null);
  };

  const handleDeleteEmail = (id: string) => {
    const next = emails.filter((e) => e.id !== id);
    setEmails(next.length ? next : [{ id: "email-new-0", value: "", isNew: true }]);
    setError(null);
  };

  const visibleEmails = toItems(uniqueEmailValues(emails.map((e) => e.value)));
  const hasEmails = visibleEmails.some((e) => e.value.trim());

  const handleConfirm = () => {
    const validEmails = uniqueEmailValues(emails.map((e) => e.value));
    onConfirm(validEmails);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-2xl bg-[#1A2E42] shadow-xl"
      >
        <div className="border-b border-[#2A4A68] px-6 py-5">
          <h2 className="text-xl font-bold text-white">Confirm your emails</h2>
          <p className="mt-1 text-sm text-[#7A92A8]">
            These came off your full broker profiles. Remove any that aren't yours, or
            continue if none were found.
          </p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          <div className="mb-4 flex flex-col gap-3" role="list" aria-label="Emails">
            {visibleEmails.map((email) => (
              <div key={email.id} className="relative group" role="listitem">
                {editingId === email.id ? (
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className={cx(
                        "flex-1 rounded-lg border px-3 py-2.5",
                        "bg-[#022136] text-white placeholder-[#7A92A8]",
                        "border-[#2A4A68] outline-none transition",
                        "focus:ring-2 focus:ring-[#00BFFF]",
                      )}
                      placeholder="user@example.com"
                    />
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00BFFF] text-[#022136] font-semibold hover:bg-[#00D4FF] transition"
                      aria-label="Save email"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2A4A68] text-[#B8C4CC] hover:bg-[#3A5A78] transition"
                      aria-label="Cancel edit"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg bg-[#022136] px-4 py-3 group-hover:bg-[#0f1f2e] transition">
                    <Mail size={18} className="shrink-0 text-[#00BFFF]" />
                    <span className="flex-1 break-all text-sm text-white">
                      {email.value || "(empty)"}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(email.id, email.value)}
                        className="rounded px-3 py-1.5 text-xs font-medium bg-[#2A4A68] text-[#00BFFF] hover:bg-[#3A5A78] transition"
                        aria-label={`Edit ${email.value}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEmail(email.id)}
                        className="rounded px-3 py-1.5 text-xs font-medium bg-[#4A2A28] text-[#FF6B6B] hover:bg-[#5A3A38] transition"
                        aria-label={`Delete ${email.value}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mb-4 border-t border-[#2A4A68] pt-2">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#7A92A8]">
              Add more emails
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddEmail();
                }}
                placeholder="another@email.com"
                className={cx(
                  "flex-1 rounded-lg border px-3 py-2.5 text-sm",
                  "bg-[#022136] text-white placeholder-[#7A92A8]",
                  "border-[#2A4A68] outline-none transition",
                  "focus:ring-2 focus:ring-[#00BFFF]",
                )}
              />
              <button
                type="button"
                onClick={handleAddEmail}
                disabled={!newEmailInput.trim()}
                className={cx(
                  "flex h-10 w-10 items-center justify-center rounded-lg font-semibold transition",
                  newEmailInput.trim()
                    ? "bg-[#00BFFF] text-[#022136] hover:bg-[#00D4FF]"
                    : "bg-[#2A4A68] text-[#7A92A8] cursor-not-allowed",
                )}
                aria-label="Add email"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-[#4A2A28] p-3 text-sm text-[#FF8A00]" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-[#2A4A68] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[#2A4A68] py-2.5 font-semibold text-[#B8C4CC] hover:bg-[#022136] transition"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={cx(
              "flex-1 rounded-lg py-2.5 font-semibold transition",
              hasEmails
                ? "bg-[#00BFFF] text-[#022136] hover:bg-[#00D4FF]"
                : "bg-[#1B4A63] text-[#9FD9F5] hover:bg-[#1F5678]",
            )}
          >
            {hasEmails ? "Confirm emails" : "Continue without emails"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
