import type { IndependentReferenceAnchors } from "./github-reference";

/**
 * Deliberately disabled until a real independent immutable-anchor
 * backend is implemented and verified. No local or in-memory fallback.
 */
export function configuredReferenceAnchors():
  IndependentReferenceAnchors | undefined {
  return undefined;
}