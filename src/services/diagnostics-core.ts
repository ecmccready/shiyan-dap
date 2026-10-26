import type { DiagnosticAuditResult, DiagnosticScanRequest } from '@/services/diagnostics-engine';

/** Optional hints the mock scan can use. All fields are optional. */
export interface ScanMetadata {
  title?: string;
  /** Free text to scan (lyrics, a prompt, a description). */
  text?: string;
  durationSeconds?: number;
}
export type ScanInput = DiagnosticScanRequest & { metadata?: ScanMetadata };

// Words that, in a real pipeline, would make a fingerprint match more likely.
const DERIVATIVE_KEYWORDS = ['remix', 'cover', 'sample', 'bootleg', 'mashup', 'karaoke', 'instrumental of', 'in the style of', 'feat.', 'official'];
const RISKY_PROMPT_KEYWORDS = ['ignore previous', 'jailbreak', 'copyrighted', 'scrape', 'lyrics of'];

/**
 * Deterministic mock similarity score (0..1, 0 = clean) from simple heuristics, and the reasons for it.
 * Base: 0 to 0.04 derived from the contentHash, so the same input gives the same score. Then bumps:
 * derivative keywords in title/text (+0.07 each, max 3), very short audio (+0.04 under 15 seconds),
 * very long text (+0.03 over 5000 chars), risky prompt keywords for MODEL_PROMPT (+0.10 each), and an
 * empty or too-short contentHash (+0.02). This is still a mock, not a real fingerprint.
 */
export function scoreDiagnostics(req: ScanInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const hex = (req.contentHash || '').replace(/[^0-9a-f]/gi, '').slice(0, 8);
  let score = hex.length === 8 ? (parseInt(hex, 16) / 0xffffffff) * 0.04 : 0.02;
  if (hex.length < 8) reasons.push('contentHash too short to derive a stable base score (+0.02)');
  const haystack = `${req.metadata?.title ?? ''} ${req.metadata?.text ?? ''}`.toLowerCase();
  const hits = DERIVATIVE_KEYWORDS.filter((k) => haystack.includes(k)).slice(0, 3);
  for (const k of hits) {
    score += 0.07;
    reasons.push(`derivative keyword "${k}" (+0.07)`);
  }
  if (req.assetType === 'MODEL_PROMPT') {
    for (const k of RISKY_PROMPT_KEYWORDS.filter((k) => haystack.includes(k)).slice(0, 2)) {
      score += 0.1;
      reasons.push(`risky prompt keyword "${k}" (+0.10)`);
    }
  }
  const d = req.metadata?.durationSeconds;
  if (req.assetType === 'AUDIO' && typeof d === 'number' && d > 0 && d < 15) {
    score += 0.04;
    reasons.push('very short audio, likely a sample (+0.04)');
  }
  if ((req.metadata?.text?.length ?? 0) > 5000) {
    score += 0.03;
    reasons.push('very long text (+0.03)');
  }
  return { score: Math.min(1, Number(score.toFixed(4))), reasons };
}

/** Shared mock pipeline used by the diagnostics route and server-side plugin tools. */
export function runDiagnosticChecks(request: ScanInput): DiagnosticAuditResult {
  return runDiagnosticChecksDetailed(request).result;
}

export function runDiagnosticChecksDetailed(request: ScanInput): { result: DiagnosticAuditResult; reasons: string[] } {
  const { score, reasons } = scoreDiagnostics(request);
  const overallStatus: DiagnosticAuditResult['overallStatus'] = score < 0.15 ? 'PASSED' : score < 0.3 ? 'FLAGGED' : 'REJECTED';
  return {
    reasons,
    result: {
      assetId: request.assetId,
      timestamp: Date.now(),
      overallStatus,
      checks: {
        copyrightMatchScore: score,
        trainingDataRisk: score < 0.1 ? 'LOW' : score < 0.25 ? 'MEDIUM' : 'HIGH',
        regulatoryCompliance: score < 0.15,
      },
      certificateHash: `cert_${crypto.randomUUID()}`,
    },
  };
}
