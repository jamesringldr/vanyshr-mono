import { useEffect, useMemo, useState, type SVGProps } from "react";
import { useNavigate } from "react-router";
import { Eye, Github, Radar, Trash2, X } from "lucide-react";
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

/** Custom search-glyph icon (from /Users/jameso/Downloads/search.svg), recolored via currentColor. */
function SearchIcon({ className }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1499.999933" className={className}>
      <defs>
        <clipPath id="vs-search-clip">
          <path d="M 11 67.5 L 1445 67.5 L 1445 1500 L 11 1500 Z M 11 67.5 " clipRule="nonzero" />
        </clipPath>
      </defs>
      <g clipPath="url(#vs-search-clip)">
        <path
          fill="currentColor"
          d="M 893.960938 67.5 C 753.121094 67.5 612.285156 121.226562 504.828125 228.691406 C 304.453125 429.0625 290.984375 745.460938 464.246094 961.542969 L 403.921875 1021.863281 C 371.980469 1016.707031 338.128906 1026.1875 313.523438 1050.816406 L 42.335938 1321.996094 C 1.605469 1362.714844 1.605469 1428.726562 42.335938 1469.445312 C 62.683594 1489.808594 89.378906 1499.996094 116.058594 1499.996094 C 142.734375 1499.996094 169.433594 1489.808594 189.777344 1469.445312 L 460.964844 1198.261719 C 485.585938 1173.648438 495.0625 1139.816406 489.914062 1107.890625 L 550.253906 1047.554688 C 650.449219 1127.894531 772.183594 1168.152344 893.960938 1168.152344 C 1034.800781 1168.152344 1175.640625 1114.421875 1283.101562 1006.96875 C 1498.011719 792.050781 1498.011719 443.609375 1283.101562 228.695312 C 1175.644531 121.226562 1034.804688 67.5 893.960938 67.5 Z M 1197.078125 920.941406 C 1116.113281 1001.90625 1008.464844 1046.496094 893.960938 1046.496094 C 779.457031 1046.496094 671.808594 1001.90625 590.84375 920.941406 C 509.878906 839.976562 465.289062 732.324219 465.289062 617.824219 C 465.289062 503.324219 509.878906 395.671875 590.84375 314.707031 C 671.808594 233.742188 779.460938 189.152344 893.960938 189.152344 C 1008.460938 189.152344 1116.113281 233.742188 1197.078125 314.707031 C 1278.042969 395.671875 1322.632812 503.320312 1322.632812 617.824219 C 1322.632812 732.328125 1278.042969 839.976562 1197.078125 920.941406 Z M 1197.078125 920.941406 "
          fillOpacity="1"
          fillRule="nonzero"
        />
      </g>
    </svg>
  );
}

/** Custom monitor/binoculars icon (from /Users/jameso/Downloads/Monitor.svg), recolored via currentColor. */
function MonitorIcon({ className }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1499.999933" className={className}>
      <defs>
        <clipPath id="vs-monitor-clip">
          <path d="M 40.371094 406 L 1457 406 L 1457 1261 L 40.371094 1261 Z M 40.371094 406 " clipRule="nonzero" />
        </clipPath>
      </defs>
      <g clipPath="url(#vs-monitor-clip)">
        <path
          fill="currentColor"
          d="M 225.871094 526.074219 L 104.152344 759.695312 C 79.75 806.59375 51.859375 854.378906 42.679688 907.714844 C 12.679688 1082.011719 134.351562 1238.332031 303.992188 1257.878906 C 466.023438 1276.539062 629.332031 1158.132812 633.996094 986.882812 L 637.136719 872.75 L 705.191406 892.492188 C 781.097656 914.492188 825.683594 860.519531 861.917969 885.8125 C 845.175781 1014.484375 882.492188 1122.722656 975.09375 1196.292969 C 1100.546875 1295.988281 1280.203125 1276.882812 1384.9375 1156.265625 C 1475.183594 1052.296875 1475.722656 913.070312 1411.84375 795.054688 L 1245.492188 487.617188 C 1206.210938 415.03125 1104.375 399.070312 1027.09375 409.335938 C 959.332031 418.324219 896.828125 469.152344 852.640625 537.320312 C 784.832031 489.238281 703.277344 480.007812 642.785156 542.328125 C 582.195312 429.570312 459.441406 379.230469 341.796875 420.191406 C 290.441406 438.066406 250.324219 479.121094 225.824219 526.171875 Z M 1058.320312 770.5 C 1119.792969 739.265625 1199.1875 737.347656 1259.386719 769.515625 C 1338.878906 812.046875 1381.890625 895.535156 1373.003906 981.527344 C 1364.460938 1064.085938 1309.761719 1143.644531 1214.949219 1169.871094 C 1103.34375 1200.761719 995.765625 1136.523438 958.300781 1040.757812 C 918.582031 939.144531 957.371094 821.722656 1058.320312 770.5 Z M 721.539062 733.371094 C 737.890625 725.367188 771.917969 732.289062 784.683594 744.027344 C 803.882812 761.757812 803.292969 806.351562 773.734375 821.820312 C 747.171875 835.71875 708.726562 823.6875 698.21875 798.296875 C 690.65625 780.027344 705.335938 741.277344 721.539062 733.371094 Z M 552.4375 972 C 544.238281 1105.191406 423.699219 1198.648438 296.527344 1172.964844 C 174.613281 1148.359375 89.816406 1022.832031 135.136719 888.90625 C 171.027344 782.875 279.492188 731.75 376.414062 749.871094 C 481.046875 769.417969 559.265625 861.550781 552.488281 971.953125 Z M 552.4375 972 "
          fillOpacity="1"
          fillRule="nonzero"
        />
      </g>
      <path
        fill="currentColor"
        d="M 1139.828125 375.105469 C 1129.023438 338.519531 1112.085938 297.460938 1086.011719 272.90625 C 1046.390625 235.628906 991.640625 232.042969 946.027344 250.511719 C 910.429688 264.851562 863.980469 304.777344 863.785156 351.089844 L 863.292969 459.527344 C 941.953125 381.980469 1026.945312 350.058594 1139.875 375.105469 Z M 1139.828125 375.105469 "
        fillOpacity="1"
        fillRule="nonzero"
      />
      <path
        fill="currentColor"
        d="M 629.429688 453.535156 L 630.117188 329.480469 C 597.710938 261.707031 521.851562 225.21875 454.238281 247.515625 C 438.527344 252.671875 403.320312 273.445312 396.988281 287.148438 L 356.628906 374.367188 C 464.992188 353.890625 548.953125 376.136719 629.429688 453.585938 Z M 629.429688 453.535156 "
        fillOpacity="1"
        fillRule="nonzero"
      />
      <path
        fill="currentColor"
        d="M 1153.328125 844.363281 C 1161.628906 845.148438 1186.421875 823 1180.875 817.253906 L 1160.054688 795.449219 C 1061.90625 799.082031 995.71875 867.640625 992.183594 966.453125 L 1022.96875 981.183594 C 1040.347656 989.484375 1049.433594 834.734375 1153.328125 844.410156 Z M 1153.328125 844.363281 "
        fillOpacity="1"
        fillRule="nonzero"
      />
      <path
        fill="currentColor"
        d="M 173.089844 950.589844 C 173.285156 962.917969 188.3125 979.808594 197.789062 982.363281 C 204.90625 984.28125 222.289062 962.328125 221.894531 953.289062 C 216.984375 839.992188 392.914062 843.871094 364.628906 816.46875 C 358.984375 810.964844 340.570312 798.394531 328.933594 797.558594 C 256.953125 792.351562 171.765625 870.585938 173.039062 950.589844 Z M 173.089844 950.589844 "
        fillOpacity="1"
        fillRule="nonzero"
      />
    </svg>
  );
}

const CYCLE_WORDS = [
  {
    word: "Find",
    Icon: SearchIcon,
    subtext: (
      <>
        Find the exact private data
        <br />
        thats discoverable online
      </>
    ),
  },
  {
    word: "Expose",
    Icon: Eye,
    subtext: (
      <>
        Expose the exact brokers and sources
        <br />
        that are sharing your private data
      </>
    ),
  },
  {
    word: "Scan",
    Icon: Radar,
    subtext: (
      <>
        Scan millions of dark web forums and breaches
        <br />
        to find any vulnerabilities
      </>
    ),
  },
  {
    word: "Remove",
    Icon: Trash2,
    subtext: (
      <>
        Automatically remove your private data
        <br />
        from brokers and sources exposing it
      </>
    ),
  },
  {
    word: "Monitor",
    Icon: MonitorIcon,
    subtext: (
      <>
        Monitor in real time for any new
        <br />
        exposures or vulnerabilities
      </>
    ),
  },
] as const;
const WORD_CYCLE_MS = 2500;
const ROW_PX = 100;
const CENTER_PX = 130;

/**
 * Vertical picker-wheel of words. The focused word grows into a bordered
 * card (icon + word + subtext); as it cycles out, that same card shrinks
 * back down to a plain faded text line — and the next word grows into a
 * card as it arrives.
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
  const visible = CYCLE_WORDS.map(({ word, Icon, subtext }, i) => ({
    word,
    Icon,
    subtext,
    offset: ((i - index + total + 1) % total) - 1,
  })).filter(({ offset }) => Math.abs(offset) <= 1);

  return (
    <div className="relative h-[260px] w-full overflow-hidden">
      {visible.map(({ word, Icon, subtext, offset }) => {
        const active = offset === 0;
        return (
          <div
            key={word}
            className={cx(
              "absolute inset-x-0 flex items-center gap-4 rounded-2xl border-2 transition-all duration-1000 ease-[cubic-bezier(0.2,0,0,1)]",
              active ? "bg-bg-surface-secondary border-accent-primary" : "border-transparent bg-transparent",
            )}
            style={{
              top: CENTER_PX + offset * ROW_PX,
              opacity: active ? 1 : 0.4,
              transform: "translateY(-50%)",
              transformOrigin: "left center",
              padding: active ? 20 : 0,
            }}
          >
            <div
              className="shrink-0 overflow-hidden transition-all duration-1000 ease-[cubic-bezier(0.2,0,0,1)]"
              style={{ width: active ? 48 : 0, opacity: active ? 1 : 0 }}
            >
              <Icon className="h-12 w-12 text-accent-primary" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span
                className={cx(
                  "text-left font-bold tracking-tight transition-all duration-1000 ease-[cubic-bezier(0.2,0,0,1)]",
                  active ? "text-[28px] text-text-primary" : "text-[30px] text-text-secondary",
                )}
              >
                {word}
              </span>
              <div
                className="grid transition-all duration-1000 ease-[cubic-bezier(0.2,0,0,1)]"
                style={{ gridTemplateRows: active ? "1fr" : "0fr" }}
              >
                <p className="overflow-hidden text-[14px] leading-snug text-text-secondary">
                  {subtext}
                </p>
              </div>
            </div>
          </div>
        );
      })}
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
