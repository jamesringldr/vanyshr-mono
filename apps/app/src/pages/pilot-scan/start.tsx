import { Link } from "react-router";
import PrimaryIcon from "@vanyshr/ui/assets/PrimaryIcon-Nooutline.png";

/**
 * Placeholder after splash — UI shell only until the next Mobbin screens land.
 */
export function PilotStartPage() {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-[#022136] px-6 font-ubuntu"
      role="main"
      aria-label="Pilot scan start"
    >
      <img
        src={PrimaryIcon}
        alt=""
        className="h-16 w-16 object-contain opacity-95"
      />
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">Pilot scan</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#B8C4CC]">
          Splash is wired. Next screens will land here as we pull structure from the
          remaining references — still UI-only.
        </p>
      </div>
      <Link
        to="/pilot-scan"
        className="text-sm font-semibold text-[#00BFFF] outline-none transition hover:text-[#00D4FF] focus-visible:underline"
      >
        Back to start
      </Link>
    </div>
  );
}
