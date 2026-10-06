/**
 * P2P capability plane. Two axes of Self() becoming operational.
 * Not four sequential boxes. Not two AIs chatting.
 *
 * Invariant: Self() names the next y and does not read prior Runs.
 * A reused sequence is selected outside Self(), and only when its
 * own final e is strictly lower. See src/lib/reuse-policy.ts.
 */

export const PLANE_VERSION = "p2p_plane_v1";

export type EpistemicAxis = "know" | "know_how" | "show" | "do";
export type PeerAxis = "individual" | "peer";
export type CapabilityName = "Know" | "Know-how" | "Show" | "Do";

export type CapabilityPoint = {
  id: string;
  asset: string;
  x: EpistemicAxis;
  y: PeerAxis;
  capability: CapabilityName;
  meaning: string;
  surface: string;
  href: string;
};

export const X_AXIS: { id: EpistemicAxis; label: CapabilityName }[] = [
  { id: "know", label: "Know" },
  { id: "know_how", label: "Know-how" },
  { id: "show", label: "Show" },
  { id: "do", label: "Do" },
];

export const Y_AXIS: { id: PeerAxis; label: string }[] = [
  { id: "individual", label: "individual" },
  { id: "peer", label: "peer / reusable" },
];

export const POINTS: CapabilityPoint[] = [
  {
    id: "auditable_verification",
    asset: "Auditable verification",
    x: "know",
    y: "individual",
    capability: "Know",
    meaning: "What is true / what was verified. Per-run log, digest, frozen artifact.",
    surface: "Audit",
    href: "/audit",
  },
  {
    id: "sovereign_engine",
    asset: "Sovereign / model-portable engine",
    x: "know_how",
    y: "individual",
    capability: "Know-how",
    meaning: "How to achieve the verified result. Swap the namer of y. Keep M and e.",
    surface: "Controller A",
    href: "/",
  },
  {
    id: "open_workbench",
    asset: "Open Workbench B",
    x: "show",
    y: "peer",
    capability: "Show",
    meaning: "Observable and reproducible through an open MCP contract. Another peer can become B.",
    surface: "Workbench B",
    href: "/workbench",
  },
  {
    id: "experience_marketplace",
    asset: "Verified experience marketplace",
    x: "do",
    y: "peer",
    capability: "Do",
    meaning: "Execute peer-to-peer. List only when final e falls. Φ > 0 is the only win.",
    surface: "Marketplace",
    href: "/marketplace",
  },
];

export const SELF_DEFINITION =
  "Self() = a peer that converts verified knowledge into executable, observable, reusable action across Workbench B.";

export const THESIS =
  "A peer's verified experience becomes actionable capability for another peer.";

export const INVARIANT = {
  selfReadsPriorRuns: false,
  listOnlyIfFinalELower: true,
  tieIsNotAWin: true,
  unsettledReceiptIsNotRevenue: true,
  feedback:
    "Do returns Φ to Know. Selection of a reused sequence sits outside Self().",
} as const;

export function planeContract() {
  return {
    version: PLANE_VERSION,
    self: SELF_DEFINITION,
    thesis: THESIS,
    axes: {
      x: "epistemic → operational",
      y: "individual → peer/reusable",
    },
    progression: X_AXIS.map((p) => p.label),
    points: POINTS,
    invariant: INVARIANT,
    loop: [
      "Self()",
      "Know + Know-how",
      "Show on Workbench B",
      "Do",
      "measured z",
      "error e / Δe",
      "verified experience Φ",
      "Self()",
    ],
  };
}