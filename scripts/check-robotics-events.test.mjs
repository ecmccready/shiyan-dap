import test from "node:test";
import assert from "node:assert/strict";
import { calculateRoboticsRecordHash, parseRoboticsJsonl, validateRoboticsEventStream } from "./check-robotics-events.mjs";

const hash = (digit) => `sha256:${digit.repeat(64)}`;
const event = (overrides = {}) => {
  const value = {
    schema_version: "aethel.robotics.event.v1",
    run_id: "run-test",
    episode_id: "episode-test",
    seq: 0,
    timestamp: "2026-11-02T20:00:00.000Z",
    monotonic_ns: 100,
    robot: { model: "unitree-g1-sim", controller_version: "sim-controller-1" },
    policy: { family: "lookback", id: "lookback-v1", version: "1.0.0" },
    stage: "know",
    event_type: "observation",
    state_ref: "fixture://state/0",
    safety: { operator_present: true, gateway_approved: false, estop_active: false },
    integrity: { previous_hash: hash("0"), record_hash: hash("1") },
    ...overrides,
  };
  value.integrity.record_hash = calculateRoboticsRecordHash(value);
  return value;
};

test("accepts a well-formed, linked episode", () => {
  const first = event();
  const second = event({
    seq: 1,
    timestamp: "2026-11-02T20:00:00.010Z",
    monotonic_ns: 110,
    stage: "show",
    event_type: "measurement",
    state_ref: undefined,
    integrity: { previous_hash: first.integrity.record_hash, record_hash: hash("2") },
  });
  const result = validateRoboticsEventStream([first, second]);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.eventCount, 2);
  assert.equal(result.episodeCount, 1);
});

test("rejects sequence gaps and broken hash links", () => {
  const first = event();
  const second = event({
    seq: 2,
    monotonic_ns: 120,
    timestamp: "2026-11-02T20:00:00.020Z",
    event_type: "measurement",
    state_ref: undefined,
    integrity: { previous_hash: hash("f"), record_hash: hash("2") },
  });
  const result = validateRoboticsEventStream([first, second]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("expected 1")));
  assert.ok(result.errors.some((error) => error.includes("does not match")));
});

test("rejects command evidence without a safe authorized state", () => {
  const command = event({
    event_type: "command",
    stage: "do",
    state_ref: undefined,
    command_ref: "fixture://intent/1",
    safety: { operator_present: false, gateway_approved: false, estop_active: true },
  });
  const result = validateRoboticsEventStream([command]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("lacks safe operator/gateway state")));
});

test("parses JSONL and reports malformed lines", () => {
  const parsed = parseRoboticsJsonl(`${JSON.stringify(event())}\nnot-json\n`);
  assert.equal(parsed.events.length, 1);
  assert.deepEqual(parsed.errors, ["line 2: invalid JSON"]);
});

test("rejects an empty stream", () => {
  assert.equal(validateRoboticsEventStream([]).ok, false);
});
