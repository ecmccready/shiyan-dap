#!/usr/bin/env node
/**
 * Read-only Aethel robotics JSONL intake validator.
 * Accepts normalized events only; it never connects to a robot or sends commands.
 * Run: node scripts/check-robotics-events.mjs <events.jsonl>
 */
import { readFileSync } from "node:fs";

const SCHEMA_VERSION = "aethel.robotics.event.v1";
const HASH_RE = /^sha256:[a-fA-F0-9]{64}$/;
const GENESIS_HASH = `sha256:${"0".repeat(64)}`;
const STAGES = new Set(["know", "know_how", "show", "do"]);
const EVENT_TYPES = new Set(["observation", "proposal", "authorization", "command", "measurement", "intervention", "stop", "outcome"]);
const POLICY_FAMILIES = new Set(["lookback", "greedy", "other"]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
const onlyKeys = (value, keys) => Object.keys(value).filter((key) => !keys.includes(key));

export function validateRoboticsEventStream(events) {
  const errors = [];
  const episodes = new Map();
  if (!Array.isArray(events) || events.length === 0) {
    return { ok: false, errors: ["input: expected a non-empty array of events"], eventCount: 0, episodeCount: 0 };
  }

  events.forEach((event, index) => {
    const at = `events[${index}]`;
    const fail = (message) => errors.push(`${at}: ${message}`);
    if (!isObject(event)) { fail("expected object"); return; }

    const allowed = ["schema_version", "run_id", "episode_id", "seq", "timestamp", "monotonic_ns", "robot", "policy", "stage", "event_type", "state_ref", "prediction_ref", "command_ref", "safety", "integrity"];
    const extras = onlyKeys(event, allowed);
    if (extras.length) fail(`unknown properties: ${extras.join(", ")}`);
    if (event.schema_version !== SCHEMA_VERSION) fail("unsupported schema_version");
    if (!nonEmpty(event.run_id)) fail("run_id: expected non-empty string");
    if (!nonEmpty(event.episode_id)) fail("episode_id: expected non-empty string");
    if (!Number.isSafeInteger(event.seq) || event.seq < 0) fail("seq: expected non-negative safe integer");
    if (!Number.isSafeInteger(event.monotonic_ns) || event.monotonic_ns < 0) fail("monotonic_ns: expected non-negative safe integer");
    if (typeof event.timestamp !== "string" || !Number.isFinite(Date.parse(event.timestamp)) || !/^\d{4}-\d\d-\d\dT/.test(event.timestamp)) fail("timestamp: expected ISO date-time");
    if (!STAGES.has(event.stage)) fail("stage: unsupported value");
    if (!EVENT_TYPES.has(event.event_type)) fail("event_type: unsupported value");

    if (!isObject(event.robot)) fail("robot: expected object");
    else {
      const extra = onlyKeys(event.robot, ["model", "controller_version"]);
      if (extra.length) fail(`robot: unknown properties ${extra.join(", ")}`);
      if (!nonEmpty(event.robot.model)) fail("robot.model: expected non-empty string");
      if (!nonEmpty(event.robot.controller_version)) fail("robot.controller_version: expected non-empty string");
    }

    if (!isObject(event.policy)) fail("policy: expected object");
    else {
      const extra = onlyKeys(event.policy, ["family", "id", "version"]);
      if (extra.length) fail(`policy: unknown properties ${extra.join(", ")}`);
      if (!POLICY_FAMILIES.has(event.policy.family)) fail("policy.family: unsupported value");
      if (!nonEmpty(event.policy.id)) fail("policy.id: expected non-empty string");
      if (!nonEmpty(event.policy.version)) fail("policy.version: expected non-empty string");
    }

    for (const [key, requiredFor] of [["state_ref", "observation"], ["prediction_ref", "proposal"], ["command_ref", "command"]]) {
      if (event.event_type === requiredFor && !nonEmpty(event[key])) fail(`${key}: required for ${requiredFor}`);
      if (event[key] !== undefined && !nonEmpty(event[key])) fail(`${key}: expected non-empty string`);
    }

    if (!isObject(event.safety)) fail("safety: expected object");
    else {
      const extra = onlyKeys(event.safety, ["operator_present", "gateway_approved", "estop_active", "protective_stop_active", "safety_event_code"]);
      if (extra.length) fail(`safety: unknown properties ${extra.join(", ")}`);
      for (const key of ["operator_present", "gateway_approved", "estop_active"]) {
        if (typeof event.safety[key] !== "boolean") fail(`safety.${key}: expected boolean`);
      }
      if (event.safety.protective_stop_active !== undefined && typeof event.safety.protective_stop_active !== "boolean") fail("safety.protective_stop_active: expected boolean");
      if (event.safety.safety_event_code !== undefined && typeof event.safety.safety_event_code !== "string") fail("safety.safety_event_code: expected string");
      if (event.event_type === "command" && (event.safety.operator_present !== true || event.safety.gateway_approved !== true || event.safety.estop_active !== false || event.safety.protective_stop_active === true)) {
        fail("command event lacks safe operator/gateway state or records an active stop");
      }
    }

    if (!isObject(event.integrity)) fail("integrity: expected object");
    else {
      const extra = onlyKeys(event.integrity, ["previous_hash", "record_hash"]);
      if (extra.length) fail(`integrity: unknown properties ${extra.join(", ")}`);
      if (!HASH_RE.test(event.integrity.previous_hash ?? "")) fail("integrity.previous_hash: expected sha256 digest");
      if (!HASH_RE.test(event.integrity.record_hash ?? "")) fail("integrity.record_hash: expected sha256 digest");
    }

    if (nonEmpty(event.run_id) && nonEmpty(event.episode_id) && Number.isSafeInteger(event.seq) && Number.isSafeInteger(event.monotonic_ns)) {
      const key = `${event.run_id}::${event.episode_id}`;
      const prior = episodes.get(key);
      if (!prior) {
        if (event.seq !== 0) fail("first event in episode must have seq 0");
        if (event.integrity?.previous_hash !== GENESIS_HASH) fail("first event previous_hash must be the zero-hash genesis value");
      } else {
        if (event.seq !== prior.seq + 1) fail(`seq: expected ${prior.seq + 1} after previous event`);
        if (event.monotonic_ns <= prior.monotonic_ns) fail("monotonic_ns must increase within an episode");
        if (event.integrity?.previous_hash !== prior.record_hash) fail("integrity.previous_hash does not match preceding record_hash");
        const currentTime = Date.parse(event.timestamp);
        if (Number.isFinite(currentTime) && currentTime < prior.timestampMs) fail("timestamp moved backwards within an episode");
      }
      episodes.set(key, { seq: event.seq, monotonic_ns: event.monotonic_ns, timestampMs: Date.parse(event.timestamp), record_hash: event.integrity?.record_hash });
    }
  });

  return { ok: errors.length === 0, errors, eventCount: events.length, episodeCount: episodes.size };
}

export function parseRoboticsJsonl(source) {
  const events = [];
  const errors = [];
  source.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try { events.push(JSON.parse(line)); }
    catch { errors.push(`line ${index + 1}: invalid JSON`); }
  });
  return { events, errors };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node scripts/check-robotics-events.mjs <events.jsonl>");
    process.exitCode = 2;
  } else {
    const parsed = parseRoboticsJsonl(readFileSync(input, "utf8"));
    const result = validateRoboticsEventStream(parsed.events);
    const errors = [...parsed.errors, ...result.errors];
    console.log(JSON.stringify({ ok: errors.length === 0, eventCount: result.eventCount, episodeCount: result.episodeCount, errors }, null, 2));
    if (errors.length) process.exitCode = 1;
  }
}
