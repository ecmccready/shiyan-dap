# Robotics telemetry intake (read-only)

**Status:** implemented as a local JSONL validator; no robot or simulator adapter is connected.

This is the first executable evidence-pipeline increment for WPA-Bench. It accepts normalized records conforming to `aethel.robotics.event.v1`, checks their shape and episode ordering, verifies each SHA-256 record digest, and checks the previous-record link. It does not connect to ROS 2, Unitree, LeRobot, a simulator, or a physical robot. It cannot issue commands.

## Input contract

One JSON event per line (UTF-8 JSONL). Each event must conform to `schemas/aethel.robotics.event.v1.schema.json`. For each `run_id + episode_id` stream:

- `seq` starts at 0 and increments by exactly one.
- `monotonic_ns` strictly increases; wall-clock `timestamp` may not move backwards.
- The first `integrity.previous_hash` is `sha256:` followed by 64 zeroes.
- Every subsequent `integrity.previous_hash` equals the prior event's `integrity.record_hash`.
- `integrity.record_hash` is SHA-256 over canonical JSON for the complete event with only `integrity.record_hash` omitted. Canonical JSON recursively sorts object keys and preserves array order. The `previous_hash` is included in the digest.
- A `command` evidence event is rejected unless an operator is present, the gateway approved it, and neither E-stop nor protective stop is active.

The validator verifies record digests and chain links. This establishes tamper-evident linkage within the supplied stream; it does not establish who produced the records, whether source telemetry is truthful, or whether a physical action occurred. Production ingestion must add authenticated source identity, trusted timestamps, immutable storage, key management/signatures, and independent robot-side safety evidence.

## Run

```bash
npm run robotics:test
npm run robotics:validate -- ./path/to/normalized-events.jsonl
```

Exit code 0 means the supplied JSONL passed these structural, ordering, safety-state, digest, and linkage checks. A non-zero exit means it must not be used as benchmark evidence.

## Next adapter boundary

A separate robot-side process should export read-only telemetry from the selected simulator/robot into this normalized JSONL contract. For the first physical path, use the approved Unitree G1 / ROS 2 environment, beginning in simulation or replay. Keep the adapter outside the Next.js web process. Do not expose robot credentials to the browser. Do not enable physical command submission as part of this intake milestone.
