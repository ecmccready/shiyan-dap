import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { DiagnosticAuditResult, DiagnosticScanRequest } from '@/services/diagnostics-engine';

export type { ScanMetadata } from '@/services/diagnostics-engine';
export type ScanInput = DiagnosticScanRequest;

export const SCORING_VERSION = 'mock-heuristic-v2';
export const FINGERPRINT_VERSION = 'sim-fp-v1';
/**
 * `fingerprint` is a metadata simulation. Real audio fingerprinting (Chromaprint, ACRCloud, Audible Magic or similar)
 * needs the audio bytes and an external service; the placeholder is always null so nothing can mistake the
 * simulation for it.
 */
export const AUDIO_FINGERPRINT_NOTE = 'not_implemented: no audio bytes analyzed';
export type AudioFingerprintStatus = 'not_implemented' | 'content_hash_only' | 'content_hash_provided';
export interface AudioFingerprintInfo {
  fingerprintKind: 'metadata_simulation';
  /** `sha256:<64 hex>` of the exact audio bytes (or of the supplied hash), else null. NOT a perceptual audio fingerprint. */
  audioFingerprint: string | null;
  audioFingerprintStatus: AudioFingerprintStatus;
  audioFingerprintNote: string;
}
export const AUDIO_FINGERPRINT_PLACEHOLDER: AudioFingerprintInfo = { fingerprintKind: 'metadata_simulation', audioFingerprint: null, audioFingerprintStatus: 'not_implemented', audioFingerprintNote: AUDIO_FINGERPRINT_NOTE };

/** Largest audio payload the scan route accepts inline (decoded bytes). */
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

/**
 * HOOK POINT for audio fingerprinting. Optional input, in order of preference:
 * - `bytes`: SHA-256 of the exact bytes, status `content_hash_only`. It matches byte-identical files only: re-encoding,
 *   trimming or tagging changes it, so it is NOT a perceptual or acoustic fingerprint and cannot detect copies.
 * - `hash`: a client-supplied 64-hex SHA-256, passed through as `sha256:<hex>` with status `content_hash_provided`. The server
 *   never saw the audio, so it is unverified.
 * - neither: null with `not_implemented: no audio bytes analyzed`.
 * To go further (Chromaprint, ACRCloud, Audible Magic or similar): decode the bytes here, compute the acoustic fingerprint or
 * call the matching service, and return it with a new status. Keep it separate from the metadata `fingerprint` and the
 * `certificateHash`, and record only the fingerprint and verdict on the ledger, never the audio. The `fingerprint` field is
 * still the metadata simulation either way, and `fingerprintKind` stays `metadata_simulation`.
 */
export function computeAudioFingerprint(audio?: { bytes?: Uint8Array; hash?: string }): AudioFingerprintInfo {
  if (audio?.bytes && audio.bytes.length > 0) {
    return { ...AUDIO_FINGERPRINT_PLACEHOLDER, audioFingerprint: `sha256:${bytesToHex(sha256(audio.bytes))}`, audioFingerprintStatus: 'content_hash_only', audioFingerprintNote: `content_hash_only: SHA-256 of ${audio.bytes.length} audio bytes; matches byte-identical files only, not a perceptual audio fingerprint` };
  }
  const h = audio?.hash?.trim().replace(/^sha256:/i, '').toLowerCase();
  if (h && /^[0-9a-f]{64}$/.test(h)) {
    return { ...AUDIO_FINGERPRINT_PLACEHOLDER, audioFingerprint: `sha256:${h}`, audioFingerprintStatus: 'content_hash_provided', audioFingerprintNote: 'content_hash_provided: client-supplied SHA-256, the server did not see the audio and cannot verify it; not a perceptual audio fingerprint' };
  }
  return AUDIO_FINGERPRINT_PLACEHOLDER;
}

/** Decodes an optional `audioBase64` string (max MAX_AUDIO_BYTES decoded) into bytes. Returns undefined for absent or invalid input. */
export function audioBytesFromBase64(b64: unknown): Uint8Array | undefined {
  if (typeof b64 !== 'string' || !b64 || b64.length > Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 8 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(b64)) return undefined;
  try {
    const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64.length / 4) * 4, '='));
    if (bin.length === 0 || bin.length > MAX_AUDIO_BYTES) return undefined;
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return undefined;
  }
}

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

export function runDiagnosticChecksDetailed(request: ScanInput, audio?: { bytes?: Uint8Array; hash?: string }): { result: DiagnosticAuditResult; reasons: string[]; scoringVersion: string; fingerprint: string; fingerprintVersion: string } & AudioFingerprintInfo {
  const { score, reasons } = scoreDiagnostics(request);
  const overallStatus: DiagnosticAuditResult['overallStatus'] = score < 0.15 ? 'PASSED' : score < 0.3 ? 'FLAGGED' : 'REJECTED';
  reasons.push(`total score ${score.toFixed(4)} gives ${overallStatus} (PASSED under 0.15, FLAGGED under 0.30, otherwise REJECTED)`);
  const audioInfo = computeAudioFingerprint(audio);
  const fingerprint = simulatedFingerprint(request);
  reasons.push(`SIMULATION ONLY: fingerprint ${fingerprint} (${FINGERPRINT_VERSION}) is a hash of normalized title, rounded duration and assetType. The metadata fingerprint analysed no audio; audioFingerprint is ${audioInfo.audioFingerprintNote}`);
  return {
    reasons,
    scoringVersion: SCORING_VERSION,
    fingerprint,
    fingerprintVersion: FINGERPRINT_VERSION,
    ...audioInfo,
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
