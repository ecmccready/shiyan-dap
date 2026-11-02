# Whole-Body Persistent Autonomy Benchmark (WPA-Bench)

**Status:** protocol and integration contract; hardware execution not yet validated  
**Owner:** Aethel Node / Shiyan DAP  
**Surface:** `/workbench/robotics`  
**Purpose:** compare a verified look-back policy with a greedy baseline on physical whole-body robots over repeated, multi-stage tasks.

> This document defines the experimental system and safe integration boundary. It does not claim that a robot adapter, physical trial, or benchmark result currently exists. The current robotics page remains a synthetic-fixture demonstration until real telemetry and signed trial records are ingested.

## 1. Research question and hypotheses

**Primary question:** Under the same robot, low-level controller, task distribution, action limits, and safety constraints, does a look-back policy that retrieves and uses previously verified experience improve long-horizon task performance over a greedy policy that optimizes only the immediate next action?

Pre-register these hypotheses:

- **H1 — task success:** look-back increases end-to-end task completion rate.
- **H2 — recovery:** look-back reduces recovery time and human interventions after perturbations.
- **H3 — efficiency:** look-back reduces energy per successful task and/or elapsed time without degrading task quality.
- **H4 — prediction quality:** look-back reduces calibrated predicted-versus-observed state error over the full episode.
- **H5 — safety:** look-back is non-inferior on predeclared safety outcomes. Any safety degradation blocks a performance claim.

The primary comparison is intention-to-treat by assigned policy. Report all attempted trials, including aborted, failed, and safety-stopped trials.

## 2. System boundary and control architecture

Aethel Node is the **verification, experience, and policy-evaluation layer**. It is not a replacement for the robot's certified safety controller, motion planner, joint controller, collision monitor, or emergency-stop circuit.

| Aethel stage | Robotics responsibility | Required evidence |
|---|---|---|
| Know | Ingest synchronized robot state, task state, perception summaries, controller status, and provenance | Timestamped, calibrated observations and source identifiers |
| Know How | Select a bounded policy proposal using either look-back retrieval or greedy scoring | Policy/version, retrieved episode IDs, scores, uncertainty, constraints |
| Show | Compare predicted state/outcome with measured state/outcome; score drift and task progress | Prediction records, observed records, residuals, evidence links |
| Do | Submit an expiring, bounded intent to the robot-side gateway after authorization | Approval, command envelope, gateway receipt, execution result |

**Control hierarchy:**

1. Robot-native safety system and emergency stop have highest authority.
2. Robot-side gateway validates every command envelope and enforces workspace, speed, force/torque, joint, rate, and freshness limits.
3. A human safety operator supervises every physical trial and can stop it at any time.
4. Aethel Node may recommend a policy or submit an approved bounded intent; it cannot disable or override levels 1–3.

### 2.1 Robot gateway contract

Use a robot-side adapter (ROS 2 is the preferred initial integration target) that exposes a narrow, authenticated interface. Keep hardware-specific drivers outside the Next.js application.

Minimum adapter operations:

- `get_capabilities()`: robot model, joint count, supported action primitives, controller and safety-state versions.
- `get_state()`: timestamped joint state, base pose/velocity, end-effector state, contact/force summaries where available, localization confidence, battery/thermal state, safety state.
- `submit_intent(envelope)`: accept only allow-listed primitives and bounded targets; return an execution ID or explicit rejection.
- `get_execution(execution_id)`: progress, completion, controller status, and measured outcome.
- `stop(reason)`: request the robot's native stop path; the physical E-stop remains independent and authoritative.
- `health()`: heartbeat, clock synchronization, dropped-message count, and adapter readiness.

Every intent must carry: run ID, episode ID, policy ID and version, approved primitive, bounded target, maximum duration, expiry timestamp, idempotency key, operator authorization reference, and trace/correlation ID. Reject stale, duplicated, malformed, out-of-envelope, unauthenticated, or unauthorized requests. Use a dead-man/heartbeat timeout and default to the robot's configured safe stop on communication loss.

**No direct browser-to-robot control.** The web UI is an oversight and evidence surface. Commands flow through a secured server-side service to the robot-side gateway. Do not put robot credentials in client code. Do not permit arbitrary scripts, free-form joint trajectories, or policy-generated safety-limit changes.

### 2.2 Suggested normalized event record

Store append-only records with monotonic sequence numbers and synchronized wall-clock timestamps. Preserve raw source references; do not overwrite observations with inferred values.

```json
{
  "schema_version": "aethel.robotics.event.v1",
  "run_id": "run_<uuid>",
  "episode_id": "episode_<uuid>",
  "seq": 42,
  "timestamp": "2026-11-02T19:50:10.000Z",
  "monotonic_ns": 123456789000,
  "robot": { "model": "declared-at-run-time", "controller_version": "declared-at-run-time" },
  "policy": { "family": "lookback", "id": "policy-id", "version": "immutable-version" },
  "stage": "know|know_how|show|do",
  "event_type": "observation|proposal|authorization|command|measurement|intervention|stop|outcome",
  "state_ref": "immutable://telemetry/record",
  "prediction_ref": "immutable://prediction/record",
  "command_ref": "immutable://intent/record",
  "safety": { "operator_present": true, "gateway_approved": false, "estop_active": false },
  "integrity": { "previous_hash": "sha256:...", "record_hash": "sha256:..." }
}
```

The example is a schema illustration, not a real event. Validate all required fields and clock quality before a record can contribute to a benchmark score.

## 3. Policies under comparison

### Policy A — verified look-back

At each decision point:

1. Retrieve only completed episodes that passed the declared evidence and safety gates.
2. Match on task phase, robot configuration, environment/context features, and uncertainty.
3. Exclude incompatible or stale experience; record every retrieved episode and exclusion reason.
4. Rank candidate bounded actions using expected long-horizon outcome, uncertainty, and safety constraints.
5. Submit only the selected bounded intent for human/gateway authorization.
6. Compare predicted and observed results; write the episode to reusable experience only after post-run verification.

The retrieval corpus is frozen at the start of each evaluation block. During a block, the policy may not learn from the evaluation trial it is currently performing. For sequential adaptation studies, define a separate pre-registered arm.

### Policy B — greedy baseline

At each decision point, choose the admissible action with the highest immediate reward / ΔΦ over a fixed short horizon. It uses the same observations, action primitives, low-level controller, safety filters, and compute/time budget as look-back, but does not retrieve prior episodes or optimize using a multi-step look-back objective.

### Fairness controls

- Same robot, task definitions, start-state tolerances, environment, low-level controller, perception stack, and allowed action primitives.
- Same safety gateway and operator rules.
- Same maximum planning latency and compute budget; report actual use.
- Freeze and hash policy code, configuration, retrieval corpus, model weights, and task scripts before each block.
- No hand-tuning one policy after seeing the other's evaluation outcomes.
- Randomize order within paired blocks; stratify by task, robot, operator, and environment condition.
- Report policy failures and fallback-to-baseline events as outcomes, not silently as successful look-back trials.

## 4. Physical benchmark tasks

Start with a stationary, low-speed, guarded test cell and compliant objects. Expand to mobile loco-manipulation only after the stationary gate passes.

| Tier | Task | Whole-body capability tested | Long-horizon challenge |
|---|---|---|---|
| T0 | Reach, grasp, carry, place at a fixed station | Coordinated torso, arms, hands, balance | Multi-step sequencing and grasp recovery |
| T1 | Reposition base, reach to shelf, retrieve and place object | Locomotion plus manipulation | State drift and changing reachability |
| T2 | Carry a light object along a marked route and place it | Dynamic balance, gait, arm/object coordination | Disturbance recovery and resource use |
| T3 | Multi-object pick/place with order constraints and safe pauses | Whole-body planning and task memory | Persistent goals, interruptions, resumption |
| T4 | Repeated task cycle with controlled variation | Robustness and adaptation | Experience reuse across episodes and days |

Use soft/light objects, low speeds, restricted workspaces, physical guarding, and robot-specific manufacturer limits. Do not introduce human-proximity, stairs, heavy payloads, doors, or unstructured public environments in the initial benchmark.

### Controlled perturbations

Only introduce perturbations approved by the robot manufacturer and the site's safety engineer. Initial examples: harmless object pose variation, target offset within a validated workspace, benign task interruption, or a pre-approved low-magnitude external disturbance fixture. Never push a robot or person into an unstable state to test recovery.

## 5. Experimental protocol

### Phase 0 — bench and simulation validation

- Validate schema, time synchronization, adapter health, command expiry, idempotency, and stop behavior without enabling actuators.
- Replay recorded episodes through both policy implementations.
- Verify that the look-back corpus contains only eligible completed episodes and that evaluation data cannot leak into retrieval.
- Run software-in-the-loop and hardware-in-the-loop tests with the robot's approved simulator/controller.
- Test communication loss, stale state, malformed command, gateway rejection, and E-stop signals. Each must produce a safe rejection/stop and a durable evidence record.

**Exit gate:** safety engineer signs off on gateway tests; no physical policy command is enabled before this gate.

### Phase 1 — supervised physical pilot

- Use one declared robot model and one task tier (T0 first).
- Collect at least 10 familiarization runs that are excluded from analysis.
- Collect a pilot of at least 5 paired blocks (one look-back and one greedy trial per block, randomized order) to estimate variance, failure rate, and practical trial duration.
- Do not use pilot data to claim superiority. Use it only to finalize the protocol and calculate the confirmatory sample size.
- Operator remains at the independent E-stop and can abort at any time.

### Phase 2 — confirmatory paired crossover

- Pre-register the primary endpoint, minimum meaningful effect, exclusions, analysis, and safety stopping rules before evaluation.
- Calculate sample size from Phase 1 variance and a stated power target (recommend 80–90%); do not choose N after inspecting policy differences.
- As a practical starting design, target 30–50 paired blocks per task tier if feasible, then adjust using the pilot-based power calculation. A block pairs the two policies under matched start conditions.
- Randomize AB/BA order within each block. Balance trials across operators, days, and environment variants.
- Use a fixed reset procedure and verify start-state tolerances before every trial.
- Keep evaluators of task-quality outcomes blind to policy identity where practical.
- Include all randomized trials in the primary intention-to-treat analysis. Report per-protocol analysis only as secondary.

### Phase 3 — persistence and transfer

Only after Phase 2 safety and performance gates pass:

- Evaluate repeated episodes across multiple days with a frozen, versioned look-back corpus.
- Test transfer to a held-out task variation and, separately, a second robot configuration.
- Measure memory staleness, retrieval quality, policy drift, and whether performance regresses after updates.
- Require a new protocol and safety review before expanding to a new robot, payload, environment, or action primitive.

## 6. Metrics and scoring

Report raw distributions and denominators, not only a composite score.

**Primary endpoint:** end-to-end task success rate per assigned trial, with success defined before data collection (all required subtasks completed, object/task quality within tolerance, no safety violation, and no unapproved human intervention).

**Secondary endpoints:**

- Task completion time; successful subtasks; task-quality error.
- Energy / battery consumption per successful task; peak and cumulative power where available.
- Human interventions per trial, intervention duration, and reason.
- Recovery success and time after a pre-approved perturbation.
- Predicted-versus-observed state error by dimension, calibration, and accumulated drift.
- Localization and manipulation error; grasp/place success; object slip/drop count.
- Joint-limit proximity, torque/force-limit events, collision-monitor events, protective stops, and E-stop activations.
- Policy inference latency, gateway latency, command rejection rate, stale-state rate, and communication availability.
- Robot uptime and productive time, with downtime reason codes.

**Safety outcomes are separately reported and never hidden inside a weighted score:** falls/tips, collisions, dropped objects, force/torque limit events, protective stops, E-stop activations, workspace violations, and near misses.

For each metric report numerator/denominator, mean and median, spread, confidence interval, missingness, and per-task/per-robot breakdown. Normalize energy and time by successful task only in addition to reporting unconditional values; otherwise a policy that fails quickly can appear efficient.

### Statistical analysis

- Binary success: paired risk difference and confidence interval; use a mixed-effects logistic model with policy as fixed effect and block/day/operator as appropriate random effects.
- Continuous outcomes: paired differences and bootstrap confidence intervals; use mixed-effects models when repeated measures require them.
- Recovery time: report censoring and failures to recover; do not drop unrecovered trials.
- Multiple task tiers/endpoints: declare one primary endpoint and control secondary inference (e.g. Holm adjustment).
- Report effect sizes and uncertainty, not just p-values.
- Safety non-inferiority margins must be set by the robot safety lead before data collection. Any serious safety event triggers a pause and review regardless of statistical significance.

## 7. Safety, authorization, and stop rules

Before physical testing, require a documented site risk assessment, manufacturer-approved operating envelope, trained operator, independent physical E-stop, guarded workspace, safe payload, and approved robot-side controller.

Immediate stop and trial invalidation/review triggers include:

- E-stop or protective stop activation.
- Collision, fall/tip, dropped payload, unexpected human/animal entry, or workspace boundary breach.
- Force, torque, speed, joint, thermal, or payload limit breach.
- Loss of heartbeat, stale state beyond the predeclared threshold, clock desynchronization, or gateway integrity failure.
- Any command not matching the approved policy/version/task envelope.
- Operator concern, regardless of automated status.

After a stop: preserve logs, do not automatically resume, require operator inspection and explicit reset, record the stop reason, and obtain safety-lead approval before restarting. Aethel Node must never autonomously clear an E-stop or restart motion.

## 8. Evidence, provenance, and Aethel Node verification

Every trial produces an immutable evidence bundle:

1. Protocol ID/version, preregistration hash, task and environment configuration.
2. Robot identity/configuration, controller/firmware versions, calibration and safety-system status.
3. Policy code/configuration hash, retrieval corpus hash, baseline definition, randomization assignment.
4. Raw telemetry references, synchronized timestamps, observation quality and missing-data markers.
5. Predictions, policy proposals, authorization, command envelope, gateway receipt, execution trace.
6. Interventions, stops, operator notes, task-quality assessment, outcome labels.
7. Analysis code/version, exclusions with reasons, metric outputs, and report hash.

A trial is **verified** only if required evidence is present, integrity checks pass, clocks meet tolerance, safety status is known, and outcome labels are auditable. Missing evidence means **unverified**, not success. A policy may not write its own evaluation outcome as ground truth.

### Workbench A / B / Z

- **Workspace A:** declares target outcomes, risk envelope, acceptance thresholds, and review authority.
- **Workbench B:** executes the benchmark protocol and records observations, policy decisions, and physical outcomes.
- **Z:** measured task result and evidence-backed score.
- **ROE:** proposes the next policy only from verified eligible experience; records why it changed and what evidence supports the change.

## 9. Reporting template

Each benchmark report must include:

- Robot, hardware, firmware, controller, task tier, and test-site description.
- Protocol and policy hashes; trial dates; sample size; randomization and exclusions.
- Look-back versus greedy results with confidence intervals and per-task breakdown.
- Safety event table and stop-rule outcomes.
- Predicted-versus-observed plots and drift over episode time.
- Intervention, recovery, energy, latency, and uptime results.
- Failed/unverified trials and missing evidence.
- Limitations, deviations, operator notes, and independent reviewer sign-off.

Do not label the look-back policy a winner unless the pre-registered primary endpoint improves, uncertainty is reported, and all safety gates pass. Do not describe synthetic fixture results as physical-robot evidence.

## 10. Implementation sequence

1. Add the versioned event schema and validation tests.
2. Add a read-only ROS 2 telemetry adapter and replay importer.
3. Add a command-gateway contract in dry-run mode; validate envelopes and log rejection reasons.
4. Add operator authorization and independent stop/heartbeat checks.
5. Run Phase 0 and obtain safety sign-off.
6. Enable only the first approved bounded primitive for T0; retain human authorization for every physical intent.
7. Ingest signed trial bundles into Workbench B and expose verified metrics in Show.
8. Enable look-back retrieval only after evidence eligibility, leakage tests, and policy freeze are enforced.

**Current completion boundary:** this repository change defines the benchmark, event contract, control boundary, and experimental protocol. Real robot control requires the target robot model, ROS 2 distribution/middleware, driver and controller APIs, site safety envelope, and an on-site safety review. No physical actuation is enabled by this document.
