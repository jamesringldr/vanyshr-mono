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
import { Phone, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface PhoneNumberItem {
    id: string;          // user_phones.id (UUID)
    number: string;
    status: BadgeStatus;
    isPrimary: boolean;
    isNew?: boolean;     // true while unsaved
}

export function OnboardingPhoneNumbers() {
    const [items, setItems] = useState<PhoneNumberItem[]>([]);
    const [profileId, setProfileId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
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
                .select("id")
                .eq("auth_user_id", user.id)
                .single();

            if (!profile) { setIsLoading(false); return; }
            setProfileId(profile.id);

            const { data: phones } = await supabase
                .from("user_phones")
                .select("id, number, is_primary, user_confirmed_status")
                .eq("user_id", profile.id)
                .eq("is_active", true)
                .order("is_primary", { ascending: false });

            if (phones) {
                setItems(phones.map((p) => ({
                    id:        p.id,
                    number:    p.number,
                    isPrimary: p.is_primary,
                    status:    p.user_confirmed_status === "confirmed" ? "confirmed" : "pending" as BadgeStatus,
                })));
            }
            setIsLoading(false);
        }
        load();
    }, []);

    // -----------------------------------------------------------------------
    // DB helpers
    // -----------------------------------------------------------------------
    const upsertPhone = useCallback(async (item: PhoneNumberItem) => {
        if (!profileId) return;
        if (item.isNew) {
            const { data } = await supabase
                .from("user_phones")
                .insert({
                    user_id:               profileId,
                    number:                item.number,
                    is_primary:            item.isPrimary,
                    user_confirmed_status: "confirmed",
                    source:                "user_input",
                })
                .select("id")
                .single();
            // Replace temp id with real DB id
            if (data) {
                setItems((prev) =>
                    prev.map((p) => p.id === item.id ? { ...p, id: data.id, isNew: false } : p)
                );
            }
        } else {
            await supabase
                .from("user_phones")
                .update({
                    number:                item.number,
                    is_primary:            item.isPrimary,
                    user_confirmed_status: "confirmed",
                })
                .eq("id", item.id);
        }
    }, [profileId]);

    const deletePhone = useCallback(async (id: string, isNew?: boolean) => {
        if (isNew) return; // never saved — nothing to delete
        await supabase.from("user_phones").update({ is_active: false }).eq("id", id);
    }, []);

    const updateAllPrimary = useCallback(async (primaryId: string) => {
        if (!profileId) return;
        // Unset all primaries then set the new one
        await supabase
            .from("user_phones")
            .update({ is_primary: false })
            .eq("user_id", profileId);
        await supabase
            .from("user_phones")
            .update({ is_primary: true })
            .eq("id", primaryId);
    }, [profileId]);

    // -----------------------------------------------------------------------
    // Interaction handlers
    // -----------------------------------------------------------------------
    const openEdit = (item: PhoneNumberItem) => {
        setActiveId(item.id);
        setEditingId(item.id);
        setEditValue(item.number);
    };

    const handleUpdate = async (id: string) => {
        const updated = items.map((p) =>
            p.id === id
                ? { ...p, number: editValue.trim() || p.number, status: "confirmed" as BadgeStatus }
                : p,
        );
        setItems(updated);
        setEditingId(null);
        setActiveId(null);

        const item = updated.find((p) => p.id === id);
        if (item) await upsertPhone(item);
    };

    const handleTogglePrimary = async (id: string, isPrimary: boolean) => {
        setItems((prev) => prev.map((p) => ({ ...p, isPrimary: p.id === id ? isPrimary : false })));
        if (isPrimary) await updateAllPrimary(id);
    };

    const handleDelete = async (id: string) => {
        const item = items.find((p) => p.id === id);
        setItems((prev) => prev.filter((p) => p.id !== id));
        if (activeId === id) setActiveId(null);
        setEditingId(null);
        if (item) await deletePhone(id, item.isNew);
    };

    const handleAdd = () => {
        const tempId = `new-${Date.now()}`;
        const newItem: PhoneNumberItem = {
            id:        tempId,
            number:    "",
            status:    "pending",
            isPrimary: items.length === 0,
            isNew:     true,
        };
        setItems((prev) => [...prev, newItem]);
        setActiveId(tempId);
        setEditingId(tempId);
        setEditValue("");
    };

    const handleConfirmAndContinue = async () => {
        // Update onboarding step
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase
                .from("user_profiles")
                .update({ onboarding_step: 2 })
                .eq("auth_user_id", user.id);
        }
        setActiveId(null);
        setEditingId(null);
        navigate("/onboarding/aliases");
    };

    if (isLoading) {
        return (
            <OnboardingLayout
                currentStep={"phone" satisfies OnboardingStep}
                completedSteps={["basic"]}
                title="Phone Numbers"
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
            currentStep={"phone" satisfies OnboardingStep}
            completedSteps={["basic"]}
            title="Phone Numbers"
            footer={
                <button
                    type="button"
                    onClick={handleConfirmAndContinue}
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
            {items.length === 0 && (
                <div className={cx(
                    "rounded-xl border p-6 text-center",
                    "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
                    "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                )}>
                    <p className="text-sm text-[var(--text-secondary)] dark:text-[#B8C4CC] mb-4">
                        No phone numbers found from your scan. Add your phone numbers so we can find and remove them from data broker sites.
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
                        onClick={() => activeId === item.id ? setActiveId(null) : openEdit(item)}
                        onConfirmAndContinue={() => handleUpdate(item.id)}
                        toggleLabel="Primary Mobile"
                        toggleValue={item.isPrimary}
                        onToggleChange={(v) => handleTogglePrimary(item.id, v)}
                        showDelete
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
                    aria-label="Add Phone Number"
                >
                    <Plus className="h-6 w-6" aria-hidden />
                </button>
            </div>
        </OnboardingLayout>
    );
}
