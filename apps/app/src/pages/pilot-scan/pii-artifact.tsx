/**
 * Square "cover" tiles for the pilot-scan intro — each one is a data-broker
 * artifact (the PII they sell). Designed to read at ~80–160px like album art.
 */
import type { ReactElement } from "react";
import { cx } from "@/utils/cx";

export type ArtifactKind =
  | "profile"
  | "phone"
  | "address"
  | "email"
  | "relatives"
  | "ssn"
  | "social"
  | "records"
  | "property"
  | "location"
  | "dob"
  | "search";

const shell =
  "relative flex h-full w-full flex-col justify-end overflow-hidden rounded-[22%] text-left font-ubuntu shadow-[0_18px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/15 [container-type:size]";

const tones: Record<ArtifactKind, string> = {
  profile: "bg-[#33485A]",
  phone: "bg-[#2A3848]",
  address: "bg-[#2C4452]",
  email: "bg-[#1F3C4C]",
  relatives: "bg-[#323E4C]",
  ssn: "bg-[#2A3038]",
  social: "bg-[#1A3A4C]",
  records: "bg-[#33404C]",
  property: "bg-[#2B3C48]",
  location: "bg-[#2A3A48]",
  dob: "bg-[#303C4A]",
  search: "bg-[#3A4E60]",
};

function Initials({
  letters,
  className,
  tint = "azure",
}: {
  letters: string;
  className?: string;
  tint?: "azure" | "navy";
}) {
  return (
    <div
      className={cx(
        "flex items-center justify-center rounded-full font-semibold tracking-tight",
        tint === "azure" ? "bg-[#00BFFF]/20 text-[#7ADFFF]" : "bg-[#022136] text-[#B8C4CC]",
        className,
      )}
    >
      {letters}
    </div>
  );
}

function ProfileArt() {
  return (
    <div className={cx(shell, tones.profile)}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_28%,rgba(0,191,255,0.22),transparent_58%)]" />
      <Initials
        letters="JM"
        className="absolute left-1/2 top-[16%] h-[38%] w-[38%] -translate-x-1/2 text-[13cqw]"
      />
      <div className="relative px-[12%] pb-[12%]">
        <p className="text-[13cqw] font-bold leading-none tracking-tight text-white">J. MORENO</p>
        <p className="mt-[0.4em] text-[8cqw] text-[#B8C4CC]">34 · Austin, TX</p>
        <p className="mt-[0.25em] text-[8cqw] font-medium text-[#00BFFF]">47 listings</p>
      </div>
    </div>
  );
}

function PhoneArt() {
  return (
    <div className={cx(shell, tones.phone)}>
      <div className="absolute inset-x-[14%] top-[12%] grid grid-cols-3 gap-[8%]">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-full bg-white/[0.06] ring-1 ring-white/[0.05]"
          />
        ))}
      </div>
      <div className="relative px-[10%] pb-[12%]">
        <p className="text-[11cqw] font-medium tabular-nums tracking-wide text-white">
          (512) •••-4481
        </p>
        <p className="mt-[0.45em] text-[7cqw] uppercase tracking-[0.14em] text-[#7A92A8]">
          Mobile · 3 carriers
        </p>
      </div>
    </div>
  );
}

function AddressArt() {
  return (
    <div className={cx(shell, tones.address)}>
      <svg
        viewBox="0 0 80 56"
        className="absolute inset-x-[10%] top-[10%] h-[46%] w-[80%]"
        aria-hidden
      >
        <rect x="2" y="4" width="76" height="48" rx="6" fill="#022136" />
        {[16, 32, 48].map((y) => (
          <line key={y} x1="8" y1={y} x2="72" y2={y} stroke="#2A4A68" strokeWidth="1" />
        ))}
        {[22, 40, 58].map((x) => (
          <line key={x} x1={x} y1="10" x2={x} y2="46" stroke="#2A4A68" strokeWidth="1" />
        ))}
        <rect x="38" y="22" width="16" height="12" fill="#00BFFF" opacity="0.85" />
        <circle cx="46" cy="20" r="3.2" fill="#00BFFF" />
      </svg>
      <div className="relative px-[12%] pb-[12%]">
        <p className="text-[12cqw] font-semibold leading-none text-white">412 Oak St</p>
        <p className="mt-[0.45em] text-[7cqw] uppercase tracking-[0.12em] text-[#7A92A8]">
          Current · Austin
        </p>
      </div>
    </div>
  );
}

function EmailArt() {
  return (
    <div className={cx(shell, tones.email)}>
      <div className="absolute left-[16%] top-[16%] h-[28%] w-[68%] rounded-[18%] border border-white/15 bg-[#022136]" />
      <div className="absolute left-[20%] top-[22%] h-[28%] w-[68%] rounded-[18%] border border-[#00BFFF]/35 bg-[#16384C]" />
      <div className="relative px-[10%] pb-[12%]">
        <p className="text-[9.5cqw] font-medium tracking-tight text-white">j.m••@gmail.com</p>
        <p className="mt-[0.45em] text-[8cqw] font-medium text-[#00BFFF]">12 breaches</p>
      </div>
    </div>
  );
}

function RelativesArt() {
  return (
    <div className={cx(shell, tones.relatives)}>
      <div className="absolute left-[14%] top-[16%] flex h-[32%] w-[72%] items-center">
        <Initials letters="A" className="h-full w-auto aspect-square text-[11cqw]" tint="navy" />
        <Initials letters="M" className="-ml-[10%] h-full w-auto aspect-square text-[11cqw]" />
        <Initials letters="R" className="-ml-[10%] h-full w-auto aspect-square text-[11cqw]" tint="navy" />
      </div>
      <div className="relative px-[12%] pb-[12%]">
        <p className="text-[12cqw] font-semibold text-white">Relatives</p>
        <p className="mt-[0.4em] text-[7cqw] uppercase tracking-[0.12em] text-[#7A92A8]">8 found</p>
      </div>
    </div>
  );
}

function SsnArt() {
  return (
    <div className={cx(shell, tones.ssn)}>
      <div className="absolute inset-x-[12%] top-[16%] flex flex-col gap-[10%]">
        <div className="h-[9cqw] w-[72%] rounded-full bg-[#0B1722]" />
        <div className="h-[9cqw] w-[38%] rounded-full bg-[#0B1722]" />
        <p className="text-[14cqw] font-semibold tabular-nums tracking-wider text-white">•• 4821</p>
      </div>
      <div className="relative px-[12%] pb-[12%]">
        <p className="text-[9cqw] font-semibold uppercase tracking-[0.16em] text-[#FF8A00]">
          Exposed
        </p>
        <p className="mt-[0.35em] text-[7.5cqw] text-[#7A92A8]">SSN on file</p>
      </div>
    </div>
  );
}

function SocialArt() {
  return (
    <div className={cx(shell, tones.social)}>
      <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(0,191,255,0.18),transparent_55%)]" />
      <p className="absolute left-[12%] top-[12%] text-[26cqw] font-bold leading-none text-[#00BFFF]/75">
        @
      </p>
      <div className="relative px-[12%] pb-[12%]">
        <p className="text-[13cqw] font-semibold text-white">jmoreno</p>
        <p className="mt-[0.4em] text-[7cqw] uppercase tracking-[0.12em] text-[#7A92A8]">
          Public · 2.4k
        </p>
      </div>
    </div>
  );
}

function RecordsArt() {
  return (
    <div className={cx(shell, tones.records)}>
      <div className="absolute left-[18%] top-[14%] h-[36%] w-[52%] rotate-[-8deg] rounded-[12%] bg-[#1A2A38] ring-1 ring-white/10" />
      <div className="absolute left-[24%] top-[18%] flex h-[36%] w-[52%] rotate-[4deg] flex-col gap-[12%] rounded-[12%] bg-[#243444] px-[8%] pt-[10%] ring-1 ring-white/10">
        <div className="h-[12%] w-[80%] rounded-full bg-white/20" />
        <div className="h-[12%] w-[60%] rounded-full bg-white/10" />
        <div className="h-[12%] w-[70%] rounded-full bg-white/10" />
      </div>
      <div className="relative px-[12%] pb-[12%]">
        <p className="text-[10cqw] font-semibold text-white">Court · Property</p>
        <p className="mt-[0.4em] text-[7cqw] uppercase tracking-[0.12em] text-[#7A92A8]">6 files</p>
      </div>
    </div>
  );
}

function PropertyArt() {
  return (
    <div className={cx(shell, tones.property)}>
      <svg
        viewBox="0 0 64 44"
        className="absolute left-[18%] top-[14%] h-[40%] w-[64%]"
        aria-hidden
      >
        <path d="M8 22 L32 6 L56 22 V40 H8 Z" fill="#022136" stroke="#00BFFF" strokeWidth="1.6" />
        <rect x="26" y="26" width="12" height="14" fill="#00BFFF" opacity="0.7" />
      </svg>
      <div className="relative px-[12%] pb-[12%]">
        <p className="text-[7.5cqw] uppercase tracking-[0.14em] text-[#7A92A8]">Est. value</p>
        <p className="mt-[0.3em] text-[14cqw] font-semibold tabular-nums text-white">$•••,•••</p>
      </div>
    </div>
  );
}

function LocationArt() {
  return (
    <div className={cx(shell, tones.location)}>
      <svg viewBox="0 0 80 48" className="absolute inset-x-[10%] top-[12%] h-[44%]" aria-hidden>
        <path
          d="M8 36 C22 10, 38 40, 52 16 S72 8, 74 20"
          fill="none"
          stroke="#2A4A68"
          strokeWidth="2"
        />
        {[
          [20, 22],
          [44, 28],
          [64, 16],
        ].map(([pinX, pinY]) => (
          <g key={`${pinX}-${pinY}`}>
            <circle cx={pinX} cy={pinY} r="4" fill="#00BFFF" />
            <circle cx={pinX} cy={pinY} r="8" fill="#00BFFF" opacity="0.18" />
          </g>
        ))}
      </svg>
      <div className="relative px-[12%] pb-[12%]">
        <p className="text-[13cqw] font-semibold text-white">3 cities</p>
        <p className="mt-[0.4em] text-[7cqw] uppercase tracking-[0.12em] text-[#7A92A8]">2014–now</p>
      </div>
    </div>
  );
}

function DobArt() {
  return (
    <div className={cx(shell, tones.dob)}>
      <div className="absolute inset-x-[16%] top-[14%] grid grid-cols-4 gap-[6%]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={cx(
              "aspect-square rounded-[20%] bg-white/[0.06]",
              i === 5 && "bg-[#00BFFF]/80",
            )}
          />
        ))}
      </div>
      <div className="relative px-[12%] pb-[12%]">
        <p className="text-[12cqw] font-semibold tabular-nums text-white">03 / •• / 1991</p>
        <p className="mt-[0.4em] text-[7cqw] uppercase tracking-[0.12em] text-[#7A92A8]">
          Date of birth
        </p>
      </div>
    </div>
  );
}

function SearchArt() {
  return (
    <div className={cx(shell, tones.search)}>
      <p className="absolute left-[12%] top-[14%] text-[7cqw] font-medium uppercase tracking-[0.16em] text-[#00BFFF]">
        People search
      </p>
      <div className="relative px-[12%] pb-[12%]">
        <p className="text-[12cqw] font-bold leading-none text-white">M. Harris, 41</p>
        <p className="mt-[0.45em] text-[9cqw] text-[#B8C4CC]">Dallas, TX</p>
        <p className="mt-[0.45em] text-[8cqw] font-medium text-[#00BFFF]">Full report →</p>
      </div>
    </div>
  );
}

const ART: Record<ArtifactKind, () => ReactElement> = {
  profile: ProfileArt,
  phone: PhoneArt,
  address: AddressArt,
  email: EmailArt,
  relatives: RelativesArt,
  ssn: SsnArt,
  social: SocialArt,
  records: RecordsArt,
  property: PropertyArt,
  location: LocationArt,
  dob: DobArt,
  search: SearchArt,
};

export function PiiArtifact({ kind }: { kind: ArtifactKind }) {
  const Art = ART[kind];
  return <Art />;
}
