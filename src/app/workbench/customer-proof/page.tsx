"use client";

import { useRef, useState } from "react";
import {
  validateExperienceRecord,
  type ExperienceRecord,
} from "../../../core/experience-schema";
import {
  evaluateDeterministicProof,
  DETERMINISTIC_PROOF_VERSION,
  type DeterministicProof,
} from "../../../core/deterministic-proof";

type Report = {
  report_version: "aethel.customer-proof/1";
  record: ExperienceRecord;
  content_sha256: string;
  server_verdict: "PASS" | "FAIL" | "INCONCLUSIVE";
};

type Inspection = {
  report: Report;
  digestMatches: boolean;
  proof: DeterministicProof | null;
};

const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

// Matches canonical record hashing in src/core/hf-memory.ts.
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (object(value)) {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("Unsupported JSON value");
  return encoded;
}

function parseReport(value: unknown): Report {
  if (
    !object(value) ||
    value.report_version !== "aethel.customer-proof/1" ||
    !validateExperienceRecord(value.record) ||
    !/^wb-[0-9a-f]{32}$/.test(value.record.experience_id) ||
    value.record.provenance.source !== "third-party-workbench" ||
    !value.record.repo.startsWith("workbench:") ||
    typeof value.content_sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.content_sha256) ||
    typeof value.server_verdict !== "string" ||
    !["PASS", "FAIL", "INCONCLUSIVE"].includes(value.server_verdict)
  ) {
    throw new Error("Unsupported customer-proof export");
  }
  return value as unknown as Report;
}

function proofFor(record: ExperienceRecord): DeterministicProof | null {
  if (record.verification.verifier_version !== DETERMINISTIC_PROOF_VERSION) {
    return null;
  }
  try {
    const detail: unknown = JSON.parse(record.metamorphic.transformation);
    if (!object(detail) || !object(detail.inputs)) return null;
    const inputs = detail.inputs;
    if (
      !finite(inputs.predicted) ||
      !finite(inputs.observed) ||
      (inputs.phi !== undefined && !finite(inputs.phi)) ||
      (inputs.step !== undefined && !finite(inputs.step)) ||
      String(inputs.predicted) !== record.predicted_outcome ||
      String(inputs.observed) !== record.observed_outcome ||
      Math.abs(inputs.predicted - inputs.observed) !== record.delta_e
    ) {
      return null;
    }
    return evaluateDeterministicProof(
      {
        predicted: inputs.predicted,
        observed: inputs.observed,
        ...(finite(inputs.phi) ? { phi: inputs.phi } : {}),
        ...(finite(inputs.step) ? { step: inputs.step } : {}),
      },
      record.metamorphic.seed,
    );
  } catch {
    return null;
  }
}

function recordedTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "long",
  }).format(new Date(value));
}

export default function CustomerProofPage() {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const serial = useRef(0);

  async function inspect(file: File) {
    const current = ++serial.current;
    setInspection(null);
    setError(null);
    try {
      if (file.size > 1024 * 1024) {
        throw new Error("Export exceeds the 1 MiB viewer limit");
      }
      const report = parseReport(JSON.parse(await file.text()));
      const bytes = new TextEncoder().encode(canonical(report.record));
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hex = Array.from(
        new Uint8Array(digest),
        (n) => n.toString(16).padStart(2, "0"),
      ).join("");
      const proof = proofFor(report.record);
      if (current === serial.current) {
        setInspection({
          report,
          digestMatches: hex === report.content_sha256,
          proof,
        });
      }
    } catch (cause) {
      if (current === serial.current) {
        setError(cause instanceof Error ? cause.message : "Cannot inspect export");
      }
    }
  }

  const record = inspection?.report.record;
  const proof = inspection?.proof;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Customer proof report</h1>
      <p>
        Local inspection of a privately exported tenant record. No API key is
        requested or stored in this browser. File contents stay in this page&apos;s
        memory; this component makes no network requests and persists nothing.
      </p>
      <p>
        Obtain an existing record through authenticated GET{" "}
        <code>/api/v1/customer-proof/&#123;experience_id&#125;</code>{" "}
        using your approved API client, then select that JSON file below.
        This page has no record listing, automatic fetch or public share link.
      </p>
      <label className="block">
        Inspect private evidence export
        <input
          className="block mt-2"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void inspect(file);
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {inspection && record && (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold">Evidence identity and scope</h2>
            <p>Experience: <code>{record.experience_id}</code></p>
            <p>Submitted run: <code>{record.provenance.run_id}</code></p>
            <p>Workbench: {record.repo}; submitted version: {record.commit_sha}</p>
            <p>This version is a workbench label, not a verified Git commit.</p>
            <p>
              Recorded timestamp: {recordedTime(record.provenance.timestamp)}
              {" "}(America/Los_Angeles)
            </p>
            <p className="break-all">
              Canonical record SHA-256:{" "}
              <code>{inspection.report.content_sha256}</code>
            </p>
            <p>
              Local record/digest comparison:{" "}
              {inspection.digestMatches
                ? "MATCH"
                : "MISMATCH — do not rely on this artifact"}.
            </p>
            <p>
              Matching a digest supplied in the same file does not authenticate its
              author, establish production origin or provide independent immutable
              anchoring. The recorded timestamp is not independently attested.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">What changed</h2>
            <p>Submitted goal: {record.goal}</p>
            <p>Submitted action: {record.action}</p>
            <p>
              No before/after code diff, deployed change or baseline-run linkage
              is recorded here.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">What was verified</h2>
            <p>
              Server-reported deterministic verdict:{" "}
              {inspection.report.server_verdict} (not signed).
            </p>
            <p>Stored verifier label: {record.verification.verifier_version}.</p>
            <p>Stored metamorphic result: {record.metamorphic.result}.</p>
            <p>
              Local verifier: {DETERMINISTIC_PROOF_VERSION}; seeded recomputation:{" "}
              {proof?.verdict ?? "NOT EVALUABLE"}.
            </p>
            <p>
              {proof?.reason ??
                "Comparable stored proof inputs are unavailable or inconsistent."}
            </p>
            <p>
              Agreement with stored result:{" "}
              {proof
                ? String(proof.verdict === record.metamorphic.result)
                : "NOT VERIFIED"}.
            </p>
            <p>
              Agreement with server-reported verdict:{" "}
              {proof
                ? String(proof.verdict === inspection.report.server_verdict)
                : "NOT VERIFIED"}.
            </p>
            <p>
              This reruns the existing mathematical metamorphic check on submitted
              values. It does not replay the customer&apos;s workflow, execute the
              action, verify external outcomes or establish business benefit.
              The stored replay_verdict field is not evidence of an independent
              replay.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">What improved</h2>
            <p>
              Submitted prediction: {record.predicted_outcome}; submitted
              observation: {record.observed_outcome}.
            </p>
            <p>Recorded absolute prediction gap: {record.delta_e}.</p>
            <p>
              Improvement: NOT MEASURED. This gap is not an error reduction.
              Comparable before/after runs, units and a direction-of-benefit
              definition are absent.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">What remains uncertain</h2>
            <p>
              Production origin, independent replay, external measurement
              accuracy, customer consent/review, durable deployment storage,
              independent integrity anchoring, causal attribution and
              Git-reference linkage are NOT VERIFIED by this artifact.
              A tenant-authorized export is not proof that the submitted
              observations describe a real production run.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">What value was demonstrated</h2>
            <p>
              This inspection can establish only internal record/digest
              consistency and reproducibility of the stated deterministic check,
              when those comparisons succeed. Customer operational improvement,
              time saved, financial ROI and commercial value: NOT MEASURED.
            </p>
          </section>

          <details>
            <summary>Inspect recomputed inputs and transformations</summary>
            <pre className="overflow-auto whitespace-pre-wrap">
              {JSON.stringify(proof, null, 2)}
            </pre>
          </details>
          <details>
            <summary>Inspect original record and untrusted export assertions</summary>
            <pre className="overflow-auto whitespace-pre-wrap">
              {JSON.stringify(inspection.report, null, 2)}
            </pre>
          </details>
        </>
      )}
    </main>
  );
}