# Step 3 — Slice identity and explicit release contract

**Status:** Accepted design decisions, 2026-10-26. **Implementation status:** Not yet implemented or verified.

## Decision

Deploying an EventSpindle slice to a development environment does **not** constitute a business slice release. A slice release is an explicit, audited Git/CI operation that captures an immutable model snapshot and build artifact. Drafts remain editable and redeployable. A released version cannot be changed in place; subsequent behavior or artifact changes require a new release identity. AWS Lambda published versions are deployment artifacts, not EventSpindle slice release numbers.

## Three independent identities

- Logical slice: `{boundedContext}/{sliceId}` (for example `sales/fulfill-order`). Stable across versions.
- Immutable slice release: `{boundedContext}/{sliceId}@{version}` with a model digest and build artifact digest.
- Deployment: `{environment}/{boundedContext}/{sliceId}@{version}+{artifactDigest}`, including a qualified AWS function version or alias target where relevant.

Aggregate stream identity (`{boundedContext}/{aggregateType}/{aggregateId}`) is independent of slice release identity. Event schema versions are independently governed.

## Lifecycle

`draft` -> explicit `release` -> `released` -> deployment `active` / `draining` -> `retired`.

- Draft slice model/code may change, including after Dev deployments. Each draft deployment must retain an immutable artifact revision for as long as an execution depends on it.
- Release runs validation, acceptance/compatibility checks, captures canonical model and build artifact hashes, and publishes signed/protected manifest and immutable artifact reference in CI. A mutable YAML flag alone is insufficient proof.
- Promotion to test or production must use the exact released artifact; no rebuild with different bytes under the same release identity.
- Runtime routes **new** executions to selected versions while **existing** Durable Function executions stay pinned to their originally deployed qualified implementation.
- Releasing does not mandate a separate physical Lambda per slice version. CDK deployment strategy is adapter-specific, but compatibility, retention, and routing guarantees remain mandatory.
- Retiring requires proof of no dependent executions, consumers, or query routes, or an explicit auditable migration/override policy. Automatic deletion is prohibited when dependencies remain.

## Proposed registry manifest (illustrative, not yet finalized schema)

```yaml
slices:
  sales/fulfill-order:
    versions:
      1:
        state: released
        modelDigest: sha256:<actual-canonical-model-hash>
        artifactDigest: sha256:<actual-build-hash>
        artifactRef: <immutable-artifact-uri>
      2:
        state: draft
        model: ./models/fulfill-order/v2.json
    deployments:
      dev:
        newExecutions: 2
      prod:
        newExecutions: 1
```

NOTE: Manifest format, canonical JSON hashing algorithm, release-number allocation, artifact retention policy, and CI protection mechanism are still to be specified before implementing the registry/generator.

## Required contract tests

1. **Draft redeploy:** Given draft v2 was deployed to Dev, when its model changes and is redeployed, it remains draft and no release is implicitly created.
2. **Explicit release:** Given draft v2 passes validators/tests, when CI releases it, the manifest records immutable model and artifact hashes.
3. **Mutation rejected:** Given v2 was released, when code or model bytes change under the same release identity, validation rejects the change.
4. **Bitwise promotion:** Given released v2, when promoting from Dev to Test, the deployment uses the exact recorded artifact digest.
5. **Old execution pinning:** Given an execution began on a draft deployment revision or released v1, when a new revision/version becomes active, the execution resumes on its original qualified implementation.
6. **Safe retirement:** Given dependent executions are active, when CDK attempts to remove the old runtime revision, deployment guardrails prevent unintentional deletion.
7. **Identity separation:** Given `sales/fulfill-order@2` is released, existing aggregate streams do not change identity and schema versions remain separately assigned.

## Remaining architecture gates

- **Gate 3 (this gate):** decision accepted; registry manifest/CI mechanics and execution retention details need implementation-level specification.
- **Gate 4:** Projection adapter correctness/capabilities: DSQL atomic projection/checkpoint, ordering and missing-event repair, capability declaration, rebuild/cutover bounds.
- **Gate 5:** Pin Event Modeling schema revision, validate canonical model and references, define supported slice mapping and deterministic model-to-code traceability.
- **Cross-cutting integration:** reconcile Step 1 and Step 2 contract artifacts, verify DynamoDB transaction sizing/outbox, real AWS Durable Functions/CDK behavior, local-versus-AWS conformance tests.

See the Step 1 core contract r3 and Step 2 delivery contract r4 as companion artifacts; their acceptance is at the design level, not evidence of working implementations.
