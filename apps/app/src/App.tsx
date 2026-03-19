import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { supabase } from "./lib/supabase";

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
import { QuickScan } from "./pages/scan/quick-scan";
import { QSScanning } from "./pages/scan/scanning";
import { QSCompiling } from "./pages/scan/compiling";
import { PreProfile } from "./pages/scan/pre-profile";
import { ScanNow } from "./pages/scan/scan-now";
import { SearchingPage } from "./pages/scan/searching";
import { CompilingBrandedPage } from "./pages/scan/compiling-branded";
import { LoadingPreProfilePage } from "./pages/scan/loading-pre-profile";
import { ScanningStartedPage } from "./pages/scan/scanning-started";
import { QuickScanErrorPage } from "./pages/quickscan-error";

// Dashboard pages
import { FinancialDashboard } from "./pages/dashboard/financial";
import { Transactions } from "./pages/dashboard/activity";
import { DashboardHome } from "./views/Dashboard/DashboardHome";
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

// Sandbox Mockups
import { VanyshrAppMockup, ScamMockup, RemovalsMockup, DataExplosionMockup } from "@vanyshr/ui";

// Dashboard pages are dev-only until they're ready for users.
// In production, hitting a dashboard route redirects to /scanning-started.
function DevOnly({ children }: { children: ReactNode }) {
    if (!import.meta.env.DEV) return <Navigate to="/scanning-started" replace />;
    return <>{children}</>;
}

function RequireAuth({ children }: { children: ReactNode }) {
    const [isReady, setIsReady] = useState(false);
    const [isAuthed, setIsAuthed] = useState(false);

    useEffect(() => {
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
    }, []);

    if (!isReady) return null;
    if (!isAuthed) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

export default function App() {
    return (
        <Routes>
            {/* Dashboard — DevOnly until ready for users */}
            <Route path="/" element={<Navigate to="/quick-scan" replace />} />
            <Route path="/dashboard" element={<DevOnly><RequireAuth><FinancialDashboard /></RequireAuth></DevOnly>} />
            <Route path="/dashboard/home" element={<DevOnly><RequireAuth><DashboardHome /></RequireAuth></DevOnly>} />
            <Route path="/dashboard/dark-web" element={<DevOnly><RequireAuth><DarkWebPage /></RequireAuth></DevOnly>} />
            <Route path="/dashboard/exposures" element={<DevOnly><RequireAuth><ExposuresPage /></RequireAuth></DevOnly>} />
            <Route path="/dashboard/tasks" element={<DevOnly><RequireAuth><TodoPage /></RequireAuth></DevOnly>} />
            <Route path="/dashboard/activity" element={<DevOnly><RequireAuth><Transactions /></RequireAuth></DevOnly>} />
            <Route path="/transactions" element={<DevOnly><RequireAuth><Transactions /></RequireAuth></DevOnly>} />

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
            <Route path="/onboarding/progress" element={<RequireAuth><OnboardingProgress /></RequireAuth>} />
            <Route path="/onboarding/primary-info" element={<RequireAuth><VerifyPrimaryInfo /></RequireAuth>} />
            <Route path="/onboarding/phone-numbers" element={<RequireAuth><OnboardingPhoneNumbers /></RequireAuth>} />
            <Route path="/onboarding/aliases" element={<RequireAuth><OnboardingAliases /></RequireAuth>} />
            <Route path="/onboarding/addresses" element={<RequireAuth><OnboardingAddresses /></RequireAuth>} />
            <Route path="/onboarding/emails" element={<RequireAuth><OnboardingEmails /></RequireAuth>} />
            <Route path="/onboarding/removal-strategy" element={<RequireAuth><OnboardingRemovalStrategyPage /></RequireAuth>} />
            <Route path="/onboarding/notifications" element={<RequireAuth><OnboardingNotifications /></RequireAuth>} />

            {/* Quick Scan */}
            <Route path="/quick-scan" element={<QuickScan />} />
            <Route path="/quickscan-error" element={<QuickScanErrorPage />} />
            <Route path="/quick-scan/scanning" element={<QSScanning />} />
            <Route path="/quick-scan/compiling" element={<QSCompiling />} />
            <Route path="/quick-scan/pre-profile/:scanId?" element={<PreProfile />} />

            {/* Settings */}
            <Route path="/settings/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />

            {/* Referral */}
            <Route path="/referral" element={<ReferralSlider />} />

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
