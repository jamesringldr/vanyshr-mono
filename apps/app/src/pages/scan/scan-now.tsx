import { useState, useCallback, useEffect } from "react";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { QuickScanForm, type ProfileMatch } from "@vanyshr/ui/components/application";
import { DataExposedAnimation } from "@vanyshr/ui/components/animations";

export function ScanNow() {
    const navigate = useNavigate();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [showFullFooter, setShowFullFooter] = useState(false);

    useEffect(() => {
        const revealTimer = setTimeout(() => {
            setShowFullFooter(true);
        }, 3000);

        return () => clearTimeout(revealTimer);
    }, []);

    const handleSelectProfile = useCallback((profile: ProfileMatch, searchParams: { firstName: string; lastName: string; zipCode: string; city: string; state: string }) => {
        sessionStorage.setItem("selectedProfile", JSON.stringify(profile));
        sessionStorage.setItem("searchParams", JSON.stringify(searchParams));
        navigate(`/quick-scan/pre-profile/${profile.id}`);
    }, [navigate]);

    return (
        <div className="min-h-screen bg-[#022136] flex flex-col items-center overflow-x-hidden">
            {/* Header */}
            <header className="w-full max-w-lg flex items-center justify-between px-6 py-4 z-10 shrink-0">
                <div className="flex items-center">
                    <img 
                        src={PrimaryLogoDark} 
                        alt="Vanyshr Logo" 
                        className="h-14 w-auto" 
                    />
                </div>
                <button className="p-2 text-white/80 hover:text-white transition-colors">
                    <Menu className="w-8 h-8" />
                </button>
            </header>

            {/* Main Content */}
            <main className="w-full max-w-lg px-6 flex flex-col items-center text-center flex-1 pb-[280px]">
                {/* Hero section */}
                <div className="flex flex-col items-center mt-1">
                    <p className="text-[#00BFFF] text-base sm:text-lg font-bold tracking-wide uppercase mb-3">
                        AI Powered Data Privacy
                    </p>
                    <h1 className="text-[40px] sm:text-[48px] font-extrabold text-white leading-[1.05] flex flex-col items-center mb-5">
                        <span className="whitespace-nowrap">Your Personal Data</span>
                        <span className="whitespace-nowrap">Is <span className="text-[#FF8A00] italic">Exposed</span></span>
                    </h1>
                </div>

                {/* Animation Section */}
                <div className="w-[85%] mx-auto mb-5 relative">
                    <DataExposedAnimation />
                </div>

                {/* Description */}
                <div className="max-w-[400px] mb-0">
                    <p className="text-[#B8C4CC] text-xl font-medium leading-tight">
                        Data Brokers harvest your personal data from private sources and expose it to
                        <span className="block mt-1 text-[22px] font-bold italic text-white">Scammers, Spammers & Stalkers</span>
                    </p>
                </div>

                <div className="flex flex-col items-center mt-12 w-full">
                    <h2 className="text-[36px] sm:text-[48px] font-extrabold text-white leading-[1.05] mb-2 whitespace-nowrap">
                        We Help You <span className="text-[#00BFFF] italic">Vanysh</span>
                    </h2>
                    <p className="text-[#B8C4CC] text-xl font-medium leading-tight mb-8">
                        Removing your data from these Brokers
                    </p>
                    
                    <ul className="flex flex-col gap-6 text-left w-full max-w-[380px] px-2">
                        <li className="flex items-start gap-4">
                            <div className="mt-1 flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30">
                                <Check className="w-4 h-4 text-[#00D4AA]" strokeWidth={3} />
                            </div>
                            <p className="text-white text-lg leading-snug">
                                Continuously Scan 500+ Data Brokers and Dark Web for <span className="text-[#FF8A00] font-bold">Exposures & Breaches</span>
                            </p>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="mt-1 flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30">
                                <Check className="w-4 h-4 text-[#00D4AA]" strokeWidth={3} />
                            </div>
                            <p className="text-white text-lg leading-snug font-medium">
                                Automatically Submit Removal Requests
                            </p>
                        </li>
                        <li className="flex items-start gap-4">
                            <div className="mt-1 flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30">
                                <Check className="w-4 h-4 text-[#00D4AA]" strokeWidth={3} />
                            </div>
                            <p className="text-white text-lg leading-snug font-medium">
                                Monitor Compliance & Progress in Real Time
                            </p>
                        </li>
                    </ul>
                </div>
            </main>

            {/* Sticky Dark Footer */}
            <footer className="
              fixed bottom-0 left-0 right-0
              z-50 px-3
            ">
                <div className="
                  bg-[#022136]
                  border-[3px] border-b-0 border-[#00BFFF]
                  rounded-t-[28px]
                  backdrop-blur-md
                  shadow-[0_-8px_24px_rgba(0,0,0,0.6)]
                  pt-6 pb-6 px-6
                  flex flex-col gap-1 relative
                  max-w-lg mx-auto
                ">
                    <div className="flex flex-col gap-1 text-center">
                        <p className="text-white font-bold text-[22px] leading-tight text-center">
                            Check If Your Data Is Exposed
                        </p>
                        <p className="text-white font-bold text-[22px] leading-tight text-center">
                            Run a QuickScan - <span className="text-[#00BFFF] italic">FREE</span>
                        </p>
                    </div>

                    <AnimatePresence>
                        {showFullFooter && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className="flex flex-col gap-3 w-full overflow-hidden"
                            >
                                <button 
                                    onClick={() => setIsDrawerOpen(true)}
                                    className="w-full h-[52px] rounded-[14px] bg-[#00BFFF] text-white font-bold text-xl hover:bg-[#00D4FF] active:bg-[#0099CC] transition-colors duration-150 shadow-md"
                                >
                                    Scan Now
                                </button>
                                <p className="text-[#7A92A8] text-[14px] leading-none text-center font-medium mb-1">
                                    No Credit Card or Sign Up Required
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </footer>

            {/* Bottom Drawer */}
            <AnimatePresence>
                {isDrawerOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsDrawerOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        />
                        {/* Drawer content wrapper */}
                        <motion.div 
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
                        >
                            <div className="w-full max-w-md bg-[#2A2A3F] rounded-t-[32px] overflow-hidden max-h-[90vh] flex flex-col shadow-2xl relative border-t border-[#2A4A68]">
                                {/* Drawer Handle */}
                                <div className="w-full h-6 flex items-center justify-center shrink-0">
                                    <div className="w-12 h-1.5 bg-gray-700 rounded-full" />
                                </div>
                                
                                {/* Close Button */}
                                <button 
                                    onClick={() => setIsDrawerOpen(false)}
                                    className="absolute top-4 right-6 p-2 rounded-full bg-[#022136] text-gray-400 hover:text-white transition-colors z-10"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                {/* Form Content */}
                                <div className="overflow-y-auto px-1 pb-10">
                                    <QuickScanForm 
                                        supabaseClient={supabase}
                                        onProfileSelect={handleSelectProfile}
                                        onClose={() => setIsDrawerOpen(false)}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
