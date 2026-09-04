/**
 * Vinnie face engine.
 *
 * Expression table is ported from jeremy-prt/bloub (MIT) `src/bot/expressions.ts`.
 * Four levers: head gaze, eye split, per-eye size, per-eye tilt.
 * Applied as offsets on Vinnie's rest ellipses — the ghost body is not Grok's.
 */

export type VinnieMood =
  | "idle"
  | "focused"
  | "surprised"
  | "excited"
  | "happy"
  | "laughing"
  | "angry"
  | "sad"
  | "scared"
  | "wary"
  | "confused"
  | "curious"
  | "proud"
  | "shy"
  | "unimpressed"
  | "sleepy";

type Eye = { w: number; h: number; tilt: number; open: number };
type Gaze = { yaw: number; pitch: number; roll: number };
export type VinnieExpression = {
  id: VinnieMood;
  bloub: string;
  gaze: Gaze;
  split: number;
  eyes: [Eye, Eye];
};

type RestEye = { cx: number; cy: number; rot: number; rx: number; ry: number };
export type EyePose = { cx: number; cy: number; rot: number; sx: number; sy: number };
export type FacePose = { L: EyePose; R: EyePose };

const REST = {
  L: { cx: 47.93, cy: 87.75, rot: 1.02, rx: 7.76, ry: 20.41 },
  R: { cx: 79.04, cy: 83.28, rot: 24.29, rx: 11.44, ry: 29.55 },
} as const;

const MID = {
  x: (REST.L.cx + REST.R.cx) / 2,
  y: (REST.L.cy + REST.R.cy) / 2,
};

const BLOUB_N = { w: 0.186, h: 0.412, split: 15.46 };

const eye = (w: number, h: number, tilt = 0, open = 1): Eye => ({ w, h, tilt, open });
const pair = (w: number, h: number, tilt = 0, open = 1): [Eye, Eye] => [
  eye(w, h, tilt, open),
  eye(w, h, -tilt, open),
];

export const EXPRESSIONS: readonly VinnieExpression[] = [
  { id: "idle",        bloub: "neutre",     gaze: { yaw: 5, pitch: 5, roll: 0 },   split: 15.46, eyes: [eye(0.186, 0.412), eye(0.186, 0.412)] },
  { id: "focused",     bloub: "attentif",   gaze: { yaw: 4, pitch: 5, roll: -4 },  split: 16,    eyes: pair(0.21, 0.44) },
  { id: "surprised",   bloub: "surpris",    gaze: { yaw: 3, pitch: -3, roll: 0 },  split: 19,    eyes: pair(0.45, 0.47) },
  { id: "excited",     bloub: "excite",     gaze: { yaw: 6, pitch: -14, roll: 0 }, split: 19.5,  eyes: pair(0.4, 0.56, -10) },
  { id: "happy",       bloub: "heureux",    gaze: { yaw: 5, pitch: 9, roll: 0 },   split: 17,    eyes: pair(0.27, 0.17, 14) },
  { id: "laughing",    bloub: "hilare",     gaze: { yaw: 4, pitch: 14, roll: 0 },  split: 18,    eyes: pair(0.34, 0.13, 20) },
  { id: "angry",       bloub: "colere",     gaze: { yaw: 3, pitch: 7, roll: 0 },   split: 17,    eyes: pair(0.34, 0.15, 30) },
  { id: "sad",         bloub: "triste",     gaze: { yaw: 3, pitch: -13, roll: 0 }, split: 16,    eyes: pair(0.22, 0.4, -28) },
  { id: "scared",      bloub: "effraye",    gaze: { yaw: 2, pitch: -20, roll: 0 }, split: 20.5,  eyes: pair(0.4, 0.6) },
  { id: "wary",        bloub: "mefiant",    gaze: { yaw: 12, pitch: 6, roll: -6 }, split: 16,    eyes: [eye(0.21, 0.4), eye(0.22, 0.15)] },
  { id: "confused",    bloub: "confus",     gaze: { yaw: -14, pitch: 3, roll: 8 }, split: 16.5,  eyes: [eye(0.2, 0.44, -18), eye(0.28, 0.17, 14)] },
  { id: "curious",     bloub: "curieux",    gaze: { yaw: 16, pitch: -9, roll: -15 }, split: 16.5, eyes: [eye(0.24, 0.46, -8), eye(0.2, 0.38, -8)] },
  { id: "proud",       bloub: "fier",       gaze: { yaw: 5, pitch: 17, roll: 0 },  split: 17,    eyes: pair(0.3, 0.15, 18) },
  { id: "shy",         bloub: "timide",     gaze: { yaw: -19, pitch: -14, roll: -7 }, split: 14, eyes: pair(0.17, 0.3) },
  { id: "unimpressed", bloub: "blase",      gaze: { yaw: -22, pitch: 2, roll: 0 }, split: 16,    eyes: pair(0.3, 0.12) },
  { id: "sleepy",      bloub: "somnolent",  gaze: { yaw: 6, pitch: -9, roll: -3 }, split: 16,    eyes: pair(0.2, 0.42, 0, 0.42) },
];

export const VINNIE_MOODS: readonly VinnieMood[] = EXPRESSIONS.map((e) => e.id);

export const BY_ID: Record<VinnieMood, VinnieExpression> = Object.fromEntries(
  EXPRESSIONS.map((e) => [e.id, e]),
) as Record<VinnieMood, VinnieExpression>;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function easeOutQuint(t: number) {
  return 1 - Math.pow(1 - t, 5);
}
function lerpEye(a: Eye, b: Eye, t: number): Eye {
  return {
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
    tilt: lerp(a.tilt, b.tilt, t),
    open: lerp(a.open, b.open, t),
  };
}
export function blend(a: VinnieExpression, b: VinnieExpression, t: number): VinnieExpression {
  return {
    id: b.id,
    bloub: b.bloub,
    gaze: {
      yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
      pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
      roll: lerp(a.gaze.roll, b.gaze.roll, t),
    },
    split: lerp(a.split, b.split, t),
    eyes: [lerpEye(a.eyes[0], b.eyes[0], t), lerpEye(a.eyes[1], b.eyes[1], t)],
  };
}

const BLINKS = (function () {
  let s = 0x5eed;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out: number[] = [];
  let t = 1.4;
  while (t < 900) {
    out.push(t);
    t += 1.9 + rnd() * 2.7;
    if (rnd() < 0.18) {
      out.push(t);
      t += 0.24;
    }
  }
  return out;
})();
const BLINK_DUR = 0.18;

function blinkLid(t: number) {
  for (let i = 0; i < BLINKS.length; i++) {
    const start = BLINKS[i];
    if (t < start) break;
    const k = (t - start) / BLINK_DUR;
    if (k >= 0 && k <= 1) return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55;
  }
  return 1;
}

function liveliness(t: number, wander: number) {
  const w = wander ?? 1;
  return {
    dYaw: (Math.sin((t / 11.3) * Math.PI * 2 + 0.4) * 5.5 + Math.sin((t / 3.7) * Math.PI * 2 + 2.1) * 1.6) * w,
    dPitch: (Math.sin((t / 9.1) * Math.PI * 2 + 1.3) * 4.2 + Math.sin((t / 4.3) * Math.PI * 2 + 0.7) * 1.3) * w,
    dRoll: Math.sin((t / 13.7) * Math.PI * 2 + 3.2) * 2.2 * w,
    lid: blinkLid(t),
  };
}

function damp(ratio: number) {
  return 1 + (ratio - 1) * 0.72;
}

export function sample(expr: VinnieExpression, t: number, look: { x: number; y: number } | null): FacePose {
  const live = liveliness(t, look ? 0.25 : 1);
  const splitMul = expr.split / BLOUB_N.split;
  let lookX = (expr.gaze.yaw - 5) * 0.42 + live.dYaw * 0.32;
  let lookY = -(expr.gaze.pitch - 5) * 0.32 + live.dPitch * 0.28;
  if (look) {
    lookX += look.x;
    lookY += look.y;
  }
  lookX = clamp(lookX, -14, 18);
  lookY = clamp(lookY, -16, 14);
  const roll = expr.gaze.roll + live.dRoll;
  const lid = 0.06 + 0.94 * live.lid;

  function one(rest: RestEye, cfg: Eye): EyePose {
    const sx = clamp(damp(cfg.w / BLOUB_N.w), 0.65, 1.85);
    const sy = clamp(damp((cfg.h / BLOUB_N.h) * cfg.open), 0.22, 1.55) * lid;
    const rot = rest.rot + cfg.tilt + roll * 0.45;
    const cx = MID.x + (rest.cx - MID.x) * splitMul + lookX;
    const cy = MID.y + (rest.cy - MID.y) * splitMul + lookY;
    return { cx, cy, rot, sx, sy };
  }
  return { L: one(REST.L, expr.eyes[0]), R: one(REST.R, expr.eyes[1]) };
}

export function apply(svg: SVGSVGElement, pose: FacePose) {
  const left = svg.querySelector<SVGGElement>("[data-vinnie-eye='left']");
  const right = svg.querySelector<SVGGElement>("[data-vinnie-eye='right']");
  if (!left || !right) return;
  const lLid = left.querySelector<SVGGElement>(".lid");
  const rLid = right.querySelector<SVGGElement>(".lid");
  if (!lLid || !rLid) return;
  lLid.style.animation = "none";
  rLid.style.animation = "none";
  left.setAttribute("transform", `translate(${pose.L.cx} ${pose.L.cy}) rotate(${pose.L.rot})`);
  right.setAttribute("transform", `translate(${pose.R.cx} ${pose.R.cy}) rotate(${pose.R.rot})`);
  lLid.setAttribute("transform", `scale(${pose.L.sx} ${pose.L.sy})`);
  rLid.setAttribute("transform", `scale(${pose.R.sx} ${pose.R.sy})`);
}

export type VinnieFaceHandle = {
  setExpression: (id: VinnieMood) => void;
  setLook: (x: number, y: number) => void;
  clearLook: () => void;
  freeze: () => void;
  thaw: () => void;
  readonly id: VinnieMood;
  destroy: () => void;
};

export function attach(
  svg: SVGSVGElement,
  opts?: { expression?: VinnieMood; morph?: number; frozen?: boolean },
): VinnieFaceHandle {
  const options = opts || {};
  let from = BY_ID[options.expression || "idle"] ?? BY_ID.idle;
  let to = from;
  let morphStart = 0;
  const morphDur = options.morph ?? 0.38;
  let look = { x: 0, y: 0 };
  let frozen = options.frozen === true;
  const t0 = performance.now() / 1000;
  let raf = 0;

  function nowExpr(t: number) {
    const u = morphDur <= 0 ? 1 : clamp((t - morphStart) / morphDur, 0, 1);
    return u >= 1 ? to : blend(from, to, easeOutQuint(u));
  }

  function tick(now: number) {
    const t = now / 1000 - t0;
    apply(svg, sample(nowExpr(t), frozen ? 0 : t, frozen ? null : look));
    raf = requestAnimationFrame(tick);
  }

  function setExpression(id: VinnieMood) {
    const next = BY_ID[id];
    if (!next || next.id === to.id) return;
    const t = performance.now() / 1000 - t0;
    from = nowExpr(t);
    to = next;
    morphStart = t;
  }

  raf = requestAnimationFrame(tick);
  return {
    setExpression,
    setLook(x: number, y: number) {
      look.x = x;
      look.y = y;
    },
    clearLook() {
      look.x = 0;
      look.y = 0;
    },
    freeze() {
      frozen = true;
    },
    thaw() {
      frozen = false;
    },
    get id() {
      return to.id;
    },
    destroy() {
      cancelAnimationFrame(raf);
    },
  };
}
