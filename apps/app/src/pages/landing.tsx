import { useState } from "react";
import { useNavigate } from "react-router";
import { Navbar, Page } from "konsta/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cx } from "@/utils/cx";
import { BrandLockup } from "@/components/BrandLockup";
import {
  FindMyDataDrawer,
  KeyboardStripFill,
  primaryButton,
  useDrawerPageEffects,
  useKeyboardInset,
} from "@/components/FindMyDataDrawer";
import heroScene from "@/assets/scenes/broker-orbit-hero-1x1.svg";

/** /landing — dark-navy entry page. "Find my data" opens the same drawer and scan sequence as `/`. */
export function LandingPage() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);
  const keyboard = useKeyboardInset();
  const keyboardOpen = keyboard.inset > 0;

  useDrawerPageEffects(isOpen, fieldFocused, "var(--color-brand-navy)");

  return (
    <>
      {isOpen && <KeyboardStripFill keyboard={keyboard} />}
      <Page
        className={cx("bg-brand-navy!", isOpen && "overflow-hidden!")}
        // Same keyboard pinning as `/`: keep the Page on the visual viewport while the keyboard is up.
        style={
          keyboardOpen
            ? { height: keyboard.visibleHeight, transform: `translateY(${keyboard.offsetTop}px)` }
            : undefined
        }
      >
        <Navbar
          className="static! mb-0 bg-transparent! [&>div:empty]:hidden!"
          bgClassName="bg-transparent! backdrop-blur-none! border-transparent!"
          rightClassName="bg-transparent! shadow-none! backdrop-blur-none!"
          left={<BrandLockup className="ml-2.5 h-7" />}
          innerClassName="pl-2.5!"
          leftClassName="ml-0! bg-transparent! shadow-none! backdrop-blur-none!"
          right={
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="flex h-11 items-center gap-1 whitespace-nowrap text-md font-semibold text-text-primary outline-none focus-visible:outline-2 focus-visible:outline-border-focus"
            >
              Sign in
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            </button>
          }
        />

        <div className="flex min-h-full flex-col items-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
          <img src={heroScene} alt="" className="w-4/5" />

          <h1 className="m-0 mt-5 font-display text-display-md font-bold tracking-tight text-text-primary">
            Hands-Free Privacy
          </h1>
          <p className="m-0 mt-3 text-lg text-text-secondary">
            Find where your private data is exposed to scammers &amp; spammers then make it{" "}
            <span className="font-bold italic text-text-primary">vanysh!</span>
          </p>

          <div className="mt-6 flex w-full flex-col items-center gap-3">
            <div className="w-1/2">
              <button type="button" onClick={() => setIsOpen(true)} className={cx(primaryButton, "text-lg!")}>
                Find my data
              </button>
            </div>
            <ul className="m-0 flex list-none items-center justify-center gap-4 p-0 text-md italic text-text-secondary">
              {["No Credit Card", "No Sign Up"].map((label) => (
                <li key={label} className="flex items-center gap-1.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Anchored to the viewport bottom, 50px above the edge (or the safe-area inset if larger). */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center pb-[max(50px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => navigate("/learn-more")}
            className="pointer-events-auto flex h-12 items-center gap-1 rounded-full px-4 text-lg font-semibold text-text-primary outline-none transition-colors duration-fast hover:bg-state-hover active:bg-state-active focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus"
          >
            Learn More
            <ChevronDown className="animate-nudge-down size-4 shrink-0" aria-hidden="true" />
          </button>
        </div>

        {isOpen && (
          <FindMyDataDrawer
            keyboard={keyboard}
            onClose={() => {
              setIsOpen(false);
              setFieldFocused(false);
            }}
            onFieldFocusChange={setFieldFocused}
          />
        )}
      </Page>
    </>
  );
}
