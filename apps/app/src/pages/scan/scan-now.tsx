import { useState, useEffect, useCallback } from "react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import SpamCallsIcon from "@vanyshr/ui/assets/spam-calls.png";
import IdentityTheftIcon from "@vanyshr/ui/assets/Identity-theft.png";
import PhishingAttackIcon from "@vanyshr/ui/assets/phishing.png";
import ScamAttemptsIcon from "@vanyshr/ui/assets/scam-attempts.png";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { QuickScanForm, type ProfileMatch } from "@vanyshr/ui/components/application";

const EXPOSED_ITEMS = [
    "Phone Numbers",
    "Emails",
    "Passwords",
    "Addresses",
    "Relatives",
    "Assets",
    "Employers"
];

const VULNERABILITIES = [
    { 
        iconSrc: SpamCallsIcon, 
        label: "Spam Calls/Texts",
        iconScale: "scale-110"
    },
    { 
        iconSrc: IdentityTheftIcon, 
        label: "Identity Theft",
        iconScale: "scale-100"
    },
    { 
        iconSrc: ScamAttemptsIcon, 
        label: "Scam Attempts",
        iconScale: "scale-110"
    },
    { 
        iconSrc: PhishingAttackIcon, 
        label: "Phishing Attacks",
        iconScale: "scale-100"
    }
];

export function ScanNow() {
    const navigate = useNavigate();
    const [index, setIndex] = useState(0);
    const [showFullFooter, setShowFullFooter] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % EXPOSED_ITEMS.length);
        }, 2500);

        const revealTimer = setTimeout(() => {
            setShowFullFooter(true);
        }, 3000);

        return () => {
            clearInterval(timer);
            clearTimeout(revealTimer);
        };
    }, []);

    const handleSelectProfile = useCallback((profile: ProfileMatch, searchParams: { firstName: string; lastName: string; zipCode: string; city: string; state: string }) => {
        sessionStorage.setItem("selectedProfile", JSON.stringify(profile));
        sessionStorage.setItem("searchParams", JSON.stringify(searchParams));
        navigate(`/quick-scan/pre-profile/${profile.id}`);
    }, [navigate]);

    return (
        <div className="min-h-screen bg-page dark:bg-[#022136] flex flex-col items-center">
            {/* Header - No bottom border */}
            <header className="w-full max-w-md flex items-center justify-between p-4 bg-white dark:bg-[#022136] z-10">
                <div className="flex items-center">
                    <img 
                        src={PrimaryLogo} 
                        alt="Vanyshr Logo" 
                        className="h-14 w-auto dark:hidden block"
                    />
                    <img 
                        src={PrimaryLogoDark} 
                        alt="Vanyshr Logo" 
                        className="h-14 w-auto hidden dark:block" 
                    />
                </div>
                <button className="p-2 text-primary dark:text-white">
                    <Menu className="w-8 h-8" />
                </button>
            </header>

            {/* Main Scrollable Content */}
            <main className="w-full max-w-md px-6 pt-[15px] pb-8 flex flex-col gap-8 flex-1">
                {/* Hero section */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-bold text-primary dark:text-white leading-tight uppercase">
                                YOUR
                            </h1>
                            <div className="h-[52px] relative overflow-hidden flex items-center">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={EXPOSED_ITEMS[index]}
                                        initial={{ y: 40, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ y: -40, opacity: 0 }}
                                        transition={{ duration: 0.5, ease: "easeInOut" }}
                                        className="bg-[#14ABFE] rounded-xl px-4 py-2 text-2xl font-bold text-white uppercase whitespace-nowrap shadow-lg flex items-center h-full"
                                    >
                                        {EXPOSED_ITEMS[index]}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>
                        <h1 className="text-4xl font-bold text-primary dark:text-white leading-tight uppercase">
                            ARE EXPOSED
                        </h1>
                    </div>
                    <p className="text-[#14ABFE] font-semibold text-lg leading-snug">
                        Data brokers harvest and sell your private data making it easily accessible online
                    </p>
                </div>

                {/* Vulnerabilities section */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-2xl font-bold text-[#022136] dark:text-white">
                        Making you vulnerable to:
                    </h2>
                    
                    <div className="grid grid-cols-2 gap-2">
                        {VULNERABILITIES.map((vuln) => (
                            <div 
                                key={vuln.label}
                                className="bg-[#022136] rounded-2xl pt-2 pb-4 px-2 flex flex-col items-center justify-center gap-1 shadow-lg"
                            >
                                <div className={`w-20 h-16 flex items-center justify-center ${vuln.iconScale}`}>
                                    <img 
                                        src={vuln.iconSrc} 
                                        alt="" 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <span className="text-white font-bold text-center text-[15px] leading-tight px-1">
                                    {vuln.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Benefits section */}
                <div className="mt-[10px]">
                    <h2 className="text-3xl font-black mb-4">
                        <span className="text-[#022136] dark:text-white">We Help You </span>
                        <span className="text-[#14ABFE] italic">Vanysh!</span>
                    </h2>
                    <ul className="space-y-2 text-[#022136] dark:text-white font-bold">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span>Scan 500+ Brokers</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span>Automated Exposure Removal & Tracking</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span>Ongoing Comprehensive Monitoring for new exposures & dark web breaches</span>
                        </li>
                    </ul>
                </div>
            </main>

            {/* Sticky Dark Footer with CTA section */}
            <footer className="w-full max-w-md bg-[#022136] rounded-t-[32px] p-8 flex flex-col items-center sticky bottom-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
                <div className="flex flex-col gap-1 text-center">
                    <p className="text-xl font-bold text-white leading-tight">
                        See Exactly What Data is Exposed <br />
                        Run a <span className="italic underline text-[#14ABFE]">FREE</span> QuickScan
                    </p>
                </div>

                <AnimatePresence>
                    {showFullFooter && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                            animate={{ height: "auto", opacity: 1, marginTop: 24 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="flex flex-col gap-4 w-full overflow-hidden"
                        >
                            <p className="text-[#14ABFE] font-medium text-center italic">
                                No Credit Card or Sign Up Required
                            </p>
                            <button 
                                onClick={() => setIsDrawerOpen(true)}
                                className="w-full h-[72px] bg-[#14ABFE] hover:bg-[#1196E0] text-white text-2xl font-bold rounded-2xl shadow-lg transition-all active:scale-[0.98]"
                            >
                                Run a QuickScan Now
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
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
                            <div className="w-full max-w-md bg-white dark:bg-[#0F2D45] rounded-t-[32px] overflow-hidden max-h-[90vh] flex flex-col shadow-2xl relative border-t border-[#D4DFE8] dark:border-[#2A4A68]">
                                {/* Drawer Handle */}
                                <div className="w-full h-6 flex items-center justify-center shrink-0">
                                    <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
                                </div>

                                {/* Close Button */}
                                <button 
                                    onClick={() => setIsDrawerOpen(false)}
                                    className="absolute top-4 right-6 p-2 rounded-full bg-gray-100 dark:bg-[#022136] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors z-10"
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
