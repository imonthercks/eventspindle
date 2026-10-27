# Framework requirements and draft contracts

**Version:** 0.1 (draft). Items marked *proposed* have not been accepted as exact API shapes.

## Functional requirements

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-01 | Atomically append one or more domain events to a single stream | Must | Accepted |
| FR-02 | Reject stale expected stream versions | Must | Accepted |
| FR-03 | Read events from one stream in version order | Must | Accepted |
| FR-04 | Build aggregate state via pure `evolve` and decide events via pure `decide` | Must | Design direction |
| FR-05 | Assign stable event and command IDs; support durable command idempotency | Must | Proposed mechanism |
| FR-06 | Attach event type, schema version, correlation/causation metadata and recorded timestamp | Must | Design direction |
| FR-07 | Permit pluggable projection destinations | Must | Accepted |
| FR-08 | Implement an Aurora DSQL projection adapter first | Must | Accepted |
| FR-09 | Project events asynchronously; tolerate duplicates and out-of-order messages | Must | Design requirement |
| FR-10 | Preserve projection progress together with effect, when transactional sink permits | Must | Design requirement |
| FR-11 | Rebuild projections from durable event history during live writes | Must before production | Open detailed protocol |
| FR-12 | Find events in approximate recorded-time windows | Should | Proposed |
| FR-13 | Support event schema evolution/upcasting | Later | Proposed |
| FR-14 | Support external translations and workflow automation | Later | Proposed |
| FR-15 | Prefer Lambda Durable Functions for Event Modeling automations and long-running process orchestration | Must for automation implementation | Accepted direction |
| FR-16 | Generate TypeScript AWS CDK and SDK code from validated Event Modeling specifications | Must for model-to-code tooling | Accepted direction |
| FR-17 | Generate acceptance tests and model-to-code traceability | Must for model-to-code tooling | Accepted direction |
| FR-18 | Keep AWS runtime configuration separate from portable business model | Must | Accepted direction |
| FR-19 | Pin upstream modeling schema version and fail closed on unresolved semantics | Must for generator | Proposed detailed contract |

## Nonfunctional requirements

- **NFR-01:** Unrelated aggregate streams have no global write-counter contention.
- **NFR-02:** Framework exposes typed conflict, domain rejection, duplicate command, transient storage, and ambiguous commit outcomes.
- **NFR-03:** Ordering promises are explicit; no implied cross-stream commit order.
- **NFR-04:** Recovery handles lost/duplicated notifications and bounded stream retention.
- **NFR-05:** A rebuild must not replace an active projection until completeness and catch-up criteria are verified.
- **NFR-06:** AWS limits and transaction costs are load-tested for actual batch size/event payloads.

## Draft TypeScript contracts (proposed, not frozen)

```typescript
export type DomainEvent<T extends string = string, D = unknown> = Readonly<{
  type: T;
  data: D;
}>;

export type Decision<E> =
  | { ok: true; events: readonly E[] }
  | { ok: false; error: DomainError };

export interface Decider<S, C, E> {
  initialState(): S;
  evolve(state: S, event: E): S;
  decide(command: C, state: S): Decision<E>;
}

export interface StoredEvent<E> {
  eventId: string;
  streamId: string;
  streamVersion: number;
  eventType: string;
  schemaVersion: number;
  data: E;
  recordedAt: string; // informational; NOT a global commit cursor
  occurredAt?: string;
  metadata: {
    commandId: string;
    correlationId?: string;
    causationId?: string;
  };
}

export interface EventStore<E> {
  readStream(streamId: string): Promise<{
    version: number;
    events: readonly StoredEvent<E>[];
  }>;
  appendToStream(args: {
    streamId: string;
    expectedVersion: number;
    commandId: string;
    events: readonly E[];
  }): Promise<{ version: number; events: readonly StoredEvent<E>[] }>;
}

export interface ProjectionStore {
  // Adapter implements transactional projection effect + progress update.
  applyBatch(input: ProjectionBatch): Promise<ProjectionApplyResult>;
}

export type ProjectionOrdering =
  | 'per-stream'
  | 'commutative';
  // No 'global-commit-order' capability in v0.1.
```

Types `DomainError`, `ProjectionBatch` and `ProjectionApplyResult` intentionally remain to be defined. Projection checkpoint shape and deduplication ledger depend on the selected delivery/replay protocol.

## Logical DynamoDB records (proposed)

```text
PK=STREAM#<type>#<id>, SK=HEAD
  version: number

PK=STREAM#<type>#<id>, SK=EVT#<zero-padded-version>
  eventId, streamVersion, type, schemaVersion, data,
  recordedAt, occurredAt?, commandId, correlationId?, causationId?

PK=COMMAND#<commandId>, SK=RECEIPT
  requestHash, outcome, streamId
```

**Append transaction concept:** conditionally update/create stream HEAD; conditionally put event records; put a unique durable command receipt (and potentially one notification/outbox record) in the same DynamoDB transaction. There is no global sequence counter or globally ordered replay table. Exact key schema and transaction budget are open.

## Logical DSQL projection records (proposed)

- Projection-specific relational tables.
- A progress ledger/checkpoint keyed by projection version and stream or event identity.
- Projection write and progress update in one DSQL transaction.
- Cross-stream commutative projections need event-ID deduplication in addition to stream progress where appropriate.

## Deferred API: time-range discovery

```typescript
interface EventDiscovery<E> {
  findEvents(options: {
    recordedFrom: Date;
    recordedTo?: Date;
  }): AsyncIterable<StoredEvent<E>>;
}
```

This is a **discovery API**, not an authoritative completeness-checked replay API.

- **NFR-07:** Native AWS-managed routing/retry/orchestration preferred when it reduces owned application logic without weakening guarantees.
- **NFR-08:** Generated infrastructure is source-controlled CDK and must synthesize before deployment.
- **NFR-09:** Durable step side effects and EventSpindle commands must use stable idempotency identities.

## v0.4 slice versioning requirements

- **SVR-01:** Identify generated artifacts by immutable `(sliceId, sliceVersion)` and bind released snapshots to computed content digests.
- **SVR-02:** Allow draft edits; reject in-place modification of released business behavior.
- **SVR-03:** Generate successor versions side by side without overwriting released runtime code/CDK/test artifacts.
- **SVR-04:** Route only new durable executions to the configured active automation version; preserve existing executions, callbacks and idempotent command identities.
- **SVR-05:** Support independent state-view version builds and checkpoints; gate projection promotion on a demonstrated completeness barrier.
- **SVR-06:** Permit translation versions to coexist for different external payload formats.
- **SVR-07:** Validate command/event schema compatibility separately from slice version and deployment revision.
- **SVR-08:** Prevent automated deletion of needed draining resources; require explicit retirement safety checks.
- **SVR-09:** Keep lifecycle/deployment settings in EventSpindle metadata outside the upstream Event Modeling specification.

Details: [SLICE-VERSIONING.md](SLICE-VERSIONING.md).
