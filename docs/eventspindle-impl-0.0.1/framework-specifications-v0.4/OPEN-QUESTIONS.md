# Open questions and validation plan

**Version:** 0.1. No item in this file should be interpreted as a decided guarantee.

## Architecture blockers before production-ready projection replay

| ID | Question | Candidate approaches | Proof required |
|---|---|---|---|
| OQ-01 | How do we discover *every* stream, including new streams during rebuild? | Complete stream manifest; repeatable reconciliation scan; durable append outbox | No missed streams under concurrent creation |
| OQ-02 | How do history and notification consumers cross a safe completeness barrier? | CDC-first overlap + reconciliation; snapshot/export + changelog | Lossless cutover with delayed delivery |
| OQ-03 | What happens after DynamoDB Streams retention expires? | Reconciliation of stream heads; optional durable Kinesis/S3 archive | Recovery after multi-day outage |
| OQ-04 | How will time-range discovery be indexed? | Bucketed/sharded GSI; separate secondary metadata table | Query efficiency and bounded latency, with acknowledged eventual consistency |
| OQ-05 | Can we prove a global 'as-of recordedAt T' snapshot? | No such promise initially; define business-time semantics separately | Explicitly scope out unsupported guarantee |
| OQ-06 | How should multi-stream projections deduplicate events? | Event-ID applied ledger, projection-specific identity, transactional checkpoint | Atomic exactly-once logical effect under retries |
| OQ-07 | How will projection rebuilds switch atomically? | Versioned tables/views and cutover metadata | Readers never see partially built model |
| OQ-08 | What defines the max event size, batch size and transaction budgets? | DynamoDB conditional transactional writes | Test 400 KB item and transaction constraints |
| OQ-09 | How are ambiguous transaction outcomes resolved? | Command receipts with stable request hashes | Disconnect-after-commit simulations |
| OQ-10 | Do some applications genuinely require strict cross-stream commit order? | Separate opt-in architecture if needed | Concrete use case before adding coordination |
| OQ-11 | How are timestamps generated and tie-broken? | UTC `recordedAt`, UUID event ID, optional source occurrence time | Deterministic ordering without false commit-order claims |
| OQ-12 | Should notification item be one event or append-batch outbox? | Transactional outbox recommended for study | Multi-event batch ordering and recovery tests |

## Immediate implementation experiments

1. **Event store MVP:** DynamoDB stream HEAD, sequential event records, expected-version append, command receipt. Prove no global coordination.
2. **Concurrency and burst test:** 10–100 commands/second plus burst loads against many independent streams. Track p50/p95/p99 and cancellation rates; same-stream contention as control.
3. **DSQL projection slice:** Apply `OrderPlaced` and transactional dedup/progress marker under duplicate delivery and simulated worker crashes.
4. **Completeness spike:** Rebuild an `OrderSummary` projection while creating new streams; delay/drop notifications and require reconciliation to find missing events.
5. **Time-window index spike:** Demonstrate timestamp query behavior and explicitly measure GSI visibility lag; do not turn this into a replay watermark.

## Proposed exit criteria for first architecture spike

- No shared global counter in append transaction.
- Per-stream versions contiguous with correct conflict handling.
- Retried commands cannot duplicate committed business effects.
- DSQL duplicate delivery cannot double-apply projection effects.
- A lost-notification scenario is repaired from authoritative DynamoDB event history.
- Architecture docs clearly state that timestamp sort is not strict cross-stream commit order.


## AWS-native runtime evaluations

- Direct DynamoDB Streams → Lambda versus EventBridge Pipes → SQS → Lambda: source/target delivery guarantees, message ordering, latency, recovery and cost.
- Durable Lambda versus Step Functions for long-running business workflows and projection rebuild orchestration; verify supported Regions and deployment configurations.
- Stream retention expiry: define an authoritative recovery path regardless of event-source mapping configuration.
- Deployment strategy for Lambda Managed Instances only when workloads justify sustained compute capacity.

## v0.3 open implementation questions

1. Which exact pinned revision of `dilgerma/event-modeling-spec` will `eventspindle-model-analyzer` support first? Validate against actual upstream JSON schema and sample documents.
2. What are the first supported Automation patterns: simple event→command, branching, callback/wait, timeouts and compensation?
3. Which AWS CDK constructs/APIs and permissions are needed for Lambda Durable Functions in target AWS regions? Verify synth/deploy.
4. Should AI skills generate complete code or invoke a versioned deterministic generator from a validated intermediate representation? Preferred: both, with deterministic templates for known patterns.
5. How are generated files updated without overwriting human edits? Define ownership boundaries and regeneration protocol.
6. What DynamoDB Streams → durable workflow trigger path gives stable execution identity and safe duplicate handling with least custom code?
7. How will EventSpindle publish/test `@eventspindle/*` packages and validate namespace availability?

## v0.4 slice registry and version lifecycle questions

- Should slice/version routing be synthesized entirely from a checked-in manifest, or does it require a minimal runtime registry for active execution routing?
- What AWS-native mechanism will safely inspect running Lambda Durable Function executions before marking a version retired?
- Should CDK provision one Lambda function per slice version, or immutable qualified versions of a shared logical function?
- How should callbacks route to the exact waiting version/execution after rollout?
- Which operational changes can be deployed without creating a new business slice version?
- How are versioned projection readiness and safe cutover proven when replay only has timestamp discovery (not a global sequence)?
- What API/CLI commands manage `release`, `activate`, `drain`, `retire` and `rollback` without inventing a custom control plane?
- What is the retention strategy for old model snapshots, event schema interpreters and Lambda versions?

Decision recorded in [ADR-008](adr/ADR-008-immutable-slices.md); mechanisms remain open.
