import { useState, useEffect } from "react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import SpamCallsIcon from "@vanyshr/ui/assets/spam-calls.png";
import IdentityTheftIcon from "@vanyshr/ui/assets/Identity-theft.png";
import PhishingAttackIcon from "@vanyshr/ui/assets/phishing.png";
import ScamAttemptsIcon from "@vanyshr/ui/assets/scam-attempts.png";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";

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
                                onClick={() => navigate("/quick-scan")}
                                className="w-full h-[72px] bg-[#14ABFE] hover:bg-[#1196E0] text-white text-2xl font-bold rounded-2xl shadow-lg transition-all active:scale-[0.98]"
                            >
                                Run a QuickScan Now
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </footer>
        </div>
    );
}
