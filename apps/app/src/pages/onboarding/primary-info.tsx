import { useState } from "react";
import {
    OnboardingLayout,
    OnboardingDataCard,
    type OnboardingStep,
    type BadgeStatus,
} from "@vanyshr/ui/components/onboarding";
import { cx } from "@/utils/cx";
import { User } from "lucide-react";

interface PrimaryInfoField {
    id: string;
    label: string;
    value: string;
    status: BadgeStatus;
    firstName?: string;
    lastName?: string;
}

function parseLegalName(value: string): { firstName: string; lastName: string } {
    const parts = value.trim().split(/\s+/);
    if (parts.length >= 2) {
        return {
            firstName: parts[0] ?? "",
            lastName: parts.slice(1).join(" ") ?? "",
        };
    }
    return { firstName: value.trim(), lastName: "" };
}

const INITIAL_FIELDS: PrimaryInfoField[] = [
    {
        id: "legalName",
        label: "LEGAL NAME",
        value: "James Oehring",
        status: "pending",
        ...parseLegalName("James Oehring"),
    },
    { id: "age", label: "AGE", value: "35", status: "pending" },
    { id: "primaryMobile", label: "PRIMARY MOBILE", value: "(816) 225-8592", status: "pending" },
    {
        id: "primaryResidence",
        label: "CURRENT RESIDENCE",
        value: "123 Main St, KC, MO",
        status: "pending",
    },
    {
        id: "primaryEmail",
        label: "PRIMARY EMAIL",
        value: "james@example.com",
        status: "pending",
    },
];

/** Vanyshr input: h-[52px], rounded-xl, split opacity bg, optional icon left. */
function EditInput({
    id,
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    icon: Icon,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    icon?: React.ElementType;
}) {
    return (
        <div className="space-y-1.5">
            <label
                htmlFor={id}
                className="block text-sm font-medium text-[#022136] dark:text-white"
            >
                {label}
            </label>
            <div className="relative">
                {Icon && (
                    <Icon
                        className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)] dark:text-[#7A92A8] pointer-events-none"
                        aria-hidden
                    />
                )}
                <input
                    id={id}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={cx(
                        "h-[52px] w-full rounded-xl border py-3 text-sm outline-none transition",
                        "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
                        "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                        "text-[#022136] dark:text-white placeholder:text-[var(--text-muted)] dark:placeholder:text-[#7A92A8]",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                        Icon ? "pl-12 pr-4" : "px-4",
                    )}
                />
            </div>
        </div>
    );
}

export function VerifyPrimaryInfo() {
    const [fields, setFields] = useState<PrimaryInfoField[]>(INITIAL_FIELDS);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

    const [editFirstName, setEditFirstName] = useState("");
    const [editLastName, setEditLastName] = useState("");
    const [editValue, setEditValue] = useState("");

    const openEdit = (field: PrimaryInfoField) => {
        setActiveId(field.id);
        setEditingFieldId(field.id);
        if (field.id === "legalName") {
            setEditFirstName(field.firstName ?? parseLegalName(field.value).firstName);
            setEditLastName(field.lastName ?? parseLegalName(field.value).lastName);
        } else {
            setEditValue(field.value);
        }
    };

    const closeEdit = () => {
        setEditingFieldId(null);
    };

    const saveAndConfirm = (id: string) => {
        const field = fields.find((f) => f.id === id);
        if (!field) return;

        const isCurrentlyEditing = editingFieldId === id;
        let updated: PrimaryInfoField[];

        if (isCurrentlyEditing) {
            if (id === "legalName") {
                const fullName = [editFirstName.trim(), editLastName.trim()].filter(Boolean).join(" ");
                updated = fields.map((f) =>
                    f.id === "legalName"
                        ? {
                              ...f,
                              value: fullName || f.value,
                              firstName: editFirstName.trim(),
                              lastName: editLastName.trim(),
                              status: "confirmed" as BadgeStatus,
                          }
                        : f,
                );
            } else {
                updated = fields.map((f) =>
                    f.id === id
                        ? { ...f, value: editValue.trim() || f.value, status: "confirmed" as BadgeStatus }
                        : f,
                );
            }
            closeEdit();
        } else {
            updated = fields.map((f) =>
                f.id === id ? { ...f, status: "confirmed" as BadgeStatus } : f,
            );
        }

        setFields(updated);
        const currentIndex = updated.findIndex((f) => f.id === id);
        const nextPending = updated.find(
            (f, i) => i > currentIndex && f.status !== "confirmed",
        );
        setActiveId(nextPending?.id ?? null);
    };

    const handleConfirmAndContinue = (id: string) => {
        saveAndConfirm(id);
    };

    const handleEdit = (id: string) => {
        const field = fields.find((f) => f.id === id);
        if (field) openEdit(field);
    };

    const handleConfirmAndContinuePage = () => {
        setFields((prev) =>
            prev.map((f) => ({ ...f, status: "confirmed" as BadgeStatus })),
        );
        setActiveId(null);
        setEditingFieldId(null);
        // TODO: navigate to next step when routing is wired (e.g. onContinue?.())
    };

    return (
        <OnboardingLayout
            currentStep={"basic" satisfies OnboardingStep}
            completedSteps={[]}
            title="Verify Primary Info"
            footer={
                <button
                    type="button"
                    onClick={handleConfirmAndContinuePage}
                    className={cx(
                        "flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold text-white outline-none transition",
                        "bg-[#00BFFF] hover:bg-[#0E9AE8]",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                    )}
                >
                    Confirm & Continue
                </button>
            }
        >
            <div className="flex flex-col gap-4">
                {fields.map((field) => (
                    <OnboardingDataCard
                        key={field.id}
                        label={field.label}
                        value={field.value}
                        status={field.status}
                        isExpanded={activeId === field.id}
                        isEditing={editingFieldId === field.id}
                        editContent={
                            editingFieldId === field.id ? (
                                field.id === "legalName" ? (
                                    <>
                                        <EditInput
                                            id={`${field.id}-first`}
                                            label="First Name"
                                            value={editFirstName}
                                            onChange={setEditFirstName}
                                            placeholder="First name"
                                            icon={User}
                                        />
                                        <EditInput
                                            id={`${field.id}-last`}
                                            label="Last Name"
                                            value={editLastName}
                                            onChange={setEditLastName}
                                            placeholder="Last name"
                                            icon={User}
                                        />
                                    </>
                                ) : (
                                    <EditInput
                                        id={`${field.id}-value`}
                                        label={field.label.replace(/_/g, " ")}
                                        value={editValue}
                                        onChange={setEditValue}
                                        placeholder={field.label.replace(/_/g, " ")}
                                        type={field.id === "primaryEmail" ? "email" : "text"}
                                    />
                                )
                            ) : undefined
                        }
                        onClick={() =>
                            activeId === field.id
                                ? setActiveId(null)
                                : handleEdit(field.id)
                        }
                        onConfirmAndContinue={() => handleConfirmAndContinue(field.id)}
                    />
                ))}
            </div>
        </OnboardingLayout>
    );
}
