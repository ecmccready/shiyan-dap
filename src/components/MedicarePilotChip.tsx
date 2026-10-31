"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { medicarePilotPulse, MEDICARE_PILOT_PULSE_MS, MEDICARE_PILOT_SEEN_KEY } from "@/lib/medicare/investigation";

/** Display-only link chip; first-visit emerald pulse (~6s) until clicked once (localStorage). */
export default function MedicarePilotChip() {
  const [seen, setSeen] = useState(true);
  const [mount, setMount] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let s = false; try { s = localStorage.getItem(MEDICARE_PILOT_SEEN_KEY) === "1"; } catch {}
    setSeen(s); if (s) return;
    const t0 = Date.now(); setMount(t0); setNow(t0);
    const iv = setInterval(() => setNow(Date.now()), 500);
    const to = setTimeout(() => clearInterval(iv), MEDICARE_PILOT_PULSE_MS + 600);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, []);
  const on = medicarePilotPulse(seen, mount, now);
  return (
    <Link data-medicare-pilot-chip data-medicare-pilot-pulsing={on ? "1" : undefined} href="/workbench/offer#pilot-proposition"
      onClick={() => { try { localStorage.setItem(MEDICARE_PILOT_SEEN_KEY, "1"); } catch {} setSeen(true); }}
      className={`inline-flex w-fit items-center gap-1 rounded-full border border-emerald-700 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50${on ? " ring-2 ring-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)] motion-safe:animate-pulse" : ""}`}>
      Medicare · Pilot proposition →
    </Link>
  );
}
