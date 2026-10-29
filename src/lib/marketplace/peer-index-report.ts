/**
 * Plain-text report for a validatePeerListingIndex() result (pure: no I/O, no network, no writes).
 * Used by scripts/validate-peer-index.ts; kept here so it can be tested without spawning the CLI.
 * Exit code 0 when the index is well-formed (warnings do not fail), 1 when it is not. A pass is a shape check only.
 */
import { PEER_INDEX_NOTE, type PeerIndexResult } from "@/lib/marketplace/peer-index";

export function formatPeerIndexReport(result: PeerIndexResult): { lines: string[]; exitCode: 0 | 1 } {
  const lines: string[] = [PEER_INDEX_NOTE];
  if (result.ok) {
    const n = result.index.listings.length;
    const m = result.index.listings.filter((l) => l.peer_ready).length;
    lines.push(`OK: ${n} listings, ${m} peer_ready`);
    for (const w of result.warnings) lines.push(`warning: ${w}`);
    return { lines, exitCode: 0 };
  }
  for (const e of result.errors) lines.push(`error: ${e}`);
  return { lines, exitCode: 1 };
}
