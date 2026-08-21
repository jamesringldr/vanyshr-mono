import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Plus, Mail, Check } from "lucide-react";
import { cx } from "@/utils/cx";

export type EmailConfirmationModalProps = {
  isOpen: boolean;
  initialEmails: string[];
  onConfirm: (emails: string[]) => void;
  onCancel: () => void;
};

type EmailItem = {
  id: string;
  value: string;
  isNew?: boolean;
};

/**
 * Email confirmation modal — shown after profile selection in pilot scan.
 * User can:
 * - Swipe right to edit an email
 * - Swipe left to delete an email
 * - Add new emails manually
 * - Confirm to proceed with Phase 2 using selected emails
 *
 * These confirmed emails are passed to leakcheck and holehe processes.
 */
export function EmailConfirmationModal({
  isOpen,
  initialEmails,
  onConfirm,
  onCancel,
}: EmailConfirmationModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const [emails, setEmails] = useState<EmailItem[]>(
    initialEmails
      .filter((e) => e && e.includes("@"))
      .map((e, i) => ({ id: `email-${i}`, value: e }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newEmailInput, setNewEmailInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // If no emails extracted, start with one empty slot for manual entry
  useEffect(() => {
    if (isOpen && emails.length === 0) {
      setEmails([{ id: "email-new-0", value: "", isNew: true }]);
    }
  }, [isOpen, emails.length]);

  const handleAddEmail = () => {
    if (!newEmailInput.trim()) {
      setError("Email cannot be empty");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(newEmailInput.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    if (emails.some((e) => e.value.toLowerCase() === newEmailInput.trim().toLowerCase())) {
      setError("This email is already in the list");
      return;
    }
    setEmails([
      ...emails,
      { id: `email-${Date.now()}`, value: newEmailInput.trim() },
    ]);
    setNewEmailInput("");
    setError(null);
  };

  const handleStartEdit = (id: string, value: string) => {
    setEditingId(id);
    setEditValue(value);
    setError(null);
  };

  const handleSaveEdit = () => {
    if (!editValue.trim()) {
      setError("Email cannot be empty");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(editValue.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    if (
      emails.some(
        (e) =>
          e.id !== editingId &&
          e.value.toLowerCase() === editValue.trim().toLowerCase()
      )
    ) {
      setError("This email is already in the list");
      return;
    }
    setEmails(emails.map((e) => (e.id === editingId ? { ...e, value: editValue.trim() } : e)));
    setEditingId(null);
    setError(null);
  };

  const handleDeleteEmail = (id: string) => {
    setEmails(emails.filter((e) => e.id !== id));
    setError(null);
  };

  // Drives both the label and the styling: the action is always available,
  // but it should read as "skip" rather than "confirm" when there is nothing
  // to confirm.
  const hasEmails = emails.some((e) => e.value.trim());

  const handleConfirm = () => {
    const filled = emails.filter((e) => e.value.trim());
    const validEmails = filled.filter((e) => /\S+@\S+\.\S+/.test(e.value));

    // Something was typed but none of it parses — that is a genuine mistake and
    // worth blocking on. An EMPTY list is not: some scans legitimately turn up
    // no email at all (Zabasearch masks its addresses at source, so a
    // zaba-only identification has none), and Phase 2 extracts its own from
    // the broker detail pages regardless. Blocking here strands the user with
    // no way forward and no enrichment ever runs.
    if (filled.length > 0 && validEmails.length === 0) {
      setError("That does not look like a valid email address");
      return;
    }

    onConfirm(validEmails.map((e) => e.value));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md rounded-2xl bg-[#1A2E42] shadow-xl"
        >
          {/* Header */}
          <div className="border-b border-[#2A4A68] px-6 py-5">
            <h2 className="text-xl font-bold text-white">Confirm your emails</h2>
            <p className="mt-1 text-sm text-[#7A92A8]">
              Select which emails are yours. We'll check them against data breaches and
              online accounts.
            </p>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
            {/* Email list with swipe actions */}
            <div className="flex flex-col gap-3 mb-4" role="list" aria-label="Emails">
              <AnimatePresence mode="popLayout">
                {emails.map((email) => (
                  <motion.div
                    key={email.id}
                    layout
                    initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="relative group"
                    role="listitem"
                  >
                    {editingId === email.id ? (
                      // Edit mode
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
                      // Display mode with swipe-like actions
                      <div
                        className="flex items-center gap-3 rounded-lg bg-[#022136] px-4 py-3 group-hover:bg-[#0f1f2e] transition"
                      >
                        <Mail size={18} className="shrink-0 text-[#00BFFF]" />
                        <span className="flex-1 text-sm text-white break-all">
                          {email.value || "(empty)"}
                        </span>
                        {/* Swipe-like action buttons - visible on hover, always visible on touch */}
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity sm:flex sm:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(email.id, email.value)}
                            className="px-3 py-1.5 rounded text-xs font-medium bg-[#2A4A68] text-[#00BFFF] hover:bg-[#3A5A78] transition"
                            aria-label={`Edit ${email.value}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEmail(email.id)}
                            className="px-3 py-1.5 rounded text-xs font-medium bg-[#4A2A28] text-[#FF6B6B] hover:bg-[#5A3A38] transition"
                            aria-label={`Delete ${email.value}`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Add email section */}
            <div className="mb-4 pt-2 border-t border-[#2A4A68]">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#7A92A8] mb-2">
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
                    "flex items-center justify-center h-10 w-10 rounded-lg font-semibold transition",
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

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
                  className="p-3 rounded-lg bg-[#4A2A28] text-[#FF8A00] text-sm"
                  role="alert"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="border-t border-[#2A4A68] px-6 py-4 flex gap-3">
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
    </AnimatePresence>
  );
}
