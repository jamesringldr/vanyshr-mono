import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
    OnboardingLayout,
    OnboardingDataCard,
    type OnboardingStep,
    type BadgeStatus,
} from "@vanyshr/ui/components/onboarding";
import { cx } from "@/utils/cx";
import { User, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PrimaryInfoField {
    id: string;
    label: string;
    value: string;
    status: BadgeStatus;
}

/** Capitalize first letter of each word */
function toProperCase(str: string): string {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Auto-format a DOB input to MM/DD/YYYY as digits are typed */
function formatDobInput(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Convert ISO date (YYYY-MM-DD) to MM/DD/YYYY for display */
function formatDateDisplay(iso: string): string {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${m}/${d}/${y}`;
}

/** Convert MM/DD/YYYY to YYYY-MM-DD for storage */
function convertInputToIso(input: string): string {
    if (!input) return "";
    const parts = input.split("/");
    if (parts.length !== 3) return input;
    const [m, d, y] = parts;
    if (!m || !d || !y) return input;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

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
    const [fields, setFields] = useState<PrimaryInfoField[]>([]);
    // DOB defaults expanded since it's empty/required on first load
    const [activeId, setActiveId] = useState<string | null>("dateOfBirth");
    const [editingFieldId, setEditingFieldId] = useState<string | null>("dateOfBirth");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Per-field edit buffers
    const [editFirstName, setEditFirstName] = useState("");
    const [editLastName, setEditLastName] = useState("");
    const [editDob, setEditDob] = useState("");

    const navigate = useNavigate();

    // -----------------------------------------------------------------------
    // Load from DB
    // -----------------------------------------------------------------------
    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setIsLoading(false); return; }

            const { data: profile } = await supabase
                .from("user_profiles")
                .select("first_name, last_name, date_of_birth")
                .eq("auth_user_id", user.id)
                .single();

            if (profile) {
                const hasDob = !!profile.date_of_birth;
                setFields([
                    {
                        id: "legalName",
                        label: "LEGAL NAME",
                        value: toProperCase([profile.first_name, profile.last_name].filter(Boolean).join(" ")),
                        status: "pending",
                    },
                    {
                        id: "dateOfBirth",
                        label: "DATE OF BIRTH",
                        value: profile.date_of_birth ?? "",
                        status: hasDob ? "pending" : "recommended",
                    },
                ]);

                // If DOB is already filled, start with it expanded for confirmation;
                // otherwise default to legalName expanded
                if (hasDob) {
                    setActiveId("dateOfBirth");
                    setEditingFieldId("dateOfBirth");
                    // Convert YYYY-MM-DD to MM/DD/YYYY for editing
                    setEditDob(formatDateDisplay(profile.date_of_birth ?? ""));
                } else {
                    setActiveId("dateOfBirth");
                    setEditingFieldId("dateOfBirth");
                }
            }
            setIsLoading(false);
        }
        load();
    }, []);

    // -----------------------------------------------------------------------
    // Save to DB
    // -----------------------------------------------------------------------
    async function saveToDb(firstName: string, lastName: string, dob: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
            .from("user_profiles")
            .update({
                first_name:    firstName,
                last_name:     lastName,
                date_of_birth: dob || null,
                onboarding_step: 1,
            })
            .eq("auth_user_id", user.id);
    }

    // -----------------------------------------------------------------------
    // Field interaction helpers
    // -----------------------------------------------------------------------
    const openEdit = (field: PrimaryInfoField) => {
        setActiveId(field.id);
        setEditingFieldId(field.id);
        if (field.id === "legalName") {
            const parts = field.value.trim().split(/\s+/);
            setEditFirstName(parts[0] ?? "");
            setEditLastName(parts.slice(1).join(" ") ?? "");
        } else if (field.id === "dateOfBirth") {
            // Convert YYYY-MM-DD to MM/DD/YYYY for editing
            setEditDob(formatDateDisplay(field.value));
        }
    };

    const saveAndConfirm = (id: string) => {
        let updated: PrimaryInfoField[];

        if (id === "legalName") {
            const fullName = [toProperCase(editFirstName.trim()), toProperCase(editLastName.trim())]
                .filter(Boolean)
                .join(" ");
            updated = fields.map((f) =>
                f.id === "legalName"
                    ? { ...f, value: fullName || f.value, status: "confirmed" as BadgeStatus }
                    : f,
            );
        } else {
            // Convert MM/DD/YYYY input back to YYYY-MM-DD for storage
            const isoDate = convertInputToIso(editDob.trim());
            updated = fields.map((f) =>
                f.id === id
                    ? { ...f, value: isoDate || f.value, status: "confirmed" as BadgeStatus }
                    : f,
            );
        }

        setFields(updated);
        setEditingFieldId(null);

        const currentIndex = updated.findIndex((f) => f.id === id);
        const nextPending = updated.find((f, i) => i > currentIndex && f.status !== "confirmed");
        setActiveId(nextPending?.id ?? null);
    };

    const handleConfirmAndContinuePage = async () => {
        setIsSaving(true);

        const nameField = fields.find((f) => f.id === "legalName");
        const dobField  = fields.find((f) => f.id === "dateOfBirth");

        const nameParts  = (nameField?.value ?? "").trim().split(/\s+/);
        const firstName  = nameParts[0] ?? "";
        const lastName   = nameParts.slice(1).join(" ") ?? "";
        const dob        = dobField?.value ?? "";

        // Mark all confirmed
        setFields((prev) => prev.map((f) => ({ ...f, status: "confirmed" as BadgeStatus })));
        setActiveId(null);
        setEditingFieldId(null);

        await saveToDb(firstName, lastName, dob);
        setIsSaving(false);
        navigate("/onboarding/phone-numbers");
    };

    if (isLoading) {
        return (
            <OnboardingLayout
                currentStep={"basic" satisfies OnboardingStep}
                completedSteps={[]}
                title="Verify Primary Info"
                subtitle="Click on Field to Edit"
                onDashboardNavigate={() => navigate("/scanning-started")}
                footer={null}
            >
                <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 rounded-full border-2 border-[#00BFFF] border-t-transparent animate-spin" />
                </div>
            </OnboardingLayout>
        );
    }

    return (
        <OnboardingLayout
            currentStep={"basic" satisfies OnboardingStep}
            completedSteps={[]}
            title="Verify Primary Info"
            subtitle="Click on Field to Edit"
            onDashboardNavigate={() => navigate("/scanning-started")}
            footer={
                <button
                    type="button"
                    onClick={handleConfirmAndContinuePage}
                    disabled={isSaving}
                    className={cx(
                        "flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold text-white outline-none transition",
                        "bg-[#00BFFF] hover:bg-[#0E9AE8]",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                        isSaving && "opacity-60 cursor-not-allowed",
                    )}
                >
                    {isSaving ? "Saving..." : "Confirm & Continue"}
                </button>
            }
        >
            <div className="flex flex-col gap-4">
                {fields.map((field) => (
                    <div key={field.id} className="flex flex-col gap-2">
                        <OnboardingDataCard
                            label={field.label}
                            value={field.value}
                            displayValue={
                                field.id === "dateOfBirth" && field.value
                                    ? formatDateDisplay(field.value)
                                    : undefined
                            }
                            status={field.status}
                            hideStatus={field.id === "legalName"}
                            isExpanded={activeId === field.id}
                            isEditing={editingFieldId === field.id}
                            editContent={
                                editingFieldId === field.id ? (
                                    field.id === "legalName" ? (
                                        <>
                                            <EditInput
                                                id="edit-first-name"
                                                label="First Name"
                                                value={editFirstName}
                                                onChange={setEditFirstName}
                                                placeholder="First name"
                                                icon={User}
                                            />
                                            <EditInput
                                                id="edit-last-name"
                                                label="Last Name"
                                                value={editLastName}
                                                onChange={setEditLastName}
                                                placeholder="Last name"
                                                icon={User}
                                            />
                                        </>
                                    ) : (
                                        <EditInput
                                            id="edit-dob"
                                            label="Date of Birth"
                                            value={editDob}
                                            onChange={(v) => setEditDob(formatDobInput(v))}
                                            placeholder="MM/DD/YYYY"
                                            type="text"
                                            icon={Calendar}
                                        />
                                    )
                                ) : undefined
                            }
                            onClick={() =>
                                activeId === field.id ? setActiveId(null) : openEdit(field)
                            }
                            onConfirmAndContinue={() => saveAndConfirm(field.id)}
                        />
                        {field.id === "dateOfBirth" && (
                            <div className={cx(
                                "rounded-xl px-4 py-3",
                                "bg-[#00BFFF]/10 dark:bg-[#00BFFF]/10",
                                "border border-[#00BFFF]/25 dark:border-[#00BFFF]/20",
                            )}>
                                <p className="text-xs leading-relaxed text-[#0099CC] dark:text-[#00BFFF] text-center">
                                    Your search profile data is securely encrypted and is{" "}
                                    <strong className="text-white">NEVER used, shared, or sold for marketing purposes.</strong>
                                    <br />
                                    Not even by us!
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </OnboardingLayout>
    );
}
