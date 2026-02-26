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
import { User, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface AliasItem {
    id: string;
    name: string;
    status: BadgeStatus;
    isNew?: boolean;
}

export function OnboardingAliases() {
    const [items, setItems] = useState<AliasItem[]>([]);
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

            const { data: aliases } = await supabase
                .from("user_aliases")
                .select("id, name, user_confirmed_status")
                .eq("user_id", profile.id)
                .eq("is_active", true)
                .order("created_at");

            if (aliases) {
                setItems(aliases.map((a) => ({
                    id:     a.id,
                    name:   a.name,
                    status: a.user_confirmed_status === "confirmed" ? "confirmed" : "pending" as BadgeStatus,
                })));
            }
            setIsLoading(false);
        }
        load();
    }, []);

    // -----------------------------------------------------------------------
    // DB helpers
    // -----------------------------------------------------------------------
    const upsertAlias = useCallback(async (item: AliasItem) => {
        if (!profileId) return;
        const now = new Date().toISOString();
        if (item.isNew) {
            const { data } = await supabase
                .from("user_aliases")
                .insert({
                    user_id:               profileId,
                    name:                  item.name,
                    user_confirmed_status: "confirmed",
                    confirmed_at:          now,
                    source:                "user_input",
                })
                .select("id")
                .single();
            if (data) {
                setItems((prev) =>
                    prev.map((a) => a.id === item.id ? { ...a, id: data.id, isNew: false } : a)
                );
            }
        } else {
            await supabase
                .from("user_aliases")
                .update({ name: item.name, user_confirmed_status: "confirmed", confirmed_at: now })
                .eq("id", item.id);
        }
    }, [profileId]);

    const deleteAlias = useCallback(async (id: string, isNew?: boolean) => {
        if (isNew) return;
        const { error } = await supabase
            .from("user_aliases")
            .update({ is_active: false })
            .eq("id", id);
        if (error) console.error("[Onboarding] Alias delete failed:", error.message);
    }, []);

    // -----------------------------------------------------------------------
    // Interaction handlers
    // -----------------------------------------------------------------------
    const openEdit = (item: AliasItem) => {
        setActiveId(item.id);
        setEditingId(item.id);
        setEditValue(item.name);
    };

    const handleUpdate = async (id: string) => {
        const updated = items.map((a) =>
            a.id === id
                ? { ...a, name: editValue.trim() || a.name, status: "confirmed" as BadgeStatus }
                : a,
        );
        setItems(updated);
        setEditingId(null);
        setActiveId(null);

        const item = updated.find((a) => a.id === id);
        if (item) await upsertAlias(item);
    };

    const handleDelete = async (id: string) => {
        const item = items.find((a) => a.id === id);
        setItems((prev) => prev.filter((a) => a.id !== id));
        if (activeId === id) setActiveId(null);
        setEditingId(null);
        if (item) await deleteAlias(id, item.isNew);
    };

    const handleAdd = () => {
        const tempId = `new-${Date.now()}`;
        setItems((prev) => [...prev, { id: tempId, name: "", status: "pending", isNew: true }]);
        setActiveId(tempId);
        setEditingId(tempId);
        setEditValue("");
    };

    const handleConfirmAndContinue = async () => {
        // Bulk-confirm all active items so none are left as 'unverified'
        if (profileId) {
            await supabase
                .from("user_aliases")
                .update({
                    user_confirmed_status: "confirmed",
                    confirmed_at:          new Date().toISOString(),
                })
                .eq("user_id", profileId)
                .eq("is_active", true);
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase
                .from("user_profiles")
                .update({ onboarding_step: 3 })
                .eq("auth_user_id", user.id);
        }
        setActiveId(null);
        setEditingId(null);
        navigate("/onboarding/addresses");
    };

    if (isLoading) {
        return (
            <OnboardingLayout
                currentStep={"aliases" satisfies OnboardingStep}
                completedSteps={["basic", "phone"]}
                title="Aliases"
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
            currentStep={"aliases" satisfies OnboardingStep}
            completedSteps={["basic", "phone"]}
            title="Aliases"
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
                        No aliases found from your scan. Add any nicknames, maiden names, or alternate spellings of your name.
                    </p>
                </div>
            )}

            <div className="flex flex-col gap-4">
                {items.map((item) => (
                    <OnboardingDataCard
                        key={item.id}
                        value={item.name}
                        status={item.status}
                        isExpanded={activeId === item.id}
                        isEditing={editingId === item.id}
                        editContent={
                            editingId === item.id ? (
                                <EditInput
                                    id={`alias-${item.id}`}
                                    label="Alias name"
                                    value={editValue}
                                    onChange={setEditValue}
                                    placeholder="e.g. nickname, maiden name"
                                    icon={User}
                                />
                            ) : undefined
                        }
                        onClick={() => activeId === item.id ? setActiveId(null) : openEdit(item)}
                        onConfirmAndContinue={() => handleUpdate(item.id)}
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
                    aria-label="Add Alias"
                >
                    <Plus className="h-6 w-6" aria-hidden />
                </button>
            </div>
        </OnboardingLayout>
    );
}
