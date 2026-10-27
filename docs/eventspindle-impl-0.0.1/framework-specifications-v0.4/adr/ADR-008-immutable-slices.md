# ADR-008 — Immutable, independently versioned Event Modeling slices

**Status:** Accepted design direction — 2026-10-26  
**Scope:** EventSpindle Event Modeling sources, SDK implementations, generated TypeScript CDK, deployment and runtime lifecycle.

## Decision

A **released slice version is immutable**. Business-behavior changes create a successor version; drafts are editable. A release binds a stable slice ID and version to an immutable model snapshot, content digest, generated implementation and acceptance tests. Multiple released versions may coexist. Version numbers belong to a slice (for example `fulfill-order@2`), not to the entire application.

Keep distinct version axes: (1) slice behavior, (2) event/command schema, (3) projection definition, and (4) infrastructure deployment revision. An AWS configuration-only change does not require a new business slice version. An incompatible event contract requires independent schema-version treatment and compatibility analysis.

The upstream Event Modeling specification remains AWS-agnostic. EventSpindle maintains slice version metadata separately in a version-controlled manifest and frozen model snapshots, rather than modifying the upstream schema.

## Required lifecycle behavior

- **Draft:** editable; may be generated and tested, not a released contract.
- **Released:** snapshot and implementation contract frozen, with digest verification.
- **Active:** eligible for *new* work according to routing policy.
- **Draining:** no new work routed here; existing long-running executions and dependent consumers retain their version.
- **Retired:** runtime disabled/removed only after explicit safety checks; source snapshot, historical schemas and traceability remain retained.

Lifecycle terminology is a framework proposal accepted in principle; exact AWS resource mapping, registry storage and lifecycle commands remain to be validated.

## Slice-specific rules

- **Automation:** pin each durable execution to an immutable implementation version. Routing changes affect new executions only. Preserve callback correlation and pending execution compatibility while draining. Stable step/command idempotency IDs survive durable step retries.
- **State view:** new projection version gets isolated state, checkpoints, replay status and query target. Build/catch up v2 without affecting v1; promote only after verified completeness/readiness. Retain rollback ability where feasible.
- **Translation:** allow simultaneous handlers for distinct upstream schema versions, with explicit routing and compatible command contracts.
- **State change:** new command-handler versions may coexist behind stable or versioned API routes; route explicitly, avoid silently changing historical event meanings.

## Model-to-code and CDK requirements

Generation of `slice@2` must not rewrite released `slice@1`. Generate TypeScript runtime code, CDK construct configuration, acceptance tests and traceability for the new version. Include a compatibility report for affected dependencies, schema contracts, live execution state and query clients. CDK must not automatically delete draining functions, callback endpoints or serving projections.

## Registry authority and deployment

**Accepted direction:** version-controlled manifest + immutable model snapshots are the source of truth for intended definitions and routing, with only operationally necessary execution/projection state stored in AWS services. This does **not** yet commit to a DynamoDB registry table, a particular Lambda-alias mechanism or a deployment control plane.

## Acceptance tests

- V-01 successor creation leaves released v1 bytes/model hash unchanged.
- V-02 modified released snapshot fails validation.
- V-03 v1 and v2 can be deployed side by side.
- V-04 after activation, new work routes to v2, previously started v1 work remains bound to v1.
- V-05 v1 durable execution can resume after v2 activation, with version-pinned callbacks and stable idempotency.
- V-06 v2 state view replays independently with separate checkpoint/state, while v1 serves reads.
- V-07 compatible rollback can route new work back to retained v1 without rewriting running v2 executions.
- V-08 retirement is blocked when active obligations or dependencies remain.
- V-09 breaking event/command contract changes trigger explicit compatibility failure or versioned migration plan.

## Consequences and tradeoffs

More deployable artifacts may coexist; lifecycle tracking, storage costs and safe cleanup become first-class concerns. In exchange, upgrades and rollbacks do not require mutating an already-running business process, and AI generation has an auditable change boundary.

## Not decided

Manifest schema/registry API; whether versions map to separate functions or qualified Lambda versions; how execution draining is queried; version retention windows; how to guarantee projection catch-up without a global cursor; exact CDK safety enforcement; migration UX for dependent slices.
