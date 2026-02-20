import { useNavigate } from "react-router";

export function SearchingPage() {
    const navigate = useNavigate();

    return (
        <div
            className="min-h-screen w-full flex flex-col items-center justify-center bg-[#022136] font-ubuntu overflow-hidden"
            role="main"
            aria-label="Searching for data"
        >
            <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-700">
                {/* Logo Scanner Container */}
                <div className="logo-scanner-container select-none">
                    {/* Faded base text */}
                    <span className="scanner-text-base">vanyshr</span>
                    
                    {/* Animated text overlay */}
                    <span className="scanner-text-overlay">vanyshr</span>
                    
                    {/* The scanning logo object */}
                    <div className="scanner-logo-object" />
                </div>

                <div className="flex flex-col items-center gap-3">
                    <p className="text-[#B8C4CC] text-lg font-medium tracking-wide animate-pulse">
                        Searching for exposures...
                    </p>
                    <p className="text-[#7A92A8] text-sm max-w-[280px] text-center leading-relaxed">
                        Crawling the dark web and broker databases to identify your digital footprint.
                    </p>
                </div>
            </div>

            {/* Optional subtle background element or footer */}
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
