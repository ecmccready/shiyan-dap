import type { WorkbenchPlugin, LedgerHookEvent } from '@/types/workbench-plugin';
import MusicStudioPanel from './MusicStudioPanel';
import { runDiagnosticChecksDetailed } from '@/services/diagnostics-core';

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Validates a split rule: 1 to 10 recipients, positive percentages that sum to 100. */
export function parseSplitRule(v: unknown): { account: string; percentage: number }[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 10) throw new Error('splitRule must be an array of 1 to 10 {account, percentage}');
  const out = v.map((x) => {
    const o = x as { account?: unknown; percentage?: unknown };
    if (typeof o?.account !== 'string' || !o.account.trim() || o.account.length > 120) throw new Error('each split needs an account string');
    if (typeof o.percentage !== 'number' || !(o.percentage > 0) || o.percentage > 100) throw new Error('each split percentage must be above 0 and at most 100');
    return { account: o.account.trim(), percentage: o.percentage };
  });
  const sum = out.reduce((a, b) => a + b.percentage, 0);
  if (Math.abs(sum - 100) > 0.001) throw new Error(`splitRule percentages must sum to 100 (got ${sum})`);
  return out;
}

let lastEvent: LedgerHookEvent | null = null;

export const musicStudioPlugin: WorkbenchPlugin = {
  id: 'music-studio',
  name: 'Music Studio',
  version: '0.1.0',
  registerTools: () => [
    {
      name: 'describe_track',
      description: 'Returns a one-line description of a track from its title and duration.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' }, durationSeconds: { type: 'number' } },
        required: ['title'],
      },
      execute: async (args) => `${String(args.title ?? 'Untitled')} (${Number(args.durationSeconds) || 0}s)`,
    },
    {
      name: 'register_track',
      description: 'Registers a track on the micro-ledger (MUSIC_TRACK event) and returns its assetId and txHash.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' }, durationSeconds: { type: 'number' }, assetId: { type: 'string' } },
        required: ['title'],
      },
      execute: async (args, context) => {
        const title = String(args.title);
        const duration = Number(args.durationSeconds) || undefined;
        const assetId = typeof args.assetId === 'string' && args.assetId ? args.assetId : `trk_${crypto.randomUUID().slice(0, 8)}`;
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ assetId, title, duration })));
        const metadataHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
        const txHash = await context.emitLedgerEvent({
          action: 'MUSIC_TRACK',
          assetId,
          payload: { title, duration, metadataHash },
          timestamp: Date.now(),
        });
        return { assetId, title, txHash };
      },
    },
    {
      name: 'create_music_asset',
      description:
        'One action: registers a track (MUSIC_TRACK) with an optional splitRule, runs the mock diagnostics scan on it, and commits the DIAGNOSTIC_AUDIT event with the same splitRule. Returns both txHashes. Settlement (settlementRail, settlementAmountCents) is attached to the track event only.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          durationSeconds: { type: 'number' },
          assetId: { type: 'string' },
          splitRule: {
            type: 'array',
            description: 'Recipients; percentages must sum to 100',
            items: { type: 'object', properties: { account: { type: 'string' }, percentage: { type: 'number' } }, required: ['account', 'percentage'] },
          },
          settlementRail: { type: 'string', enum: ['INTERNAL_MICRO', 'STRIPE', 'X_MONEY'] },
          settlementAmountCents: { type: 'number' },
          settlementCurrency: { type: 'string' },
        },
        required: ['title'],
      },
      execute: async (args, context) => {
        const title = String(args.title ?? '').trim();
        if (!title || title.length > 200) throw new Error('title is required (max 200 characters)');
        const duration = typeof args.durationSeconds === 'number' && args.durationSeconds > 0 ? args.durationSeconds : undefined;
        const splitRule = args.splitRule === undefined ? undefined : parseSplitRule(args.splitRule);
        const assetId = typeof args.assetId === 'string' && args.assetId ? args.assetId : `trk_${crypto.randomUUID().slice(0, 8)}`;
        const metadataHash = await sha256Hex(JSON.stringify({ assetId, title, duration, splitRule }));
        const settlement = {
          ...(typeof args.settlementRail === 'string' ? { settlementRail: args.settlementRail } : {}),
          ...(typeof args.settlementAmountCents === 'number' ? { settlementAmountCents: args.settlementAmountCents } : {}),
          ...(typeof args.settlementCurrency === 'string' ? { settlementCurrency: args.settlementCurrency } : {}),
        };
        const trackTxHash = await context.emitLedgerEvent({
          action: 'MUSIC_TRACK',
          assetId,
          payload: { title, duration, splitRule, metadataHash, ...settlement },
          timestamp: Date.now(),
        });
        // In-process scan: same checks as POST /api/v1/diagnostics/scan (this tool runs server-side).
        // contentHash is derived from the track content (title, duration), not the random assetId, so the same
        // title and duration always score the same.
        const contentHash = await sha256Hex(JSON.stringify({ title: title.toLowerCase(), duration: duration ?? null }));
        const { result, reasons, scoringVersion, fingerprint, fingerprintVersion } = runDiagnosticChecksDetailed({
          assetId,
          assetType: 'AUDIO',
          contentHash,
          metadata: { title, durationSeconds: duration },
        });
        const auditTxHash = await context.emitLedgerEvent({
          action: 'DIAGNOSTIC_AUDIT',
          assetId,
          payload: {
            ...(splitRule ? { splitRule } : {}),
            auditStatus: result.overallStatus === 'PASSED' ? 'PASSED' : 'FAILED',
            metadataHash: result.certificateHash,
          },
          timestamp: result.timestamp,
        });
        return { assetId, title, duration, splitRule: splitRule ?? null, trackTxHash, auditTxHash, audit: result, reasons, scoringVersion, fingerprint, fingerprintVersion };
      },
    },
  ],
  onLedgerEvent: async (event) => {
    lastEvent = event;
  },
  renderPanel: MusicStudioPanel,
};

export const getLastMusicLedgerEvent = () => lastEvent;
