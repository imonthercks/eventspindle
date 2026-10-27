# Step 4 readiness and remaining architecture gates

## Accepted for Step 4

- Hybrid projection authoring; pure reducers preferred, native SQL handlers permitted with a reference implementation.
- Separate projection instance namespace; per-stream contiguous checkpoint and optional event-ID deduplication ledger.
- Atomic projection mutation and checkpoint; DSQL full-transaction retry for 40001.
- Offline bounded manual rebuild only; no online consistency claim.
- Contract-level parity tests for memory and DSQL; real AWS integration required to validate transaction behavior.

## Delivery for v0.0.1

1. Implement base contracts and in-memory transactional adapter.
2. Implement pure order summary fixture and processor gap-repair logic.
3. Implement DSQL adapter and provision schema separately; run AWS integration suite.
4. Support one native SQL projection with pure reference and parity tests.
5. Implement operator-triggered rebuild into isolated non-serving instance, with explicit stream list/high-watermarks.

## Open for Step 5 (last main architecture design area)

- Pin exact upstream Event Modeling JSON Schema commit/revision and choose local schema artifact strategy.
- Formal validator and normalized IR rules for 4 slice kinds.
- Generated code ownership, deterministic file content, traceability, and version successor behavior.
- Map scenario assertions to Gherkin/unit/integration test generation.
- Final cross-contract audit: ensure per-command DynamoDB outbox, per-stream events, and DSQL transactions fit together.
