export type PredictedB = {
  scale: number;
  time: number;
  speed: number;
  confidence: number;
};

export type LedgerRow = {
  proposal: "B";
  workspaceId: string;
  channelId: string;
  predicted: PredictedB;
  weight: number;
  external_event: {
    price: number | null;
    source: "none" | "stripe";
    authoritative: boolean;
  };
  observed: {
    settled_in_shiyan: boolean;
    ping_id?: string;
  };
  error: number | null;
  z: string;
  next_action: string;
  at: string;
};

const g = globalThis as unknown as { __shiyanLedger?: LedgerRow[] };

function ledger() {
  if (!g.__shiyanLedger) g.__shiyanLedger = [];
  return g.__shiyanLedger;
}

export function predictB(input: {
  scale: number;
  time: number;
  speed: number;
  confidence: number;
}): PredictedB & { weight: number } {
  const scale = clamp(input.scale);
  const time = clamp(input.time);
  const speed = clamp(input.speed);
  const confidence = clamp(input.confidence);
  const weight =
    Math.round(((scale + time + speed) / 3) * confidence * 1000) / 1000;
  return { scale, time, speed, confidence, weight };
}

export function measure(predWeight: number, observed: number | null) {
  if (observed === null) return null;
  return Math.round((observed - predWeight) * 1000) / 1000;
}

export function nextAction(opts: {
  external: boolean;
  settled: boolean;
  error: number | null;
}) {
  if (opts.external && opts.settled) return "OPTIMIZE_FROM_E_B";
  if (opts.external) return "WAIT_EXTERNAL";
  return "CONTINUE_ENDOGENOUS";
}

export function writeRow(row: LedgerRow) {
  ledger().unshift(row);
  return ledger().slice(0, 20);
}

export function rows() {
  return ledger().slice(0, 20);
}

function clamp(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}