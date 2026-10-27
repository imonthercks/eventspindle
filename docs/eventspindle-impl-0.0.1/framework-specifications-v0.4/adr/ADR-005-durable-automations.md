# ADR-005: Lambda Durable Functions for automations

**Status:** Accepted architectural direction  
**Date:** 2026-10-25  

## Context
Event Modeling automation slices describe long-lived reactions to domain events: commands, waiting for external outcomes, timeouts, retries and possible compensation. EventSpindle favors AWS-managed execution rather than maintaining custom process state machines.

## Decision
Use **AWS Lambda Durable Functions** as the preferred execution runtime for Event Modeling **Automation** slices and process orchestration. Generate normal TypeScript workflows using the AWS SDK and EventSpindle command/event abstractions. Use standard Lambda for short-lived command handlers and projections; Step Functions remains an option for workflows where its native integrations or operational tooling are a better fit.

## Consequences and invariants
- Execution state/checkpoints are managed by AWS; event history remains in DynamoDB.
- Durable step completion is **not** a transactional guarantee for side effects. Commands and external effects need stable idempotency keys.
- Workflow invocation must deduplicate repeated trigger delivery, ideally by deterministic execution identity / durable receipts.
- Each workflow propagates event ID, correlation ID and causation ID where appropriate.
- Projection checkpoints are independent from durable workflow checkpoints.
- Runtime selection, limits, retention, deployment-region availability and exact CDK APIs must be verified during implementation.

## Acceptance scenarios
- DA-01: Duplicate delivery of one triggering event starts at most one logical workflow effect.
- DA-02: Restart after a completed step does not duplicate a command or external side effect.
- DA-03: Timeout and compensation follow explicit modeled or approved policies; no fabricated default business rules.
- DA-04: A workflow result is represented by committed domain events, not only by Lambda execution history.
