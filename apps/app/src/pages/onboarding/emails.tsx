import { useState } from "react";
import {
    OnboardingLayout,
    OnboardingDataCard,
    EditInput,
    type OnboardingStep,
    type BadgeStatus,
} from "@vanyshr/ui/components/onboarding";
import { cx } from "@/utils/cx";
import { Mail } from "lucide-react";

export interface EmailItem {
    id: string;
    email: string;
    status: BadgeStatus;
    isPrimary: boolean;
}

const INITIAL: EmailItem[] = [
    { id: "1", email: "dev@example.com", status: "confirmed", isPrimary: true },
    { id: "2", email: "tester@vanyshr.com", status: "confirmed", isPrimary: false },
];

function nextId(items: { id: string }[]) {
    const n = items.reduce((acc, i) => Math.max(acc, parseInt(i.id, 10) || 0), 0);
    return String(n + 1);
}

export function OnboardingEmails() {
    const [items, setItems] = useState<EmailItem[]>(INITIAL);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    const openEdit = (item: EmailItem) => {
        setActiveId(item.id);
        setEditingId(item.id);
        setEditValue(item.email);
    };

    const handleUpdate = (id: string) => {
        setItems((prev) =>
            prev.map((e) =>
                e.id === id ? { ...e, email: editValue.trim() || e.email, status: "confirmed" as BadgeStatus } : e,
            ),
        );
        setEditingId(null);
        setActiveId(null);
    };

    const handleTogglePrimary = (id: string, isPrimary: boolean) => {
        setItems((prev) =>
            prev.map((e) => ({ ...e, isPrimary: e.id === id ? isPrimary : false })),
        );
    };

    const handleDelete = (id: string) => {
        setItems((prev) => prev.filter((e) => e.id !== id));
        if (activeId === id) setActiveId(null);
        setEditingId(null);
    };

    const handleAdd = () => {
        const id = nextId(items);
        const newItem: EmailItem = {
            id,
            email: "",
            status: "pending",
            isPrimary: items.length === 0,
        };
        setItems((prev) => [...prev, newItem]);
        setActiveId(id);
        setEditingId(id);
        setEditValue("");
    };

    const handleFinishSetup = () => {
        setActiveId(null);
        setEditingId(null);
        // TODO: complete onboarding, navigate to dashboard
    };

    return (
        <OnboardingLayout
            currentStep={"emails" satisfies OnboardingStep}
            completedSteps={["basic", "phone", "aliases", "addresses"]}
            title="Emails"
            footer={
                <button
                    type="button"
                    onClick={handleFinishSetup}
                    className={cx(
                        "flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold text-white outline-none transition",
                        "bg-[#00BFFF] hover:bg-[#0E9AE8]",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                    )}
                >
                    Finish Setup
                </button>
            }
        >
            {items.length === 0 && (
                <div
                    className={cx(
                        "rounded-xl border p-6 text-center",
                        "bg-[var(--bg-surface)] dark:bg-[#2A2A3F]",
                        "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                    )}
                >
                    <p className="text-sm text-[var(--text-secondary)] dark:text-[#B8C4CC] mb-4">
                        No email addresses added yet. Add your email addresses so we can find and remove them from data broker sites.
                    </p>
                </div>
            )}
            <div className="flex flex-col gap-4">
                {items.map((item) => (
                    <OnboardingDataCard
                        key={item.id}
                        value={item.email}
                        status={item.status}
                        isExpanded={activeId === item.id}
                        isEditing={editingId === item.id}
                        editContent={
                            editingId === item.id ? (
                                <EditInput
                                    id={`email-${item.id}`}
                                    label="Email address"
                                    value={editValue}
                                    onChange={setEditValue}
                                    placeholder="you@example.com"
                                    type="email"
                                    icon={Mail}
                                />
                            ) : undefined
                        }
                        onClick={() =>
                            activeId === item.id ? setActiveId(null) : openEdit(item)
                        }
                        onConfirmAndContinue={() => handleUpdate(item.id)}
                        toggleLabel="Primary"
                        toggleValue={item.isPrimary}
                        onToggleChange={(v) => handleTogglePrimary(item.id, v)}
                        showDelete
                        onDelete={() => handleDelete(item.id)}
                    />
                ))}
            </div>
            <button
                type="button"
                onClick={handleAdd}
                className={cx(
                    "mt-2 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-semibold outline-none transition",
                    "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                    "text-[#022136] dark:text-white",
                    "hover:bg-[#F0F4F8]/50 dark:hover:bg-[#022136]/30",
                    "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2",
                )}
            >
                Add Email
            </button>
        </OnboardingLayout>
    );
}
