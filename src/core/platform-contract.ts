// Aethel Node Extension Architecture
// A third-party Workbench produces these records without modifying the core engine.
// Level 4 = authoritative execution and verification.
// Hugging Face = durable, versioned founder experience archive.
// ROE = retrieval, qualification and next-action selection.
// Flywheel = live, inspectable presentation.

export type {
  ExperienceRecord,
  VerificationResult,
  MetamorphicResult,
  NextActionProposal,
} from "./interfaces";

export interface WorkbenchManifest {
  name: string;
  version: string;
  produces: ("ExperienceRecord" | "VerificationResult" | "MetamorphicResult" | "NextActionProposal")[];
  entrypoint: string;
}

export const PLATFORM_CONTRACT_VERSION = "1.1";
