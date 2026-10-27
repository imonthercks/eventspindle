# EventSpindle — architecture specifications v0.4

**Status:** Working architecture baseline; not an implementation guarantee  
**Updated:** 2026-10-26  
**Former working name:** StreamKit  
**Scope:** Lightweight standalone TypeScript event-sourcing framework, Event Modeling-driven development, AWS-native execution.

## Summary

EventSpindle uses **DynamoDB** as the authoritative event store with per-stream versions and no shared global sequencing counter. Cross-stream timestamp order is sufficient for discovery and approximate chronology, but **not** an exact commit-order or completeness guarantee. Projection sinks are pluggable; **Aurora DSQL** is the first relational adapter. **Lambda Durable Functions** is the preferred runtime for Event Modeling automations. Validated Event Modeling specifications can generate **TypeScript SDK implementations, TypeScript AWS CDK and acceptance tests**, with business and AWS-specific settings separated.

## Read in this order

1. [Architecture](ARCHITECTURE.md) — design boundaries, write/read flow and guarantees.
2. [Decisions](DECISIONS.md) — accepted versus proposed; original ADR history retained.
3. [Model-to-code](MODEL-TO-CODE.md) — Event Modeling specifications, AI skills, code and CDK output.
4. [AWS-native runtime](AWS-NATIVE-RUNTIME.md) — Lambda, Streams, Pipes, retries and orchestration.
5. [Event Modeling scenarios](EVENT-MODELING.md) — slice/acceptance coverage.
6. [Requirements](REQUIREMENTS.md) — functional/NFR items and draft SDK contracts.
7. [Package map](PACKAGE-MAP.md) — proposed `@eventspindle/*` modules.
8. [Open questions](OPEN-QUESTIONS.md) — validation tasks, design uncertainties.
9. [Changelog](CHANGELOG.md) — specification history.

## ADRs

- [ADR-001 Event persistence](adr/ADR-001-event-store.md)
- [ADR-002 Projection adapters](adr/ADR-002-projection-stores.md)
- [ADR-003 Timestamp ordering](adr/ADR-003-ordering.md)
- [ADR-004 Replay completeness](adr/ADR-004-replay.md)
- [ADR-005 Lambda Durable Functions](adr/ADR-005-durable-automations.md)
- [ADR-006 Event Modeling to AWS CDK](adr/ADR-006-spec-to-cdk.md)
- [ADR-007 Naming](adr/ADR-007-project-name.md)
- [ADR-008 Immutable slices](adr/ADR-008-immutable-slices.md)

## Decision statuses

- **Accepted:** Chosen design direction, still subject to engineering validation.
- **Proposed:** Candidate API, data shape, runtime wiring or algorithm, not committed.
- **Open:** Needs investigation or proof.

This package records architectural decisions; it does not claim published SDK packages, validated AWS CDK APIs, or production-tested replay completeness.

## v0.4 — Immutable slice versions

New accepted architecture direction: immutable released slice definitions, independently versioned behaviors, side-by-side deployments, new-execution routing, retained durable executions, independently rebuilt state views and explicit retirement checks. See [Slice Versioning](SLICE-VERSIONING.md) and [ADR-008](adr/ADR-008-immutable-slices.md).
