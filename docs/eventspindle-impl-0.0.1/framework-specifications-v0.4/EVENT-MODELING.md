# Event Modeling blueprint

**Version:** 0.1 (draft). Use the four Event Modeling patterns: State Change, State View, Automation, Translation. Technical failure cases are acceptance paths, not domain events.

## Model boundaries

- **Board A — Framework behavior:** stream append, expected-version conflicts, retries, projections, recovery, replay.
- **Board B — Example ordering domain:** `OrderCreated`, `OrderItemAdded`, `OrderPlaced`, `OrderShipped`; commands and views attached to a domain event timeline.
- Persist domain facts in the event store. Do not add technical events like `SerializationFailure` to the domain stream.

## Scenario catalog

| ID | Pattern | Slice | Phase |
|---|---|---|---|
| SC-01 | State change | Create a new stream | MVP |
| SC-02 | State change | Append events to existing stream | MVP |
| SC-03 | State change | Reject invalid command | MVP |
| SC-04 | State change | Competing commands on same stream | MVP |
| SC-05 | State change | Retry after ambiguous commit | MVP |
| SV-01 | State view | Rehydrate aggregate | MVP |
| SV-02 | State view | Apply asynchronous DSQL projection | MVP |
| SV-03 | State view | Query relational read model | MVP |
| SV-04 | State view | Read-your-writes freshness token | Later/proposed |
| AU-01 | Automation | Deliver committed event notification | MVP |
| AU-02 | Automation | Recover interrupted projector | MVP |
| AU-03 | Automation | Rebuild while writes continue | Before production |
| AU-05 | Automation | Replay/live overlap and deduplication | Before production |
| AU-06 | Automation | Recover per-stream version gap | Before production |
| AU-07 | Automation | Verify catch-up completeness | Before production |
| AU-04 | Automation | Trigger follow-up command | Later |
| TR-01 | Translation | Translate external message | Later |
| EV-01 | Cross-cutting | Upcast historical schema | Later |

## Acceptance criteria (Given / When / Then)

### SC-01 — First append
**Given** a stream does not exist. **When** `CreateOrder` produces `OrderCreated`. **Then** its first event has stream version 1, the HEAD indicates version 1, and both commit atomically. A duplicate initialization cannot create conflicting history.

### SC-02 — Append batch
**Given** order stream version 3. **When** a valid command emits two events with expected version 3. **Then** events receive versions 4 and 5, and the batch is all-or-nothing. Other streams require no shared global counter.

### SC-03 — Domain rejection
**Given** an order with no items. **When** `PlaceOrder` is handled. **Then** a typed business rejection is returned, and no events or stream-version change occur.

### SC-04 — Competing writers
**Given** two commands observe version 7 on the same stream. **When** both attempt append with expected version 7. **Then** at most one succeeds; the loser reloads/redecides under explicit policy or receives `StreamConflict`. Concurrent commands against different streams remain independent.

### SC-05 — Ambiguous commit
**Given** a stable `commandId` and payload hash. **When** an append commits but its acknowledgment is lost and the command is retried. **Then** the existing receipt resolves the original outcome without appending duplicate events. Reusing the ID with different input fails.

### SV-01 — Aggregate replay
**Given** a stream with event versions 1..N. **When** the aggregate is rehydrated. **Then** events are evolved in stream-version order and the same history produces the same state independently of timestamps.

### SV-02 — DSQL projection
**Given** a committed DynamoDB event. **When** the worker applies it to a DSQL read model. **Then** the projection mutation and its checkpoint/dedup marker commit atomically. A retry does not apply the logical effect twice.

### SV-03 — Query model
**Given** projection progress through a known stream version. **When** the query API reads the DSQL model. **Then** it returns the materialized state and, where needed, exposes a meaningful freshness token.

### SV-04 — Read your writes (proposed)
**Given** a command committed stream version N. **When** a client asks for a corresponding projected view. **Then** the response either reflects at least N or reports that projection catch-up is pending.

### AU-01 — Committed notification
**Given** an append batch is committed. **When** notification processing runs. **Then** its eligible events eventually reach the projector. Duplicate notifications are safe, and notification loss can be recovered using authoritative history.

### AU-02 — Worker interruption
**Given** a projection worker crashes before or after a DSQL transaction commits. **When** processing resumes. **Then** its durable progress reflects only committed effects, and already-applied effects are not repeated.

### AU-03 — Rebuild during writes
**Given** a projection rebuild begins with ongoing commands. **When** history is replayed and live changes are reconciled. **Then** a new projection instance becomes active only after verified complete coverage through its cutover barrier.

### AU-05 — Replay/live overlap
**Given** a historical event appears in both replay and notification paths. **When** both reach the projector. **Then** one logical event effect is committed.

### AU-06 — Missing stream version
**Given** last applied version 42 for a stream. **When** version 45 is observed. **Then** 43 and 44 are recovered from DynamoDB and applied first, or the stream is blocked with an explicit actionable error.

### AU-07 — Completeness/cutover
**Given** new streams can be created during rebuild and notifications may be delayed or lost. **When** a projection is promoted. **Then** the framework has proved stream-discovery completeness and historical/live coverage through a defined barrier. An empty queue or timestamp cutoff alone is not sufficient evidence.

### AU-04 — Follow-up command (later)
**Given** `OrderPlaced` has committed. **When** an automation issues `PrepareShipment`. **Then** causation metadata and stable idempotency identity prevent duplicate business effects.

### TR-01 — External translation (later)
**Given** a shipping-provider message with external ID. **When** it is translated into an internal command. **Then** payload version is validated, source identity is retained, and repeated delivery is idempotent.

### EV-01 — Old event schema (later)
**Given** an immutable historical event with older schema version. **When** it is replayed. **Then** deterministic upcasting provides the expected representation or fails explicitly.

## Global invariants

1. Immutable committed events, append-only normal API.
2. Contiguous per-stream versions and atomic event batches.
3. Durable idempotency for committed commands.
4. No global write counter or global commit-order promise.
5. Domain state replay always respects per-stream version order.
6. Cross-stream timestamp ordering is deterministic but not a completeness guarantee.
7. Projectors handle duplicates, missing versions and interrupted processing.
8. Projection rebuild cannot claim completion without verified coverage.

## Test strategy

- Pure decider scenario tests.
- In-memory and DynamoDB event-store contract tests.
- Real DynamoDB competing-writer and ambiguous-commit fault tests.
- DSQL projection transaction and duplicate/retry tests.
- Integration tests for newly created streams during backfill, expired notifications, delayed indexed records and replay/live overlap.

## v0.3 additions: durable automation and model-driven CDK

| Slice | Given | When | Then |
|---|---|---|---|
| DA-01 Trigger deduplication | `OrderPlaced` is committed | Trigger is delivered more than once | One logical durable process/effect is initiated |
| DA-02 Durable workflow resume | Step has issued an idempotent command | Workflow restarts after a checkpoint | Command does not create a second domain effect |
| DA-03 Timeout/compensation | Explicit timeout and compensation policy exists | Workflow wait expires | Modeled compensating command is issued exactly once logically |
| MG-01 Automation code generation | Valid Automation slice with complete dependencies | Generator runs | Workflow TS, CDK TS, tests and traceability are produced |
| MG-02 Missing semantics | Model omits failure policy | Generator analyzes workflow | Review blocker emitted; no invented rule |
| MG-03 Safe model regeneration | A single slice changes | Generator reruns | Impacted generated files change with traceability, user-owned code protected |
| MG-04 Deployment verification | Generated CDK exists | CDK synthesis executes | Infrastructure validates without deploying |

These complement existing application-level slices; they do not represent persisted business events.

## v0.4 scenarios — immutable slice versioning (accepted contract)

| Slice | Given | When | Then |
|---|---|---|---|
| V-01 Successor | Released `fulfill-order@1` | Generate v2 | v1 model/code stays unchanged; v2 gets distinct identity and artifacts |
| V-02 Mutation guard | Hash-locked released slice | Source modified in place | Validation fails before synth/deploy |
| V-03 Coexist | Released v1 and v2 | Deploy both | Both are addressable without overwriting each other |
| V-04 New-work routing | v2 active, v1 draining | New triggering event arrives | New execution starts on v2 |
| V-05 Resume old durable execution | v1 execution waiting for payment | v2 activates and callback arrives | v1 resumes under its original implementation and stable command IDs |
| V-06 Shadow projection | v1 serving, v2 rebuilding | Replay and catch-up execute | v2 uses separate data/checkpoints; v1 stays untouched |
| V-07 Rollback routing | Retained compatible v1 | Route new work back to v1 | Existing v2 executions remain pinned |
| V-08 Safe retirement | v1 still has pending obligations | Request removal | Deployment safety check blocks retirement |
| V-09 Schema compatibility | New slice changes command/event contract | Generate/synthesize | Breaking changes are reported and require explicit version/migration policy |

See [ADR-008](adr/ADR-008-immutable-slices.md). These tests do not assume globally sequenced events. Projection readiness still requires a separately verified completeness mechanism.
