import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PiiArtifact, type ArtifactKind } from "./pii-artifact";

/** Impeccable / design-daddy preferred curve — snappy, no bounce. */
const EASE = [0.2, 0, 0, 1] as const;

const DRIFT_MS = 1700;
const VANISH_MS = 1080;
const SETTLE_MS = 180;

type Phase = "drift" | "vanish";

type CardSpec = {
  id: string;
  kind: ArtifactKind;
  /** Position in the 390×844 composition space. */
  x: number;
  y: number;
  size: number;
  /** -1 far / 0 focal / +1 in front of lens. Drives blur, scale feel, speed. */
  z: number;
  rotate: number;
  vanishDelay: number;
};

/**
 * Queue-like scatter: denser in the upper two-thirds, mixed depths so
 * some tiles sit in focus and others blow out of the focal plane.
 */
const CARDS: CardSpec[] = [
  { id: "dob", kind: "dob", x: 18, y: -28, size: 86, z: 0.62, rotate: -14, vanishDelay: 0 },
  { id: "search", kind: "search", x: 236, y: -36, size: 104, z: 0.38, rotate: 10, vanishDelay: 0.04 },
  { id: "ssn", kind: "ssn", x: 168, y: 78, size: 138, z: 0.12, rotate: 5, vanishDelay: 0.08 },
  { id: "address", kind: "address", x: -18, y: 196, size: 92, z: -0.18, rotate: -6, vanishDelay: 0.02 },
  { id: "email", kind: "email", x: 268, y: 214, size: 108, z: 0.08, rotate: 7, vanishDelay: 0.1 },
  { id: "profile", kind: "profile", x: 72, y: 292, size: 156, z: 0.02, rotate: -7, vanishDelay: 0.14 },
  { id: "phone", kind: "phone", x: 228, y: 348, size: 98, z: -0.22, rotate: 3, vanishDelay: 0.06 },
  { id: "relatives", kind: "relatives", x: 148, y: 468, size: 100, z: -0.08, rotate: -3, vanishDelay: 0.12 },
  { id: "records", kind: "records", x: -8, y: 508, size: 84, z: -0.36, rotate: 8, vanishDelay: 0.05 },
  { id: "social", kind: "social", x: 286, y: 552, size: 118, z: 0.48, rotate: -9, vanishDelay: 0 },
  { id: "property", kind: "property", x: 96, y: 62, size: 88, z: -0.28, rotate: 4, vanishDelay: 0.07 },
  { id: "location", kind: "location", x: 168, y: 668, size: 78, z: 0.72, rotate: 12, vanishDelay: 0.02 },
];

function depthFilter(z: number) {
  const away = Math.abs(z);
  const focusBlur = away * 11;
  const closeBlur = z > 0.4 ? (z - 0.4) * 22 : 0;
  const opacity = 1 - away * 0.28;
  return { filter: `blur(${(focusBlur + closeBlur).toFixed(1)}px)`, opacity };
}

function travel(z: number) {
  const speed = 1 + z * 0.85;
  return {
    startY: 36 + z * 12,
    driftY: -48 * speed,
    vanishY: -320 * speed,
    vanishX: z * 18,
  };
}

type VanishingPiiFieldProps = {
  onComplete: () => void;
  /** Fires when cards start leaving so the next beat can fade in underneath. */
  onVanishStart?: () => void;
};

export function VanishingPiiField({ onComplete, onVanishStart }: VanishingPiiFieldProps) {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("drift");

  useEffect(() => {
    if (prefersReducedMotion) {
      onComplete();
      return;
    }

    let cancelled = false;
    const vanishAt = window.setTimeout(() => {
      if (!cancelled) {
        setPhase("vanish");
        onVanishStart?.();
      }
    }, DRIFT_MS);
    const doneAt = window.setTimeout(
      () => {
        if (!cancelled) onComplete();
      },
      DRIFT_MS + VANISH_MS + SETTLE_MS,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(vanishAt);
      window.clearTimeout(doneAt);
    };
  }, [onComplete, onVanishStart, prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <div
      className="absolute inset-0 z-20 overflow-hidden bg-transparent"
      aria-hidden
    >
      <button
        type="button"
        className="absolute inset-0 z-30 cursor-pointer bg-transparent"
        onClick={onComplete}
        aria-label="Skip intro"
      />

      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "vanish" ? 1 : 0.35 }}
        transition={{ duration: 0.9, ease: EASE }}
        style={{
          background:
            "radial-gradient(ellipse 70% 48% at 50% 40%, rgba(0,191,255,0.16), transparent 70%)",
        }}
      />

      <div
        className="pointer-events-none absolute left-1/2 top-1/2 origin-center"
        style={{
          width: 390,
          height: 844,
          // Unitless scale — `100vw / 390` is a length and is invalid in scale().
          transform: "translate(-50%, -50%) scale(min(100vw / 390px, 100dvh / 780px))",
        }}
      >
        {CARDS.map((card) => {
          const move = travel(card.z);
          const depth = depthFilter(card.z);
          return (
            <motion.div
              key={card.id}
              className="absolute will-change-transform"
              style={{
                left: card.x,
                top: card.y,
                width: card.size,
                height: card.size,
                filter: depth.filter,
              }}
              initial={{
                y: move.startY,
                x: 0,
                rotate: card.rotate,
                opacity: depth.opacity,
              }}
              animate={
                phase === "drift"
                  ? {
                      y: move.driftY,
                      x: 0,
                      rotate: card.rotate,
                      opacity: depth.opacity,
                    }
                  : {
                      y: move.vanishY,
                      x: move.vanishX,
                      rotate: card.rotate + (card.z > 0 ? -6 : 4),
                      opacity: 0,
                    }
              }
              transition={
                phase === "drift"
                  ? { duration: DRIFT_MS / 1000, ease: "linear" }
                  : {
                      duration: VANISH_MS / 1000,
                      ease: EASE,
                      delay: card.vanishDelay,
                    }
              }
            >
              <PiiArtifact kind={card.kind} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
