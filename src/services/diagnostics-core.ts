import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { DiagnosticAuditResult, DiagnosticScanRequest } from '@/services/diagnostics-engine';

export type { ScanMetadata } from '@/services/diagnostics-engine';
export type ScanInput = DiagnosticScanRequest;

export const SCORING_VERSION = 'mock-heuristic-v2';
export const FINGERPRINT_VERSION = 'sim-fp-v1';

// Words that, in a real pipeline, would make a fingerprint match more likely.
const DERIVATIVE_KEYWORDS = [
  'remix', 'cover', 'sample', 'bootleg', 'mashup', 'karaoke', 'instrumental of', 'in the style of', 'feat.', 'official',
  'radio edit', 'extended mix', 'live at', 'slowed', 'sped up', 'nightcore', 'bass boosted', 're-edit', 'acoustic version',
];
const RISKY_PROMPT_KEYWORDS = ['ignore previous', 'jailbreak', 'copyrighted', 'scrape', 'lyrics of'];
const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Deterministic mock similarity score (0..1, 0 = clean) from simple heuristics, plus a reason for every term.
 * The result depends only on contentHash, assetType, title, text and duration (title and text are lowercased and
 * whitespace-normalized), never on time or randomness. Terms: 0 to 0.04 from the contentHash (+0.02 when it is
 * too short); derivative keywords in title/text (+0.07 each, max 3); an "Artist - Title" pattern on AUDIO
 * (+0.02); a missing or very short title (+0.02); AUDIO under 15 s (+0.04), over 20 min (+0.02) or with no
 * duration (+0.01); text over 5000 chars (+0.03); risky keywords for MODEL_PROMPT (+0.10 each, max 2).
 * This is still a mock, not a real fingerprint or compliance check.
 */
export function scoreDiagnostics(req: ScanInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const hex = (req.contentHash || '').replace(/[^0-9a-f]/gi, '').slice(0, 8);
  let score = hex.length === 8 ? (parseInt(hex, 16) / 0xffffffff) * 0.04 : 0.02;
  reasons.push(
    hex.length === 8
      ? `base ${score.toFixed(4)} derived from contentHash ${hex} (0 to 0.04)`
      : 'contentHash too short to derive a stable base score (+0.02)',
  );
  const title = norm(req.metadata?.title);
  const text = norm(req.metadata?.text);
  const haystack = `${title} ${text}`;
  const hits = DERIVATIVE_KEYWORDS.filter((k) => haystack.includes(k)).slice(0, 3);
  for (const k of hits) {
    score += 0.07;
    reasons.push(`derivative keyword "${k}" in title or text (+0.07)`);
  }
  if (req.assetType === 'MODEL_PROMPT') {
    for (const k of RISKY_PROMPT_KEYWORDS.filter((k) => haystack.includes(k)).slice(0, 2)) {
      score += 0.1;
      reasons.push(`risky prompt keyword "${k}" (+0.10)`);
    }
  }
  if (req.assetType === 'AUDIO' && / [-\u2013\u2014] /.test(title)) {
    score += 0.02;
    reasons.push('title looks like "Artist - Title", possibly an existing release (+0.02)');
  }
  if (req.metadata?.title !== undefined || req.assetType === 'AUDIO') {
    if (title.length < 3) {
      score += 0.02;
      reasons.push('missing or very short title (+0.02)');
    }
  }
  if (req.assetType === 'AUDIO') {
    const d = req.metadata?.durationSeconds;
    if (typeof d !== 'number' || !(d > 0)) {
      score += 0.01;
      reasons.push('no duration given for audio (+0.01)');
    } else if (d < 15) {
      score += 0.04;
      reasons.push(`very short audio (${d}s), likely a sample (+0.04)`);
    } else if (d > 1200) {
      score += 0.02;
      reasons.push(`unusually long audio (${d}s) (+0.02)`);
    }
  }
  if ((req.metadata?.text?.length ?? 0) > 5000) {
    score += 0.03;
    reasons.push('very long text (+0.03)');
  }
  if (reasons.length === 1) reasons.push('no other risk terms matched');
  return { score: Math.min(1, Number(score.toFixed(4))), reasons };
}

/**
 * SIMULATED fingerprint: `fp_` plus 16 hex characters of a SHA-256 over the normalized title (lowercase, letters and
 * digits only), the duration rounded to whole seconds, and the assetType. It is distinct from the certificateHash
 * (which also covers assetId, contentHash, text, score and verdict) and is stable across punctuation, case and
 * sub-second duration differences. It is a hash of metadata, NOT an audio fingerprint: it knows nothing about the audio.
 */
export function simulatedFingerprint(req: ScanInput): string {
  const title = (req.metadata?.title ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const d = req.metadata?.durationSeconds;
  const dur = typeof d === 'number' && d > 0 ? String(Math.round(d)) : 'na';
  return `fp_${bytesToHex(sha256(utf8ToBytes(JSON.stringify([FINGERPRINT_VERSION, title, dur, req.assetType])))).slice(0, 16)}`;
}

/** Deterministic certificate id: a SHA-256 over the inputs and verdict, so identical inputs give the same certificate. */
export function certificateFor(req: ScanInput, score: number, overallStatus: string): string {
  const canon = JSON.stringify([
    SCORING_VERSION,
    req.assetId,
    req.assetType,
    req.contentHash,
    norm(req.metadata?.title),
    norm(req.metadata?.text),
    req.metadata?.durationSeconds ?? null,
    score,
    overallStatus,
  ]);
  return `cert_${bytesToHex(sha256(utf8ToBytes(canon))).slice(0, 40)}`;
}

/** Shared mock pipeline used by the diagnostics route and server-side plugin tools. */
export function runDiagnosticChecks(request: ScanInput): DiagnosticAuditResult {
  return runDiagnosticChecksDetailed(request).result;
}

export function runDiagnosticChecksDetailed(request: ScanInput): { result: DiagnosticAuditResult; reasons: string[]; scoringVersion: string; fingerprint: string; fingerprintVersion: string } {
  const { score, reasons } = scoreDiagnostics(request);
  const overallStatus: DiagnosticAuditResult['overallStatus'] = score < 0.15 ? 'PASSED' : score < 0.3 ? 'FLAGGED' : 'REJECTED';
  reasons.push(`total score ${score.toFixed(4)} gives ${overallStatus} (PASSED under 0.15, FLAGGED under 0.30, otherwise REJECTED)`);
  const fingerprint = simulatedFingerprint(request);
  reasons.push(`simulated fingerprint ${fingerprint} (${FINGERPRINT_VERSION}: hash of normalized title, rounded duration and assetType; not an audio fingerprint)`);
  return {
    reasons,
    scoringVersion: SCORING_VERSION,
    fingerprint,
    fingerprintVersion: FINGERPRINT_VERSION,
    result: {
      assetId: request.assetId,
      timestamp: Date.now(),
      overallStatus,
      checks: {
        copyrightMatchScore: score,
        trainingDataRisk: score < 0.1 ? 'LOW' : score < 0.25 ? 'MEDIUM' : 'HIGH',
        regulatoryCompliance: score < 0.15,
      },
      certificateHash: certificateFor(request, score, overallStatus),
    },
  };
}
