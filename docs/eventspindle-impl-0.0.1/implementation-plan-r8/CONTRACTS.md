# Core TypeScript ports and data contracts

Illustrative API, to be refined through tests. Avoid coupling domain code to AWS SDK types.

```typescript
export interface DomainEvent<T extends string = string, D = unknown> {
  type: T;
  schemaVersion: number;
  data: D;
}
export interface EventEnvelope<E extends DomainEvent = DomainEvent> {
  eventId: string;
  streamId: string;
  streamVersion: number;
  recordedAt: string; // informational, NOT commit-ordered
  commandId: string;
  correlationId?: string;
  causationId?: string;
  event: E;
}
export type Decision<E> =
  | { ok: true; events: readonly E[] }
  | { ok: false; error: { code: string; message: string } };
export interface Decider<S, C, E> {
  initialState(): S;
  evolve(state: S, event: E): S;
  decide(command: C, state: S): Decision<E>;
}
export interface AppendCommand<E> {
  streamId: string;
  expectedVersion: number; // 0 signifies nonexistent new stream
  commandId: string;
  requestHash: string;
  events: readonly E[];
}
export interface EventStore<E> {
  readStream(streamId: string): Promise<{ version: number; events: EventEnvelope<E>[] }>;
  append(input: AppendCommand<E>): Promise<{ version: number; events: EventEnvelope<E>[] }>;
}
export interface ProjectionSink<E> {
  applyInOrder(projectionId: string, event: EventEnvelope<E>): Promise<'applied' | 'duplicate' | 'gap'>;
  getView<T>(projectionId: string, key: string): Promise<T | null>;
}
export interface CommandBus<C> {
  execute(input: { commandId: string; command: C }): Promise<unknown>;
}
```

## Adapter rules

- Memory adapter atomicity is enforced in-process with a stream-level mutex or serialized transactional critical section; arrays/maps otherwise are insufficient for async competing writers.
- DynamoDB adapter uses `TransactWriteItems` for stream HEAD, new EVT items, and command receipt, with conditional existence/version checks. Each event item gets distinct sort key. For a new stream insert HEAD with conditional nonexistence.
- The framework must classify `StreamConflict`, `DuplicateCommand`, `AmbiguousCommit`, transient capacity errors; stable command receipts make timeout retries safe.
- Production event IDs are generated once before the transaction and reused on retries. `recordedAt` is application timestamp and no strict cross-stream order is promised.
- Stream event ordering uses `streamVersion` only; optional cross-stream temporal views sort by `(recordedAt,eventId)` for display only.
- Memory and DSQL projection adapters share tests for idempotency and per-stream contiguous progress. Multi-stream aggregations are deferred, so checkpoint only scopes an order-status view to one order.
- Local workflow engine exposes `start`, `advanceClock`, and `inspect`, backed by in-memory state; AWS workflow uses AWS Durable SDK. Do not claim backend semantics are identical beyond business outcomes and idempotent command execution.
- Translation is a pure `externalMessage -> Command` function where possible; inbound HTTP adapter verifies a configured shared secret or signature in AWS and maps to stable `commandId`.

## Proposed version metadata

```yaml
slices:
  fulfill-order:
    versions:
      1:
        source: event-model/versions/fulfill-order/v1.json
        implementation: apps/example-orders/src/slices/fulfill-order/v1
        modelSha256: <calculated-at-release>
        lifecycle: released
```

A content hash is materialized at release, never left as placeholder in actual released manifest. Runtime app version and infrastructure revision remain separate from slice behavior version.

## Normative CloudEvents-oriented contract update (r2)

The earlier `EventEnvelope` interface above is an **internal legacy sketch**; for implementation, use the *logical CloudEvents 1.0 envelope* below and [STANDARDS-PROFILE.md](STANDARDS-PROFILE.md). Do not persist two divergent canonical envelope types.

```typescript
export interface EventSpindleCloudEvent<Data = unknown> {
  specversion: '1.0';
  id: string;                    // generated once, UUIDv7 preferred
  source: string;                // bounded context URI-reference
  type: string;                  // namespaced domain event type
  subject: string;               // canonical stream ID
  time: string;                  // RFC 3339 UTC; not commit order
  datacontenttype: 'application/json';
  dataschema: string;            // immutable versioned JSON Schema URI
  data: Data;
  streamrevision: number;       // EventSpindle CloudEvents extension
  commandid: string;
  correlationid?: string;
  causationid?: string;
  sliceid: string;
  sliceversion: number;
  recordedat?: string;
  traceparent?: string;
  tracestate?: string;
}

export interface PendingDomainEvent<Data = unknown> {
  type: string;
  schemaVersion: number;
  data: Data;
}
```

- Deciders emit `PendingDomainEvent`; the append boundary materializes the CloudEvent envelope using a pinned schema registry, injected clock and ID generator.
- Event IDs and timestamps are fixed for a given command attempt and reused on transport retries; if a command is already committed, return the persisted receipt and original event envelopes.
- Stream storage keys are derived from `subject` and revision; `source`+`id` identifies a CloudEvent even if transported multiple times.
- The public `EventStore` generic should be migrated to `EventSpindleCloudEvent` before M1; deprecated illustrative interface must not be copied into the implementation.
- Keep `traceparent`/`tracestate` optional and independent of business `correlationid`/`causationid`.
