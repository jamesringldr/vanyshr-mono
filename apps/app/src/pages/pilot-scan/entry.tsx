import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  X,
  Menu,
  Zap,
  Search,
  Phone,
  Home,
  Users,
  Mail,
  Loader2,
  Briefcase,
  Calendar,
} from "lucide-react";
import {
  AlertTriangleFilled,
  ShieldFilled,
  MailFilled,
  Fingerprint,
  KeyFilled,
  Users as UsersFilled,
} from "@appica/icons-react";
import PrimaryIcon from "@vanyshr/ui/assets/PrimaryIcon-Nooutline.png";
import { QuickScanForm } from "@vanyshr/ui/components/application";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";

type InviteScanResponse = {
  success: boolean;
  first_name?: string;
  last_name?: string;
  city?: string;
  state?: string;
  email?: string;
  scan_id?: string;
  profile_id?: string;
  error?: string;
};

const DRAWER_EASE = [0.2, 0, 0, 1] as const;
const REVEAL_EASE = [0.2, 0, 0, 1] as const;
const GHOST_LIFT_MS = 1850;
const EXPAND_MS = 900;
const EXPAND_AT_MS = 1100;

type EntryPhase = "enter" | "expand" | "slides";

const SLIDES = [
  {
    id: "listed",
    title: (
      <>
        Data brokers expose
        <br />
        your personal data to
        <br />
        scammers and spammers
      </>
    ),
  },
  {
    id: "scan",
    title: (
      <>
        Our AI agents find where
        <br />
        your data is exposed and
        <br />
        automatically remove it
      </>
    ),
  },
  {
    id: "report",
    title: (
      <>
        Start Vanyshing
        <br />
        Run a QuickScan
      </>
    ),
  },
] as const;

/**
 * Pilot-scan entry — /pilot-scan.
 * Splash (headline + ghost rise) then ghost centers, grows, and fades into
 * the Craft-style slides. Continue opens the privacy form.
 */
export function PilotEntryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const scanIdParam = searchParams.get("id");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [ghostLift, setGhostLift] = useState(false);
  const [phase, setPhase] = useState<EntryPhase>("enter");
  const [slide, setSlide] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{
    id: number;
    x: number;
    y: number;
    sl: number;
    axis?: "x" | "y";
  } | null>(null);
  const advanceRef = useRef<number | null>(null);
  const loopingRef = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setGhostLift(true);
      setPhase("slides");
      return;
    }

    setGhostLift(true);
    const tExpand = window.setTimeout(() => setPhase("expand"), EXPAND_AT_MS);
    const tSlides = window.setTimeout(
      () => setPhase("slides"),
      EXPAND_AT_MS + EXPAND_MS,
    );
    return () => {
      window.clearTimeout(tExpand);
      window.clearTimeout(tSlides);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!scanIdParam) return;

    let cancelled = false;

    async function loadInviteScan() {
      const { data, error } = await supabase.rpc("get_invite_scan", {
        p_scan_id: scanIdParam,
      });

      if (cancelled) return;

      const result = data as InviteScanResponse | null;

      if (error || !result?.success) {
        return;
      }

      const resolvedScanId = result.scan_id ?? scanIdParam;
      if (resolvedScanId) {
        sessionStorage.setItem("pendingScanId", resolvedScanId);
      }
      if (result.profile_id) {
        sessionStorage.setItem("pendingProfileId", result.profile_id);
      }
      if (result.email) {
        sessionStorage.setItem("invitePrefillEmail", result.email);
      } else {
        sessionStorage.removeItem("invitePrefillEmail");
      }
    }

    loadInviteScan();

    return () => {
      cancelled = true;
    };
  }, [scanIdParam]);

  async function handlePilotSubmit(fields: {
    firstName: string;
    lastName: string;
    zipCode: string;
    city: string;
    state: string;
  }) {
    sessionStorage.removeItem("pilotScanResult");
    sessionStorage.removeItem("pilotScanError");
    sessionStorage.removeItem("pilotPhase2Result");
    sessionStorage.removeItem("pilotConfirmedEmails");
    sessionStorage.removeItem("pendingScanId");

    const { data, error } = await supabase.functions.invoke("intro-scan", {
      body: {
        firstName: fields.firstName,
        lastName: fields.lastName,
        zipCode: fields.zipCode,
        city: fields.city,
        state: fields.state,
      },
    });
    if (error || data?.error || !data?.id) {
      throw new Error(error?.message || data?.error || "Could not start scan");
    }

    sessionStorage.setItem("pendingScanId", data.id);
    sessionStorage.setItem("pilotScanFields", JSON.stringify(fields));
    setIsDrawerOpen(false);
    navigate("/pilot-scan/splash");
  }

  function goToSlide(index: number) {
    if (index >= SLIDES.length) {
      loopToFirst();
      return;
    }
    const next = Math.max(0, Math.min(SLIDES.length - 1, index));
    const node = scrollerRef.current;
    if (node) {
      node.scrollTo({
        left: next * node.clientWidth,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    }
    setSlide(next);
  }

  function loopToFirst() {
    const node = scrollerRef.current;
    if (!node) return;
    loopingRef.current = true;
    node.scrollTo({
      left: SLIDES.length * node.clientWidth,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }

  function settleCloneIfNeeded() {
    const node = scrollerRef.current;
    if (!node) return false;
    const w = Math.max(1, node.clientWidth);
    if (node.scrollLeft < SLIDES.length * w - 12) return false;
    loopingRef.current = false;
    node.scrollTo({ left: 0, behavior: "auto" });
    setSlide(0);
    return true;
  }

  function handleScroll() {
    const node = scrollerRef.current;
    if (!node) return;
    if (settleCloneIfNeeded()) return;
    const next = Math.round(node.scrollLeft / Math.max(1, node.clientWidth));
    if (next !== slide && next < SLIDES.length) setSlide(next);
  }

  function clearAdvance() {
    if (advanceRef.current != null) {
      window.clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
  }

  function scheduleAdvance(from: number) {
    clearAdvance();
    if (from === SLIDES.length - 1) {
      advanceRef.current = window.setTimeout(() => loopToFirst(), 5000);
      return;
    }
    advanceRef.current = window.setTimeout(() => {
      goToSlide(from + 1);
    }, 2000);
  }

  useEffect(() => {
    clearAdvance();
  }, [slide]);

  function onSwipeDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (phase !== "slides") return;
    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;
    const node = scrollerRef.current;
    if (!node) return;
    swipeRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      sl: node.scrollLeft,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onSwipeMove(e: ReactPointerEvent<HTMLDivElement>) {
    const swipe = swipeRef.current;
    const node = scrollerRef.current;
    if (!swipe || !node || e.pointerId !== swipe.id) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (!swipe.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      swipe.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    }
    if (swipe.axis !== "x") return;
    e.preventDefault();
    node.scrollLeft = swipe.sl - dx;
  }

  function onSwipeUp(e: ReactPointerEvent<HTMLDivElement>) {
    const swipe = swipeRef.current;
    if (!swipe || e.pointerId !== swipe.id) return;
    const node = scrollerRef.current;
    swipeRef.current = null;
    if (!node) return;
    const w = Math.max(1, node.clientWidth);
    if (settleCloneIfNeeded()) return;
    goToSlide(Math.round(node.scrollLeft / w));
  }

  return (
    <>
      <div
        className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-[#0B1B2B] font-ubuntu touch-pan-y pb-[180px]"
        role="main"
        aria-label="Pilot scan invitation"
        onPointerDown={onSwipeDown}
        onPointerMove={onSwipeMove}
        onPointerUp={onSwipeUp}
        onPointerCancel={onSwipeUp}
      >
        <motion.div
          className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-4"
          initial={false}
          animate={{ opacity: phase === "expand" || phase === "slides" ? 1 : 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: REVEAL_EASE }}
          style={{ pointerEvents: phase === "slides" ? "auto" : "none" }}
        >
          <div className="flex min-w-[120px] items-center gap-2">
            <img
              src={PrimaryIcon}
              alt=""
              className="h-7 w-7 object-contain"
            />
            <span className="text-[17px] font-bold tracking-tight text-white">
              Vanyshr
            </span>
          </div>
          <div
            className="flex items-center justify-center"
            role="tablist"
            aria-label="Highlights"
          >
            {SLIDES.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === (slide % SLIDES.length)}
                aria-label={`Slide ${i + 1} of ${SLIDES.length}`}
                className="flex h-8 items-center px-1"
                onClick={() => goToSlide(i)}
              >
                <span
                  className={cx(
                    "h-1.5 rounded-full transition-[width,background-color] duration-200",
                    i === slide ? "w-4 bg-white" : "w-1.5 bg-white/35",
                  )}
                />
              </button>
            ))}
          </div>
          <div className="flex min-w-[120px] justify-end">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white"
            >
              <Menu className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </motion.div>

        <motion.div
          className="flex min-h-0 flex-1 flex-col"
          initial={false}
          animate={{ opacity: phase === "expand" || phase === "slides" ? 1 : 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.42, ease: REVEAL_EASE }}
        >
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {[...SLIDES, SLIDES[0]].map((item, i) => {
            const isClone = i >= SLIDES.length;
            return (
            <section
              key={isClone ? `${item.id}-loop` : item.id}
              className="flex w-full shrink-0 snap-center flex-col items-stretch px-6 pt-[72px] pb-8"
              aria-roledescription="slide"
              aria-label={`Slide ${i + 1} of ${SLIDES.length}`}
            >
              {item.id === "listed" ? (
                <ListedSlide
                  active={phase === "slides" && slide === 0 && !isClone}
                  reduced={Boolean(prefersReducedMotion)}
                  onDone={() => scheduleAdvance(0)}
                />
              ) : item.id === "scan" ? (
                <ScanSlide
                  active={phase === "slides" && slide === 1}
                  reduced={Boolean(prefersReducedMotion)}
                  onDone={() => scheduleAdvance(1)}
                />
              ) : (
                <ReportSlide
                  active={phase === "slides" && slide === 2}
                  reduced={Boolean(prefersReducedMotion)}
                  onDone={() => scheduleAdvance(2)}
                />
              )}
            </section>
            );
          })}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 px-4">
          <footer
            className="w-full rounded-t-[28px] bg-[#1A2E42] px-5 pb-6 pt-5 shadow-[0_0_40px_rgba(20,171,254,0.18)]"
            style={{ pointerEvents: phase === "slides" ? "auto" : "none" }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1E3A52] bg-[#0B1B2B] px-3 py-1 text-[11px] font-medium text-[#14ABFE]">
              <Zap className="h-3 w-3 fill-[#14ABFE]" />
              Real results in ~3 minutes
            </span>
            <h2 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-tight text-white">
              See your exposed data
            </h2>
            <p className="mt-1.5 text-sm leading-snug text-[#94A3B8]">
              We DO NOT save personal data from QuickScan results
            </p>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-[#14ABFE] text-[17px] font-semibold text-white"
            >
              Run QuickScan
            </button>
            <ul className="mt-3 flex justify-center gap-4 text-[12px] font-medium text-[#94A3B8]">
              <li className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-[#14ABFE]" />
                No Paywall
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-[#14ABFE]" />
                No Sign Up
              </li>
            </ul>
          </footer>
        </div>
        </motion.div>

        {phase !== "slides" && (
          <div className="absolute inset-0 z-[35] overflow-hidden" aria-hidden={phase !== "enter"}>
            <motion.h1
              className="absolute inset-x-0 top-[18vh] z-10 px-8 text-center text-[32px] font-bold leading-[1.15] tracking-tight text-white sm:text-[36px]"
              initial={false}
              animate={{ opacity: phase === "enter" ? 1 : 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: REVEAL_EASE }}
            >
              Vanysh from
              <br />
              Scammers &amp; Spammers
            </motion.h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.img
                src={PrimaryIcon}
                alt=""
                className="w-[72%] max-w-[280px] select-none object-contain"
                initial={false}
                animate={{
                  y: ghostLift ? "0vh" : "42vh",
                  // Inside the `phase !== "slides"` guard above, so the
                  // slides case cannot arise here.
                  scale: phase === "expand" ? 9 : 1,
                  opacity: phase === "expand" ? 0 : 1,
                }}
                transition={{
                  y: {
                    duration: prefersReducedMotion ? 0 : GHOST_LIFT_MS / 1000,
                    ease: REVEAL_EASE,
                  },
                  scale: {
                    duration: prefersReducedMotion ? 0 : EXPAND_MS / 1000,
                    ease: REVEAL_EASE,
                  },
                  opacity: {
                    duration: prefersReducedMotion ? 0 : EXPAND_MS / 1000,
                    ease: REVEAL_EASE,
                  },
                }}
              />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: DRAWER_EASE }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              aria-hidden
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.36, ease: DRAWER_EASE }
              }
              className="fixed inset-y-0 right-0 z-50 flex w-[min(100%,320px)] flex-col bg-[#1A2E42] px-5 pt-5 shadow-[-16px_0_40px_rgba(0,0,0,0.28)]"
            >
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold text-white">Menu</p>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#7A92A8] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: DRAWER_EASE }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Start your scan"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.52, ease: DRAWER_EASE }
              }
              drag={prefersReducedMotion ? false : "y"}
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 150) setIsDrawerOpen(false);
              }}
              className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
            >
              <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-[32px] bg-[#112538] shadow-[0_0_40px_rgba(20,171,254,0.35),0_0_80px_rgba(20,171,254,0.18),0_25px_50px_-12px_rgba(0,0,0,0.25)]">
                <div className="flex h-8 w-full shrink-0 items-center justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-[#1E3A52]" />
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setIsDrawerOpen(false)}
                  className="absolute right-4 top-3 cursor-pointer rounded-full p-1.5 text-[#7A92A8] transition-colors hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="overflow-y-auto px-1 pb-10">
                  <QuickScanForm
                    startAtPrivacy
                    onPilotSubmit={handlePilotSubmit}
                    onClose={() => setIsDrawerOpen(false)}
                    className="!bg-transparent"
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

const DETAIL_CARDS = [
  {
    id: "ssn",
    label: "SSN",
    detail: "•••-••-••••",
    Icon: Fingerprint,
    className: "left-0 top-0 z-10 w-[118px] -rotate-[6deg]",
  },
  {
    id: "emails",
    label: "Emails",
    detail: "j••••@gmail.com",
    Icon: Mail,
    className: "right-0 top-0 z-10 w-[118px] rotate-[7deg]",
  },
  {
    id: "phones",
    label: "Phones",
    detail: "(***) •••-••••",
    Icon: Phone,
    className: "left-1 top-[88px] z-10 w-[118px] -rotate-[8deg]",
  },
  {
    id: "dob",
    label: "DOB",
    detail: "••/••/••••",
    Icon: Calendar,
    className: "right-1 top-[88px] z-10 w-[118px] rotate-[8deg]",
  },
  {
    id: "addresses",
    label: "Addresses",
    detail: "Current & previous",
    Icon: Home,
    className: "bottom-3 left-0 z-20 w-[124px] -rotate-[5deg]",
  },
  {
    id: "relatives",
    label: "Relatives",
    detail: "Household names",
    Icon: Users,
    className: "bottom-1 right-1 z-20 w-[124px] rotate-[6deg]",
  },
] as const;

const POP_MS = 260;
const POP_STAGGER_MS = 300;
const HOLD_AFTER_IN_MS = 1000;
const TITLE_SWAP_MS = 380;

function ListedSlide({
  active,
  reduced,
  onDone,
}: {
  active: boolean;
  reduced: boolean;
  onDone?: () => void;
}) {
  const [inCount, setInCount] = useState(0);
  const [outCount, setOutCount] = useState(0);
  const [vanyshCopy, setVanyshCopy] = useState(false);
  const [cleared, setCleared] = useState(false);
  const played = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!active) {
      setInCount(0);
      setOutCount(0);
      setVanyshCopy(false);
      setCleared(false);
      played.current = false;
      return;
    }
    if (played.current) return;
    played.current = true;

    if (reduced) {
      setInCount(DETAIL_CARDS.length);
      setOutCount(DETAIL_CARDS.length);
      setVanyshCopy(true);
      setCleared(true);
      onDoneRef.current?.();
      return;
    }

    let finished = false;
    const timers: number[] = [];
    DETAIL_CARDS.forEach((_, i) => {
      timers.push(
        window.setTimeout(() => setInCount(i + 1), 180 + i * POP_STAGGER_MS),
      );
    });
    const afterIn = 180 + DETAIL_CARDS.length * POP_STAGGER_MS + HOLD_AFTER_IN_MS;
    timers.push(window.setTimeout(() => setVanyshCopy(true), afterIn));
    DETAIL_CARDS.forEach((_, i) => {
      timers.push(
        window.setTimeout(
          () => setOutCount(i + 1),
          afterIn + TITLE_SWAP_MS + i * POP_STAGGER_MS,
        ),
      );
    });
    timers.push(
      window.setTimeout(() => {
        setCleared(true);
        finished = true;
        onDoneRef.current?.();
      }, afterIn + TITLE_SWAP_MS + DETAIL_CARDS.length * POP_STAGGER_MS),
    );
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      if (!finished) played.current = false;
    };
  }, [active, reduced]);

  return (
    <>
      <div className="relative min-h-[108px] w-full text-left">
        <AnimatePresence mode="wait">
          <motion.h1
            key={vanyshCopy ? "vanysh" : "expose"}
            className="text-[30px] font-bold leading-[1.15] tracking-tight text-white sm:text-[34px]"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: TITLE_SWAP_MS / 1000, ease: REVEAL_EASE }}
          >
            {vanyshCopy ? (
              <>We help you Vanysh</>
            ) : (
              <>
                Data brokers expose
                <br />
                your personal data to
                <br />
                scammers and spammers
              </>
            )}
          </motion.h1>
        </AnimatePresence>
      </div>

      <div className="relative mt-6 flex w-full flex-1 items-center justify-center">
        <div className="relative h-[300px] w-full max-w-[320px]">
          <motion.div
            className="absolute left-[48px] top-[28px] h-[220px] w-[230px] rounded-[20px] border border-white/10 bg-[#24384C] px-4 py-4 shadow-[0_16px_36px_rgba(0,0,0,0.32)]"
            initial={false}
            animate={{ rotate: cleared ? 0 : 8 }}
            transition={{ duration: 0.42, ease: REVEAL_EASE }}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#14ABFE]/15">
                <Search className="h-4 w-4 text-[#14ABFE]" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-white">People search</p>
                <p className="text-[10px] text-[#7A92A8]">FastPeopleSearch · AnyWho · Zaba</p>
              </div>
            </div>
            <div className="relative mt-4 min-h-[120px]">
              <motion.div
                className="space-y-2"
                initial={false}
                animate={{ opacity: cleared ? 0 : 1 }}
                transition={{ duration: 0.28, ease: REVEAL_EASE }}
              >
                <div className="h-2.5 w-28 rounded-full bg-white/25" />
                <div className="h-2 w-40 rounded-full bg-white/10" />
                <div className="h-2 w-24 rounded-full bg-white/10" />
                <div className="h-2 w-36 rounded-full bg-white/10" />
                <div className="mt-3 h-2 w-20 rounded-full bg-white/10" />
                <div className="h-2 w-32 rounded-full bg-white/10" />
              </motion.div>
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center"
                initial={false}
                animate={{ opacity: cleared ? 1 : 0, scale: cleared ? 1 : 0.86 }}
                transition={{ duration: 0.36, ease: REVEAL_EASE }}
              >
                <X className="h-14 w-14 text-[#FF3B30]" strokeWidth={3} />
                <p className="mt-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-white">
                  No Data Found
                </p>
              </motion.div>
            </div>
          </motion.div>

          {DETAIL_CARDS.map((card, i) => {
            const visible = inCount > i && outCount <= i;
            return (
              <motion.div
                key={card.id}
                className={cx(
                  "absolute rounded-2xl border border-white/10 bg-[#1A2E42] px-3 py-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.28)]",
                  card.className,
                )}
                initial={false}
                animate={{
                  opacity: visible ? 1 : 0,
                  scale: visible ? 1 : 0.72,
                }}
                transition={{ duration: POP_MS / 1000, ease: REVEAL_EASE }}
              >
                <div className="flex items-center gap-1.5">
                  <card.Icon className="h-3.5 w-3.5 text-[#14ABFE]" />
                  <p className="text-[11px] font-semibold text-white">{card.label}</p>
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-[#94A3B8]">{card.detail}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </>
  );
}

const BROKER_HITS = [
  { id: "fps", name: "FastPeopleSearch", fields: "Legal Name, Addresses" },
  { id: "npd", name: "National Public Data", fields: "SSN, DOB" },
  { id: "anywho", name: "AnyWho", fields: "Phone Numbers, Legal Name" },
  { id: "zaba", name: "ZabaSearch", fields: "Addresses, Phone Numbers" },
] as const;

const SLIDE_OUT_MS = 340;
const REMOVE_STAGGER_MS = 420;

function ScanSlide({
  active,
  reduced,
  onDone,
}: {
  active: boolean;
  reduced: boolean;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState(0);
  const [sliding, setSliding] = useState(-1);
  const [removed, setRemoved] = useState(0);
  const [removeCopy, setRemoveCopy] = useState(false);
  const [cleared, setCleared] = useState(false);
  const played = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!active) {
      setShown(0);
      setSliding(-1);
      setRemoved(0);
      setRemoveCopy(false);
      setCleared(false);
      played.current = false;
      return;
    }
    if (played.current) return;
    played.current = true;

    if (reduced) {
      setShown(BROKER_HITS.length);
      setRemoved(BROKER_HITS.length);
      setRemoveCopy(true);
      setCleared(true);
      onDoneRef.current?.();
      return;
    }

    let finished = false;
    const timers: number[] = [];
    BROKER_HITS.forEach((_, i) => {
      timers.push(window.setTimeout(() => setShown(i + 1), 280 + i * POP_STAGGER_MS));
    });
    const afterIn = 280 + BROKER_HITS.length * POP_STAGGER_MS + HOLD_AFTER_IN_MS;
    timers.push(window.setTimeout(() => setRemoveCopy(true), afterIn));

    BROKER_HITS.forEach((_, i) => {
      const start = afterIn + TITLE_SWAP_MS + i * REMOVE_STAGGER_MS;
      timers.push(window.setTimeout(() => setSliding(i), start));
      timers.push(
        window.setTimeout(() => {
          setSliding(-1);
          setRemoved(i + 1);
        }, start + SLIDE_OUT_MS),
      );
    });
    timers.push(
      window.setTimeout(() => {
        setCleared(true);
        finished = true;
        onDoneRef.current?.();
      }, afterIn + TITLE_SWAP_MS + BROKER_HITS.length * REMOVE_STAGGER_MS + 280),
    );

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      if (!finished) played.current = false;
    };
  }, [active, reduced]);

  return (
    <>
      <div className="relative min-h-[108px] w-full text-left">
        <AnimatePresence mode="wait">
          <motion.h1
            key={removeCopy ? "remove" : "find"}
            className="text-[30px] font-bold leading-[1.15] tracking-tight text-white sm:text-[34px]"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: TITLE_SWAP_MS / 1000, ease: REVEAL_EASE }}
          >
            {removeCopy ? (
              <>
                and automate full
                <br />
                removal from each source
              </>
            ) : (
              <>
                Our agents find exactly
                <br />
                where your data is exposed...
              </>
            )}
          </motion.h1>
        </AnimatePresence>
      </div>

      <div className="relative mt-6 flex w-full flex-1 items-center justify-center">
        <div className="relative w-full max-w-[300px] overflow-hidden rounded-[20px] border border-white/10 bg-[#24384C] px-4 py-4 shadow-[0_16px_36px_rgba(0,0,0,0.32)]">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#14ABFE]/15">
              {cleared ? (
                <Search className="h-4 w-4 text-[#14ABFE]" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-[#14ABFE]" />
              )}
            </span>
            <div>
              <p className="text-[13px] font-semibold text-white">
                {cleared ? "Brokers scanned" : "Scanning Brokers"}
              </p>
              <p className="text-[10px] text-[#7A92A8]">
                {cleared ? "Nothing left on file" : "Live people-search sweep"}
              </p>
            </div>
          </div>
          <div className="relative mt-3 min-h-[188px]">
            <motion.div
              className="flex flex-col gap-2 overflow-hidden"
              initial={false}
              animate={{ opacity: cleared ? 0 : 1 }}
              transition={{ duration: 0.28, ease: REVEAL_EASE }}
            >
              {BROKER_HITS.slice(0, shown).map((hit, i) => {
                const isRemoved = removed > i;
                const isSliding = sliding === i;
                return (
                  <motion.div
                    key={`${hit.id}-${isRemoved ? "removed" : "found"}`}
                    className="rounded-xl border border-white/10 bg-[#1A2E42] px-3 py-2.5"
                    initial={
                      isRemoved
                        ? { opacity: 0, x: 24 }
                        : { opacity: 0, y: 10, scale: 0.96, x: 0 }
                    }
                    animate={{
                      opacity: isSliding ? 0 : 1,
                      y: 0,
                      scale: 1,
                      x: isSliding ? "-120%" : 0,
                    }}
                    transition={{
                      duration: isSliding ? SLIDE_OUT_MS / 1000 : POP_MS / 1000,
                      ease: REVEAL_EASE,
                    }}
                  >
                    {isRemoved ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-semibold text-white">{hit.name}</p>
                          <p className="text-[10px] font-semibold text-[#FF3B30]">Profile Removed!</p>
                        </div>
                        <p className="mt-0.5 text-[10px] leading-snug text-[#7A92A8]">{hit.fields}</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-semibold text-white">{hit.name}</p>
                          <p className="text-[10px] font-semibold text-[#22C55E]">Profile Found!</p>
                        </div>
                        <p className="mt-0.5 text-[10px] leading-snug text-[#94A3B8]">{hit.fields}</p>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center"
              initial={false}
              animate={{ opacity: cleared ? 1 : 0, scale: cleared ? 1 : 0.86 }}
              transition={{ duration: 0.36, ease: REVEAL_EASE }}
            >
              <X className="h-14 w-14 text-[#FF3B30]" strokeWidth={3} />
              <p className="mt-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-white">
                No Profiles Found
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}

type ReportBeat = "hex" | "preview";

const HEX_MINI = [
  { id: "critical", label: "Critical", angle: -90, score: 0.82, Icon: AlertTriangleFilled },
  { id: "scam", label: "Scam", angle: -30, score: 0.55, Icon: ShieldFilled },
  { id: "family", label: "Family", angle: 30, score: 0.38, Icon: UsersFilled },
  { id: "identity", label: "Identity Theft", angle: 90, score: 0.7, Icon: Fingerprint },
  { id: "accounts", label: "Accounts", angle: 150, score: 0.48, Icon: KeyFilled },
  { id: "spam", label: "Spam", angle: 210, score: 0.62, Icon: MailFilled },
] as const;

const HEX_VIEW = 200;
const HEX_CENTER = 100;
const HEX_AXIS = 52;
const HEX_LABEL = 88;

function hexPolar(radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: HEX_CENTER + radius * Math.cos(rad),
    y: HEX_CENTER + radius * Math.sin(rad),
  };
}

function hexPoly(radius: number) {
  return HEX_MINI.map((p) => {
    const { x, y } = hexPolar(radius, p.angle);
    return `${x},${y}`;
  }).join(" ");
}

function HexPreview({ reduced, play }: { reduced: boolean; play: boolean }) {
  const [plot, setPlot] = useState(0);

  useEffect(() => {
    if (!play) {
      setPlot(0);
      return;
    }
    if (reduced) {
      setPlot(1);
      return;
    }
    setPlot(0);
    let raf = 0;
    const delay = window.setTimeout(() => {
      let start = 0;
      const duration = 800;
      const tick = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / duration);
        setPlot(1 - (1 - t) ** 3);
        if (t < 1) raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
    }, 160);
    return () => {
      window.clearTimeout(delay);
      window.cancelAnimationFrame(raf);
    };
  }, [play, reduced]);

  const fillPoints = HEX_MINI.map((item) => {
    const { x, y } = hexPolar(HEX_AXIS * item.score * plot, item.angle);
    return `${x},${y}`;
  }).join(" ");

  return (
    <motion.div
      key="hex"
      className="relative aspect-square w-full max-w-[280px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32, ease: REVEAL_EASE }}
    >
      <svg viewBox={`0 0 ${HEX_VIEW} ${HEX_VIEW}`} className="h-full w-full">
        {[0.35, 0.55, 0.75, 1].map((t) => (
          <polygon
            key={t}
            points={hexPoly(HEX_AXIS * t)}
            fill="none"
            stroke="rgba(184, 196, 204, 0.18)"
            strokeWidth={1}
          />
        ))}
        {HEX_MINI.map((item) => {
          const end = hexPolar(HEX_AXIS, item.angle);
          return (
            <line
              key={`ax-${item.id}`}
              x1={HEX_CENTER}
              y1={HEX_CENTER}
              x2={end.x}
              y2={end.y}
              stroke="rgba(184, 196, 204, 0.14)"
              strokeWidth={1}
            />
          );
        })}
        <polygon
          points={fillPoints}
          fill="rgba(20,171,254, 0.22)"
          stroke="#14ABFE"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {HEX_MINI.map((item) => {
          const pt = hexPolar(HEX_AXIS * item.score * plot, item.angle);
          return (
            <circle key={`d-${item.id}`} cx={pt.x} cy={pt.y} r={3.2} fill="#14ABFE" />
          );
        })}
        <circle cx={HEX_CENTER} cy={HEX_CENTER} r={3.5} fill="#14ABFE" />
      </svg>
      {HEX_MINI.map((item) => {
        const pt = hexPolar(HEX_LABEL, item.angle);
        const Icon = item.Icon;
        return (
          <div
            key={`lb-${item.id}`}
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{
              left: `${(pt.x / HEX_VIEW) * 100}%`,
              top: `${(pt.y / HEX_VIEW) * 100}%`,
            }}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/35 bg-[#0B1B2B] text-white shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              <Icon size={20} />
            </span>
            <span className="max-w-[72px] text-center text-[9px] font-medium leading-tight text-white">
              {item.label}
            </span>
          </div>
        );
      })}
    </motion.div>
  );
}

function PreProfilePreview() {
  const sections = [
    {
      key: "identity",
      body: (
        <>
          <div className="flex items-end justify-between">
            <p className="text-[13px] font-bold text-white">Michael Scott</p>
            <p className="text-[11px] text-[#94A3B8]">62 years old</p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[#7A92A8]">
                Date of birth
              </p>
              <p className="mt-0.5 text-[11px] text-white">March 15, 1965</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[#7A92A8]">
                Current address
              </p>
              <p className="mt-0.5 text-[11px] text-white">Scranton, PA</p>
            </div>
          </div>
        </>
      ),
    },
    {
      key: "email",
      body: (
        <>
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-[#14ABFE]" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A92A8]">Email</p>
          </div>
          <p className="mt-1 text-[11px] text-white">mscott@dundermifflin.com</p>
        </>
      ),
    },
    {
      key: "aka",
      body: (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A92A8]">
            Also known as
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {["Caleb Crawdad", "Michael Scarn", "Prison Mike"].map((alias) => (
              <span
                key={alias}
                className="rounded-lg border border-[#1E3A52] bg-[#0B1B2B]/50 px-2 py-0.5 text-[10px] text-white"
              >
                {alias}
              </span>
            ))}
          </div>
        </>
      ),
    },
    {
      key: "family",
      body: (
        <>
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[#14ABFE]" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A92A8]">
              Friends &amp; family
            </p>
          </div>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-white">
            <li>Jan Levinson-Gould</li>
            <li>Dwight Schrute</li>
            <li>Todd Packer</li>
          </ul>
        </>
      ),
    },
    {
      key: "jobs",
      body: (
        <>
          <div className="flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-[#14ABFE]" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A92A8]">
              Job history
            </p>
          </div>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-white">
            <li>Dunder Mifflin — Regional Manager</li>
            <li>Michael Scott Paper Co. — Founder</li>
          </ul>
        </>
      ),
    },
  ];

  return (
    <motion.div
      key="preview"
      className="flex w-full max-w-[300px] flex-col gap-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: REVEAL_EASE }}
    >
      {sections.map((section, i) => (
        <motion.div
          key={section.key}
          className="rounded-xl border border-[#1E3A52] bg-[#112538] px-3 py-2.5"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.32,
            delay: i * 0.12,
            ease: REVEAL_EASE,
          }}
        >
          {section.body}
        </motion.div>
      ))}
    </motion.div>
  );
}

function ReportSlide({
  active,
  reduced,
  onDone,
}: {
  active: boolean;
  reduced: boolean;
  onDone?: () => void;
}) {
  const [beat, setBeat] = useState<ReportBeat>("hex");
  const played = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!active) {
      setBeat("hex");
      played.current = false;
      return;
    }
    if (played.current) return;
    played.current = true;
    if (reduced) {
      setBeat("preview");
      onDoneRef.current?.();
      return;
    }
    let finished = false;
    const tPreview = window.setTimeout(() => setBeat("preview"), 2000 + 720);
    const tDone = window.setTimeout(() => {
      finished = true;
      onDoneRef.current?.();
    }, 2000 + 720 + 900);
    return () => {
      window.clearTimeout(tPreview);
      window.clearTimeout(tDone);
      if (!finished) played.current = false;
    };
  }, [active, reduced]);

  return (
    <>
      <div className="w-full text-left">
        <h1 className="text-[30px] font-bold leading-[1.15] tracking-tight text-white sm:text-[34px]">
          Start Vanyshing
          <br />
          Run a QuickScan
        </h1>
        <div className="relative mt-2 min-h-[28px]">
          <AnimatePresence mode="wait">
            <motion.p
              key={beat}
              className="text-[18px] font-semibold leading-snug tracking-tight text-[#94A3B8] sm:text-[20px]"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: TITLE_SWAP_MS / 1000, ease: REVEAL_EASE }}
            >
              {beat === "hex" ? "Get a Risk Report" : "See your real exposed data"}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <div className="relative mt-6 flex w-full flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {beat === "hex" ? (
            <HexPreview reduced={reduced} play={active} />
          ) : (
            <PreProfilePreview />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
