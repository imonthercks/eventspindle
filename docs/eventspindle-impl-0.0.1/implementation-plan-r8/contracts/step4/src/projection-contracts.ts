/** EventSpindle v0.0.1 Step 4 — proposed public TypeScript contracts.
 * No dependency on AWS SDK, DSQL driver, or a global sequence.
 */
export type StreamId = string & { readonly __streamId: unique symbol };
export type EventId = string & { readonly __eventId: unique symbol };
export type ProjectionId = string & { readonly __projectionId: unique symbol };
export type SliceVersion = number;

export interface ProjectionIdentity {
  readonly boundedContext: string;
  readonly projectionId: ProjectionId;
  readonly version: SliceVersion;
}
export interface ProjectionInstance {
  /** Separate instance key allows a v2 rebuild alongside a serving v2 instance. */
  readonly identity: ProjectionIdentity;
  readonly instanceId: string;
}
export interface DomainEvent<T = unknown> {
  readonly specversion: '1.0';
  readonly id: EventId;
  readonly source: string;
  readonly type: string;
  readonly subject: StreamId;
  readonly time?: string;
  readonly dataschema: string;
  readonly datacontenttype: 'application/json';
  readonly streamrevision: number;
  readonly correlationid?: string;
  readonly causationid?: string;
  readonly data: T;
}
export type ProjectionApplyResult =
  | { readonly status: 'applied'; readonly checkpoint: number }
  | { readonly status: 'duplicate'; readonly checkpoint: number }
  | { readonly status: 'gap'; readonly expectedRevision: number; readonly receivedRevision: number };
export interface Checkpoint {
  readonly streamId: StreamId;
  readonly revision: number; // 0 = no applied events on this stream
  readonly lastEventId?: EventId;
}

/** Strict per-stream ledger is sufficient when every event is processed in revision order. */
export interface ProjectionTransaction {
  getCheckpoint(streamId: StreamId): Promise<Checkpoint>;
  /** Application operation with no external side effects. */
  read<T>(key: string): Promise<T | undefined>;
  write<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  /** SQL-backed adapters may expose a separately typed SQL capability in their own package. */
  setCheckpoint(checkpoint: Checkpoint): Promise<void>;
}

/** The store owns the atomic transaction across changes and checkpoints. */
export interface ProjectionStore {
  readonly capabilities: ProjectionCapabilities;
  getCheckpoint(instance: ProjectionInstance, streamId: StreamId): Promise<Checkpoint>;
  transact<T>(
    instance: ProjectionInstance,
    work: (transaction: ProjectionTransaction) => Promise<T>
  ): Promise<T>;
  clearInstance(instance: ProjectionInstance): Promise<void>; // maintenance/offline only
}
export interface ProjectionCapabilities {
  readonly atomicMutationAndCheckpoint: true;
  readonly perStreamCheckpoint: true;
  readonly supportsVersionIsolation: true;
  readonly nativeQueries: boolean;
  readonly historicalRebuild: 'bounded-offline' | 'unsupported';
}

export interface PureProjection<TState, TPayload = unknown> {
  readonly kind: 'pure';
  readonly identity: ProjectionIdentity;
  initialState(): TState;
  /** Must be deterministic, synchronous, side-effect free, and order-independent across streams if shared. */
  evolve(state: Readonly<TState>, event: DomainEvent<TPayload>): TState;
  stateKey(event: DomainEvent<TPayload>): string;
}
export interface NativeProjection<TPayload = unknown> {
  readonly kind: 'native';
  readonly identity: ProjectionIdentity;
  /** Called only after checkpoint validation, inside the same storage transaction. */
  apply(event: DomainEvent<TPayload>, tx: ProjectionTransaction): Promise<void>;
  /** Mandatory locally runnable reference for parity testing v0.0.1. */
  readonly reference: PureProjection<unknown, TPayload>;
}
export type ProjectionDefinition<TState = unknown, TPayload = unknown> =
  | PureProjection<TState, TPayload>
  | NativeProjection<TPayload>;

export interface EventRangeReader {
  readRange(streamId: StreamId, firstRevision: number, lastRevision: number): Promise<readonly DomainEvent[]>;
}
export interface StreamCatalog {
  /** Explicit bounded, stable stream list; no assumption of global event positions. */
  listForRebuild(scope: string): Promise<readonly StreamId[]>;
}
export interface ProjectionProcessor {
  apply(instance: ProjectionInstance, event: DomainEvent): Promise<ProjectionApplyResult>;
  repairRange(instance: ProjectionInstance, streamId: StreamId, throughRevision: number): Promise<void>;
}
export interface BoundedRebuildRequest {
  readonly target: ProjectionInstance;
  readonly scope: string;
  readonly streams: readonly StreamId[];
  /** Captured while writes are paused or from explicitly stable bounded test data. */
  readonly inclusiveHighWatermarks: Readonly<Record<string, number>>;
}
export interface BoundedRebuildResult {
  readonly target: ProjectionInstance;
  readonly appliedEvents: number;
  readonly verifiedCheckpoints: Readonly<Record<string, number>>;
  readonly queryTrafficSwitched: false;
}
export interface ProjectionRebuilder {
  rebuildOffline(request: BoundedRebuildRequest): Promise<BoundedRebuildResult>;
}
export type ProjectionError =
  | { readonly kind: 'invalid-event'; readonly reason: string }
  | { readonly kind: 'unknown-schema'; readonly schema: string }
  | { readonly kind: 'missing-history'; readonly streamId: StreamId; readonly revision: number }
  | { readonly kind: 'transient-conflict'; readonly retryable: true }
  | { readonly kind: 'storage-unavailable'; readonly retryable: true }
  | { readonly kind: 'terminal-projection-error'; readonly reason: string };
