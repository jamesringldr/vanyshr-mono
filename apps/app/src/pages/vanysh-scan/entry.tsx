import { useEffect, useMemo, useState, type SVGProps } from "react";
import { useNavigate } from "react-router";
import { Github, Radar, X } from "lucide-react";
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

/** Custom delete/trash icon (from ~/Downloads/Add a subheading/Delete.svg), recolored via currentColor. */
function DeleteIcon({ className }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1499.999933" className={className}>
      <defs>
        <clipPath id="vs-delete-clip">
          <path d="M 269.621094 38.328125 L 1230.371094 38.328125 L 1230.371094 1461.828125 L 269.621094 1461.828125 Z M 269.621094 38.328125 " clipRule="nonzero" />
        </clipPath>
      </defs>
      <g clipPath="url(#vs-delete-clip)">
        <path
          fill="currentColor"
          d="M 399.71875 506.625 L 1142.28125 506.625 C 1167.539062 506.625 1189.277344 516.0625 1206.523438 534.515625 C 1223.769531 552.96875 1232.472656 575.359375 1230.019531 600.5 L 1153.960938 1379.265625 C 1149.453125 1425.402344 1112.574219 1461.289062 1066.222656 1461.289062 L 475.777344 1461.289062 C 429.425781 1461.289062 392.546875 1425.40625 388.039062 1379.265625 L 311.980469 600.5 C 309.527344 575.359375 318.230469 552.96875 335.476562 534.515625 C 352.722656 516.0625 374.460938 506.625 399.71875 506.625 Z M 602.15625 1278.261719 L 558.1875 685.394531 C 557.011719 668.746094 542.5625 656.203125 525.917969 657.375 C 509.269531 658.550781 496.726562 673 497.902344 689.652344 L 541.871094 1282.515625 C 543.046875 1299.164062 557.492188 1311.710938 574.140625 1310.535156 C 590.789062 1309.359375 603.332031 1294.910156 602.15625 1278.261719 Z M 1000.128906 1282.515625 L 1044.097656 689.652344 C 1045.273438 673 1032.730469 658.550781 1016.082031 657.375 C 999.433594 656.203125 984.984375 668.746094 983.8125 685.394531 L 939.84375 1278.261719 C 938.667969 1294.910156 951.210938 1309.359375 967.859375 1310.535156 C 984.503906 1311.710938 998.953125 1299.164062 1000.128906 1282.515625 Z M 801.261719 1280.390625 L 801.261719 687.523438 C 801.261719 670.808594 787.710938 657.257812 771 657.257812 C 754.289062 657.257812 740.738281 670.808594 740.738281 687.523438 L 740.738281 1280.390625 C 740.738281 1297.105469 754.289062 1310.652344 771 1310.652344 C 787.710938 1310.652344 801.261719 1297.105469 801.261719 1280.390625 Z M 310.300781 300.011719 L 1124.3125 81.871094 C 1153.550781 74.035156 1183.789062 91.496094 1191.625 120.738281 L 1202.511719 161.367188 C 1210.347656 190.609375 1192.886719 220.855469 1163.648438 228.691406 L 349.636719 446.828125 C 320.398438 454.664062 290.15625 437.203125 282.324219 407.960938 L 271.4375 367.332031 C 263.601562 338.085938 281.0625 307.84375 310.300781 300.011719 Z M 547.78125 173.707031 L 855.503906 91.242188 L 851.054688 74.636719 C 844.175781 48.960938 817.625 33.632812 791.953125 40.511719 L 577.453125 97.992188 C 551.78125 104.871094 536.457031 131.425781 543.332031 157.101562 Z M 547.78125 173.707031 "
          fillOpacity="1"
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

/** Custom target icon (from ~/Downloads/Add a subheading/Target.svg), recolored via currentColor. */
function TargetIcon({ className }: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1499.999933" className={className}>
      <defs>
        <clipPath id="vs-target-clip">
          <path d="M 1 7.5 L 1499 7.5 L 1499 1500 L 1 1500 Z M 1 7.5 " clipRule="nonzero" />
        </clipPath>
      </defs>
      <g clipPath="url(#vs-target-clip)">
        <path
          fill="currentColor"
          d="M 1286.097656 441.554688 L 1498.304688 229.359375 L 1298.359375 207.390625 L 1276.40625 7.445312 L 1064.199219 219.640625 L 1078.992188 354.375 L 1044.542969 388.808594 C 933.953125 293.570312 790.867188 235.160156 633.785156 235.160156 C 285.046875 235.160156 1.34375 518.878906 1.34375 867.601562 C 1.34375 1216.335938 285.046875 1500.054688 633.785156 1500.054688 C 982.523438 1500.054688 1266.222656 1216.335938 1266.222656 867.601562 C 1266.222656 742.910156 1229.464844 626.855469 1166.921875 528.785156 L 1055.246094 640.460938 C 1091.84375 708.09375 1112.671875 785.460938 1112.671875 867.601562 C 1112.671875 1131.664062 897.847656 1346.5 633.785156 1346.5 C 369.71875 1346.5 154.898438 1131.664062 154.898438 867.601562 C 154.898438 603.550781 369.71875 388.714844 633.785156 388.714844 C 748.523438 388.714844 853.382812 429.878906 935.867188 497.488281 L 856.996094 576.355469 C 795.070312 528.773438 717.746094 500.304688 633.785156 500.304688 C 431.25 500.304688 266.449219 665.066406 266.449219 867.601562 C 266.449219 1070.148438 431.25 1234.910156 633.785156 1234.910156 C 836.316406 1234.910156 1001.066406 1070.148438 1001.066406 867.601562 C 1001.066406 816.648438 990.597656 768.105469 971.765625 723.941406 L 845.734375 849.972656 C 846.226562 855.886719 847.511719 861.566406 847.511719 867.601562 C 847.511719 985.476562 751.644531 1081.371094 633.785156 1081.371094 C 515.921875 1081.371094 420 985.476562 420 867.601562 C 420 749.738281 515.921875 653.859375 633.785156 653.859375 C 675.320312 653.859375 713.804688 666.148438 746.539062 686.8125 L 666.617188 766.722656 C 656.214844 763.34375 645.320312 761.03125 633.785156 761.03125 C 574.921875 761.03125 527.199219 808.753906 527.199219 867.601562 C 527.199219 926.460938 574.921875 974.171875 633.785156 974.171875 C 692.632812 974.171875 740.355469 926.460938 740.355469 867.601562 C 740.355469 858.5 738.863281 849.824219 736.714844 841.394531 L 1151.359375 426.746094 L 1286.097656 441.554688 "
          fillOpacity="1"
          fillRule="nonzero"
        />
      </g>
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
    Icon: TargetIcon,
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
    Icon: DeleteIcon,
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
const INACTIVE_SCALE = 0.55;

/**
 * Vertical picker-wheel of words. Icon, word, and subtext are always laid
 * out at full size inside the bordered card — the whole card is scaled up
 * or down as ONE unit (anchored to its own left edge) rather than having
 * the icon/subtext each independently collapse their own width/height.
 * That keeps everything growing and shrinking in lockstep instead of
 * wiping/clipping past each other mid-transition.
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
              "absolute inset-x-0 flex items-center gap-4 rounded-2xl border-2 p-5 transition-all duration-1000 ease-[cubic-bezier(0.2,0,0,1)]",
              active ? "bg-bg-surface-secondary border-accent-primary" : "border-transparent bg-transparent",
            )}
            style={{
              top: CENTER_PX + offset * ROW_PX,
              opacity: active ? 1 : 0.4,
              transform: `translateY(-50%) scale(${active ? 1 : INACTIVE_SCALE})`,
              transformOrigin: "left center",
            }}
          >
            <Icon className="h-12 w-12 shrink-0 text-accent-primary" />
            <div className="flex min-w-0 flex-col">
              <span
                className={cx(
                  "text-left text-[28px] font-bold tracking-tight transition-colors duration-1000 ease-[cubic-bezier(0.2,0,0,1)]",
                  active ? "text-text-primary" : "text-text-secondary",
                )}
              >
                {word}
              </span>
              <p className="text-[14px] leading-snug text-text-secondary">{subtext}</p>
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
