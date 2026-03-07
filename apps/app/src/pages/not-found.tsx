import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import logoIcon from "../../../../packages/shared/assets/LogoFiles/PrimaryIcon-outline.svg";

export function NotFound() {
    const navigate = useNavigate();

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center px-6"
            style={{ backgroundColor: "#022136", fontFamily: "’Ubuntu’, sans-serif" }}
        >
            {/* 4 [logo] 4 */}
            <motion.div
                className="flex items-center justify-center"
                style={{ gap: "12px" }}
                initial={{ opacity: 0, y: -24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
            >
                <span
                    className="font-bold leading-none select-none"
                    style={{
                        fontSize: "clamp(96px, 20vw, 180px)",
                        color: "#FFFFFF",
                        letterSpacing: "-0.05em",
                        lineHeight: 1,
                    }}
                >
                    4
                </span>

                <img
                    src={logoIcon}
                    alt="0"
                    style={{
                        width: "clamp(80px, 16vw, 148px)",
                        height: "clamp(80px, 16vw, 148px)",
                        objectFit: "contain",
                        filter: "brightness(0) invert(1)",
                    }}
                />

                <span
                    className="font-bold leading-none select-none"
                    style={{
                        fontSize: "clamp(96px, 20vw, 180px)",
                        color: "#FFFFFF",
                        letterSpacing: "-0.05em",
                        lineHeight: 1,
                    }}
                >
                    4
                </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
                className="font-bold text-center mt-6"
                style={{
                    color: "#FFFFFF",
                    fontSize: "clamp(22px, 5vw, 30px)",
                    letterSpacing: "-0.03em",
                    maxWidth: "480px",
                }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            >
                Uh oh — this page has{" "}
                <span style={{ color: "#00BFFF" }}>vanyshed</span>.
            </motion.h1>

            {/* Supporting copy */}
            <motion.p
                className="text-center mt-3"
                style={{
                    color: "#B8C4CC",
                    fontSize: "16px",
                    lineHeight: "1.6",
                    maxWidth: "380px",
                }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
            >
                We looked everywhere. It’s gone — like your data{" "}
                <em>should</em> be.
            </motion.p>

            {/* Buttons */}
            <motion.div
                className="flex flex-col gap-3 mt-8 w-full"
                style={{ maxWidth: "320px" }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            >
                {/* Primary: Dashboard */}
                <button
                    onClick={() => navigate("/dashboard")}
                    className="cursor-pointer font-bold transition-colors duration-150"
                    style={{
                        width: "100%",
                        height: "52px",
                        borderRadius: "12px",
                        backgroundColor: "#00BFFF",
                        color: "#022136",
                        fontSize: "16px",
                        border: "none",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#00D4FF")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#00BFFF")}
                >
                    Go to Dashboard
                </button>

                {/* Divider + new user prompt */}
                <div className="flex flex-col items-center gap-1 pt-3 pb-1">
                    <p className="font-bold" style={{ color: "#FFFFFF", fontSize: "14px" }}>
                        Don't have an account?
                    </p>
                    <p className="text-center" style={{ color: "#B8C4CC", fontSize: "13px", lineHeight: "1.5" }}>
                        Start with a QuickScan to see if your data is exposed.
                    </p>
                </div>

                {/* Secondary: QuickScan */}
                <button
                    onClick={() => navigate("/quick-scan")}
                    className="cursor-pointer font-bold transition-colors duration-150"
                    style={{
                        width: "100%",
                        height: "52px",
                        borderRadius: "12px",
                        backgroundColor: "transparent",
                        color: "#FFFFFF",
                        fontSize: "16px",
                        border: "1px solid #2A4A68",
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "#00BFFF";
                        e.currentTarget.style.color = "#00BFFF";
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "#2A4A68";
                        e.currentTarget.style.color = "#FFFFFF";
                    }}
                >
                    Run a QuickScan
                </button>
            </motion.div>

            {/* Reassurance footer */}
            <motion.p
                className="text-center mt-8"
                style={{ color: "#7A92A8", fontSize: "12px" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
            >
                Nothing to see here. Move along.
            </motion.p>
        </div>
    );
}
