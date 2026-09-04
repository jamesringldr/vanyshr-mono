import { useEffect, useRef, type SVGProps } from "react";
import { cx } from "@/utils/cx";
import { attach, type VinnieFaceHandle, type VinnieMood } from "./vinnie-face";

export type VinnieColorway = "primary" | "navy" | "cyan" | "auto";

export type VinnieProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  mood?: VinnieMood;
  cycle?: readonly VinnieMood[];
  hold?: number;
  followPointer?: boolean;
  colorway?: VinnieColorway;
  frozen?: boolean;
};

const COLORWAY_CLASS: Record<VinnieColorway, string> = {
  primary: "[--vinnie-body:#ffffff] [--vinnie-shade:#14abfe] [--vinnie-eye:#0b1b2b]",
  navy: "[--vinnie-body:#022136] [--vinnie-shade:#14abfe] [--vinnie-eye:#000000]",
  cyan: "[--vinnie-body:#14abfe] [--vinnie-shade:#022136] [--vinnie-eye:#000000]",
  auto: "[--vinnie-body:#022136] [--vinnie-shade:#14abfe] [--vinnie-eye:#000000] dark:[--vinnie-body:#ffffff] dark:[--vinnie-eye:#0b1b2b]",
};

const LID_STYLE = { transformBox: "fill-box" as const, transformOrigin: "center" };

export function Vinnie({
  mood = "idle",
  cycle,
  hold = 1400,
  followPointer = false,
  colorway = "primary",
  frozen,
  className,
  ...props
}: VinnieProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const handleRef = useRef<VinnieFaceHandle | null>(null);
  const cycleIndexRef = useRef(0);
  const cycleKey = cycle?.join(",") ?? "";

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const initial = cycle?.[0] ?? mood;
    const handle = attach(svg, {
      expression: initial,
      frozen: frozen ?? reduced,
    });
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
    // Mount-only: mood/cycle updates go through setExpression so the blink calendar stays put.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (frozen ?? reduced) handle.freeze();
    else handle.thaw();
  }, [frozen]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    if (cycleKey) return;
    handle.setExpression(mood);
  }, [mood, cycleKey]);

  useEffect(() => {
    if (!cycle?.length) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const sequence = cycle;
    cycleIndexRef.current = 0;
    handleRef.current?.setExpression(sequence[0]);
    const id = window.setInterval(() => {
      cycleIndexRef.current = (cycleIndexRef.current + 1) % sequence.length;
      handleRef.current?.setExpression(sequence[cycleIndexRef.current]);
    }, hold);
    return () => window.clearInterval(id);
    // cycleKey stands in for cycle contents so inline arrays don't reset the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleKey, hold]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !followPointer) return;
    const onMove = (ev: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      const nx = ((ev.clientX - r.left) / r.width - 0.38) * 2;
      const ny = ((ev.clientY - r.top) / r.height - 0.28) * 2;
      handleRef.current?.setLook(Math.max(-1, Math.min(1, nx)) * 10, Math.max(-1, Math.min(1, ny)) * 8);
    };
    const onLeave = () => handleRef.current?.clearLook();
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerleave", onLeave);
    return () => {
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerleave", onLeave);
    };
  }, [followPointer]);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 230.35 320"
      fill="none"
      overflow="visible"
      role="img"
      aria-label="Vinnie"
      className={cx("overflow-visible", COLORWAY_CLASS[colorway], className)}
      {...props}
    >
      <path
        d="M220.72 139.31 L220.57 143.15 L220.34 146.97 L220.03 150.76 L219.65 154.53 L219.19 158.26 L218.06 164.73 L216.27 173.93 L213.81 185.85 L210.68 200.50 L208.17 212.51 L206.28 221.89 L205.00 228.62 L204.33 232.72 L203.75 236.62 L203.27 240.30 L202.87 243.79 L202.56 247.07 L202.35 250.70 L202.22 254.70 L202.18 259.05 L202.23 263.77 L202.41 268.20 L202.72 272.35 L203.15 276.21 L203.72 279.80 L204.45 283.44 L205.34 287.13 L206.40 290.86 L207.63 294.66 L208.99 298.27 L210.48 301.70 L212.09 304.95 L213.83 308.03 L214.92 310.45 L215.36 312.21 L215.14 313.33 L214.27 313.79 L213.06 314.19 L211.53 314.52 L209.66 314.79 L207.46 314.99 L204.30 315.08 L200.21 315.06 L195.16 314.92 L189.17 314.66 L183.69 314.35 L178.72 313.99 L174.26 313.58 L170.32 313.12 L166.32 312.57 L162.27 311.93 L158.18 311.20 L154.03 310.38 L150.12 309.56 L146.46 308.74 L143.04 307.92 L139.86 307.10 L136.28 306.07 L132.28 304.81 L127.87 303.34 L123.06 301.65 L118.51 299.94 L114.24 298.23 L110.23 296.50 L106.49 294.76 L102.98 293.05 L99.70 291.39 L96.65 289.76 L93.83 288.18 L91.03 286.52 L88.24 284.81 L85.46 283.03 L82.69 281.18 L79.72 279.08 L76.55 276.73 L73.16 274.11 L69.58 271.25 L66.20 268.41 L63.02 265.62 L60.05 262.87 L57.28 260.15 L54.77 257.62 L52.52 255.26 L50.52 253.09 L48.78 251.09 L46.97 248.92 L45.11 246.59 L43.17 244.09 L41.17 241.43 L39.19 238.64 L37.22 235.72 L35.26 232.67 L33.31 229.50 L31.49 226.40 L29.80 223.37 L28.24 220.43 L26.80 217.56 L25.37 214.45 L23.94 211.09 L22.50 207.49 L21.07 203.65 L19.88 200.33 L18.93 197.54 L18.22 195.28 L17.76 193.53 L17.70 192.83 L18.03 193.16 L18.76 194.53 L19.89 196.94 L21.26 199.64 L22.87 202.64 L24.73 205.93 L26.83 209.52 L29.35 213.45 L32.30 217.73 L35.67 222.35 L39.46 227.32 L42.95 231.72 L46.16 235.57 L49.06 238.84 L51.67 241.56 L54.24 244.13 L56.75 246.57 L59.21 248.86 L61.61 251.01 L64.32 253.30 L67.31 255.74 L70.60 258.31 L74.19 261.03 L77.63 263.54 L80.94 265.84 L84.10 267.94 L87.12 269.84 L90.82 271.98 L95.20 274.36 L100.26 276.98 L106.00 279.85 L112.05 282.62 L118.40 285.28 L125.06 287.84 L132.02 290.30 L138.25 292.39 L143.73 294.10 L148.47 295.45 L152.46 296.42 L156.89 297.40 L161.76 298.37 L167.06 299.34 L172.80 300.32 L177.44 301.08 L180.97 301.65 L183.40 302.01 L184.74 302.16 L186.27 302.24 L188.01 302.24 L189.96 302.16 L192.11 302.01 L193.83 301.84 L195.11 301.66 L195.95 301.47 L196.36 301.26 L196.49 300.75 L196.34 299.93 L195.90 298.80 L195.19 297.37 L194.44 295.71 L193.68 293.81 L192.88 291.68 L192.06 289.33 L191.27 286.63 L190.50 283.58 L189.76 280.18 L189.04 276.44 L188.48 272.59 L188.07 268.62 L187.81 264.53 L187.71 260.33 L187.72 256.31 L187.85 252.47 L188.09 248.81 L188.45 245.32 L188.90 241.82 L189.44 238.28 L190.06 234.72 L190.78 231.13 L191.60 227.41 L192.52 223.54 L193.55 219.53 L194.67 215.38 L196.58 209.25 L199.27 201.13 L202.74 191.02 L206.99 178.93 L210.66 168.18 L213.73 158.75 L216.21 150.66 L218.11 143.90 L219.53 138.81 L220.48 135.40 L220.95 133.68 L220.95 133.62 L220.91 134.55 L220.84 136.44 Z"
        fill="var(--vinnie-shade)"
      />
      <path
        d="M141.99 4.94 L145.21 4.99 L148.58 5.14 L152.09 5.37 L155.74 5.69 L159.53 6.10 L163.27 6.60 L166.96 7.18 L170.60 7.86 L174.18 8.63 L177.58 9.43 L180.78 10.25 L183.79 11.09 L186.61 11.96 L189.74 13.05 L193.20 14.36 L196.98 15.88 L201.08 17.62 L204.88 19.34 L208.39 21.03 L211.60 22.69 L214.52 24.33 L217.00 25.83 L219.02 27.19 L220.59 28.41 L221.72 29.48 L222.71 30.62 L223.55 31.82 L224.26 33.09 L224.82 34.42 L225.21 35.82 L225.41 37.28 L225.44 38.80 L225.28 40.39 L225.04 41.80 L224.71 43.03 L224.28 44.08 L223.77 44.95 L223.14 45.81 L222.40 46.65 L221.54 47.49 L220.57 48.31 L219.60 49.02 L218.62 49.64 L217.65 50.15 L216.68 50.56 L215.72 50.91 L214.77 51.19 L213.83 51.41 L212.91 51.56 L211.77 51.62 L210.41 51.60 L208.84 51.48 L207.05 51.28 L205.25 51.14 L203.46 51.06 L201.67 51.05 L199.87 51.10 L199.18 51.29 L199.59 51.62 L201.10 52.10 L203.72 52.71 L206.07 53.44 L208.17 54.29 L210.02 55.25 L211.60 56.32 L212.95 57.32 L214.05 58.24 L214.91 59.09 L215.52 59.86 L216.25 61.16 L217.10 63.01 L218.06 65.39 L219.13 68.31 L220.08 71.10 L220.90 73.77 L221.59 76.30 L222.16 78.71 L222.67 81.19 L223.13 83.76 L223.54 86.39 L223.90 89.11 L224.18 92.00 L224.39 95.08 L224.51 98.33 L224.56 101.76 L224.48 105.45 L224.24 109.39 L223.87 113.60 L223.36 118.05 L222.72 122.56 L221.95 127.12 L221.06 131.73 L220.03 136.39 L218.83 141.28 L217.44 146.41 L215.88 151.76 L214.14 157.34 L211.87 164.25 L209.08 172.47 L205.76 182.01 L201.92 192.87 L198.76 202.05 L196.27 209.56 L194.47 215.38 L193.34 219.53 L192.32 223.54 L191.40 227.41 L190.58 231.13 L189.86 234.72 L189.23 238.28 L188.69 241.82 L188.25 245.32 L187.89 248.81 L187.63 252.33 L187.48 255.89 L187.43 259.49 L187.48 263.13 L187.71 266.93 L188.12 270.90 L188.71 275.04 L189.47 279.34 L190.26 283.16 L191.05 286.48 L191.86 289.33 L192.68 291.68 L193.47 293.81 L194.24 295.71 L194.98 297.37 L195.70 298.80 L196.03 299.94 L195.98 300.79 L195.54 301.34 L194.73 301.60 L193.55 301.79 L192.01 301.92 L190.11 301.98 L187.86 301.98 L184.54 301.71 L180.16 301.17 L174.72 300.37 L168.22 299.29 L162.34 298.24 L157.09 297.22 L152.46 296.22 L148.47 295.24 L144.41 294.17 L140.28 292.99 L136.10 291.71 L131.84 290.33 L127.58 288.84 L123.30 287.25 L119.01 285.56 L114.71 283.77 L110.62 281.99 L106.76 280.22 L103.11 278.47 L99.67 276.73 L96.40 275.00 L93.27 273.28 L90.30 271.58 L87.48 269.89 L84.58 268.06 L81.58 266.08 L78.49 263.97 L75.32 261.72 L72.19 259.40 L69.12 257.02 L66.10 254.57 L63.12 252.06 L60.23 249.51 L57.41 246.93 L54.67 244.30 L52.01 241.64 L49.46 239.00 L47.03 236.39 L44.71 233.80 L42.51 231.24 L40.29 228.53 L38.06 225.69 L35.82 222.71 L33.57 219.58 L31.06 215.77 L28.29 211.26 L25.27 206.06 L21.99 200.17 L19.12 194.58 L16.66 189.31 L14.61 184.34 L12.97 179.68 L11.54 175.34 L10.31 171.31 L9.28 167.61 L8.47 164.23 L7.72 160.81 L7.06 157.36 L6.47 153.86 L5.96 150.32 L5.55 146.50 L5.24 142.37 L5.03 137.95 L4.93 133.24 L4.92 129.00 L4.99 125.24 L5.16 121.95 L5.42 119.13 L5.76 116.16 L6.20 113.03 L6.72 109.75 L7.34 106.32 L8.04 102.90 L8.84 99.49 L9.72 96.10 L10.69 92.72 L11.76 89.36 L12.91 86.04 L14.15 82.73 L15.48 79.45 L16.96 76.12 L18.57 72.74 L20.32 69.31 L22.22 65.83 L24.26 62.38 L26.43 58.97 L28.75 55.61 L31.21 52.28 L33.64 49.16 L36.05 46.27 L38.43 43.59 L40.79 41.13 L43.31 38.68 L46.00 36.22 L48.86 33.76 L51.88 31.30 L54.93 28.97 L58.00 26.77 L61.10 24.69 L64.23 22.74 L67.25 20.96 L70.17 19.35 L72.99 17.90 L75.70 16.62 L78.59 15.37 L81.67 14.14 L84.92 12.93 L88.35 11.76 L91.61 10.72 L94.68 9.82 L97.57 9.07 L100.29 8.45 L103.16 7.89 L106.18 7.38 L109.36 6.92 L112.69 6.51 L116.39 6.15 L120.46 5.84 L124.90 5.58 L129.72 5.38 L133.34 5.21 L135.78 5.08 L137.02 4.99 L137.07 4.94 L137.91 4.92 L139.55 4.92 Z"
        fill="var(--vinnie-body)"
      />
      <g data-vinnie-eye="left" className="eye" transform="translate(47.93 87.75) rotate(1.02)">
        <g className="lid" style={LID_STYLE}>
          <ellipse cx="0" cy="0" rx="7.76" ry="20.41" fill="var(--vinnie-eye)" />
        </g>
      </g>
      <g data-vinnie-eye="right" className="eye" transform="translate(79.04 83.28) rotate(24.29)">
        <g className="lid" style={LID_STYLE}>
          <ellipse cx="0" cy="0" rx="11.44" ry="29.55" fill="var(--vinnie-eye)" />
        </g>
      </g>
    </svg>
  );
}
