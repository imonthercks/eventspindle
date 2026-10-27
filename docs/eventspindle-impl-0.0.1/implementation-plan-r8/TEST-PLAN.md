# Test plan and quality gates

## Suites

### 1. Domain unit tests (memory, fast)
- Given/When/Then scenario fixtures from `SCENARIOS.md`.
- evolve determinism and transition rejections.
- Source model-to-slice ID links verified.

### 2. EventStore contract tests (both adapters)
- New stream version 1; append multiple events consecutively.
- Read stream in numerical order.
- Command ID stable idempotency; conflicting request hash failure.
- Two concurrent writers using same expected version: at most one commits.
- Atomicity under injected failure or DynamoDB transaction rejection.
- Same test factory runs against memory and real DynamoDB.

### 3. Projection contract tests (both adapters)
- Single stream events 1/2/3 become correct view.
- Repeated event never applies twice.
- Event 3 before event 2 reports gap and recovers missing event 2 from source.
- Fail after SQL update but before checkpoint: rollback both.
- Failed retry after ambiguous commit: read checkpoint/receipt and avoid duplicate effect.

### 4. Automation tests
- Local fake clock proves 10-second wait without sleeping.
- Duplicate trigger produces one command effect.
- AWS durable execution starts via version-qualified identifier; after wait, event store has one fulfillment event even if step is retried.

### 5. End-to-end smoke tests
- Local: launch HTTP server and test end-to-end with process memory.
- AWS: deploy CDK, write order, poll projection, observe durable result and webhook transformation.
- Diagnostics include event IDs, stream versions, command IDs, slice/version and correlation IDs.

### 6. Cost/performance smoke (not production benchmark)
- 10, 50, 100 concurrent requests against unrelated order IDs; report p50/p95 append latency and DynamoDB throttles.
- Verify no global-sequence contention.
- Check DSQL projector latency and iterator age for a brief burst.
- Avoid assuming these numbers establish production-scale benchmarks.

## CI pipeline gates
`model:validate` -> typecheck -> unit/domain tests -> memory integration tests -> CDK synth -> isolated AWS integration tests (opt-in, sandbox account) -> release snapshot hash check.

## Release acceptance
- Local and AWS smoke follow same **domain** scenario sequence.
- No AWS cloud dependency needed for local runs.
- No unhandled duplicates or intra-stream ordering errors.
- Durable workflow is tested in real AWS separately from local simulation.
- DSQL read projection is eventually consistent, with bounded polling in tests.
- Permissions, retention and teardown documented.

## Standards conformance suite (added r2)

Execute **SP-01 through SP-10** from `STANDARDS-PROFILE.md`. Prioritize SP-01–SP-08 as unit/contract tests in M1/M2; run SP-02, SP-04, SP-06 and SP-09 through DynamoDB Streams, Durable Functions, DSQL and EventBridge if configured in AWS smoke tests. Include timestamp disorder and duplicate transport delivery as explicit negative cases. EventBridge Schema Registry conversions and AsyncAPI/OpenAPI are optional generated outputs, not blockers.

Gate for M0/M1: no implementation may rely on an application-time timestamp or UUIDv7 monotonicity to imply a globally complete ordered replay cursor.


## R-01/R-02 mandatory quality checks

- Static decision-lint: no live implementation document may call accepted Step 1–5 choices undecided; allow explicit `deferred` implementation mechanisms and archived history.
- Failure injection: duplicate/reordered notifications, partial batch failures, poison event, disabled ESM, iterator backlog, checkpoint gap repair, after-retention loss simulation, and unknown-stream miss.
- Assert operational failure artifacts include stream ID/range when known, source sequence identity, timestamp, consumer/projection version, error and durable incident ID.
- Assert no `HEALTHY` or `replayComplete=true` after simulated beyond-retention loss without documented discovery proof.
- Assert manual replay repairs a *known* stream; test that it does not enumerate an unrelated unseen stream.
- See `OPERATIONS-AND-TESTS.md` for scenario-level exit criteria.
