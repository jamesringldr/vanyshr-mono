import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cx } from "@/utils/cx";
import { EASE_OUT } from "./chrome";

export const THREAT_WORDS = ["HACKERS", "SCAMMERS", "SPAMMERS"] as const;

const ROLL_MS = 2200;

/**
 * Cycles one threat word at a time with a vertical roll.
 *
 * Every word is rendered invisibly in the same grid cell, so the slot is always
 * as wide as the widest *rendered* word — measuring by character count instead
 * would under-size it, since equal-length words differ in width. The visible
 * word is left-aligned in that fixed slot, so its left edge never moves as the
 * word changes. Falls back to a single static word under reduced motion.
 */
export function RollingThreatWord({
  words = THREAT_WORDS,
  reducedMotion,
  className,
}: {
  words?: readonly string[];
  reducedMotion: boolean;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion || words.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, ROLL_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, words]);

  const word = words[index % words.length];

  if (reducedMotion) {
    return <span className={cx("text-warning", className)}>{words[0]}</span>;
  }

  return (
    <span
      className="relative inline-grid justify-items-start overflow-hidden text-left align-baseline"
      aria-live="polite"
    >
      {words.map((w) => (
        <span key={w} className="invisible col-start-1 row-start-1 font-semibold" aria-hidden>
          {w}
        </span>
      ))}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={word}
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={{ duration: 0.34, ease: EASE_OUT }}
          className={cx("col-start-1 row-start-1 font-semibold text-warning", className)}
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
