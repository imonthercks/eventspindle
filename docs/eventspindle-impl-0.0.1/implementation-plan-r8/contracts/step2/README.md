# EventSpindle v0.0.1 — Architecture Gate Step 2 (r4)

Status: **accepted design decisions; implementation unverified**. Date: 2026-10-26.

This companion specification builds on `eventspindle-v0.0.1-core-contract-r3` and does **not** supersede its stream identity, CloudEvents envelope or command transaction contract.

## Accepted decisions
- Normal DSQL projection freshness target: **within seconds**, not a synchronous or hard-SLA guarantee.
- Recovery: **bounded native Lambda retries, full failed-record capture, and operator-initiated manual reconciliation**. Automated full historical backfill and recovery after expired DynamoDB Streams history are deferred.
- Cross-stream causality: **explicit waits, authoritative state checks, correlation and idempotent commands inside Lambda Durable Functions**; no implicit framework-wide causal ordering.
- Delivery: **at least once**; projection effects and command effects **effectively once** through durable idempotency controls. This is not exactly-once transport.
- No global event sequence. Stream revision orders one aggregate; timestamps enable approximate temporal sorting only.

## Documents
- `DELIVERY-CONTRACT.md`: normative delivery/causal semantics and exclusions.
- `AWS-RUNTIME.md`: DynamoDB Streams → Lambda, failure capture, observability and manual repair.
- `src/delivery-contracts.ts`: framework-facing TypeScript interfaces without AWS imports.
- `ACCEPTANCE.feature`: Given/When/Then scenarios.
- `IMPLEMENTATION-GATE.md`: readiness checklist and validation spikes.

Important: A DynamoDB Streams event-source failure destination is **not** an authoritative replay log. Failure capture plus manual reconciliation is a scoped v0.0.1 recovery mechanism. Projectors must never claim an end-to-end completeness guarantee that cannot be proved.
