import { useEffect, useMemo, useState, type SVGProps } from "react";
import { useNavigate } from "react-router";
import { Binoculars, Eye, Github, Radar, Search, Trash2, X } from "lucide-react";
import { MailFilled } from "@appica/icons-react";
import PrimaryIcon from "@vanyshr/ui/assets/PrimaryIcon-Nooutline.png";
import WordmarkOnly from "@vanyshr/ui/assets/WordmarkOnly-DarkMode.png";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";

/** Google "G" mark — lucide has no brand logos, so this is a hand-drawn solid glyph. */
function GoogleIcon({ className }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
    </svg>
  );
}

/** Apple mark — lucide's "Apple" icon is a literal fruit, not the brand logo. */
function AppleIcon({ className }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M16.365,1.43c0,1.14-0.493,2.27-1.177,3.08c-0.744,0.9-1.99,1.57-2.987,1.57c-0.12,0-0.23-0.02-0.3-0.03c-0.01-0.06-0.04-0.22-0.04-0.39c0-1.15,0.572-2.27,1.206-2.98c0.804-0.94,2.142-1.64,3.248-1.68C16.345,1.13,16.365,1.28,16.365,1.43z M20.93,17.14c-0.03,0.07-0.463,1.58-1.518,3.12c-0.945,1.34-1.94,2.71-3.43,2.71c-1.517,0-1.9-0.88-3.63-0.88c-1.698,0-2.302,0.91-3.67,0.91c-1.377,0-2.332-1.26-3.428-2.8c-1.287-1.82-2.323-4.63-2.323-7.28c0-4.28,2.797-6.55,5.552-6.55c1.448,0,2.633,0.95,3.53,0.95c0.854,0,2.184-1.01,3.822-1.01c0.622,0,2.833,0.06,4.311,2.15c-0.109,0.07-2.574,1.51-2.574,4.61C17.571,15.79,20.84,17.1,20.93,17.14z" />
    </svg>
  );
}

const CYCLE_WORDS = [
  {
    word: "Find",
    Icon: Search,
    subtext: "Find the exact private data thats discoverable online",
  },
  {
    word: "Expose",
    Icon: Eye,
    subtext: "Expose the exact brokers and sources that are sharing your private data",
  },
  {
    word: "Scan",
    Icon: Radar,
    subtext: "Scan millions of dark web forums and breaches to find any vulnerabilities",
  },
  {
    word: "Remove",
    Icon: Trash2,
    subtext: "Automatically remove your private data from brokers and sources exposing it",
  },
  {
    word: "Monitor",
    Icon: Binoculars,
    subtext: "Monitor in real time for any new exposures or vulnerabilities",
  },
] as const;
const WORD_CYCLE_MS = 2000;
const ROW_PX_UP = 48;
const ROW_PX_DOWN = 120;
const CENTER_PX = 70;
const SUBTEXT_TOP = CENTER_PX + 36;

/**
 * Vertical picker-wheel of words — focused word plus one faded word above
 * and below, scrolling past at a constant size (no scale-pop). The active
 * word's slot never moves, so the subtext below it can be a separate,
 * fixed-position element that just fades in — it never slides.
 */
function CyclingWords() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % CYCLE_WORDS.length);
    }, WORD_CYCLE_MS);
    return () => window.clearInterval(id);
  }, []);

  const total = CYCLE_WORDS.length;
  const visible = CYCLE_WORDS.map(({ word, Icon }, i) => ({
    word,
    Icon,
    offset: ((i - index + total + 1) % total) - 1,
  })).filter(({ offset }) => Math.abs(offset) <= 1);

  return (
    <div className="relative h-[260px] w-full overflow-hidden">
      {visible.map(({ word, Icon, offset }) => (
        <div
          key={word}
          className="absolute inset-x-0 flex items-center gap-3 transition-all duration-1000 ease-[cubic-bezier(0.2,0,0,1)]"
          style={{
            top: CENTER_PX + offset * (offset < 0 ? ROW_PX_UP : ROW_PX_DOWN),
            opacity: offset === 0 ? 1 : 0.35,
            transform: "translateY(-50%)",
            transformOrigin: "left center",
          }}
        >
          {offset === 0 && <Icon className="h-9 w-9 text-accent-primary" />}
          <span
            className={cx(
              "text-left font-bold tracking-tight transition-all duration-1000 ease-[cubic-bezier(0.2,0,0,1)]",
              offset === 0 ? "text-[42px] text-text-primary" : "text-[30px] text-text-secondary",
            )}
          >
            {word}
          </span>
        </div>
      ))}
      <p
        key={index}
        className="animate-in fade-in absolute inset-x-0 max-w-[300px] text-[15px] leading-snug text-text-secondary duration-700"
        style={{ top: SUBTEXT_TOP }}
      >
        {CYCLE_WORDS[index].subtext}
      </p>
    </div>
  );
}

/**
 * Vanysh-scan entry — /vanysh-scan.
 *
 * Simplified A/B counterpart to /pilot-scan's entry page: a single static
 * hero instead of the swipeable slide carousel + ghost-logo intro sequence.
 * Same brand tokens, animation stripped down. Gates on sign-in (magic-link
 * email; social buttons are visual placeholders until OAuth is configured)
 * instead of the anonymous QuickScan form.
 */
export function VanyshScanEntryPage() {
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showEmailField, setShowEmailField] = useState(false);
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isValidEmail = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

  async function handleSendMagicLink() {
    if (!isValidEmail || isSending) return;
    setIsSending(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });

    if (error) {
      setAuthError(error.message);
      setIsSending(false);
      return;
    }

    navigate(`/confirm-email?email=${encodeURIComponent(email.trim())}`);
  }

  function handleCloseDrawer() {
    setIsDrawerOpen(false);
    setShowEmailField(false);
  }

  return (
    <div
      className="relative flex min-h-dvh w-full flex-col bg-brand-dark font-ubuntu"
      role="main"
      aria-label="Vanysh scan invitation"
    >
      <main className="flex flex-1 flex-col px-6 pb-10">
        <div className="flex flex-1 items-center">
          <CyclingWords />
        </div>

        <div className="flex flex-col items-start text-left">
          <img src={PrimaryIcon} alt="" className="h-16 w-16 object-contain" />
          <img
            src={WordmarkOnly}
            alt="Vanyshr"
            className="mt-6 h-[54px] w-auto object-contain"
          />
          <p className="mt-3 max-w-[300px] text-[15px] leading-snug text-text-secondary">
            Vanysh from hackers, scammers &amp; spammers
          </p>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="mt-8 flex h-12 w-full items-center justify-center rounded-2xl bg-accent-primary text-[17px] font-semibold text-text-primary"
          >
            Sign In
          </button>
          <button
            type="button"
            className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl border border-border-subtle text-[17px] font-semibold text-text-primary"
          >
            Learn More
          </button>
        </div>
      </main>

      <div
        role="presentation"
        onClick={handleCloseDrawer}
        className={cx(
          "fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          isDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!isDrawerOpen}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to Vanyshr"
        aria-hidden={!isDrawerOpen}
        className={cx(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-[32px] bg-bg-surface transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
          isDrawerOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={handleCloseDrawer}
          className="absolute right-4 top-3 cursor-pointer rounded-full p-1.5 text-text-tertiary transition-colors hover:text-text-primary"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center gap-6 overflow-y-auto px-6 pb-10 pt-10">
          <img src={PrimaryIcon} alt="" className="h-14 w-14 object-contain" />
          <h2 className="text-[20px] font-bold tracking-tight text-text-primary">
            Sign in to Vanyshr
          </h2>

          <div className="grid w-full grid-cols-3 gap-3">
            {[
              { label: "Google", Icon: GoogleIcon },
              { label: "GitHub", Icon: Github },
              { label: "Apple", Icon: AppleIcon },
            ].map(({ label, Icon }) => (
              <button
                key={label}
                type="button"
                disabled
                aria-label={`Continue with ${label} (coming soon)`}
                className="flex h-12 items-center justify-center rounded-xl bg-gray-300 text-brand-dark"
              >
                <Icon className="h-5 w-5" fill="currentColor" />
              </button>
            ))}
          </div>

          <div className="w-full">
            {showEmailField ? (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMagicLink()}
                  disabled={isSending}
                  placeholder="Your email address"
                  aria-label="Email address"
                  autoFocus
                  className="h-[52px] w-full rounded-xl border border-border-subtle bg-brand-dark/50 px-4 text-base text-text-primary outline-none transition-colors duration-150 placeholder:text-text-tertiary focus:border-accent-primary disabled:opacity-50"
                />
                {authError && (
                  <p className="mt-2 text-left text-xs text-[#FF5757]">{authError}</p>
                )}
                <button
                  type="button"
                  onClick={handleSendMagicLink}
                  disabled={!isValidEmail || isSending}
                  className="mt-4 flex h-[52px] w-full items-center justify-center rounded-xl bg-gray-300 text-base font-semibold text-brand-dark transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSending ? "Sending..." : "Send Magic Link"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowEmailField(true)}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gray-300 text-base font-semibold text-brand-dark"
              >
                <MailFilled className="h-5 w-5" />
                Magic Link
              </button>
            )}
          </div>

          <div className="flex w-full items-center gap-3 text-[12px] font-medium text-text-tertiary">
            <span className="h-px flex-1 bg-border-subtle" />
            Don't have an account?
            <span className="h-px flex-1 bg-border-subtle" />
          </div>

          <button
            type="button"
            className="flex h-[52px] w-full items-center justify-center rounded-xl border border-border-subtle text-base font-semibold text-text-primary"
          >
            Run Your ExposureSweep
          </button>

          <p className="text-xs text-text-tertiary">
            By continuing you agree to Vanyshr's
            <br />
            <span className="text-text-secondary">Terms of Service</span> and{" "}
            <span className="text-text-secondary">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
