import type {
  CommandId,
  EventId,
  JsonValue,
  PendingDomainEvent,
  RFC3339UTC,
  RequestFingerprint,
  StoredCloudEvent,
  StreamId,
  StreamRevision,
} from '@eventspindle/core';

export const moduleName = '@eventspindle/eventstore' as const;

export interface StreamRead<T extends JsonValue = JsonValue> {
  readonly exists: boolean;
  readonly streamId: StreamId;
  readonly revision: StreamRevision;
  readonly events: readonly StoredCloudEvent<T>[];
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
  readonly committedAt: RFC3339UTC;
}

export interface AppendRequest<E extends PendingDomainEvent = PendingDomainEvent> {
  readonly commandId: CommandId;
  readonly requestFingerprint: RequestFingerprint;
  readonly streamId: StreamId;
  readonly expectedRevision: StreamRevision;
  readonly source: string;
  readonly events: readonly E[];
  readonly provenance: { readonly sliceId: string; readonly sliceVersion: number };
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
}

export interface AppendResult<T extends JsonValue = JsonValue> {
  readonly kind: 'committed' | 'previously-committed';
  readonly receipt: CommandReceipt;
  readonly events: readonly StoredCloudEvent<T>[];
}

export type EventStoreFailure =
  | { readonly kind: 'ValidationFailure'; readonly message: string }
  | {
      readonly kind: 'StreamConflict';
      readonly streamId: StreamId;
      readonly expectedRevision: StreamRevision;
      readonly actualRevision: StreamRevision;
    }
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
