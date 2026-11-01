import Link from "next/link";

export const AUDIT_SUMMARY_HREF = "/workbench/audit";

/** Display-only link chip to /workbench/audit (shared by Medicare + look-back sticky strips). */
export default function AuditSummaryChip({ scope }: { scope: "medicare" | "lookback" }) {
  const cls = scope === "medicare" ? "px-3 py-1 text-xs" : "px-2 py-0.5";
  return (
    <Link data-audit-summary-chip={scope} href={AUDIT_SUMMARY_HREF}
      className={`inline-flex w-fit items-center rounded-full border border-violet-700 bg-violet-950/40 ${cls} font-semibold text-violet-300 hover:bg-violet-900/50`}>
      Audit summary →
    </Link>
  );
}
