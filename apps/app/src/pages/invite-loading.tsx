import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { QSInfoCard } from "@vanyshr/ui/components/application/qs-info-card/qs-info-card";
import { QSProgressSteps } from "@vanyshr/ui/components/application/qs-progress-steps/qs-progress-steps";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";
import { allowLocalRouteBypass } from "@/lib/env";

const SCAN_MS = 3000;
const COMPILE_MS = 3000;

export function InviteLoading() {
    const { scanId } = useParams<{ scanId: string }>();
    const navigate = useNavigate();
    const [phase, setPhase] = useState<"scanning" | "compiling">("scanning");
    const holdForUiPreview = allowLocalRouteBypass();

    useEffect(() => {
        if (!scanId) {
            // Local UI preview: keep the loading screen without an invite id.
            if (holdForUiPreview) return;
            navigate("/invite", { replace: true });
            return;
        }

        // Local: stay on this URL so you can inspect the loading UI.
        if (holdForUiPreview) return;

        const scanTimer = window.setTimeout(() => setPhase("compiling"), SCAN_MS);
        const doneTimer = window.setTimeout(() => {
            navigate(`/quick-scan/pre-profile/${scanId}`, { replace: true });
        }, SCAN_MS + COMPILE_MS);

        return () => {
            window.clearTimeout(scanTimer);
            window.clearTimeout(doneTimer);
        };
    }, [scanId, navigate, holdForUiPreview]);

    const isScanning = phase === "scanning";

    return (
        <div
            className="min-h-screen w-full flex flex-col bg-[#F0F4F8] dark:bg-[#022136] transition-colors duration-200"
            role="main"
            aria-label={isScanning ? "Preparing your scan" : "Compiling your results"}
        >
            <div className="px-4 pt-6 pb-4">
                <QSProgressSteps
                    totalSteps={3}
                    activeStep={isScanning ? 1 : 2}
                    aria-label={isScanning ? "Scan progress: step 1 of 3" : "Compile progress: step 2 of 3"}
                />
            </div>

            <div className="flex flex-1 flex-col items-center px-4 pb-8 md:px-6">
                <h1 className="text-center text-xl font-bold text-[#022136] dark:text-white md:text-2xl mt-2 mb-2 max-w-lg">
                    {isScanning
                        ? "Prowling the deepest parts of the web to find who has your data..."
                        : "We found a broker selling your data!"}
                </h1>
                <p className="text-center text-sm text-[#B8C4CC] md:text-base max-w-lg mb-6 leading-relaxed">
                    {isScanning
                        ? "We are targeting known data brokers and crawling their databases to identify if they have your data and exactly what data they have."
                        : "We are collecting all the data this broker has for you and pinpointing the extent of your exposure."}
                </p>

                <div className="flex justify-center mb-6" aria-hidden>
                    <img
                        src={PrimaryIconOutline}
                        alt=""
                        className="h-24 w-24 md:h-28 md:w-28 object-contain opacity-90"
                    />
                </div>

                <div className="w-full max-w-sm mb-8">
                    <QSInfoCard
                        iconSrc={isScanning ? "/brand/icons/spammer.png" : "/brand/icons/scammer.png"}
                        title={isScanning ? undefined : "Reduce Scam & Phishing Risk"}
                        description={
                            isScanning
                                ? undefined
                                : "This data is easily available for Hackers, Identity Thieves and Scammers to easily target you and your family."
                        }
                    />
                </div>
            </div>
        </div>
    );
}
