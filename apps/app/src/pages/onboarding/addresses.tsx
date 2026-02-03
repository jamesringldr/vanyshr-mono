import { useState } from "react";
import {
    OnboardingLayout,
    OnboardingDataCard,
    EditInput,
    type OnboardingStep,
    type BadgeStatus,
} from "@vanyshr/ui/components/onboarding";
import { cx } from "@/utils/cx";
import { MapPin } from "lucide-react";

export interface AddressItem {
    id: string;
    address: string;
    status: BadgeStatus;
    isCurrent: boolean;
}

const INITIAL: AddressItem[] = [
    { id: "1", address: "123 Main St, San Francisco, CA", status: "confirmed", isCurrent: true },
    { id: "2", address: "456 Maple Ave, Portland, OR", status: "confirmed", isCurrent: false },
];

function nextId(items: { id: string }[]) {
    const n = items.reduce((acc, i) => Math.max(acc, parseInt(i.id, 10) || 0), 0);
    return String(n + 1);
}

export function OnboardingAddresses() {
    const [items, setItems] = useState<AddressItem[]>(INITIAL);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    const openEdit = (item: AddressItem) => {
        setActiveId(item.id);
        setEditingId(item.id);
        setEditValue(item.address);
    };

    const handleUpdate = (id: string) => {
        setItems((prev) =>
            prev.map((a) =>
                a.id === id ? { ...a, address: editValue.trim() || a.address, status: "confirmed" as BadgeStatus } : a,
            ),
        );
        setEditingId(null);
        setActiveId(null);
    };

    const handleToggleCurrent = (id: string, isCurrent: boolean) => {
        setItems((prev) =>
            prev.map((a) => ({ ...a, isCurrent: a.id === id ? isCurrent : false })),
        );
    };

    const handleDelete = (id: string) => {
        setItems((prev) => prev.filter((a) => a.id !== id));
        if (activeId === id) setActiveId(null);
        setEditingId(null);
    };

    const handleAdd = () => {
        const id = nextId(items);
        const newItem: AddressItem = {
            id,
            address: "",
            status: "pending",
            isCurrent: items.length === 0,
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
            currentStep={"addresses" satisfies OnboardingStep}
            completedSteps={["basic", "phone", "aliases"]}
            title="Addresses"
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
                        No addresses added yet. Add your current and past addresses so we can find and remove them from data broker sites.
                    </p>
                </div>
            )}
            <div className="flex flex-col gap-4">
                {items.map((item) => (
                    <OnboardingDataCard
                        key={item.id}
                        value={item.address}
                        status={item.status}
                        isExpanded={activeId === item.id}
                        isEditing={editingId === item.id}
                        editContent={
                            editingId === item.id ? (
                                <EditInput
                                    id={`addr-${item.id}`}
                                    label="Address"
                                    value={editValue}
                                    onChange={setEditValue}
                                    placeholder="Street, City, State"
                                    icon={MapPin}
                                />
                            ) : undefined
                        }
                        onClick={() =>
                            activeId === item.id ? setActiveId(null) : openEdit(item)
                        }
                        onConfirmAndContinue={() => handleUpdate(item.id)}
                        toggleLabel="Current Address"
                        toggleValue={item.isCurrent}
                        onToggleChange={(v) => handleToggleCurrent(item.id, v)}
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
                Add Address
            </button>
        </OnboardingLayout>
    );
}
