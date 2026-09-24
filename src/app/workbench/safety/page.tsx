"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type State = {
  status: string;
  candidate: string | null;
  required: string[];
  available: string[];
  contradictions: { source: string; note: string }[];
  secondOrder: string[];
  checks: Record<string, boolean>;
  y: string;
  e: string;
  limitation: string;
};

type LoopSnap = {
  B?: {
    completeness: number;
    contradiction: number;
    missing: number;
    uncertainty: number;
    useful: number;
  };
  V?: number;
  e_norm?: number | null;
  last_z?: string | null;
  A?: { y: string; locked: { execute_task: boolean } };
  ledger?: { t: number; y: string; dV: number; dominant: string }[];
};

export default function SafetyWorkbenchPage() {
  const [state, setState] = useState<State | null>(null);
  const [loop, setLoop] = useState<LoopSnap | null>(null);
  const [err, setErr] = useState("");
  const [loopErr, setLoopErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadEvidence() {
    try {
      const r = await fetch("/api/workbench/diagnostic", { cache: "no-store" });
      const d = await r.json();
      setState(d.state);
      setErr("");
    } catch {
      setErr("Evidence API not on this deploy. Commit diagnostic-state first.");
    }
  }

  async function loadLoop() {
    try {
      const r = await fetch("/api/workbench/loop", { cache: "no-store" });
      if (!r.ok) throw new Error("loop");
      setLoop(await r.json());
      setLoopErr("");
    } catch {
      setLoopErr("Loop API not on this deploy. Commit control-loop first.");
    }
  }

  async function recordEvidenceTick() {
    setBusy(true);
    try {
      const r = await fetch("/api/workbench/loop", {
        method: "POST",
       