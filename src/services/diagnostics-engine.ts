import { recordLedgerState } from "@/lib/micro-ledger-client";
import type { LedgerRecordResponse } from "@/types/ledger";

export interface DiagnosticScanRequest {
  assetId: string;
  /** Checks to run; defaults to all mock checks. */
  checks?: string[];
  baseUrl?: string;
}

export interface DiagnosticAuditResult {
  assetId: string;
  scannedAt: string;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  ledger: LedgerRecordResponse;
}

const DEFAULT_CHECKS = ["metadata-complete", "rights-declared", "no-duplicate-asset"];

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Mocked compliance scan; commits the result to the micro-ledger. */
export async function executeDiagnosticScan(
  req: DiagnosticScanRequest,
): Promise<DiagnosticAuditResult> {
  const scannedAt = new Date().toISOString();
  const checks = (req.checks?.length ? req.checks : DEFAULT_CHECKS).map((name) => ({
    name,
    passed: true,
    detail: "mock check passed",
  }));
  const passed = checks.every((c) => c.passed);
  const stateHash = `sha256:${await sha256Hex(JSON.stringify({ assetId: req.assetId, checks, scannedAt }))}`;
  const ledger = await recordLedgerState(
    {
      assetId: req.assetId,
      domain: "diagnostics",
      eventType: "diagnostic.scan.completed",
      stateHash,
      timestamp: scannedAt,
      metadata: { passed, checkCount: checks.length, mock: true },
    },
    req.baseUrl,
  );
  return { assetId: req.assetId, scannedAt, passed, checks, ledger };
}
