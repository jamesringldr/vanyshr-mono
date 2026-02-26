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
import { MapPin, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface AddressItem {
    id: string;
    address: string;   // display string (full_address or composed)
    status: BadgeStatus;
    isCurrent: boolean;
    isNew?: boolean;
}

function composeAddress(row: {
    full_address?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
}): string {
    if (row.full_address) return row.full_address;
    return [row.street, row.city, row.state, row.zip].filter(Boolean).join(", ");
}

export function OnboardingAddresses() {
    const [items, setItems] = useState<AddressItem[]>([]);
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

            const { data: addresses } = await supabase
                .from("user_addresses")
                .select("id, full_address, street, city, state, zip, is_current, user_confirmed_status")
                .eq("user_id", profile.id)
                .eq("is_active", true)
                .order("is_current", { ascending: false });

            if (addresses) {
                setItems(addresses.map((a) => ({
                    id:        a.id,
                    address:   composeAddress(a),
                    isCurrent: a.is_current,
                    status:    a.user_confirmed_status === "confirmed" ? "confirmed" : "pending" as BadgeStatus,
                })));
            }
            setIsLoading(false);
        }
        load();
    }, []);

    // -----------------------------------------------------------------------
    // DB helpers
    // -----------------------------------------------------------------------
    const upsertAddress = useCallback(async (item: AddressItem) => {
        if (!profileId) return;
        const now = new Date().toISOString();
        if (item.isNew) {
            const { data } = await supabase
                .from("user_addresses")
                .insert({
                    user_id:               profileId,
                    full_address:          item.address,
                    is_current:            item.isCurrent,
                    user_confirmed_status: "confirmed" as const,
                    confirmed_at:          now,
                    source:                "user_input" as const,
                })
                .select("id")
                .single();
            if (data) {
                setItems((prev) =>
                    prev.map((a) => a.id === item.id ? { ...a, id: data.id, isNew: false } : a)
                );
            }
        } else {
            // When manually editing, clear structured fields so stale street/city/state/zip
            // from the original quick-scan don't persist alongside the new full_address.
            await supabase
                .from("user_addresses")
                .update({
                    full_address:          item.address,
                    street:                null,
                    city:                  null,
                    state:                 null,
                    zip:                   null,
                    is_current:            item.isCurrent,
                    user_confirmed_status: "confirmed",
                    confirmed_at:          now,
                })
                .eq("id", item.id);
        }
    }, [profileId]);

    const deleteAddress = useCallback(async (id: string, isNew?: boolean) => {
        if (isNew) return;
        const { error } = await supabase
            .from("user_addresses")
            .update({ is_active: false })
            .eq("id", id);
        if (error) console.error("[Onboarding] Address delete failed:", error.message);
    }, []);

    const updateAllCurrent = useCallback(async (currentId: string) => {
        if (!profileId) return;
        await supabase
            .from("user_addresses")
            .update({ is_current: false })
            .eq("user_id", profileId);
        await supabase
            .from("user_addresses")
            .update({ is_current: true })
            .eq("id", currentId);
    }, [profileId]);

    // -----------------------------------------------------------------------
    // Interaction handlers
    // -----------------------------------------------------------------------
    const openEdit = (item: AddressItem) => {
        setActiveId(item.id);
        setEditingId(item.id);
        setEditValue(item.address);
    };

    const handleUpdate = async (id: string) => {
        const updated = items.map((a) =>
            a.id === id
                ? { ...a, address: editValue.trim() || a.address, status: "confirmed" as BadgeStatus }
                : a,
        );
        setItems(updated);
        setEditingId(null);
        setActiveId(null);

        const item = updated.find((a) => a.id === id);
        if (item) await upsertAddress(item);
    };

    const handleToggleCurrent = async (id: string, isCurrent: boolean) => {
        setItems((prev) => prev.map((a) => ({ ...a, isCurrent: a.id === id ? isCurrent : false })));
        if (isCurrent) await updateAllCurrent(id);
    };

    const handleDelete = async (id: string) => {
        const item = items.find((a) => a.id === id);
        setItems((prev) => prev.filter((a) => a.id !== id));
        if (activeId === id) setActiveId(null);
        setEditingId(null);
        if (item) await deleteAddress(id, item.isNew);
    };

    const handleAdd = () => {
        const tempId = `new-${Date.now()}`;
        setItems((prev) => [...prev, { id: tempId, address: "", isCurrent: items.length === 0, status: "pending", isNew: true }]);
        setActiveId(tempId);
        setEditingId(tempId);
        setEditValue("");
    };

    const handleConfirmAndContinue = async () => {
        // Bulk-confirm all active items so none are left as 'unverified'
        if (profileId) {
            await supabase
                .from("user_addresses")
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
                .update({ onboarding_step: 4 })
                .eq("auth_user_id", user.id);
        }
        setActiveId(null);
        setEditingId(null);
        navigate("/onboarding/emails");
    };

    if (isLoading) {
        return (
            <OnboardingLayout
                currentStep={"addresses" satisfies OnboardingStep}
                completedSteps={["basic", "phone", "aliases"]}
                title="Addresses"
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
            currentStep={"addresses" satisfies OnboardingStep}
            completedSteps={["basic", "phone", "aliases"]}
            title="Addresses"
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
                        No addresses found from your scan. Add your current and past addresses so we can find and remove them from data broker sites.
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
                        onClick={() => activeId === item.id ? setActiveId(null) : openEdit(item)}
                        onConfirmAndContinue={() => handleUpdate(item.id)}
                        toggleLabel="Current Address"
                        toggleValue={item.isCurrent}
                        onToggleChange={(v) => handleToggleCurrent(item.id, v)}
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
                    aria-label="Add Address"
                >
                    <Plus className="h-6 w-6" aria-hidden />
                </button>
            </div>
        </OnboardingLayout>
    );
}
