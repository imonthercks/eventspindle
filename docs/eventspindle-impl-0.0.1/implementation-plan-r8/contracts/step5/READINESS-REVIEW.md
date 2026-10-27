# EventSpindle v0.0.1 — Cross-Contract Implementation Readiness

Date: 2026-10-26. Decision readiness and software validation are separate dimensions.

## Steps 1–5 status

| Gate | Accepted design | What's validated? | Missing proof before production use |
|---|---|---|---|
| 1 Stream append and idempotency | Composite context/type/id stream, revision 0 nonexistent, first append creates, strict concurrency, command ID + fingerprint, durable no-op, single-stream transaction | Contract and BDD scenarios specified | Canonical stream codec, hashing implementation, DynamoDB transactional tests incl. race and ambiguous commit |
| 2 Delivery/causal processing | Transactional outbox, at-least-once, per-stream revision gap repair, native failure capture, explicit durable dependencies | Contract and BDD scenarios specified | Streams mapping limits/retention, persisted repair actions, failure injection, exact Durable Functions API tests |
| 3 Slice identity/releases | Separate slice, release, deployment identity; Dev drafts editable; explicit protected CI release; immutable hash-pinned artifacts and workflow execution revisions | Policy accepted | Manifest schema, release/retention CI guardrails, deployment pin verification |
| 4 Projections | Pure preferred + native reference, atomic DSQL update/checkpoint, per-stream checkpoints, idempotency, version isolation, bounded offline replay | Interfaces and BDD scenarios specified | DSQL live transaction tests and SQL/native parity, bounded-rebuild operator procedure |
| 5 Model-to-code | Official JSON input, pin schema, strict semantics, deterministic IR + generator, disjoint code ownership, successor workflow | Compiler contract and BDD scenarios specified (this package) | Vendor exact upstream schema commit+sha, golden generation/fixtures, implement semantic validator and compiler |

**Conclusion:** Steps 1–5 are accepted at design level; implementation is ready to **begin in a controlled order once reproducibility pins and cross-contract consistency checks are added to M-1**. This is **not** approval to claim AWS operational readiness or run production workloads.

## Cross-contract findings that should not be hidden

1. **DynamoDB transaction action count and outbox**: a command writes HEAD + N events + receipt + outbox, which must fit actual `TransactWriteItems` limits and item sizes. A no-op uses a HEAD condition and receipt but does not create an empty stream. ConditionCheck targeting an absent HEAD must correctly represent expected revision 0. An outbox must refer to authoritative committed event revision ranges without duplicating data and must not introduce a contended global counter.
2. **Command fingerprint ownership**: hash includes canonical command type, payload, stream target and semantic context; explicitly exclude volatile tracing metadata and delivery-attempt fields. Duplicate command with different fingerprint is an error, not a success. Receipt retention cannot expire while the same idempotency keys might reasonably be reused without an explicit documented policy.
3. **Outbox and projection completeness**: outbox notification and DynamoDB Streams delivery are not global-order guarantees. Each per-stream checkpoint repairs known gaps; it does not prove every stream has been discovered. An expired notification is operationally visible and repaired manually in this release.
4. **Projection concurrency**: two streams may update the same DSQL row; revision checkpoints alone are not sufficient for cross-stream commutativity. v0.0.1 examples must either use commutative deterministic updates or an explicit workflow coordination rule. DSQL must transactionally apply projection data and checkpoint.
5. **Workflow pinning vs slice releases**: even draft Dev deployments require immutable qualified Lambda artifact references for in-flight executions. Git/CI release state is separate from Lambda versions and aliases; verify exact AWS behavior in integration tests.
6. **Event metadata identity**: preserve original CloudEvents event ID and source on replay; `time` need not be commit time; provenance `sliceId/version` and schema version are separate. Stream revisions remain authoritative; no global sequence.
7. **Model schema and model-to-code mismatch**: official upstream schema describes general field types and textual/example specifications but doesn't necessarily provide enough semantics for fully executable workflows, safe numeric mapping, stream ID derivation, or SQL queries. Require sidecar mappings or developer-written handlers; fail instead of guessing.
8. **Release artifact vs generated files**: stable hashes require canonical byte definition, compiler version and formatting locks. Draft code compilation does not establish release immutability. Release manifest records both source and deployed artifact digests.

## Concrete M-1 closure tasks

1. Vendor exact upstream schema commit and SHA-256; lock compiler toolchain, canonicalizer and JSON Schema dialect configurations; run four-slice validation fixture.
2. Finalize the manifest JSON Schema, namespaces and output ownership; implement compiler semantic diagnostics for the sample order app.
3. Reconcile Step 1 `AppendRequest` with Step 2 outbox in one transaction and Step 4 projection gap reader; write cross-package TypeScript compile/contract tests.
4. Create end-to-end sample Event Model + sidecar for all four slices; check generated outputs contain no manual-business-logic placeholders falsely marked complete.
5. Define CI commands for regenerate/diff, acceptance tests and explicit protected release; support safe successor creation and Dev draft pinning.
6. Add AWS integration/operational test plan for ambiguous transaction, duplicate stream records, DSQL serialization failures, Durable Function version pinning and poison-event capture.

## Scope decision

**Go for M0 and M1 in-memory implementation:** yes, after task (1) exact schema pin + lockfile is performed as the first M0 action. Use strict contracts and unit tests, not mocked AWS promises.

**Go for M2 local vertical slice:** yes when core and generated contract checks pass.

**Go for M3–M6 AWS rollout:** conditional on live AWS API/CDK validation and targeted failure tests; account permissions and region-specific service availability must be confirmed.

**Go for production release:** no; operational evidence, replay guarantees, security reviews and runbooks are not yet complete.

## Deferred by design

Global event ordering, multi-stream atomic commands, full online projection replay/catch-up, self-healing beyond stream retention, universal native SQL projection portability, all AI-generated business logic, HCL/YAML Event Model ingestion, and a standalone runtime registry service.
