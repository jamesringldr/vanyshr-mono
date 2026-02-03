import { useState } from "react";
import {
    OnboardingLayout,
    OnboardingDataCard,
    EditInput,
    type OnboardingStep,
    type BadgeStatus,
} from "@vanyshr/ui/components/onboarding";
import { cx } from "@/utils/cx";
import { Phone } from "lucide-react";

export interface PhoneNumberItem {
    id: string;
    number: string;
    status: BadgeStatus;
    isPrimary: boolean;
}

const INITIAL: PhoneNumberItem[] = [
    { id: "1", number: "+1 (555) 123-4567", status: "confirmed", isPrimary: true },
    { id: "2", number: "+1 (415) 555-0199", status: "confirmed", isPrimary: false },
];

function nextId(items: { id: string }[]) {
    const n = items.reduce((acc, i) => Math.max(acc, parseInt(i.id, 10) || 0), 0);
    return String(n + 1);
}

export function OnboardingPhoneNumbers() {
    const [items, setItems] = useState<PhoneNumberItem[]>(INITIAL);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    const openEdit = (item: PhoneNumberItem) => {
        setActiveId(item.id);
        setEditingId(item.id);
        setEditValue(item.number);
    };

    const handleUpdate = (id: string) => {
        setItems((prev) =>
            prev.map((p) =>
                p.id === id ? { ...p, number: editValue.trim() || p.number, status: "confirmed" as BadgeStatus } : p,
            ),
        );
        setEditingId(null);
        setActiveId(null);
    };

    const handleTogglePrimary = (id: string, isPrimary: boolean) => {
        setItems((prev) =>
            prev.map((p) => ({ ...p, isPrimary: p.id === id ? isPrimary : false })),
        );
    };

    const handleDelete = (id: string) => {
        setItems((prev) => prev.filter((p) => p.id !== id));
        if (activeId === id) setActiveId(null);
        setEditingId(null);
    };

    const handleAdd = () => {
        const id = nextId(items);
        const newItem: PhoneNumberItem = {
            id,
            number: "",
            status: "pending",
            isPrimary: items.length === 0,
        };
        setItems((prev) => [...prev, newItem]);
        setActiveId(id);
        setEditingId(id);
        setEditValue("");
    };

    const handleConfirmAndContinue = () => {
        setActiveId(null);
        setEditingId(null);
        // TODO: navigate to next step
    };

    return (
        <OnboardingLayout
            currentStep={"phone" satisfies OnboardingStep}
            completedSteps={["basic"]}
            title="Phone Numbers"
            footer={
                <button
                    type="button"
                    onClick={handleConfirmAndContinue}
                    className={cx(
                        "flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold text-white outline-none transition",
                        "bg-[#14ABFE] hover:bg-[#0E9AE8]",
                        "focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                    )}
                >
                    Confirm & Continue
                </button>
            }
        >
            {items.length === 0 && (
                <div
                    className={cx(
                        "rounded-xl border p-6 text-center",
                        "bg-[var(--bg-surface)] dark:bg-[#0F2D45]",
                        "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                    )}
                >
                    <p className="text-sm text-[var(--text-secondary)] dark:text-[#A8BFD4] mb-4">
                        No phone numbers added yet. Add your phone numbers so we can find and remove them from data broker sites.
                    </p>
                </div>
            )}
            <div className="flex flex-col gap-4">
                {items.map((item) => (
                    <OnboardingDataCard
                        key={item.id}
                        value={item.number}
                        status={item.status}
                        isExpanded={activeId === item.id}
                        isEditing={editingId === item.id}
                        editContent={
                            editingId === item.id ? (
                                <EditInput
                                    id={`phone-${item.id}`}
                                    label="Phone number"
                                    value={editValue}
                                    onChange={setEditValue}
                                    placeholder="+1 (555) 000-0000"
                                    icon={Phone}
                                />
                            ) : undefined
                        }
                        onClick={() =>
                            activeId === item.id ? setActiveId(null) : openEdit(item)
                        }
                        onConfirmAndContinue={() => handleUpdate(item.id)}
                        toggleLabel="Primary Mobile"
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
                    "focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2",
                )}
            >
                Add Phone Number
            </button>
        </OnboardingLayout>
    );
}
