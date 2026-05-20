import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";

function formatName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return "";
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

type InviteScanResponse = {
    success: boolean;
    first_name?: string;
    last_name?: string;
    city?: string;
    state?: string;
    email?: string;
    scan_id?: string;
    profile_id?: string;
    error?: string;
};

const inputClass = cx(
    "h-12 w-full rounded-xl border px-4 text-sm outline-none transition",
    "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
    "border-[var(--border-subtle)] dark:border-[#2A4A68]",
    "text-[#022136] dark:text-white placeholder:text-[var(--text-muted)] dark:placeholder:text-[#7A92A8]",
    "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
);

export function Invite() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const prefersReducedMotion = useReducedMotion();
    const scanIdParam = searchParams.get("id");
    const [firstName, setFirstName] = useState<string | null>(null);
    const [scanId, setScanId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(Boolean(scanIdParam));
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmFirstName, setConfirmFirstName] = useState("");
    const [confirmLastName, setConfirmLastName] = useState("");
    const [confirmCity, setConfirmCity] = useState("");
    const [confirmState, setConfirmState] = useState("");
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        if (!scanIdParam) {
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        async function loadInviteScan() {
            setIsLoading(true);
            const { data, error } = await supabase.rpc("get_invite_scan", {
                p_scan_id: scanIdParam,
            });

            if (cancelled) return;

            const result = data as InviteScanResponse | null;

            if (error || !result?.success) {
                setFirstName(null);
                setScanId(null);
                setIsLoading(false);
                return;
            }

            if (result.first_name) {
                setFirstName(formatName(result.first_name));
            }
            const resolvedScanId = result.scan_id ?? scanIdParam;
            setScanId(resolvedScanId);
            if (resolvedScanId) {
                sessionStorage.setItem("pendingScanId", resolvedScanId);
            }
            if (result.profile_id) {
                sessionStorage.setItem("pendingProfileId", result.profile_id);
            }
            if (result.email) {
                sessionStorage.setItem("invitePrefillEmail", result.email);
            } else {
                sessionStorage.removeItem("invitePrefillEmail");
            }

            setConfirmFirstName(result.first_name ?? "");
            setConfirmLastName(result.last_name ?? "");
            setConfirmCity(result.city ?? "");
            setConfirmState(result.state ?? "");
            setIsLoading(false);
        }

        loadInviteScan();

        return () => {
            cancelled = true;
        };
    }, [scanIdParam]);

    function openConfirmModal() {
        if (!scanId) return;
        setConfirmError(null);
        setShowConfirmModal(true);
    }

    async function handleConfirm() {
        if (!scanId || isConfirming) return;
        if (!confirmFirstName.trim() || !confirmLastName.trim()) {
            setConfirmError("First and last name are required.");
            return;
        }

        setIsConfirming(true);
        setConfirmError(null);

        const { data, error } = await supabase.rpc("confirm_invite_scan", {
            p_scan_id: scanId,
            p_first_name: confirmFirstName.trim(),
            p_last_name: confirmLastName.trim(),
            p_city: confirmCity.trim(),
            p_state: confirmState.trim(),
        });

        const result = data as { success?: boolean; error?: string } | null;

        if (error || !result?.success) {
            setConfirmError("Could not save your info. Please try again.");
            setIsConfirming(false);
            return;
        }

        setFirstName(formatName(confirmFirstName));
        setShowConfirmModal(false);
        setIsConfirming(false);
        navigate(`/invite/loading/${scanId}`);
    }

    return (
        <>
            <motion.div
                className={cx(
                    "min-h-screen w-full font-sans transition-colors duration-200",
                    "bg-[#F0F4F8] dark:bg-[#022136]",
                )}
                role="main"
                aria-label="Invitation to Vanyshr"
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1 }}
                transition={{ duration: 0.4 }}
            >
                <motion.div
                    className="mx-auto flex w-full max-w-md flex-col items-center px-6 pb-12 pt-10 text-center"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                    animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.05 }}
                >
                    <div className="flex justify-center">
                        <img
                            src={PrimaryLogo}
                            alt="Vanyshr"
                            className="h-10 w-auto dark:hidden sm:h-11"
                        />
                        <img
                            src={PrimaryLogoDark}
                            alt="Vanyshr"
                            className="hidden h-10 w-auto dark:block sm:h-11"
                        />
                    </div>

                    <span
                        className={cx(
                            "mt-5 inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium",
                            "bg-[#00BFFF]/10 border border-[#00BFFF]/30 text-[#00BFFF]",
                        )}
                    >
                        AI-Powered Data Privacy
                    </span>

                    {isLoading ? (
                        <p className="mt-4 text-sm text-[var(--text-muted)] dark:text-[#7A92A8] font-ubuntu">
                            Loading your invite…
                        </p>
                    ) : firstName ? (
                        <p className="mt-4 text-xl font-semibold text-[#022136] dark:text-white font-ubuntu">
                            Welcome {firstName}
                        </p>
                    ) : null}

                    <div className="mt-8 flex justify-center" aria-hidden>
                        <motion.img
                            src={PrimaryIconOutline}
                            alt=""
                            className="h-36 w-36 object-contain sm:h-40 sm:w-40"
                            animate={prefersReducedMotion ? undefined : { y: [0, -10, 0] }}
                            transition={
                                prefersReducedMotion
                                    ? undefined
                                    : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
                            }
                        />
                    </div>

                    <h1 className="mt-8 text-3xl font-bold tracking-tight text-[#022136] dark:text-white sm:text-4xl font-ubuntu leading-tight">
                        You&apos;ve Been Invited to Vanyshr!
                    </h1>

                    <p className="mt-4 text-base text-[var(--text-muted)] dark:text-[#B8C4CC] font-ubuntu leading-relaxed">
                        See what private info is exposed and how to start Vanyshing!
                    </p>

                    <button
                        type="button"
                        onClick={openConfirmModal}
                        disabled={isLoading || !scanId}
                        className={cx(
                            "mt-8 flex h-[52px] w-full max-w-sm items-center justify-center rounded-xl text-sm font-semibold text-white outline-none transition",
                            "bg-[#00BFFF] hover:bg-[#0E9AE8]",
                            "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                            (isLoading || !scanId) && "cursor-not-allowed opacity-50 hover:bg-[#00BFFF]",
                        )}
                    >
                        See My Data
                    </button>

                    <p className="mt-5 text-sm font-light italic text-[#00BFFF]">
                        No Credit Card Required
                    </p>

                    <p className="mt-6 max-w-sm text-xs leading-relaxed text-[#7A92A8]">
                        The data we show is pulled from public sources. Your data is not saved,
                        stored, sold, or used to spam you.
                    </p>
                </motion.div>
            </motion.div>

            {showConfirmModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-info-title"
                >
                    <div
                        className={cx(
                            "w-full max-w-md rounded-2xl border p-6 shadow-xl",
                            "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
                            "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                        )}
                    >
                        <h2
                            id="confirm-info-title"
                            className="text-lg font-bold text-[#022136] dark:text-white"
                        >
                            Confirm Your Info
                        </h2>
                        <p className="mt-1 text-sm text-[var(--text-muted)] dark:text-[#B8C4CC]">
                            Make sure we have the right person before showing your results.
                        </p>

                        <div className="mt-5 space-y-4 text-left">
                            <label className="block">
                                <span className="mb-1 block text-sm font-medium text-[#022136] dark:text-white">
                                    First name
                                </span>
                                <input
                                    type="text"
                                    value={confirmFirstName}
                                    onChange={(e) => setConfirmFirstName(e.target.value)}
                                    className={inputClass}
                                    autoComplete="given-name"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-sm font-medium text-[#022136] dark:text-white">
                                    Last name
                                </span>
                                <input
                                    type="text"
                                    value={confirmLastName}
                                    onChange={(e) => setConfirmLastName(e.target.value)}
                                    className={inputClass}
                                    autoComplete="family-name"
                                />
                            </label>
                            <div>
                                <span className="mb-1 block text-sm font-medium text-[#022136] dark:text-white">
                                    Live in
                                </span>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        value={confirmCity}
                                        onChange={(e) => setConfirmCity(e.target.value)}
                                        placeholder="City"
                                        className={inputClass}
                                        autoComplete="address-level2"
                                    />
                                    <input
                                        type="text"
                                        value={confirmState}
                                        onChange={(e) => setConfirmState(e.target.value)}
                                        placeholder="State"
                                        className={inputClass}
                                        autoComplete="address-level1"
                                    />
                                </div>
                            </div>
                        </div>

                        {confirmError && (
                            <p className="mt-3 text-sm text-red-500 dark:text-red-400">{confirmError}</p>
                        )}

                        <div className="mt-6 flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isConfirming}
                                className={cx(
                                    "flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold text-white",
                                    "bg-[#00BFFF] hover:bg-[#0E9AE8] disabled:opacity-50",
                                )}
                            >
                                {isConfirming ? "Confirming…" : "Confirm"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isConfirming}
                                className="text-sm font-medium text-[#7A92A8] hover:text-[#B8C4CC]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
