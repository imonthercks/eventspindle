# Decision log

**As of 2026-10-26.** Accepted = explicitly aligned with the user during architecture discussion; other entries remain proposals.

| ID | Decision | Status | Rationale | ADR |
|---|---|---|---|---|
| D-001 | Build standalone lightweight TypeScript framework, influenced by Emmett | Accepted design direction | Tailor complexity to use cases | — |
| D-002 | Use Event Modeling to specify and test scenarios | Accepted design direction | Slice-oriented validation | — |
| D-003 | Use DynamoDB as authoritative event persistence | Accepted design direction | Atomic conditional writes, independent aggregate scaling | [ADR-001](adr/ADR-001-event-store.md) |
| D-004 | Keep projection stores pluggable; implement DSQL SQL adapter first | **Accepted explicitly** | Decouple persistence of events from relational views | [ADR-002](adr/ADR-002-projection-stores.md) |
| D-005 | No shared global sequencing counter on command writes | **Accepted explicitly** | Avoid latency during command bursts | [ADR-003](adr/ADR-003-ordering.md) |
| D-006 | Per-stream version authoritative; cross-stream timestamp order is sufficient | **Accepted explicitly** | No need for exact global commit ordering | [ADR-003](adr/ADR-003-ordering.md) |
| D-007 | Timestamp alone is not a complete replay cursor | Accepted design caveat | Late writes/index lag can produce missed events | [ADR-004](adr/ADR-004-replay.md) |
| D-008 | Asynchronous DynamoDB → DSQL projections are eventually consistent | Architectural consequence | No cross-service ACID transaction | [ADR-002](adr/ADR-002-projection-stores.md) |
| D-009 | Notifications + authoritative history/reconciliation for recovery | Proposed approach | Recover missed deliveries/expired stream retention | [ADR-004](adr/ADR-004-replay.md) |
| D-010 | Projection state and progress committed together where possible | Proposed contract | Effectively-once logical effects | [ADR-002](adr/ADR-002-projection-stores.md) |
| D-011 | Optional `recordedAt` time-bucket discovery index | Proposed | Efficient approximate time-range queries | [ADR-004](adr/ADR-004-replay.md) |
| D-012 | Maintain command receipts transactionally for durable idempotency | Proposed | Resolve ambiguous commits | [ADR-001](adr/ADR-001-event-store.md) |
| D-013 | Prefer Lambda Durable Functions for Event Modeling automations and long-running process orchestration | **Accepted explicitly** | Native durable steps, waits and recovery | [ADR-005](adr/ADR-005-durable-automations.md) |
| D-014 | Generate TypeScript AWS CDK from Event Modeling specifications using reusable constructs | **Accepted explicitly** | Native infrastructure, traceable model-to-deployment path | [ADR-006](adr/ADR-006-spec-to-cdk.md) |
| D-015 | Keep AWS-specific execution settings separate from core Event Modeling business specifications | Accepted design direction | Avoid provider coupling of business semantics | [ADR-006](adr/ADR-006-spec-to-cdk.md) |
| D-016 | Adopt **EventSpindle** as the project name | **Accepted explicitly** | Distinct identity from working name | [ADR-007](adr/ADR-007-project-name.md) |
| D-017 | Use specialized AI skills + deterministic schema validation/generation | Proposed implementation pattern | Repeatability and controlled code changes | [ADR-006](adr/ADR-006-spec-to-cdk.md) |
| D-018 | Released Event Modeling slice versions are immutable; business changes create successor versions | **Accepted explicitly** | Safe evolution and deterministic generation | [ADR-008](adr/ADR-008-immutable-slices.md) |
| D-019 | Allow coexisting slice versions and explicit new-work routing; preserve in-flight durable executions | **Accepted design direction** | Prevent workflow mutation during rollout | [ADR-008](adr/ADR-008-immutable-slices.md) |
| D-020 | Version projections independently with isolated state and checkpoints before promotion | **Accepted design direction** | Safe replay, cutover and rollback | [ADR-008](adr/ADR-008-immutable-slices.md) |
| D-021 | Use manifest + immutable model snapshots for desired definitions; runtime registry mechanism remains open | **Accepted direction / mechanism open** | Keep business specifications AWS-independent and infrastructure minimal | [ADR-008](adr/ADR-008-immutable-slices.md) |

## Explicitly superseded earlier ideas

- DSQL-only event persistence as the default: replaced by DynamoDB write model + DSQL projection model.
- Transactional global event/commit sequencer: **rejected for initial design** due to contention and burst latency concern.
- Global `readAll(afterPosition)` as required core contract: removed; cannot honestly guarantee it with timestamp-only ordering.
- Updating DSQL relational views in the same transaction as DynamoDB events: not possible across the two services; projections are asynchronous.

These decisions can be revisited via a new ADR rather than silently modifying the baseline.


## ADR-005 — AWS-native-first runtime (accepted principle; candidate services proposed)

Use native AWS managed capabilities wherever they reduce framework-owned infrastructure and code without weakening correctness guarantees. Evaluate Lambda Durable Functions, native event-source mappings and partial batch responses, EventBridge Pipes, SQS, Step Functions and Lambda Managed Instances case by case. Details in [AWS-NATIVE-RUNTIME.md](AWS-NATIVE-RUNTIME.md).
