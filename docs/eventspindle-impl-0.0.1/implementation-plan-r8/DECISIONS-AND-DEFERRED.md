# Decisions, proposals, and deferred features

## Carried forward as accepted from EventSpindle v0.4
1. DynamoDB as authoritative event store.
2. Per-stream sequential versions and expected-version optimistic concurrency.
3. No global append counter; timestamp-based cross-stream sorting is informational, not strict commit order.
4. Pluggable projection stores; Aurora DSQL first SQL adapter.
5. AWS-native-first deployment, maximizing managed capabilities while minimizing custom framework code.
6. Lambda Durable Functions for process orchestration / automations.
7. AWS CDK generated/provisioned infrastructure; SDK business behavior stays AWS-independent where practical.
8. Four Event Modeling patterns: state change, state view, automation, translation.
9. Released slice versions immutable; successor version instead of mutating released behavior.
10. AI-assisted model-to-code remains strategic goal, not v0.0.1 blocker.

## Implementation choices for v0.0.1 (not architecture blockers)
- Order-processing demo (PlaceOrder -> FulfillmentRequested -> ShipmentConfirmed).
- One event table with stream HEAD/EVT records and command receipts.
- Node-based local HTTP server, Vitest, pnpm workspaces, Nx task orchestration/local cache, AWS CDK TypeScript and Changesets for framework npm package versioning.
- Local virtual clock and simulated workflow implementation; real AWS Durable Function in cloud.
- Single-order DSQL projection with per-stream checkpoint and dedup ledger.
- DynamoDB Streams outbox-item INSERT filtering with NEW_IMAGE and bounded retry/failure configuration; initial position selected and verified by CDK integration tests.
- 10-second durable wait as visible demonstration of orchestration.
- CDK wrapper constructs can be thin adapters over aws-cdk-lib, progressively extracted.

## Framework tooling decisions — accepted from Framework Tooling Options

- pnpm workspaces + committed lockfile for package management.
- Nx for project graph, builds, tests and deterministic local cache.
- Vitest for testing and AWS CDK TypeScript for infrastructure.
- Changesets for framework npm packages and publishing; immutable slice releases use an **independent protected** release workflow, never Changesets.
- Projen is optional; custom Nx generators and remote Nx caching are deferred.
- Full convention/CI design in [TOOLING.md](TOOLING.md).

## Deliberately deferred
- Projen adoption, custom Nx generators, and remote/distributed Nx cache.
- Globally complete event discovery/replay and guaranteed cross-stream time-range reconstruction.
- Point-in-time export to S3; replay while writes continue; CDC recovery beyond 24h retention.
- Cross-stream relational aggregates and strict time-order projections.
- Multi-Region active-active conflict handling.
- Automated model-to-code AI skill, CLI scaffolder, upstream JSON schema extension.
- Complete side-by-side release lifecycle management, automated traffic promotion/drain/retirement and runtime registry service; identity, explicit immutable release and execution pinning contracts are **accepted**, and a narrow implementation must honor them.
- Production IAM auth/application identity, multi-tenancy, event schema upcasters and snapshots.
- External provider integrations and payment/financial workflows.

## Risks and explicit controls
- Cross-database atomicity does not exist: projection retries/checkpoints protect resulting state, and queries are eventually consistent.
- DynamoDB Streams delivery is at least once and retains data 24h: inspect failure queue and iterator age. Do not market v0.0.1 as replay-complete.
- Non-global timestamps can be late/out of order: never use a strict `(timestamp,id)` cursor for guaranteed completeness.
- AWS Durable Functions resumability cannot be validated by a local in-memory runner alone: run AWS integration tests.
- CDK/DSQL resource support varies: use official CloudFormation/CDK surfaces supported by pinned versions, not invented APIs.
- Local memory process restart loses state by design; document this and keep it confined to demonstration.

## Post-v0.0.1 roadmap
- v0.0.2: robust replay/reconciliation and projection rebuild strategy; checkpoint recovery beyond Streams retention.
- v0.0.3: generate one automation and one state-change from model JSON using AI skill plus deterministic templates.
- v0.0.4: independently deployed slice v2, model hash locking, activation/draining and safe rollback demonstration.

## Accepted after architecture Step 1 standards review (r2)

- CloudEvents 1.0 is the canonical **logical** persisted domain event envelope; AWS transport envelopes are adapters.
- JSON Schema Draft 2020-12 governs canonical domain event and command payload validation.
- UUIDv7 (RFC 9562) is preferred for generated event/command identifiers; stable externally supplied idempotency keys are also supported.
- RFC 3339 UTC timestamps record occurrence/preparation metadata, never global database commit order.
- W3C Trace Context and OpenTelemetry are the baseline for propagating trace context and observing operations; correlation and causation remain distinct domain concepts.
- AsyncAPI 3.x and OpenAPI 3.1 are **optional generated** documentation outputs, not required source artifacts for v0.0.1.
- Use bounded-context `source`, aggregate `subject`, and custom `streamrevision` CloudEvents extension; do not adopt the source-scoped CloudEvents Sequence extension for v0.0.1.

## Step 1–5 decisions accepted — implementation verification outstanding

- **Step 1:** canonical `boundedContext/aggregateType/aggregateId`; nonexistent stream is revision 0; first nonempty append creates it; stale revisions rejected; stable command ID + canonical fingerprint; durable no-op receipt; single-stream atomic batch. See `contracts/step1`.
- **Step 2:** atomic event/outbox transaction, at-least-once notification, per-stream checkpoint and gap repair, explicit Durable Function causal dependency, seconds-level freshness objective, native failure capture and known-stream manual reconciliation. See `contracts/step2` and `RECOVERY-BOUNDARY.md`.
- **Step 3:** logical slice vs immutable slice release vs environment deployment identity; local/Dev deployments are editable drafts; protected Git/CI release locks model and artifact hashes; even draft in-flight durable executions pin exact code revision. See `SLICE-RELEASE-CONTRACT.md`.
- **Step 4:** pure-first with native handlers allowed, per-stream checkpoints, DSQL projection+checkpoint atomicity, bounded offline manual rebuild and parity tests. See `contracts/step4`.
- **Step 5:** official upstream JSON schema only, pinned Draft-07 validation, JSON Schema 2020-12 payload contracts, deterministic code generation of types/scaffolds/tests/CDK, generated code separated from developer code, ambiguous semantics fail. See `contracts/step5`.

**Engineering tasks, not undecided policy:** exact upstream commit/checksum, actual manifest/CLI implementation, transaction-limit validation, AWS service/CDK integration proof and operational monitoring deployment. **Deferred capabilities:** automatic complete stream discovery beyond Streams retention, online replay/cutover, arbitrary cross-stream global ordering and production-grade recovery. These must not be claimed as delivered.
