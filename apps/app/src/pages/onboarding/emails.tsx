import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
    OnboardingLayout,
    OnboardingDataCard,
    EditInput,
    type OnboardingStep,
    type BadgeStatus,
} from "@vanyshr/ui/components/onboarding";
import { cx } from "@/utils/cx";
import { Mail, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface EmailItem {
    id: string;
    email: string;
    status: BadgeStatus;
    isPrimary: boolean;
    isAuthEmail?: boolean; // auth email — cannot be deleted
    isNew?: boolean;
}

export function OnboardingEmails() {
    const [items, setItems] = useState<EmailItem[]>([]);
    const [profileId, setProfileId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

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
                .select("id, email")
                .eq("auth_user_id", user.id)
                .single();

            if (!profile) { setIsLoading(false); return; }
            setProfileId(profile.id);

            const { data: emails } = await supabase
                .from("user_emails")
                .select("id, email, is_primary, user_confirmed_status, source")
                .eq("user_id", profile.id)
                .eq("is_active", true)
                .order("is_primary", { ascending: false });

            if (emails) {
                setItems(emails.map((e) => ({
                    id:           e.id,
                    email:        e.email,
                    isPrimary:    e.is_primary,
                    isAuthEmail:  e.source === "auth",
                    status:       e.user_confirmed_status === "confirmed" ? "confirmed" : "pending" as BadgeStatus,
                })));
            }
            setIsLoading(false);
        }
        load();
    }, []);

    // -----------------------------------------------------------------------
    // DB helpers
    // -----------------------------------------------------------------------
    const upsertEmail = useCallback(async (item: EmailItem) => {
        if (!profileId) return;
        if (item.isNew) {
            const { data } = await supabase
                .from("user_emails")
                .insert({
                    user_id:               profileId,
                    email:                 item.email,
                    is_primary:            item.isPrimary,
                    user_confirmed_status: "confirmed",
                    source:                "user_input",
                })
                .select("id")
                .single();
            if (data) {
                setItems((prev) =>
                    prev.map((e) => e.id === item.id ? { ...e, id: data.id, isNew: false } : e)
                );
            }
        } else {
            await supabase
                .from("user_emails")
                .update({ email: item.email, is_primary: item.isPrimary, user_confirmed_status: "confirmed" })
                .eq("id", item.id);
        }
    }, [profileId]);

    const deleteEmail = useCallback(async (id: string, isNew?: boolean) => {
        if (isNew) return;
        await supabase.from("user_emails").update({ is_active: false }).eq("id", id);
    }, []);

    const updateAllPrimary = useCallback(async (primaryId: string) => {
        if (!profileId) return;
        await supabase
            .from("user_emails")
            .update({ is_primary: false })
            .eq("user_id", profileId);
        await supabase
            .from("user_emails")
            .update({ is_primary: true })
            .eq("id", primaryId);
    }, [profileId]);

    // -----------------------------------------------------------------------
    // Interaction handlers
    // -----------------------------------------------------------------------
    const openEdit = (item: EmailItem) => {
        if (item.isAuthEmail) return; // auth email is confirmed — no editing
        setActiveId(item.id);
        setEditingId(item.id);
        setEditValue(item.email);
    };

    const handleUpdate = async (id: string) => {
        const updated = items.map((e) =>
            e.id === id
                ? { ...e, email: editValue.trim() || e.email, status: "confirmed" as BadgeStatus }
                : e,
        );
        setItems(updated);
        setEditingId(null);
        setActiveId(null);

        const item = updated.find((e) => e.id === id);
        if (item) await upsertEmail(item);
    };

    const handleTogglePrimary = async (id: string, isPrimary: boolean) => {
        setItems((prev) => prev.map((e) => ({ ...e, isPrimary: e.id === id ? isPrimary : false })));
        if (isPrimary) await updateAllPrimary(id);
    };

    const handleDelete = async (id: string) => {
        const item = items.find((e) => e.id === id);
        if (item?.isAuthEmail) return; // never delete the auth email
        setItems((prev) => prev.filter((e) => e.id !== id));
        if (activeId === id) setActiveId(null);
        setEditingId(null);
        if (item) await deleteEmail(id, item.isNew);
    };

    const handleAdd = () => {
        const tempId = `new-${Date.now()}`;
        setItems((prev) => [...prev, {
            id:        tempId,
            email:     "",
            isPrimary: false,
            status:    "pending",
            isNew:     true,
        }]);
        setActiveId(tempId);
        setEditingId(tempId);
        setEditValue("");
    };

    // Final step — mark onboarding complete and go to dashboard
    const handleFinishSetup = async () => {
        setIsSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase
                .from("user_profiles")
                .update({ onboarding_completed: true, onboarding_step: 5 })
                .eq("auth_user_id", user.id);
        }
        setIsSaving(false);
        navigate("/");
    };

    if (isLoading) {
        return (
            <OnboardingLayout
                currentStep={"emails" satisfies OnboardingStep}
                completedSteps={["basic", "phone", "aliases", "addresses"]}
                title="Emails"
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
            currentStep={"emails" satisfies OnboardingStep}
            completedSteps={["basic", "phone", "aliases", "addresses"]}
            title="Emails"
            footer={
                <button
                    type="button"
                    onClick={handleFinishSetup}
                    disabled={isSaving}
                    className={cx(
                        "flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold text-white outline-none transition",
                        "bg-[#00BFFF] hover:bg-[#0E9AE8]",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                        isSaving && "opacity-60 cursor-not-allowed",
                    )}
                >
                    {isSaving ? "Finishing..." : "Finish Setup"}
                </button>
            }
        >
            {items.length === 0 && (
                <div className={cx(
                    "rounded-xl border p-6 text-center",
                    "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
                    "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                )}>
                    <p className="text-sm text-[var(--text-secondary)] dark:text-[#B8C4CC] mb-4">
                        No additional emails found. Your sign-in email is already tracked. Add any other email addresses linked to your identity.
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
                            editingId === item.id && !item.isAuthEmail ? (
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
                        onClick={() => activeId === item.id ? setActiveId(null) : openEdit(item)}
                        onConfirmAndContinue={() => handleUpdate(item.id)}
                        toggleLabel="Primary"
                        toggleValue={item.isPrimary}
                        onToggleChange={(v) => handleTogglePrimary(item.id, v)}
                        showDelete={!item.isAuthEmail}
                        onDelete={() => handleDelete(item.id)}
                    />
                ))}
            </div>

            <div className="mt-8 flex justify-center pb-4">
                <button
                    type="button"
                    onClick={handleAdd}
                    className={cx(
                        "flex h-14 w-14 items-center justify-center rounded-full outline-none transition shadow-lg",
                        "bg-[#00D4AA] text-[#022136] hover:bg-[#00E5B8]",
                        "focus-visible:ring-2 focus-visible:ring-[#00D4AA] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                    )}
                    aria-label="Add Email"
                >
                    <Plus className="h-6 w-6" aria-hidden />
                </button>
            </div>
        </OnboardingLayout>
    );
}
