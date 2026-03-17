import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";

const KEYFRAMES = `
@keyframes qs-float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-14px); }
}
@keyframes qs-glow-pulse {
  0%, 100% { opacity: 0.25; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(1.12); }
}
@keyframes qs-dot-blink {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}
@keyframes qs-fade-up {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes qs-scan-line {
  0%   { top: 0%; opacity: 0.8; }
  45%  { opacity: 0.8; }
  50%  { opacity: 0; }
  51%  { top: 100%; opacity: 0; }
  52%  { opacity: 0.8; }
  100% { top: 0%; opacity: 0.8; }
}
`;

export function ScanningStartedPage() {
  return (
    <>
      <style>{KEYFRAMES}</style>

      <div
        className="min-h-screen w-full bg-[#022136] flex items-center justify-center px-6 py-12"
        role="main"
        aria-label="Scan started"
      >
        <div className="w-full max-w-sm flex flex-col items-center text-center">

          {/* ── Ghost icon ────────────────────────────── */}
          <div
            className="relative mb-7 flex items-center justify-center"
            style={{ animation: "qs-fade-up 0.5s ease both" }}
          >
            {/* ambient glow */}
            <div
              className="absolute rounded-full bg-[#00BFFF]"
              style={{
                width: 160,
                height: 160,
                filter: "blur(40px)",
                animation: "qs-glow-pulse 3.5s ease-in-out infinite",
                zIndex: 0,
              }}
              aria-hidden
            />
            {/* scan line overlay */}
            <div
              className="absolute overflow-hidden pointer-events-none"
              style={{ width: 160, height: 160, zIndex: 2 }}
              aria-hidden
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: 2,
                  background:
                    "linear-gradient(90deg, transparent 0%, #00BFFF 40%, #00D4FF 60%, transparent 100%)",
                  animation: "qs-scan-line 2.8s linear infinite",
                }}
              />
            </div>
            <img
              src={PrimaryIconOutline}
              alt="Vanyshr ghost icon"
              className="relative object-contain"
              style={{
                width: 160,
                height: 160,
                animation: "qs-float 4s ease-in-out infinite",
                zIndex: 1,
              }}
            />
          </div>

          {/* ── Title ─────────────────────────────────── */}
          <h1
            className="text-[32px] font-bold tracking-tighter text-white mb-4"
            style={{ animation: "qs-fade-up 0.5s 0.1s ease both" }}
          >
            Vanyshing
            <span className="inline-flex gap-[2px] ml-[2px]" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    animation: `qs-dot-blink 1.4s ${i * 0.22}s ease-in-out infinite`,
                  }}
                >
                  .
                </span>
              ))}
            </span>
          </h1>

          {/* ── Body copy ─────────────────────────────── */}
          <p
            className="text-[#B8C4CC] text-base leading-relaxed mb-6"
            style={{ animation: "qs-fade-up 0.5s 0.2s ease both" }}
          >
            Our AI Agents have started searching{" "}
            <span className="text-[#00BFFF] font-semibold">500+ sources</span>{" "}
            for your data &amp; immediately submitting removal demands.
          </p>

          {/* ── Thorough callout ──────────────────────── */}
          <div
            className="w-full border-t border-[#2A4A68] pt-5 space-y-3"
            style={{ animation: "qs-fade-up 0.5s 0.3s ease both" }}
          >
            <div>
              <p className="text-white text-sm font-bold">
                Our search is{" "}
                <span className="text-[#00BFFF]">THOROUGH!</span>
              </p>
              <p className="mt-1 text-[#7A92A8] text-xs leading-relaxed">
                Our agents need a little time to fully search all sources.
              </p>
            </div>

            {/* email notice */}
            <div className="bg-[#2D3847] border border-[#2A4A68] rounded-xl px-4 py-3">
              <p className="text-white text-sm font-bold leading-relaxed">
                We&apos;ll send you an email with an exposure report and a link
                to your Dashboard the minute your scan is finished.
              </p>
            </div>
          </div>

          {/* ── Coverage card ─────────────────────────── */}
          <div
            className="w-full mt-6"
            style={{ animation: "qs-fade-up 0.5s 0.4s ease both" }}
          >
            <p className="text-left text-[11px] font-medium tracking-wide uppercase text-[#7A92A8] mb-2">
              Where we are looking
            </p>
            <div className="w-full bg-[#2D3847] border border-[#2A4A68] rounded-2xl p-5 text-left">
              <ul className="space-y-4" role="list">
                <li className="flex items-start gap-3">
                  <span
                    className="text-[#00BFFF] text-base leading-none mt-[3px] select-none"
                    aria-hidden
                  >
                    ●
                  </span>
                  <span className="text-white font-semibold text-sm leading-relaxed">
                    Dark Web forums, marketplaces and known credential leaks
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    className="text-[#00BFFF] text-base leading-none mt-[3px] select-none"
                    aria-hidden
                  >
                    ●
                  </span>
                  <span className="text-white font-semibold text-sm leading-relaxed">
                    Data Brokers &amp; &lsquo;People-search&rsquo; sites
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
