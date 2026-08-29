import { useCallback } from "react";
import { useNavigate } from "react-router";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { supabase } from "@/lib/supabase";
import { QuickScanForm, type ProfileMatch } from "@vanyshr/ui/components/application";

export function QuickScan() {
  const navigate = useNavigate();

  // Handle profile selection
  const handleSelectProfile = useCallback((profile: ProfileMatch, searchParams: { firstName: string; lastName: string; zipCode: string; city: string; state: string }, scanId: string | null) => {
    if (!scanId) {
      navigate("/quickscan-error", { state: { searchParams, originalScanId: null } });
      return;
    }
    sessionStorage.setItem("selectedProfile", JSON.stringify(profile));
    sessionStorage.setItem("searchParams", JSON.stringify(searchParams));
    navigate(`/quick-scan/pre-profile/${scanId}`);
  }, [navigate]);

  // Handle total scan failure after both attempts — navigate to error page with context
  const handleTotalFailure = useCallback((searchParams: { firstName: string; lastName: string; zipCode: string; city: string; state: string }, originalScanId: string | null) => {
    navigate("/quickscan-error", { state: { searchParams, originalScanId } });
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#F0F4F8] dark:bg-[#0B1B2B] font-sans transition-colors duration-200">
      
      {/* Logo - Positioned above container */}
      <div className="mb-8">
         <img 
            src={PrimaryLogo} 
            alt="Vanyshr Logo" 
            className="h-[60px] w-auto dark:hidden block"
         />
         <img 
            src={PrimaryLogoDark} 
            alt="Vanyshr Logo" 
            className="h-[60px] w-auto hidden dark:block" 
         />
      </div>

      <QuickScanForm
        supabaseClient={supabase}
        onProfileSelect={handleSelectProfile}
        onTotalFailure={handleTotalFailure}
        onPhoneLookup={async (phone: string) => {
          const { data, error } = await supabase.functions.invoke('phone-lookup', { body: { phone } });
          if (error) return { error: 'fetch_failed' };
          return data;
        }}
        className="max-w-md border border-[#D4DFE8] dark:border-[#1E3A52] shadow-lg"
      />
    </div>
  );
}
