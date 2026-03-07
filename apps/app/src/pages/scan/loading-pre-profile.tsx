import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";

export function LoadingPreProfilePage() {
    const navigate = useNavigate();
    const prefersReducedMotion = useReducedMotion();
    const [ellipsis, setEllipsis] = useState(".");

    useEffect(() => {
        const frames = [".", "..", "..."];
        const intervalId = window.setInterval(() => {
            setEllipsis((prev) => {
                const currentIndex = frames.indexOf(prev);
                const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % frames.length;
                return frames[nextIndex];
            });
        }, 420);

        return () => window.clearInterval(intervalId);
    }, []);

    return (
        <div
            className="min-h-screen w-full flex flex-col items-center justify-center bg-[#022136] font-ubuntu overflow-hidden"
            role="main"
            aria-label="Finalizing report"
        >
            <div className="flex flex-col items-center gap-8 px-6 animate-in fade-in zoom-in duration-700">
                <div className="flex justify-center" aria-hidden>
                    <motion.img
                        src={PrimaryIconOutline}
                        alt=""
                        className="h-28 w-28 md:h-32 md:w-32 object-contain opacity-95"
                        animate={prefersReducedMotion ? undefined : { y: [0, -8, 0] }}
                        transition={
                            prefersReducedMotion
                                ? undefined
                                : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
                        }
                    />
                </div>

                <div className="flex flex-col items-center gap-3 max-w-[560px] text-center">
                    <h1 className="text-2xl font-bold font-ubuntu text-white leading-snug">
                        We Found Your Multiple Brokers Exposing Your Data
                    </h1>
                    <p className="text-base font-normal font-ubuntu text-[#B8C4CC] leading-relaxed">
                        Compiling and building your report now
                        <span
                            aria-hidden
                            className="inline-block w-[3ch] text-left font-medium"
                        >
                            {ellipsis}
                        </span>
                        <span className="sr-only">Loading</span>
                    </p>
                </div>
            </div>

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-20">
                <button 
                  onClick={() => navigate("/")}
                  className="text-white text-xs hover:underline uppercase tracking-widest outline-none"
                >
                    Cancel Search
                </button>
            </div>
        </div>
    );
}
