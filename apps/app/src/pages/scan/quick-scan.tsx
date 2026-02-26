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
    sessionStorage.setItem("selectedProfile", JSON.stringify(profile));
    sessionStorage.setItem("searchParams", JSON.stringify(searchParams));
    navigate(`/quick-scan/pre-profile/${scanId ?? profile.id}`);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#F0F4F8] dark:bg-[#022136] font-sans transition-colors duration-200">
      
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
        className="max-w-md border border-[#D4DFE8] dark:border-[#2A4A68] shadow-lg"
      />
    </div>
  );
}
