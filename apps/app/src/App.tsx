import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { supabase } from "./lib/supabase";
import { allowLocalRouteBypass, isProductionApp } from "./lib/env";

// Auth pages
import { AuthMagicLink } from "./pages/auth/magic-link";
import { CheckEmail } from "./pages/auth/check-email";
import { AuthCallback } from "./pages/auth/callback";
import { DashboardLogin } from "./pages/auth/dashboard-login";
import { WrongEmail } from "./pages/auth/wrong-email";

// Onboarding pages
import { Welcome } from "./pages/onboarding/welcome";
import { OnboardingProgress } from "./pages/onboarding/progress";
import { VerifyPrimaryInfo } from "./pages/onboarding/primary-info";
import { OnboardingPhoneNumbers } from "./pages/onboarding/phone-numbers";
import { OnboardingAliases } from "./pages/onboarding/aliases";
import { OnboardingAddresses } from "./pages/onboarding/addresses";
import { OnboardingEmails } from "./pages/onboarding/emails";

// Scan pages
import { QSScanning } from "./pages/scan/scanning";
import { QSCompiling } from "./pages/scan/compiling";
import { PreProfile } from "./pages/scan/pre-profile";
import { ScanNow } from "./pages/scan/scan-now";
import { SearchingPage } from "./pages/scan/searching";
import { CompilingBrandedPage } from "./pages/scan/compiling-branded";
import { LoadingPreProfilePage } from "./pages/scan/loading-pre-profile";
import { ScanningStartedPage } from "./pages/scan/scanning-started";
import { QuickScanErrorPage } from "./pages/quickscan-error";
import { PilotEntryPage } from "./pages/pilot-scan/entry";
import { PilotSplashPage } from "./pages/pilot-scan/splash";
import { PilotStartPage } from "./pages/pilot-scan/start";
import { PilotLoadingPage } from "./pages/pilot-scan/loading";
import { PilotRiskSummaryPage } from "./pages/pilot-scan/risk-summary";
import { PilotPreProfilePage } from "./pages/pilot-scan/pre-profile";
import { PilotReportPage } from "./pages/pilot-scan/report";
import { SelfScanEntryPage } from "./pages/self-scan/entry";
import { SelfScanSplashPage } from "./pages/self-scan/splash";
import { SelfScanLoadingPage } from "./pages/self-scan/loading";
import { SelfScanReportPage } from "./pages/self-scan/report";

// Dashboard pages
import { DashboardHome } from "./views/Dashboard/DashboardHome";
import { Transactions } from "./pages/dashboard/activity";
import { DarkWebPage } from "./pages/dashboard/dark-web";
import { ExposuresPage } from "./pages/dashboard/exposures";
import { TodoPage } from "./pages/dashboard/todo";

// Settings pages
import { NotificationsPage } from "./pages/settings/notifications";

// Onboarding — notifications
import { OnboardingNotifications } from "./pages/onboarding/notifications";
import { OnboardingRemovalStrategyPage } from "./pages/onboarding/removal-strategy";

// Other pages
import { Pricing } from "./pages/pricing";
import { NotFound } from "./pages/not-found";
import { ReferralSlider } from "./pages/referral";
import { Invite } from "./pages/invite";
import { InviteLoading } from "./pages/invite-loading";

// Sandbox Mockups
import { VanyshrAppMockup, ScamMockup, RemovalsMockup, DataExplosionMockup } from "@vanyshr/ui";

// Dashboard pages are hidden on production until ready for users.
function DevOnly({ children }: { children: ReactNode }) {
    if (isProductionApp()) return <Navigate to="/scanning-started" replace />;
    return <>{children}</>;
}

function RequireAuth({
    children,
    productionOnly = false,
}: {
    children: ReactNode;
    productionOnly?: boolean;
}) {
    // Local / preview: skip login so any URL renders its UI shell.
    // productionOnly: dashboard stays open off app.vanyshr.com (existing behavior).
    const skipAuth =
        allowLocalRouteBypass() || (productionOnly && !isProductionApp());

    const [isReady, setIsReady] = useState(skipAuth);
    const [isAuthed, setIsAuthed] = useState(skipAuth);

    useEffect(() => {
        if (skipAuth) return;

        let isMounted = true;

        const initializeSession = async () => {
            try {
                const { data, error } = await supabase.auth.getSession();
                if (!isMounted) return;
                if (error) console.error("Failed to get session:", error);
                setIsAuthed(Boolean(data?.session));
            } finally {
                if (isMounted) setIsReady(true);
            }
        };

        initializeSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!isMounted) return;
            setIsAuthed(Boolean(session));
            setIsReady(true);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [skipAuth]);

    if (skipAuth) return <>{children}</>;
    if (!isReady) return null;
    if (!isAuthed) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

export default function App() {
    return (
        <Routes>
            {/* Dashboard — DevOnly until ready for users */}
            <Route path="/" element={<Navigate to="/self-scan" replace />} />
            <Route path="/dashboard" element={<DevOnly><RequireAuth productionOnly><DashboardHome /></RequireAuth></DevOnly>} />
            <Route path="/dashboard/home" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/dark-web" element={<DevOnly><RequireAuth productionOnly><DarkWebPage /></RequireAuth></DevOnly>} />
            <Route path="/dashboard/exposures" element={<DevOnly><RequireAuth productionOnly><ExposuresPage /></RequireAuth></DevOnly>} />
            <Route path="/dashboard/tasks" element={<DevOnly><RequireAuth productionOnly><TodoPage /></RequireAuth></DevOnly>} />
            <Route path="/dashboard/activity" element={<DevOnly><RequireAuth productionOnly><Transactions /></RequireAuth></DevOnly>} />
            <Route path="/transactions" element={<DevOnly><RequireAuth productionOnly><Transactions /></RequireAuth></DevOnly>} />

            {/* Auth */}
            <Route path="/signup" element={<AuthMagicLink />} />
            <Route path="/confirm-email" element={<CheckEmail />} />
            <Route path="/check-email" element={<CheckEmail />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/login" element={<DashboardLogin />} />
            <Route path="/dashboard/login" element={<Navigate to="/login" replace />} />
            <Route path="/auth/wrong-email" element={<WrongEmail />} />

            {/* Onboarding */}
            <Route path="/welcome" element={<RequireAuth><Welcome /></RequireAuth>} />
            <Route path="/welcome/:userId" element={<RequireAuth><Welcome /></RequireAuth>} />
            <Route path="/onboarding/progress" element={<RequireAuth><OnboardingProgress /></RequireAuth>} />
            <Route path="/onboarding/primary-info" element={<RequireAuth><VerifyPrimaryInfo /></RequireAuth>} />
            <Route path="/onboarding/phone-numbers" element={<RequireAuth><OnboardingPhoneNumbers /></RequireAuth>} />
            <Route path="/onboarding/aliases" element={<RequireAuth><OnboardingAliases /></RequireAuth>} />
            <Route path="/onboarding/addresses" element={<RequireAuth><OnboardingAddresses /></RequireAuth>} />
            <Route path="/onboarding/emails" element={<RequireAuth><OnboardingEmails /></RequireAuth>} />
            <Route path="/onboarding/removal-strategy" element={<RequireAuth><OnboardingRemovalStrategyPage /></RequireAuth>} />
            <Route path="/onboarding/notifications" element={<RequireAuth><OnboardingNotifications /></RequireAuth>} />

            {/* Quick Scan — entry inactivated; page files kept */}
            <Route path="/quick-scan" element={<Navigate to="/pilot-scan" replace />} />
            <Route path="/quickscan-error" element={<QuickScanErrorPage />} />
            <Route path="/quick-scan/scanning" element={<QSScanning />} />
            <Route path="/quick-scan/compiling" element={<QSCompiling />} />
            <Route path="/quick-scan/pre-profile/:scanId?" element={<PreProfile />} />

            {/* Pilot Scan */}
            <Route path="/pilot-scan" element={<PilotEntryPage />} />
            <Route path="/pilot-scan/splash" element={<PilotSplashPage />} />
            <Route path="/pilot-scan/loading" element={<PilotLoadingPage />} />
            <Route path="/pilot-scan/risk-summary" element={<PilotRiskSummaryPage />} />
            <Route path="/pilot-scan/pre-profile" element={<PilotPreProfilePage />} />
            <Route path="/pilot-scan/report" element={<PilotReportPage />} />
            <Route path="/pilot-scan/start" element={<PilotStartPage />} />

            <Route path="/self-scan" element={<SelfScanEntryPage />} />
            <Route path="/self-scan/splash" element={<SelfScanSplashPage />} />
            <Route path="/self-scan/loading" element={<SelfScanLoadingPage />} />
            <Route path="/self-scan/report" element={<SelfScanReportPage />} />

            {/* Settings */}
            <Route path="/settings/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />

            {/* Referral */}
            <Route path="/referral" element={<ReferralSlider />} />
            <Route path="/invite" element={<Invite />} />
            <Route path="/invite/loading/:scanId?" element={<InviteLoading />} />

            {/* Other */}
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/scan-now" element={<ScanNow />} />
            <Route path="/searching" element={<SearchingPage />} />
            <Route path="/compiling" element={<CompilingBrandedPage />} />
            <Route path="/Loading-pre-profile" element={<LoadingPreProfilePage />} />
            <Route path="/scanning-started" element={<ScanningStartedPage />} />
            
            {/* Sandbox Mockups */}
            <Route path="/sandbox/notifications" element={<VanyshrAppMockup />} />
            <Route path="/sandbox/scams" element={<ScamMockup />} />
          <Route path="/sandbox/removals" element={<RemovalsMockup />} />
            <Route path="/sandbox/explosion" element={<DataExplosionMockup />} />

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}
