import type { Metadata } from "next";
import RecoveryProofClient from "./RecoveryProofClient";

export const metadata: Metadata = {
  title: "Recovery proof | Aethel Node",
  description:
    "Verify checkpoint recovery, safe continuation, and evidence export in the Level 4 workbench.",
};

export default function RecoveryProofPage() {
  return <RecoveryProofClient />;
}
