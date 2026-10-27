/** EventSpindle v0.0.1: proposed public contracts; framework-agnostic, no AWS imports. */
export type Brand<T, B extends string> = T & { readonly __brand: B };
export type StreamId = Brand<string, 'StreamId'>;
export type CommandId = Brand<string, 'CommandId'>;
export type EventId = Brand<string, 'EventId'>;
export type RequestFingerprint = Brand<string, 'RequestFingerprint'>;
export type StreamRevision = Brand<number, 'StreamRevision'>;
export type RFC3339UTC = Brand<string, 'RFC3339UTC'>;

export interface AggregateIdentity {
  readonly boundedContext: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
}

/** Canonical identifier codec must be round-trip safe and collision-free. */
export interface StreamIdentityCodec {
  encode(identity: AggregateIdentity): StreamId;
  decode(id: StreamId): AggregateIdentity;
}

export interface PendingDomainEvent<T = unknown> {
  readonly type: string;
  readonly schemaVersion: number;
  readonly data: T;
}

/** Required subset of the EventSpindle CloudEvents 1.0 profile. */
export interface StoredCloudEvent<T = unknown> {
  readonly specversion: '1.0';
  readonly id: EventId;
  readonly source: string;
  readonly type: string;
  readonly subject: StreamId;
  readonly time: RFC3339UTC;
  readonly datacontenttype: 'application/json';
  readonly dataschema: string;
  readonly data: T;
  readonly streamrevision: StreamRevision;
  readonly commandid: CommandId;
  readonly correlationid?: string;
  readonly causationid?: string;
  readonly sliceid: string;
  readonly sliceversion: number;
  readonly recordedat?: RFC3339UTC;
  readonly traceparent?: string;
  readonly tracestate?: string;
}

export type Decision<E> =
  | { readonly ok: true; readonly events: readonly E[] }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

export interface Decider<S, C, E extends PendingDomainEvent> {
  initialState(): S;
  evolve(state: S, event: E): S;
  decide(command: C, state: S): Decision<E>;
}

/** Hash of canonical *request meaning*, not ephemeral metadata or event IDs. */
export interface CommandIdentity {
  readonly commandId: CommandId;
  readonly requestFingerprint: RequestFingerprint;
}

/**
 * Low-level append boundary. The application command handler must check receipt
 * before evaluating a fresh business decision when retrying an existing ID.
 * All events must already have validated immutable schema references.
 */
export interface AppendRequest<E extends PendingDomainEvent = PendingDomainEvent> extends CommandIdentity {
  readonly streamId: StreamId;
  readonly expectedRevision: StreamRevision; // 0 means no persisted HEAD
  readonly events: readonly E[];             // may be empty: durable no-op
  readonly provenance: { readonly sliceId: string; readonly sliceVersion: number };
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
}

export interface CommandReceipt {
  readonly commandId: CommandId;
  readonly requestFingerprint: RequestFingerprint;
  readonly streamId: StreamId;
  readonly expectedRevision: StreamRevision;
  readonly resultingRevision: StreamRevision;
  readonly outcome: 'appended' | 'no-op';
  readonly eventIds: readonly EventId[];
  readonly eventRevisions: readonly StreamRevision[];
  readonly committedAt?: RFC3339UTC; // omit if authoritative commit time unavailable
}

export interface StreamRead<T = unknown> {
  readonly exists: boolean;
  readonly streamId: StreamId;
  readonly revision: StreamRevision;
  readonly events: readonly StoredCloudEvent<T>[];
}

export type AppendResult<T = unknown> = {
  readonly kind: 'committed' | 'previously-committed';
  readonly receipt: CommandReceipt;
  readonly events: readonly StoredCloudEvent<T>[];
};

export type EventStoreFailure =
  | { readonly kind: 'ValidationFailure'; readonly message: string }
  | { readonly kind: 'StreamConflict'; readonly streamId: StreamId; readonly expectedRevision: StreamRevision; readonly actualRevision: StreamRevision }
  | { readonly kind: 'IdempotencyKeyReuse'; readonly commandId: CommandId }
  | { readonly kind: 'TransientFailure'; readonly cause?: unknown }
  | { readonly kind: 'CommitOutcomeUnknown'; readonly commandId: CommandId }
  | { readonly kind: 'InfrastructureFailure'; readonly cause?: unknown };

export type StoreOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: EventStoreFailure };

export interface EventStore {
  readStream(streamId: StreamId): Promise<StoreOutcome<StreamRead>>;
  getCommandReceipt(commandId: CommandId): Promise<StoreOutcome<CommandReceipt | null>>;
  append(input: AppendRequest): Promise<StoreOutcome<AppendResult>>;
}

export interface CommandHandler<C> {
  handle(input: { readonly identity: CommandIdentity; readonly command: C }): Promise<
    | { readonly ok: true; readonly result: AppendResult }
    | { readonly ok: false; readonly error: EventStoreFailure | { kind: 'BusinessRejection'; code: string; message: string } }
  >;
}
