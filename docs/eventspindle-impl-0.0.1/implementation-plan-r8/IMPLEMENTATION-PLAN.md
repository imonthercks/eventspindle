# EventSpindle v0.0.1 — Detailed Implementation Plan

## 1. Outcome and constraints

Ship a runnable TypeScript monorepo with a shared **domain and scenario implementation** and two runtime compositions:

- `local`: HTTP API + memory event store + memory projection store + in-process dispatch + deterministic simulated durable orchestration.
- `aws`: Lambda HTTP API + DynamoDB event store + DynamoDB Streams event source mapping + Lambda projection worker + Aurora DSQL SQL projection adapter + Lambda Durable Function automation + HTTP translation endpoint.

Use CDK TypeScript for all provisioned AWS resources. Favor native AWS facilities over custom infrastructure. Keep released slice files immutable and place slice IDs and versions in generated-artifact metadata. **No general AI model-to-code generator, full slice registry or rollout manager is required in v0.0.1.**

## M-1: Accepted architecture contracts and engineering verification (before public SDK freeze)

1. Adopt [STANDARDS-PROFILE.md](STANDARDS-PROFILE.md) as the canonical event envelope and interoperability contract; record chosen conventions (`source` bounded context, `subject` aggregate, `streamrevision` extension).
2. **Implement the accepted Step 1 contract:** bounded-context/type/ID stream, revision-0 nonexistent semantics, first-event creation, stable event IDs, durable no-op receipts, one-stream transaction. Do not reopen these decisions.
3. Implement and contract-test Step 1 append/conflict/idempotency and unknown-commit outcomes against the memory adapter, then DynamoDB. Fingerprint canonical command/target/semantic inputs and exclude trace noise.
4. Apply accepted Steps 2 and 4: transactional outbox, per-stream ordering/gap repair, DSQL atomic checkpoints, duplicate-safe effects, and explicit causality. Demonstrate native failure capture and conservative recovery status; see `RECOVERY-BOUNDARY.md`.
5. Pin upstream Draft-07 Event Modeling JSON schema revision and checksum, version JSON Schema 2020-12 command/event payloads, and implement Step 3 protected release hash validation.
6. Execute referenced Steps 1–5 scenarios as build gates; lock generated-file ownership and deterministic compiler output. Fail generation on ambiguity. Record deviations before public interface freeze.

**Gate exit:** accepted decisions are implemented or represented by failing-first contract tests, the exact schema is pinned, compiler and manifest inputs are reproducible, and unresolved AWS verification tasks have owners. M0–M6 retain their order. M3+ also require the R-02 observability/failure-capture gate.

## 2. Chosen example: order fulfillment

Flow: `PlaceOrder` -> `OrderPlaced`; order status projection becomes `Placed`; an automation waits ten seconds and invokes `RequestFulfillment` -> `FulfillmentRequested`; an external shipping webhook is translated to `ConfirmShipment` -> `ShipmentConfirmed`; the query view reports `Confirmed`.

These are demo behaviors, not production commerce processes. No payment provider, inventory, invoices, user authentication or external delivery network.

Four slices:
- `place-order@1` (STATE_CHANGE): create an order; shared command handler also supports `RequestFulfillment` and `ConfirmShipment` under small separate state-change slice definitions.
- `order-status@1` (STATE_VIEW): `OrderPlaced`, `FulfillmentRequested`, `ShipmentConfirmed` to status view.
- `fulfill-order@1` (AUTOMATION): `OrderPlaced` trigger, persistent wait then idempotent command.
- `shipment-webhook@1` (TRANSLATION): incoming demo provider payload to idempotent `ConfirmShipment` command.

## 3. Workspace layout

```text
eventspindle/
  package.json                 # pnpm workspace scripts, strict TypeScript, Vitest
  pnpm-workspace.yaml         # packages/* and apps/*
  pnpm-lock.yaml              # committed frozen dependency graph
  nx.json                     # Nx task graph and conservative local cache
  .changeset/config.json      # npm package versioning only
  .npmrc                      # workspace install conventions
  tsconfig.base.json
  event-model/
    model.json                 # upstream Event Modeling schema-valid model
    eventspindle.yaml         # slice-version manifest, runtime mapping
    versions/{slice-id}/v1.json
  packages/
    core/                      # events, deciders, typed commands
    eventstore/                # read/append ports and contract suite
    eventstore-memory/         # deterministic memory persistence
    eventstore-dynamodb/       # DynamoDB SDK adapter
    projection-core/           # projector port, checkpoint/dedup behavior
    projection-memory/
    projection-dsql/
    automation-core/           # shared business orchestration plan interface
    automation-local/          # simulated clock, in-memory durable wait
    automation-lambda/         # Durable Execution SDK adapter
    aws-cdk/                   # reusable minimal constructs
    testing/                   # scenario DSL and reusable contract tests
  apps/
    example-orders/
      src/domain/
      src/slices/{place-order,request-fulfillment,confirm-shipment,order-status,fulfill-order,shipment-webhook}/v1/
      src/api/
      src/local/
      src/aws/
      tests/
  infra/
    bin/eventspindle.ts
    lib/example-stack.ts
  scripts/
    smoke-local.ts
    smoke-aws.ts
```

For the first iteration, workspace packages may be private and published only once APIs stabilize. Do not spend time building an elaborate CLI before functional parity.

## 4. Milestone order and exit criteria

### M0: Repository and executable specification
Tasks:
1. Initialize pnpm workspaces, Nx targets/dependency graph with local task caching, TypeScript strict mode, Oxlint with tsgolint type-aware rules, Oxfmt, Vitest, AWS CDK app and Changesets configuration. Pin Node and pnpm via `packageManager`/Corepack; commit `pnpm-lock.yaml`.
2. Pin Node, pnpm, Nx, Vitest, AWS CDK and relevant AWS SDK/Durable SDK versions in committed manifests; verify supported Lambda runtime and CDK APIs. Configure Nx local caching only for deterministic tasks and correct input dependencies.
3. Create upstream Event Modeling JSON and validate against a pinned schema commit; add separate `eventspindle.yaml` with `sliceId`, `sliceVersion`, source hash, and deployment target.
4. Define events, commands, Given/When/Then fixtures and stable IDs.

Exit: `pnpm install --frozen-lockfile`, `pnpm nx run-many -t lint typecheck test build format:check`, `pnpm model:validate`, and `pnpm infra:synth` work before any AWS deployment; changeset status is checkable and task cache invalidates on model/schema/generator changes. Draft versions are editable; released snapshots are immutable by policy and hash verification.

### M1: Pure domain behavior and memory event store
Tasks:
1. Define CloudEvents 1.0 `StoredEvent`, typed `Command`, `Decision`, `Evolve`, `StreamRead`, `AppendResult` using the immutable payload schema registry and profile in `STANDARDS-PROFILE.md`.
2. Implement in-memory store with atomic append, expected-version guarding, stable command receipts and full ordered stream reads.
3. Define an order decider with valid and invalid transitions.
4. Run scenario tests for valid create, duplicate create, fulfillment, shipment confirmation and stale writes.

Exit: no AWS packages imported by domain code; per-stream sequential event versions and duplicate-command idempotency verified.

### M2: Local vertical slice
Tasks:
1. Add memory projection adapter with event ID dedup and contiguous per-stream version checkpoint.
2. Add event dispatcher after successful append; inject a deterministic virtual clock for automation.
3. Implement `OrderPlaced -> wait(10s) -> RequestFulfillment` as a testable process definition.
4. Translate simulated `shipment.delivered` payload into `ConfirmShipment` with stable command ID.
5. Provide local HTTP routes and diagnostics.

Suggested routes:
- `POST /orders` body `{orderId, customerId}`; require `Idempotency-Key`.
- `GET /orders/{id}` projection result plus `processedVersion`.
- `GET /orders/{id}/events` immutable history for demo.
- `POST /webhooks/shipping` body `{providerEventId,orderId,status}`.
- `POST /__dev/clock/advance` local-only test helper.
- `GET /__dev/workflows` local-only workflow status.

Exit: `pnpm dev:local` plus scripted smoke test demonstrates all four patterns without Docker or AWS credentials.

### M3: DynamoDB event persistence in AWS
Tasks:
1. CDK DynamoDB table with `PK`,`SK`, Streams enabled `NEW_IMAGE` and PITR as appropriate.
2. `HEAD` record per stream and `EVT#<version>` immutable event item; command-receipt records keyed by stable command ID.
3. One `TransactWriteItems` for stream header, event items and receipt. For initial stream, use conditional Put of HEAD. Handle failed expected-version condition independently from duplicate receipt.
4. Reuse domain handlers and eventstore contract suite against real DynamoDB.
5. Add API Lambda/function URL or API Gateway HTTP API; AWS credentials/region from standard provider chain.

Exit: AWS append/read and idempotency tests pass; no global counter or per-app event-index hot key.

### M4: AWS projections to DSQL
Tasks:
1. Create DSQL cluster and IAM database authentication; initialize application database role and schema using a documented, separately executed migration step.
2. SQL schema: `order_status_v1` plus `projection_event_receipts` or `projection_stream_checkpoints` (whichever is appropriate to its ordering semantics). Use a composite `(projection_id, event_id)` unique constraint for dedup; model stream version progression separately.
3. Build `projection-dsql` adapter: transaction applies event update and records receipt/checkpoint atomically; bounded whole-transaction retry on DSQL OCC conflicts.
4. DynamoDB Streams event-source mapping to Lambda; filter to INSERT of event items, not HEAD/receipt changes. Configure `TRIM_HORIZON`, retry/bisect, failure destination, and alarms. Beware that events written in one DynamoDB transaction appear as separate stream records.
5. On gap detection, query missing events directly from authoritative DynamoDB stream and apply in version order.

Exit: post-order eventual SQL status matches event history; duplicate/out-of-order callbacks cannot double-apply or skip within a stream; query consistency is explicitly eventual.

### M5: Native Lambda Durable Function automation
Tasks:
1. Add `fulfill-order@1` Durable Function using AWS-supported TypeScript Durable Execution SDK and CDK `durableConfig`.
2. Trigger by stream event via a small idempotent dispatcher: start execution under stable `fulfill-order:v1:<sourceEventId>` identity using version-qualified function identifier.
3. Implement a durable 10-second wait and then issue `RequestFulfillment` with deterministic idempotency key.
4. Keep local simulated orchestrator behind same *business process* contract, not a fake implementation of AWS runtime internals.
5. Verify duplicate trigger, restart/replay, and idempotent command dispatch through AWS integration test.

Exit: actual AWS durable execution survives interruption and emits one logical fulfillment outcome, with duplicate starts/steps safe.

### M6: End-to-end AWS smoke and operational readiness
Tasks:
1. Deploy dev CDK stack, apply DSQL migration, run same scenario as local smoke.
2. Validate event sequence, DSQL projection, durable execution state and webhook translation.
3. Add CloudWatch structured logs, correlation/causation IDs, basic metrics and DLQ/failure-alarm visibility.
4. Document costs, expected latency, `cdk diff`, deploy/rollback, and `cdk destroy` workflow with retained-data considerations.
5. Release v0.0.1 framework npm packages using Changesets if publishing is in scope; separately release demo slice versions through the protected slice manifest/hash process. Generate tagged release notes with separate identities. Changesets MUST NOT mutate or publish immutable Event Modeling slice releases.

Exit: clean checkout reproducibly executes local smoke and AWS smoke. AWS infrastructure can be recreated in a disposable sandbox account and teardown is documented.

## 5. Planned developer commands (pnpm + Nx)

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm model:validate
pnpm nx run-many -t lint typecheck test build format:check
pnpm dev:local
pnpm smoke:local
pnpm infra:synth
pnpm infra:deploy:dev
pnpm db:migrate:dev
pnpm smoke:aws
pnpm infra:destroy:dev
pnpm changeset status
```

Commands are proposed scripts/targets, not a runnable repository yet. Project names/targets are defined during M0 in `project.json` or inferred Nx plugin configuration; exact shorthand scripts belong in root `package.json`. Never cache stateful AWS deployment/destroy, database migrations, slice releases, or integration tests relying on live AWS. For deterministic model/compiler outputs, Nx `inputs` must include source Event Model JSON, pinned upstream schema, manifests, generator config and tool versions. Nx caching must not mask released-slice hash validation.

`pnpm changeset` creates framework **npm package** release notes; `pnpm changeset version` and `pnpm changeset publish` manage package versions and publishing. Slice release is a different explicit protected operation (for example `pnpm slice:release --slice sales/fulfill-order --version 1`), which never runs from Changesets. See [TOOLING.md](TOOLING.md) for target-level rules and CI stages.

AWS deployment requires account credentials, CDK bootstrap and DSQL DB setup.

## 6. Scope guardrails
- No global ordered log, timestamp-based completeness guarantee, or cross-stream strong ordering.
- No complete projection rebuild while writes continue; basic per-stream replay plus explicit future plan only.
- No automatic spec-to-code AI generator; source model mapping and templates established for future skill.
- No live slice version migration; v1 immutable artifact conventions and a test that prevents post-release mutation.
- No production-ready identity provider, multi-tenant isolation, PCI workflow or payment integrations.
- Native infrastructure integration is preferred, but correctness must not depend on unverified automatic exactly-once delivery.

## Standards execution checkpoints by milestone

| Milestone | Required standards work |
|---|---|
| M0 | Pin Event Modeling schema; check in JSON Schema 2020-12 for OrderPlaced, FulfillmentRequested, ShipmentConfirmed and inbound translation payload; validate versions/model IDs; establish released slice hashes. |
| M1 | Implement CloudEvents envelope builder, UUIDv7 generator/injected ID factory, RFC 3339 time factory, schema validator; enforce source/subject/type/streamrevision and retry identity. |
| M2 | Local HTTP adapters preserve business correlation, causation and `traceparent`; local diagnostics show canonical event metadata; validate SP-01–SP-08 in memory. |
| M3 | DynamoDB persists original CloudEvents envelope and revision under one transaction; verify identical IDs after commit ambiguity; conformance tests in AWS. |
| M4 | DynamoDB Streams Lambda and DSQL adapter retain envelope and timestamp as metadata only; checkpoint progression follows per-stream revision, not timestamp. |
| M5 | Durable Function command execution derives deterministic IDs; OpenTelemetry/W3C trace propagation instrumented without using trace IDs for deduplication. |
| M6 | Run SP-01–SP-09 end to end; optional generated AsyncAPI/OpenAPI output, if pursued, remains derived and does not block v0.0.1. |

**Version note:** EventSpindle v0.0.1 is the runtime milestone; this consolidated plan is revision r8. npm framework package versions (Changesets) are independent of slice versions and deploy revisions. The standard profile has its own version, 0.1.


## Architecture gate — Steps 1–5 accepted

All five architecture decision gates are accepted; implementation validation remains outstanding. Explicit slice release—not Dev deployment—establishes immutability. See [SLICE-RELEASE-CONTRACT.md](SLICE-RELEASE-CONTRACT.md), `contracts/step4`, and `contracts/step5`. Tooling decisions from Framework Tooling Options are captured in [TOOLING.md](TOOLING.md).


## Architecture-review remediation (R-01 / R-02) — mandatory cross-cutting work

- R-01: Treat this r8 package and `DECISION-RECONCILIATION.md` as the **consolidated v0.0.1 implementation baseline**. Older v0.4 architecture docs and r2/r3 implementation-plan packages are historical snapshots; where they label Step 1–5 decisions as open, they are superseded for v0.0.1. Do not edit published/archived release snapshots in place.
- R-02: Follow `RECOVERY-BOUNDARY.md` and `OPERATIONS-AND-TESTS.md` before promoting an AWS environment. A known-stream replay is not complete stream discovery. After retention loss or unknown mapping outage coverage, mark affected projection/automation subscriptions `RECOVERY_INCOMPLETE`; prevent readiness/completeness claims until human evidence and a supported repair plan exist.
- Local memory mode uses the same explicit recovery state but loses all data upon process restart. This is a demo limitation, not durable recovery.
- Production-use readiness remains **NO-GO** until full recovery discovery/archival strategy is implemented and validated or a separately approved, narrower risk model exists.

## Tooling integration — accepted (r8)

- **pnpm** owns workspaces, lockfile and package scripts; do not initialize npm workspaces or use `npm ci` for this repository.
- **Nx** orchestrates lint, typecheck, build, unit/contract test and deterministic code generation with **local** caching; represent project dependencies explicitly and verify model/schema files invalidate dependent tasks.
- **AWS CDK TypeScript** remains the infrastructure definition and deployment tool; Nx may invoke `cdk synth`, but external deployment operations remain uncached and explicit.
- **Vitest** executes unit, contract and local integration tests across packages. Real-AWS smoke/fault injection is always non-cached.
- **Changesets** manages versions/changelogs/publishing for framework npm packages; independent protected Git/CI workflows manage immutable Event Modeling slice releases.
- **Projen** optional and outside M0–M1 critical path. **Custom Nx generators** and **remote Nx caching** deferred until repeated needs justify them.
- Tooling may evolve without changing Step 1–5 runtime contracts or the R-02 recovery boundary.
