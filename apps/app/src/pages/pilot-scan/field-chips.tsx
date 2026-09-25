const RISK_RANK: { re: RegExp; n: number }[] = [
  { re: /ssn|social.?sec/i, n: 100 },
  { re: /password|passwd|hash/i, n: 95 },
  { re: /dob|birth/i, n: 90 },
  { re: /credit|card|financial|bank/i, n: 85 },
  { re: /phone/i, n: 70 },
  { re: /email/i, n: 65 },
  { re: /address/i, n: 60 },
  { re: /relative|family/i, n: 50 },
  { re: /name|alias/i, n: 40 },
];

function scoreField(field: string): number {
  return RISK_RANK.find((r) => r.re.test(field))?.n ?? 20;
}

export function rankFields(fields: string[], limit = 5): { top: string[]; more: number } {
  const ranked = [...fields].sort((a, b) => scoreField(b) - scoreField(a) || a.localeCompare(b));
  const top = ranked.slice(0, limit);
  return { top, more: Math.max(0, ranked.length - top.length) };
}

export function FieldChips({ fields, limit = 5 }: { fields: string[]; limit?: number }) {
  const { top, more } = rankFields(fields, limit);
  if (top.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {top.map((field) => (
        <span
          key={field}
          className="rounded-full border border-border-subtle px-2.5 py-0.5 text-[12px] text-text-secondary"
        >
          {field}
        </span>
      ))}
      {more > 0 ? (
        <span className="rounded-full px-2.5 py-0.5 text-[12px] text-text-tertiary">+{more} more</span>
      ) : null}
    </div>
  );
}
