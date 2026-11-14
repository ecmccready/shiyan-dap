/** TEST ONLY. Offline check for the M1 4D state compression core (src/core/compression).
 * Hand-written fixture records only; never connects to a database and writes nothing.
 * Run: npx --yes tsx@4 --tsconfig ./tsconfig.json scripts/check-compression.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  compressPoints,
  compressTenant,
  decodeFloats,
  encodeFloats,
  extractPoints,
  reconstruct,
  sealSegment,
  verifyChain,
  verifySegment,
  verifyTenant,
  type SealedSegment,
  type SourceRow,
  type StatePoint,
} from "../src/core/compression";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const same = (a: number, b: number) => Object.is(a, b);

// ---------- Fixtures (tests only) ----------
type Fx = { tenant?: string; id: string; predicted: number; observed: number; phi?: number; step?: number;
  verdict?: string; source?: string; ts?: string; recordTenant?: string };

function fixtureRow(f: Fx): SourceRow {
  const tenant = f.tenant ?? "tenant-a";
  const inputs = { predicted: f.predicted, observed: f.observed, phi: f.phi ?? 1, step: f.step ?? 0 };
  const record = {
    experience_id: f.id, tenant_id: f.recordTenant ?? tenant, repo: "workbench:fixture-bench", commit_sha: "1.0.0",
    goal: "fixture goal", baseline: `predicted=${f.predicted}`, action: "fixture action",
    predicted_outcome: String(f.predicted), observed_outcome: String(f.observed),
    delta_e: Math.abs(f.predicted - f.observed), metrics: { transformations: 8 },
    verification: { replay_verdict: "PASS", verifier_version: "deterministic-proof-v1" },
    metamorphic: { seed: 42, transformation: JSON.stringify({ inputs, transformations: [] }),
      expected_relation: "fixture relation", result: f.verdict ?? "PASS", converged: true },
    provenance: { source: f.source ?? "third-party-workbench", run_id: `run-${f.id}`, timestamp: f.ts ?? "2026-01-01T00:00:00.000Z" },
    reuse_eligibility: false, z_next_action: "fixture next action", data_classification: "third-party-submission", revision: 1,
  };
  const record_json = JSON.stringify(record);
  return { tenant_id: tenant, experience_id: f.id, record_json, content_sha256: sha(record_json), proof_timestamp: f.ts ?? "2026-01-01T00:00:00.000Z" };
}

const ts = (i: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
const id = (i: number) => `wb-${i.toString(16).padStart(32, "0")}`;
const rowsA: SourceRow[] = Array.from({ length: 10 }, (_, i) => fixtureRow({
  id: id(i), predicted: 1 + i / 10, observed: 1 + i / 9, phi: 1 - i / 100, step: i,
  verdict: ["PASS", "FAIL", "INCONCLUSIVE"][i % 3], ts: ts(i),
}));

let checks = 0;
const check = (name: string, fn: () => void) => { fn(); checks += 1; console.log(`PASS ${name}`); };

// ---------- Lossless round trip ----------
check("float coding is bit-exact incl. -0, subnormal, huge, repeated", () => {
  const values = [-0, 0, 5e-324, -5e-324, 2.2250738585072014e-308, 1.7976931348623157e308, -1.7976931348623157e308,
    0.1 + 0.2, 0.1 + 0.2, 0.1 + 0.2, 1e-300, -1e300, 123456789.123456789, Number.EPSILON, Number.MAX_SAFE_INTEGER];
  const codes = encodeFloats(values);
  const back = decodeFloats(codes);
  assert.equal(back.length, values.length);
  values.forEach((v, i) => assert.ok(same(back[i], v), `index ${i}: ${back[i]} !== ${v}`));
  assert.equal(codes[8], "0", "repeated value encodes as 0");
  assert.equal(codes[9], "0");
  assert.throws(() => encodeFloats([NaN]));
  assert.throws(() => encodeFloats([Infinity]));
  assert.throws(() => decodeFloats(["00ff"]), "non-canonical hex rejected");
});

check("reconstruct(compress(points)) is exact for the 4D state", () => {
  const specials = [-0, 5e-324, 1.7976931348623157e308, -1.7976931348623157e308, 0.30000000000000004, 0.30000000000000004];
  const points: StatePoint[] = specials.map((v, i) => ({
    experience_id: id(i), content_sha256: sha(String(i)), t: Date.UTC(2026, 0, 1) + i * 1000,
    predicted: v, observed: -v, phi: specials[(i + 1) % specials.length], step: i === 0 ? -0 : i,
    verdict: (["PASS", "FAIL", "INCONCLUSIVE"] as const)[i % 3],
  }));
  const sealed = compressPoints("tenant-a", 0, points, null);
  const back = reconstruct(sealed.segment);
  assert.equal(back.length, points.length);
  back.forEach((v, i) => {
    const p = points[i];
    assert.equal(v.t, p.t); assert.equal(v.verdict, p.verdict);
    for (const k of ["predicted", "observed", "phi", "step"] as const) assert.ok(same(v[k], p[k]), `${k}[${i}]`);
  });
  // JSON round trip of the segment (as storage would do) is also exact.
  const viaJson = reconstruct(JSON.parse(JSON.stringify(sealed.segment)));
  viaJson.forEach((v, i) => assert.ok(same(v.predicted, points[i].predicted)));
});

check("extract reads -0 written literally in stored inputs", () => {
  const r = fixtureRow({ id: id(99), predicted: 1, observed: 2, ts: ts(0) });
  const record = JSON.parse(r.record_json);
  record.metamorphic.transformation = '{"inputs":{"predicted":-0,"observed":2,"phi":1,"step":0},"transformations":[]}';
  const json = JSON.stringify(record);
  const row = { ...r, record_json: json, content_sha256: sha(json) };
  const { points } = extractPoints("tenant-a", [row]);
  assert.ok(Object.is(points[0].predicted, -0));
});

// ---------- Determinism ----------
check("same rows, any order => identical chain and hashes", () => {
  const a = compressTenant("tenant-a", rowsA, { segmentSize: 4 });
  const reversed = compressTenant("tenant-a", [...rowsA].reverse(), { segmentSize: 4 });
  const shuffled = compressTenant("tenant-a", [rowsA[7], rowsA[2], rowsA[9], rowsA[0], rowsA[5], rowsA[1], rowsA[8], rowsA[3], rowsA[6], rowsA[4]], { segmentSize: 4 });
  const again = compressTenant("tenant-a", rowsA, { segmentSize: 4 });
  for (const other of [reversed, shuffled, again]) assert.deepEqual(other, a);
  assert.equal(a.segments.length, 2);
  assert.equal(a.pending, 2, "partial window stays pending");
  assert.equal(a.head_sha256, a.segments[1].segment_sha256);
  assert.equal(a.segments[0].segment.prev_segment_sha256, null);
  assert.equal(a.segments[1].segment.prev_segment_sha256, a.segments[0].segment_sha256);
  const sealed = compressTenant("tenant-a", rowsA, { segmentSize: 4, sealPartial: true });
  assert.equal(sealed.segments.length, 3); assert.equal(sealed.pending, 0);
  assert.equal(sealed.segments[1].segment_sha256, a.segments[1].segment_sha256, "sealing a partial window does not change closed ones");
  assert.equal(compressTenant("tenant-a", rowsA).segments.length, 0, "default N=256 leaves 10 points pending");
  assert.equal(compressTenant("tenant-a", rowsA).pending, 10);
  assert.ok(verifyTenant("tenant-a", a.segments, [...rowsA].reverse(), { segmentSize: 4 }).ok);
});

// ---------- Verification and tamper detection ----------
const chain = compressTenant("tenant-a", rowsA, { segmentSize: 4 });
const seg0 = chain.segments[0];
const seg0Rows = rowsA.slice(0, 4);
const clone = (s: SealedSegment): SealedSegment => JSON.parse(JSON.stringify(s));

check("untampered segment and chain verify", () => {
  assert.deepEqual(verifySegment(seg0, seg0Rows), { ok: true, errors: [] });
  assert.deepEqual(verifySegment(seg0, [...seg0Rows].reverse()), { ok: true, errors: [] });
  assert.deepEqual(verifyChain(chain.segments), { ok: true, errors: [] });
  assert.deepEqual(verifyTenant("tenant-a", chain.segments, rowsA, { segmentSize: 4 }), { ok: true, errors: [] });
});

check("tamper: value", () => {
  const t = clone(seg0); t.segment.predicted[1] = "1";
  assert.equal(verifySegment(t, seg0Rows).ok, false, "hash no longer matches");
  const forged = sealSegment(t.segment); // attacker also recomputes the hash
  const r = verifySegment(forged, seg0Rows);
  assert.equal(r.ok, false); assert.ok(r.errors.includes("segment does not reproduce from sources"));
  const badSource = { ...seg0Rows[1], record_json: seg0Rows[1].record_json.replace('"predicted\\":1.1', '"predicted\\":1.2') };
  assert.notEqual(badSource.record_json, seg0Rows[1].record_json);
  assert.equal(verifySegment(seg0, [seg0Rows[0], badSource, seg0Rows[2], seg0Rows[3]]).ok, false, "edited source row (hash mismatch) is caught");
});

check("tamper: id", () => {
  const record = JSON.parse(seg0Rows[2].record_json); record.experience_id = id(500);
  const json = JSON.stringify(record);
  const swapped = { ...seg0Rows[2], experience_id: id(500), record_json: json, content_sha256: sha(json) };
  const r = verifySegment(seg0, [seg0Rows[0], seg0Rows[1], swapped, seg0Rows[3]]);
  assert.equal(r.ok, false); assert.ok(r.errors.includes("source_ids_root does not match sources"));
  const t = clone(seg0); t.segment.source_ids_root = "0".repeat(64);
  assert.equal(verifySegment(sealSegment(t.segment), seg0Rows).ok, false);
});

check("tamper: verdict", () => {
  const t = clone(seg0);
  t.segment.verdicts = (t.segment.verdicts[0] === "P" ? "F" : "P") + t.segment.verdicts.slice(1);
  assert.equal(verifySegment(t, seg0Rows).ok, false);
  assert.equal(verifySegment(sealSegment(t.segment), seg0Rows).ok, false);
  t.segment.verdicts = "XPFI";
  assert.equal(verifySegment(sealSegment(t.segment), seg0Rows).ok, false, "invalid code rejected");
});

check("tamper: prev link", () => {
  const t = chain.segments.map(clone);
  t[1].segment.prev_segment_sha256 = "f".repeat(64);
  t[1] = sealSegment(t[1].segment);
  const r = verifyChain(t);
  assert.equal(r.ok, false); assert.ok(r.errors.some((e) => e.includes("prev_segment_sha256")));
  assert.equal(verifyTenant("tenant-a", t, rowsA, { segmentSize: 4 }).ok, false);
  assert.equal(verifyChain([chain.segments[1], chain.segments[0]]).ok, false, "reordered chain rejected");
  assert.equal(verifyChain([chain.segments[1]]).ok, false, "chain must start at seq 0");
});

// ---------- Tenant isolation ----------
check("tenant isolation", () => {
  const rowB = fixtureRow({ tenant: "tenant-b", id: id(200), predicted: 9, observed: 9, ts: ts(1) });
  const spoof = fixtureRow({ tenant: "tenant-a", recordTenant: "tenant-b", id: id(201), predicted: 9, observed: 9, ts: ts(2) });
  const mixed = compressTenant("tenant-a", [...rowsA, rowB, spoof], { segmentSize: 4 });
  assert.equal(mixed.excluded.reasons.tenant_mismatch, 2);
  assert.deepEqual(mixed.segments, chain.segments, "foreign rows never enter tenant-a segments");
  const rowsB = Array.from({ length: 4 }, (_, i) => fixtureRow({ tenant: "tenant-b", id: id(i), predicted: 1 + i / 10, observed: 1 + i / 9, phi: 1 - i / 100, step: i, verdict: ["PASS", "FAIL", "INCONCLUSIVE"][i % 3], ts: ts(i) }));
  const b = compressTenant("tenant-b", rowsB, { segmentSize: 4 });
  assert.notEqual(b.segments[0].segment_sha256, seg0.segment_sha256, "identical values in another tenant hash differently");
  assert.equal(verifySegment(seg0, rowsB).ok, false, "tenant-a segment does not verify against tenant-b rows");
  assert.equal(verifyTenant("tenant-b", chain.segments, rowsB, { segmentSize: 4 }).ok, false);
  assert.throws(() => compressTenant("Tenant A", rowsA), /TENANT_ID_PATTERN/);
});

// ---------- Exclusion counting ----------
check("exclusions are counted, never guessed", () => {
  const notWb = fixtureRow({ id: id(300), predicted: 1, observed: 1, source: "hf-memory", ts: ts(3) });
  const badVerdict = fixtureRow({ id: id(301), predicted: 1, observed: 1, verdict: "MAYBE", ts: ts(3) });
  const badTs = { ...fixtureRow({ id: id(302), predicted: 1, observed: 1, ts: ts(3) }), proof_timestamp: "not-a-date" };
  const hashBad = { ...fixtureRow({ id: id(303), predicted: 1, observed: 1, ts: ts(3) }), content_sha256: "0".repeat(64) };
  const badJson = { ...fixtureRow({ id: id(304), predicted: 1, observed: 1, ts: ts(3) }), record_json: "{", content_sha256: sha("{") };
  const noInputsRec = JSON.parse(fixtureRow({ id: id(305), predicted: 1, observed: 1, ts: ts(3) }).record_json);
  noInputsRec.metamorphic.transformation = "{\"transformations\":[]}";
  const noInputsJson = JSON.stringify(noInputsRec);
  const noInputs = { ...fixtureRow({ id: id(305), predicted: 1, observed: 1, ts: ts(3) }), record_json: noInputsJson, content_sha256: sha(noInputsJson) };
  const invalidRec = { ...fixtureRow({ id: id(306), predicted: 1, observed: 1, ts: ts(3) }) };
  const invRecord = JSON.parse(invalidRec.record_json); delete invRecord.goal;
  const invJson = JSON.stringify(invRecord);
  const invalid = { ...invalidRec, record_json: invJson, content_sha256: sha(invJson) };
  const dupe = fixtureRow({ id: id(0), predicted: 5, observed: 5, ts: ts(0) });
  const garbage = { tenant_id: "tenant-a", experience_id: 7 } as unknown as SourceRow;
  const all = [...rowsA, notWb, badVerdict, badTs, hashBad, badJson, noInputs, invalid, dupe, garbage];
  const r = compressTenant("tenant-a", all, { segmentSize: 4 });
  assert.deepEqual(r.excluded, { count: 9, reasons: {
    not_third_party_workbench: 1, invalid_verdict: 1, invalid_timestamp: 1, hash_mismatch: 1, invalid_json: 1,
    unparseable_inputs: 1, invalid_record: 1, duplicate_id: 1, invalid_row: 1,
  } });
  assert.deepEqual(r.segments, chain.segments, "excluded rows do not change the chain");
  assert.equal(r.pending, 2);
  assert.deepEqual(compressTenant("tenant-a", [...all].reverse(), { segmentSize: 4 }), r, "exclusion handling is order-independent");
  assert.equal(verifySegment(seg0, [...seg0Rows, notWb]).ok, false, "a segment's source set may not contain excluded rows");
});

console.log(`check-compression: ${checks} checks passed`);
