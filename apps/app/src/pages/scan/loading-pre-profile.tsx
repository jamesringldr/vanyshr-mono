import { useNavigate } from "react-router";

export function LoadingPreProfilePage() {
    const navigate = useNavigate();

    return (
        <div
            className="min-h-screen w-full flex flex-col items-center justify-center bg-[#022136] font-ubuntu overflow-hidden"
            role="main"
            aria-label="Finalizing report"
        >
            <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-700">
                <div className="logo-scanner-container select-none">
                    <span className="scanner-text-base">vanyshr</span>
                    <span className="scanner-text-overlay">vanyshr</span>
                    <div className="scanner-logo-object" />
                </div>

                <div className="flex flex-col items-center gap-3">
                    <p className="text-[#B8C4CC] text-lg font-medium tracking-wide animate-pulse">
                        Finalizing your report...
                    </p>
                    <p className="text-[#7A92A8] text-sm max-w-[280px] text-center leading-relaxed">
                        Securely encrypting and packaging your data removal dashboard.
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
