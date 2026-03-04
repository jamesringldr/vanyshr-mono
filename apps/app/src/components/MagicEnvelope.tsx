import { motion, useReducedMotion } from "framer-motion";
import GhostOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";

const CYCLE = 6;

// Ghost+wand group dips down for the tap gesture
const DIP = {
  y: [0, 0, 22, 22, 22, 0, 0],
  times: [0, 0.14, 0.28, 0.38, 0.58, 0.72, 1.0],
};

// Wand swings from resting angle (tilted left) to vertical for the tap
const WAND_SWING = {
  rotate: [20, 20, 0, 0, 0, 20, 20],
  times: [0, 0.12, 0.28, 0.38, 0.56, 0.72, 1.0],
};

// Envelope flap opens after wand contact
const FLAP = {
  rotateX: [0, 0, -155, -155, 0, 0],
  times: [0, 0.32, 0.44, 0.56, 0.66, 1.0],
};

// Inner glow visible when envelope is open
const ENV_GLOW = {
  opacity: [0, 0, 0.9, 0.9, 0, 0],
  times: [0, 0.40, 0.46, 0.54, 0.66, 1.0],
};

// Sparkle burst on wand-envelope contact
const SPARK = {
  opacity: [0, 0, 1, 1, 0, 0],
  scale: [0, 0, 1.4, 1.2, 0, 0],
  times: [0, 0.26, 0.30, 0.36, 0.42, 1.0],
};

const TAP_POINT = { x: 120, y: 148 };

const SPARKLES = [
  { x: -18, y: -8, s: 3, d: 0 },
  { x: 20, y: -5, s: 4, d: 0.03 },
  { x: -10, y: -22, s: 3, d: 0.06 },
  { x: 25, y: -16, s: 2.5, d: 0.02 },
  { x: -25, y: -14, s: 2, d: 0.05 },
  { x: 6, y: -25, s: 3.5, d: 0.08 },
  { x: 14, y: 6, s: 2.5, d: 0.04 },
];

export function MagicEnvelope({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div className={className} aria-hidden="true">
        <div
          className="relative mx-auto"
          style={{ width: 260, height: 230 }}
        >
          <img
            src={GhostOutline}
            alt=""
            width={76}
            height={76}
            className="absolute"
            style={{ left: 92, top: 10 }}
          />
          <div
            className="absolute"
            style={{ left: 108, top: 73, transform: "rotate(20deg)" }}
          >
            <WandSvg />
          </div>
          <div
            className="absolute"
            style={{ bottom: 5, left: 55, right: 55, height: 80 }}
          >
            <EnvelopeInner />
            <EnvelopeBody />
            <div
              className="absolute inset-x-0"
              style={{
                top: 0,
                height: 30,
                transformOrigin: "bottom center",
                zIndex: 30,
              }}
            >
              <FlapFace />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} aria-hidden="true">
      <div
        className="relative mx-auto"
        style={{ width: 260, height: 230 }}
      >
        {/* Ghost + wand group with float + dip */}
        <motion.div
          className="absolute inset-x-0 top-0"
          style={{ height: 160 }}
          animate={{ y: [0, -5, 0] }}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <motion.div
            className="relative"
            animate={{ y: DIP.y }}
            transition={{
              duration: CYCLE,
              times: DIP.times,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Ghost image (z-20, renders on top of wand) */}
            <img
              src={GhostOutline}
              alt=""
              width={76}
              height={76}
              className="absolute"
              style={{ left: 92, top: 5, zIndex: 20 }}
            />

            {/* Wand pivot at ghost's lower-left (front side) */}
            <div
              className="absolute"
              style={{ left: 108, top: 68, zIndex: 10 }}
            >
              <motion.div
                style={{ transformOrigin: "10px 0px" }}
                animate={{ rotate: WAND_SWING.rotate }}
                transition={{
                  duration: CYCLE,
                  times: WAND_SWING.times,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <WandSvg />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* Sparkles at tap contact point */}
        {SPARKLES.map((sp, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: sp.s,
              height: sp.s,
              left: TAP_POINT.x + sp.x,
              top: TAP_POINT.y + sp.y,
              zIndex: 40,
              background: i % 2 === 0 ? "#00BFFF" : "#FFB81C",
              boxShadow: `0 0 6px 2px ${
                i % 2 === 0
                  ? "rgba(0,191,255,0.5)"
                  : "rgba(255,184,28,0.5)"
              }`,
            }}
            animate={{
              opacity: SPARK.opacity,
              scale: SPARK.scale,
            }}
            transition={{
              duration: CYCLE,
              times: SPARK.times,
              repeat: Infinity,
              delay: sp.d,
              ease: "easeOut",
            }}
          />
        ))}

        {/* Envelope at bottom */}
        <div
          className="absolute"
          style={{
            bottom: 5,
            left: 55,
            right: 55,
            height: 80,
            perspective: 600,
          }}
        >
          <EnvelopeInner />

          {/* Inner glow when open */}
          <motion.div
            className="absolute rounded-b-lg"
            style={{
              top: 32,
              left: 20,
              right: 20,
              height: 18,
              background:
                "radial-gradient(ellipse at center top, rgba(0,191,255,0.35) 0%, transparent 80%)",
              zIndex: 2,
            }}
            animate={{ opacity: ENV_GLOW.opacity }}
            transition={{
              duration: CYCLE,
              times: ENV_GLOW.times,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <EnvelopeBody />

          {/* Flap */}
          <motion.div
            className="absolute inset-x-0"
            style={{
              top: 0,
              height: 30,
              transformOrigin: "bottom center",
              zIndex: 30,
            }}
            animate={{ rotateX: FLAP.rotateX }}
            transition={{
              duration: CYCLE,
              times: FLAP.times,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <FlapFace />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function EnvelopeInner() {
  return (
    <div
      className="absolute inset-x-0 rounded-b-lg"
      style={{
        top: 30,
        bottom: 0,
        background: "linear-gradient(180deg, #17293A 0%, #0F1F2E 100%)",
        zIndex: 0,
      }}
    />
  );
}

function EnvelopeBody() {
  return (
    <div
      className="absolute inset-x-0 bottom-0 overflow-hidden rounded-b-lg border border-[#2A4A68]"
      style={{
        height: 50,
        background:
          "linear-gradient(170deg, #3B4D5E 0%, #2D3847 40%, #263340 100%)",
        zIndex: 20,
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 150 50"
        fill="none"
      >
        <path
          d="M0 0 L75 30 L150 0"
          stroke="#2A4A68"
          strokeWidth="0.75"
          opacity="0.6"
        />
      </svg>
    </div>
  );
}

function FlapFace() {
  return (
    <div
      className="h-full w-full"
      style={{
        clipPath: "polygon(0% 100%, 50% 0%, 100% 100%)",
        background:
          "linear-gradient(180deg, #42576A 0%, #364556 60%, #2F3E4E 100%)",
      }}
    />
  );
}

function WandSvg() {
  return (
    <svg width="20" height="70" viewBox="0 0 20 70" fill="none">
      <defs>
        <filter
          id="wand-tap-glow"
          x="-80%"
          y="-80%"
          width="260%"
          height="260%"
        >
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient
          id="wand-tap-stick"
          x1="10"
          y1="0"
          x2="10"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#D4B276" />
          <stop offset="30%" stopColor="#A07830" />
          <stop offset="65%" stopColor="#6B4F1E" />
          <stop offset="100%" stopColor="#3D2806" />
        </linearGradient>
      </defs>
      {/* Stick (grip end at top) */}
      <rect
        x="8"
        y="0"
        width="4"
        height="50"
        rx="2"
        fill="url(#wand-tap-stick)"
      />
      <rect
        x="8.5"
        y="0"
        width="1.2"
        height="50"
        rx="0.6"
        fill="rgba(255,255,255,0.1)"
      />
      {/* Glowing star tip at bottom */}
      <path
        d="M10 48 L12 55 L19 57.5 L12 60 L10 67 L8 60 L1 57.5 L8 55 Z"
        fill="#00BFFF"
        filter="url(#wand-tap-glow)"
      />
    </svg>
  );
}
