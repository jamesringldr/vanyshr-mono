import { Route, Routes } from "react-router";

// Auth pages
import { AuthMagicLink } from "./pages/auth/magic-link";
import { CheckEmail } from "./pages/auth/check-email";
import { AuthCallback } from "./pages/auth/callback";

// Onboarding pages
import { Welcome } from "./pages/onboarding/welcome";
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

// Dashboard pages
import { HomeScreen } from "./pages/dashboard/home";
import { FinancialDashboard } from "./pages/dashboard/financial";
import { Transactions } from "./pages/dashboard/activity";
import { DashboardHome } from "./views/Dashboard/DashboardHome";

// Other pages
import { Pricing } from "./pages/pricing";
import { NotFound } from "./pages/not-found";

export default function App() {
    return (
        <Routes>
            {/* Dashboard */}
            <Route path="/" element={<HomeScreen />} />
            <Route path="/dashboard" element={<FinancialDashboard />} />
            <Route path="/dashboard-home" element={<DashboardHome />} />
            <Route path="/activity" element={<Transactions />} />

            {/* Auth */}
            <Route path="/magic-link" element={<AuthMagicLink />} />
            <Route path="/check-email" element={<CheckEmail />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Onboarding */}
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/onboarding/primary-info" element={<VerifyPrimaryInfo />} />
            <Route path="/onboarding/phone-numbers" element={<OnboardingPhoneNumbers />} />
            <Route path="/onboarding/aliases" element={<OnboardingAliases />} />
            <Route path="/onboarding/addresses" element={<OnboardingAddresses />} />
            <Route path="/onboarding/emails" element={<OnboardingEmails />} />

            {/* Quick Scan */}
            <Route path="/quick-scan" element={<QuickScan />} />
            <Route path="/quick-scan/scanning" element={<QSScanning />} />
            <Route path="/quick-scan/compiling" element={<QSCompiling />} />
            <Route path="/quick-scan/pre-profile/:scanId?" element={<PreProfile />} />

            {/* Other */}
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/scan-now" element={<ScanNow />} />
            <Route path="/searching" element={<SearchingPage />} />
            <Route path="/compiling" element={<CompilingBrandedPage />} />
            <Route path="/Loading-pre-profile" element={<LoadingPreProfilePage />} />
            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}
