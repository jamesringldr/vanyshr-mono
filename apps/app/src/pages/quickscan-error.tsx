import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { QuickScanError } from "@vanyshr/ui/components/application";
import { supabase } from "@/lib/supabase";

export function QuickScanErrorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { searchParams, originalScanId } = (location.state as { searchParams?: { firstName: string; lastName: string; zipCode: string; city: string; state: string }; originalScanId?: string | null }) ?? {};

  const handleQueueWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.functions.invoke("queue-scan-retry", {
      body: {
        email,
        search_input: {
          first_name: searchParams?.firstName ?? "",
          last_name: searchParams?.lastName ?? "",
          zip_code: searchParams?.zipCode,
          city: searchParams?.city,
          state: searchParams?.state,
        },
        original_scan_id: originalScanId ?? null,
      },
    });
    if (error) throw new Error(error.message || "Failed to queue request");
  }, [searchParams, originalScanId]);

  const handleDismiss = useCallback(() => {
    navigate("/quick-scan");
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

      <QuickScanError
        onQueueWithEmail={handleQueueWithEmail}
        onDismiss={handleDismiss}
        className="max-w-md border border-[#D4DFE8] dark:border-[#2A4A68] shadow-lg"
      />
    </div>
  );
}
