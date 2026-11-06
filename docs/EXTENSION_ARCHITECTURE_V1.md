# Aethel Node Extension Architecture v1

**Status:** Contract proposal implemented as a declaration validator.  
**Scope:** Public extension boundary for independently built Workbenches.  
**Non-goal:** This document does not claim that third-party code is currently sandboxed, dynamically loaded, or authorized to execute in production.

## Product boundary

Aethel Node Core owns the trusted control plane:

- identity, authentication, tenant boundaries and authorization;
- repository connection and scoped credentials;
- run scheduling, budgets, idempotency and safety gates;
- evidence provenance, replay verification and proof-pack integrity;
- experience persistence, retention and ROE eligibility;
- audit events, human approvals and billing entitlements.

An extension supplies domain-specific behavior behind a versioned contract. It does not own the host's credentials, tenant identity, verifier, or eligibility decision.

## Extension manifest

The v1 TypeScript contract lives in `src/core/extensions/manifest.ts`.

A manifest declares:

| Field | Purpose |
|---|---|
| `api_version` | Exact host contract version |
| `id`, `name`, `version` | Stable identity and release |
| `entrypoint` | Relative extension entrypoint; traversal is rejected |
| `mode` | `read-only`, `propose`, or `execute` |
| `capabilities` | Explicit allowlisted host capabilities |
| `data_scopes` | Explicit data scopes; wildcard access is forbidden |
| `tenant_isolation` | Must be `required` |
| `human_approval` | v1 execution mode requires approval |
| `output_contracts` | Versioned output/evidence contract identifiers |

Example:

```json
{
  "api_version": "aethel.extension/v1",
  "id": "com.example.repository-auditor",
  "name": "Repository Auditor",
  "version": "1.0.0",
  "entrypoint": "dist/index.js",
  "mode": "read-only",
  "capabilities": ["repository.read", "evidence.read"],
  "data_scopes": ["repository:connected", "evidence:current-run"],
  "tenant_isolation": "required",
  "human_approval": true,
  "output_contracts": ["aethel.findings/v1"]
}
```

Validate untrusted manifest input with `validateExtensionManifest(unknown)`. Validation is declaration checking only; a valid manifest is not an authorization token.

## Capability model

| Capability | Intended host-mediated operation |
|---|---|
| `repository.read` | Read authorized repository metadata and content |
| `repository.propose_change` | Submit a patch proposal; never push directly to the protected branch |
| `evidence.read` | Read evidence explicitly scoped to the current tenant/run |
| `evidence.write` | Submit candidate evidence for host validation |
| `experience.read` | Retrieve eligible experience within the caller's tenant |
| `experience.propose` | Submit a candidate experience; host verifier decides eligibility |
| `workbench.execute` | Request a bounded host-managed execution |

No wildcard capabilities exist. New capabilities require a contract version review and explicit host implementation.

## Lifecycle

1. **Discover:** list an extension's manifest, publisher, version and declared contracts.
2. **Validate:** parse and validate the manifest; reject unknown capabilities and unsafe paths.
3. **Authorize:** tenant administrator grants the minimum required scopes. Manifest declarations never grant access by themselves.
4. **Plan:** extension returns a typed plan with inputs, expected outputs, resource budget and risk classification.
5. **Approve:** host obtains human approval for changes and all v1 execute-mode runs.
6. **Execute:** host runs work in an isolated, resource-limited environment with short-lived scoped credentials. No extension receives host secrets.
7. **Verify:** host validates output schema, provenance, policy, replay and metamorphic requirements.
8. **Persist:** only verified records enter durable experience storage. ROE separately decides reuse eligibility.
9. **Revoke:** host can revoke grants, disable an extension version and terminate outstanding runs.

## Evidence and memory rules

- Extensions submit *candidate* evidence; they cannot mark their own output verified.
- The host owns canonical run IDs, commit references, verifier versions, timestamps and content hashes.
- A failed or skipped check is preserved as such; it is never converted to PASS.
- Synthetic/demo records are labeled and excluded from production customer proof.
- Customer data is tenant-scoped by default. Cross-tenant learning requires explicit opt-in, minimization/de-identification, policy review and a separately auditable approval.
- Hugging Face founder memory is not a shared customer-memory pool. Customer records must use an isolated tenant store and retention policy.
- ROE consumes only host-qualified records; an extension cannot self-award reuse eligibility.

## Security requirements before third-party execution

A production runtime must add, and independently test:

- process/container isolation and filesystem/network policy;
- CPU, memory, wall-clock and output-size limits;
- short-lived credentials scoped to one tenant and operation;
- signed/pinned extension artifacts and dependency review;
- immutable audit events for approval, invocation, outputs and revocation;
- output schema validation and content-addressed evidence;
- abuse, prompt-injection and secret-exfiltration defenses.

Until those controls exist, treat extensions as design-time integrations or read-only reviewed code—not arbitrary plugins to load into the application server.

## Compatibility and versioning

- The host supports one explicit `api_version` per extension invocation.
- Patch releases must not change the manifest contract.
- Minor releases may add optional fields only when the validator and compatibility policy are updated deliberately.
- Breaking changes require a new API version and migration period.
- Unknown fields and capabilities fail closed in v1.
- Extensions must declare output contract versions; persisted evidence remains readable after an extension is disabled.

## First reference extension

Build a read-only Repository Auditor first. It should accept a host-issued repository snapshot, return structured findings tied to paths and commit SHA, and never write to GitHub. The host then validates the findings and can create a human-reviewed work plan.

This proves the extension boundary before granting code execution. The next extension can propose a patch; bounded execution comes only after the host sandbox and approval controls are proven.
