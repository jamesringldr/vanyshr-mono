import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence, type PanInfo } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { DataExplosionMockup } from "@vanyshr/ui/components/animations";
import { VanyshrAppMockup, ScamMockup, RemovalsMockup } from "@vanyshr/ui/components/marketing";
import { QuickScanForm, type ProfileMatch } from "@vanyshr/ui/components/application";
import { supabase } from "@/lib/supabase";

// ─── Config ───────────────────────────────────────────────────────────────────

const SLIDE_COUNT = 5;
const AUTO_ADVANCE_MS = 6000;

// ─── Slide transition variants ────────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? "-100%" : "100%",
    opacity: 0,
  }),
};

const slideSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

// ─── Slide 1 — Text hero ─────────────────────────────────────────────────────

function Slide1() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.1 }}
      className="w-full h-full flex flex-col items-center justify-start pt-1 px-6 gap-5"
    >
      {/* Badge */}
      <div className="px-3.5 py-1.5 rounded-full bg-[#00BFFF]/10 border border-[#00BFFF]/20">
        <span className="text-[#00BFFF] text-[11px] font-medium tracking-wide uppercase">
          AI-Powered Personal Data Privacy
        </span>
      </div>

      {/* Headline */}
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-[clamp(26px,8vw,40px)] font-extrabold text-white leading-[1.05] flex flex-col items-center text-center">
          <span>Your Personal Data</span>
          <span>
            Is <span className="text-[#FF8A00] italic">Exposed</span>
          </span>
        </h1>
        <p className="text-xl font-bold text-white tracking-tight">
          You've been invited to Vanysh!
        </p>
      </div>

      {/* Subtext */}
      <p className="text-base text-[#B8C4CC] leading-relaxed text-center">
        Phone numbers, home addresses, family members — all publicly listed on
        data broker sites that anyone can search right now.
      </p>

      {/* Swipe prompt */}
      <div className="flex items-center gap-1.5">
        <span className="text-white font-bold text-sm">Swipe to Learn More</span>
        <ArrowRight className="w-4 h-4 text-white" aria-hidden />
      </div>

      {/* Feature chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {["240+ data brokers", "Real-time monitoring", "Automatic removal"].map(
          (tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full bg-[#2D3847] border border-[#2A4A68] text-[#B8C4CC] text-xs font-medium"
            >
              {tag}
            </span>
          )
        )}
      </div>
    </motion.div>
  );
}

// ─── Shared layout for Slides 2–4 ────────────────────────────────────────────

interface SlideWithMockupProps {
  visual: React.ReactNode;
  heading: React.ReactNode;
  subtext: React.ReactNode;
  current: number;
  onGoTo: (index: number, dir: number) => void;
  onStartTimer: () => void;
}

function SlideWithMockup({
  visual,
  heading,
  subtext,
  current,
  onGoTo,
  onStartTimer,
}: SlideWithMockupProps) {
  return (
    <div className="w-full h-full flex flex-col">
      {/* Top half — component visual with bottom fade */}
      <div
        className="relative w-full overflow-hidden shrink-0"
        style={{
          // Responsive height: fills available space minus logo + dots + text
          height: "clamp(220px, calc(100vh - 420px), 460px)",
          // Fade the bottom of the component out
          WebkitMaskImage:
            "linear-gradient(to bottom, black 55%, transparent 98%)",
          maskImage:
            "linear-gradient(to bottom, black 55%, transparent 98%)",
        }}
      >
        {/*
          Scale the component down so it fits the container, then shift
          it up by exactly the scaled centering dead-space above the phone.
          Phone top in all three components = (50vh - 360px) in original coords.
          After scale(S): visual phone top = (50vh - 360px) * S from element top.
          Setting marginTop = -S * (50vh - 360px) cancels this exactly → phone
          top sits flush with the container top on any screen height.
          Clamped at 0 for screens shorter than the phone (≤ 720px viewport).
        */}
        <div
          style={{
            transform: "scale(0.72)",
            transformOrigin: "top center",
            marginTop: "clamp(-80px, calc(0.72 * (360px - 50vh) + 64px), 64px)",
          }}
        >
          {visual}
        </div>
      </div>

      {/* Progress dots — at the boundary between top and bottom */}
      <div
        className="flex justify-center gap-2 py-2.5 shrink-0"
        role="tablist"
        aria-label="Slide navigation"
      >
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === current}
            aria-label={`Slide ${i + 1} of ${SLIDE_COUNT}`}
            onClick={() => {
              onGoTo(i, i > current ? 1 : -1);
              onStartTimer();
            }}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              i === current
                ? "w-6 bg-[#00BFFF]"
                : "w-1.5 bg-white/25 hover:bg-white/40"
            }`}
          />
        ))}
      </div>

      {/* Bottom half — heading + subtext */}
      <div className="flex flex-col gap-3 px-6 pt-1 pb-4 shrink-0">
        <h2 className="text-[clamp(18px,5vw,24px)] font-bold text-white tracking-tight leading-snug">
          {heading}
        </h2>
        <p className="text-[13px] text-[#B8C4CC] leading-relaxed">{subtext}</p>
      </div>
    </div>
  );
}

// ─── Slide 2 — DataExplosionMockup ───────────────────────────────────────────

function Slide2({
  current,
  onGoTo,
  onStartTimer,
}: {
  current: number;
  onGoTo: (i: number, d: number) => void;
  onStartTimer: () => void;
}) {
  return (
    <SlideWithMockup
      visual={<DataExplosionMockup />}
      heading={
        <>
          Your private data{" "}
          <span className="text-[#FF8A00] italic">isn't</span> private
        </>
      }
      subtext={
        <>
          Every account you sign up for or page you visit leaves a digital
          trail — Legal Name, Phone Number, Relatives, Addresses. Data brokers
          harvest this data and sell it to{" "}
          <span className="text-white font-bold italic">
            Scammers, Spammers &amp; Stalkers.
          </span>
        </>
      }
      current={current}
      onGoTo={onGoTo}
      onStartTimer={onStartTimer}
    />
  );
}

// ─── Slides 3 & 4 placeholders (same SlideWithMockup structure) ──────────────

function Slide3({
  current,
  onGoTo,
  onStartTimer,
}: {
  current: number;
  onGoTo: (i: number, d: number) => void;
  onStartTimer: () => void;
}) {
  return (
    <SlideWithMockup
      visual={<VanyshrAppMockup />}
      heading={
        <>
          Tired of endless{" "}
          <span className="text-[#FF8A00] italic">spam</span>{" "}
          calls &amp; texts?
        </>
      }
      subtext={
        <>
          Sales predators don't care about your 'Do Not Call' list. They buy
          millions of records at a time from these brokers &amp; effortlessly
          hammer your phone with bots.
        </>
      }
      current={current}
      onGoTo={onGoTo}
      onStartTimer={onStartTimer}
    />
  );
}

function Slide4({
  current,
  onGoTo,
  onStartTimer,
}: {
  current: number;
  onGoTo: (i: number, d: number) => void;
  onStartTimer: () => void;
}) {
  return (
    <SlideWithMockup
      visual={<ScamMockup />}
      heading={
        <>
          Intel for{" "}
          <span className="text-[#FF8A00] italic">scammers</span>{" "}
          &amp;{" "}
          <span className="text-[#FF8A00] italic">identity thieves</span>
        </>
      }
      subtext={
        <>
          As AI evolves, scam attempts are becoming indistinguishable from
          reality. With just a few leaked data points, a criminal can automate
          a perfect imitation of you or someone close to you to gain access to
          your{" "}
          <span className="text-white font-bold italic">
            accounts or assets.
          </span>
        </>
      }
      current={current}
      onGoTo={onGoTo}
      onStartTimer={onStartTimer}
    />
  );
}

function Slide5({
  current,
  onGoTo,
  onStartTimer,
}: {
  current: number;
  onGoTo: (i: number, d: number) => void;
  onStartTimer: () => void;
}) {
  return (
    <SlideWithMockup
      visual={<RemovalsMockup />}
      heading={
        <>
          We help you{" "}
          <span className="text-[#00BFFF] italic">Vanysh</span>
        </>
      }
      subtext={
        <>
          Our AI agents scan hundreds of broker databases to find any exposures.
          Autonomously demand removals, verify compliance, and relentlessly
          monitor for any new leaks.
        </>
      }
      current={current}
      onGoTo={onGoTo}
      onStartTimer={onStartTimer}
    />
  );
}

// ─── Main slider ──────────────────────────────────────────────────────────────

export function ReferralSlider() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((index: number, dir: number) => {
    setDirection(dir);
    setCurrent(index);
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((prev) => {
        if (prev >= SLIDE_COUNT - 1) {
          // Already on last slide — stop the timer and stay
          if (timerRef.current) clearInterval(timerRef.current);
          return prev;
        }
        setDirection(1);
        return prev + 1;
      });
    }, AUTO_ADVANCE_MS);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const THRESHOLD = 50;
      if (info.offset.x < -THRESHOLD && current < SLIDE_COUNT - 1) {
        goTo(current + 1, 1);
        startTimer();
      } else if (info.offset.x > THRESHOLD && current > 0) {
        goTo(current - 1, -1);
        startTimer();
      }
    },
    [current, goTo, startTimer]
  );

  const handleSelectProfile = useCallback(
    (
      profile: ProfileMatch,
      searchParams: {
        firstName: string;
        lastName: string;
        zipCode: string;
        city: string;
        state: string;
      },
      scanId: string | null
    ) => {
      sessionStorage.setItem("selectedProfile", JSON.stringify(profile));
      sessionStorage.setItem("searchParams", JSON.stringify(searchParams));
      navigate(`/quick-scan/pre-profile/${scanId ?? profile.id}`);
    },
    [navigate]
  );

  const slides = [
    <Slide1 key="s1" />,
    <Slide2 key="s2" current={current} onGoTo={goTo} onStartTimer={startTimer} />,
    <Slide3 key="s3" current={current} onGoTo={goTo} onStartTimer={startTimer} />,
    <Slide4 key="s4" current={current} onGoTo={goTo} onStartTimer={startTimer} />,
    <Slide5 key="s5" current={current} onGoTo={goTo} onStartTimer={startTimer} />,
  ];

  return (
    <div
      className="relative h-screen w-full overflow-hidden bg-[#022136] font-ubuntu select-none flex flex-col"
      aria-label="Vanyshr onboarding"
      role="main"
    >
      {/* ── Sticky logo — bar height expands on Slide 1 to push logo down
              toward content; springs up and shrinks on slides 2–4 ── */}
      <motion.div
        className="flex items-end justify-center shrink-0 relative z-10 pb-3"
        animate={{ height: current === 0 ? 265 : 60 }}
        transition={{ type: "spring", stiffness: 180, damping: 26 }}
      >
        <motion.img
          src={PrimaryLogoDark}
          alt="Vanyshr"
          animate={{ height: current === 0 ? 65 : 28 }}
          transition={{ type: "spring", stiffness: 180, damping: 26 }}
          style={{ width: "auto" }}
        />
      </motion.div>

      {/* ── Slide viewport — flex-1 so it fills whatever the logo bar leaves ── */}
      <div className="relative overflow-hidden flex-1 min-h-0">
        <AnimatePresence initial={false} custom={direction} mode="sync">
          <motion.div
            key={current}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideSpring}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={handleDragEnd}
            style={{ touchAction: "pan-y" }}
            className="absolute inset-0"
            aria-live="polite"
            aria-atomic="true"
          >
            {slides[current]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Spacer so flex-1 slide viewport doesn't bleed under the fixed footer */}
      <div className="h-[180px] shrink-0" />

      {/* ── Sticky CTA footer (scan-now style) ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 px-3">
        <div className="bg-[#022136] rounded-t-[28px] backdrop-blur-md shadow-[0_0_40px_rgba(0,191,255,0.4),0_0_80px_rgba(0,191,255,0.22),0_-8px_24px_rgba(0,0,0,0.6)] pt-6 pb-6 px-6 flex flex-col gap-1 relative max-w-lg mx-auto">
          <div className="flex flex-col gap-1 text-center">
            <p className="text-white font-bold text-[22px] leading-tight">
              Check If Your Data Is Exposed
            </p>
            <p className="text-white font-bold text-[22px] leading-tight">
              Run a QuickScan —{" "}
              <span className="text-[#00BFFF] italic">FREE</span>
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full mt-3">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="w-full h-[52px] rounded-xl bg-[#00BFFF] text-[#022136] font-bold text-xl hover:bg-[#00D4FF] active:bg-[#0099CC] active:text-white transition-colors duration-150 shadow-md cursor-pointer"
            >
              Scan Now
            </button>
            <p className="text-[#7A92A8] text-[14px] leading-none text-center font-medium mb-1">
              No Credit Card or Sign Up Required
            </p>
          </div>
        </div>
      </footer>

      {/* ── QuickScan bottom drawer ── */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 150) setIsDrawerOpen(false);
              }}
              className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
            >
              <div className="w-full max-w-md bg-[#2D3847] rounded-t-[32px] overflow-hidden max-h-[90vh] flex flex-col relative shadow-[0_0_40px_rgba(0,191,255,0.35),0_0_80px_rgba(0,191,255,0.18),0_25px_50px_-12px_rgba(0,0,0,0.25)]">
                <div className="w-full h-8 flex items-center justify-center shrink-0">
                  <div className="w-12 h-1.5 bg-[#2A4A68] rounded-full" />
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setIsDrawerOpen(false)}
                  className="absolute top-3 right-4 p-1.5 rounded-full text-[#7A92A8] hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="overflow-y-auto px-1 pb-10">
                  <QuickScanForm
                    supabaseClient={supabase}
                    onProfileSelect={handleSelectProfile}
                    onClose={() => setIsDrawerOpen(false)}
                    className="!bg-transparent"
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
