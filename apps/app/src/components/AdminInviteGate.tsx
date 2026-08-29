import { cx } from "@/utils/cx";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";

interface AdminInviteGateProps {
  scanId?: string;
  emailHint?: string | null;
}

/**
 * Masks an email for display: first char + asterisks + domain
 * e.g., "james@example.com" → "j***@example.com"
 */
function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "your email";
  const [local, domain] = email.split("@");
  if (!local || local.length === 0) return "your email";
  return `${local[0]}***@${domain}`;
}

/**
 * AdminInviteGate — Auth gate for admin-sent quick scans
 *
 * Display when:
 *  • status === 'admin_sent'
 *  • User is not authenticated
 *
 * Content:
 *  • Masked email hint
 *  • "Check your email" / "Contact support" (no resend from client)
 *  • Visual style: copy from check-email.tsx
 */
export function AdminInviteGate({ emailHint }: AdminInviteGateProps) {
  const maskedEmail = maskEmail(emailHint);

  return (
    <div
      className={cx(
        "min-h-screen w-full font-sans transition-colors duration-200",
        "bg-[#F0F4F8] dark:bg-[#0B1B2B]",
      )}
      role="main"
      aria-label="Email verification gate"
    >
      <div className="mx-auto flex w-full max-w-sm flex-col px-4 pb-10 pt-10">
        <div className="flex justify-center">
          <img
            src={PrimaryIconOutline}
            alt=""
            className="h-28 w-28"
            aria-hidden
          />
        </div>

        <h1 className="mt-3 text-center text-2xl font-bold tracking-tight text-[#0B1B2B] dark:text-white">
          Your privacy report is ready
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
          We sent a secure link to
          <br />
          <span className="font-semibold text-[#0B1B2B] dark:text-white">
            {maskedEmail}
          </span>
        </p>

        <p className="mt-5 text-center text-sm font-bold text-[#0B1B2B] dark:text-white">
          Open it on this device to view your report.
          <br />
          No password needed.
        </p>

        <div
          className={cx(
            "mt-4 rounded-xl border p-4",
            "bg-[var(--bg-surface)] dark:bg-[#112538]",
            "border-[var(--border-subtle)] dark:border-[#1E3A52]",
          )}
        >
          <div className="text-center">
            <p className="text-sm font-bold text-[#0B1B2B] dark:text-white">
              Didn&apos;t get it?
            </p>
            <p className="mt-1 text-xs text-[#7A92A8]">
              Check your spam folder, or contact support.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm font-bold text-[#0B1B2B] dark:text-white">
            Still having issues?
          </p>
          <a
            href="mailto:support@vanyshr.com"
            className="mt-1 inline-block text-xs font-medium text-[#14ABFE] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 outline-focus-ring rounded"
          >
            Send to Support
          </a>
          <p className="mt-1 text-xs text-[#7A92A8]">
            We will investigate and contact you ASAP!
          </p>
        </div>
      </div>
    </div>
  );
}
