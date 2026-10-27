import {
  asEventId,
  asRfc3339Utc,
  asStreamRevision,
  isTraceparent,
  type CommandId,
  type EventId,
  type RFC3339UTC,
  type StreamId,
  type StreamRevision,
} from './identity';
import { assertJsonValue, type JsonValue } from './commands';
import type { PayloadSchemaRegistry } from './schemas';

export interface PendingDomainEvent<T extends JsonValue = JsonValue> {
  readonly type: string;
  readonly schemaVersion: number;
  readonly data: T;
}

export interface EventProvenance {
  readonly sliceId: string;
  readonly sliceVersion: number;
}

export interface EventMetadata {
  readonly source: string;
  readonly streamId: StreamId;
  readonly revision: number;
  readonly commandId: CommandId;
  readonly eventId: string;
  readonly time: Date;
  readonly provenance: EventProvenance;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
}

export interface StoredCloudEvent<T extends JsonValue = JsonValue> {
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
  readonly traceparent?: string;
  readonly tracestate?: string;
}

export type StoredEvent<T extends JsonValue = JsonValue> = StoredCloudEvent<T>;

export type Decision<E> =
  | { readonly ok: true; readonly events: readonly E[] }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

export type Evolve<S, E> = (state: S, event: E) => S;

export interface Decider<S, C, E extends PendingDomainEvent> {
  initialState(): S;
  evolve: Evolve<S, E>;
  decide(command: C, state: S): Decision<E>;
}

export function buildStoredEvent<T extends JsonValue>(
  pending: PendingDomainEvent<T>,
  metadata: EventMetadata,
  schemas: PayloadSchemaRegistry,
): StoredCloudEvent<T> {
  const schema = schemas.resolve(pending.type, pending.schemaVersion);
  assertJsonValue(pending.data, '$.data');
  schemas.validate(schema.uri, pending.data);
  const id = asEventId(metadata.eventId);
  const revision = asStreamRevision(metadata.revision);
  if (revision === 0) throw new RangeError('Stored event revisions start at 1');
  if (!metadata.source || !/^[a-z][a-z\d+.-]*:/i.test(metadata.source)) {
    throw new TypeError('Event source must be a stable absolute URI reference');
  }
  if (
    !metadata.provenance.sliceId ||
    !Number.isSafeInteger(metadata.provenance.sliceVersion) ||
    metadata.provenance.sliceVersion < 1
  ) {
    throw new TypeError('Event slice provenance is invalid');
  }
  if (metadata.traceparent !== undefined && !isTraceparent(metadata.traceparent)) {
    throw new TypeError('traceparent is not a valid W3C traceparent');
  }
  const event: StoredCloudEvent<T> = {
    specversion: '1.0',
    id,
    source: metadata.source,
    type: pending.type,
    subject: metadata.streamId,
    time: asRfc3339Utc(metadata.time.toISOString()),
    datacontenttype: 'application/json',
    dataschema: schema.uri,
    data: pending.data,
    streamrevision: revision,
    commandid: metadata.commandId,
    sliceid: metadata.provenance.sliceId,
    sliceversion: metadata.provenance.sliceVersion,
    ...(metadata.correlationId === undefined ? {} : { correlationid: metadata.correlationId }),
    ...(metadata.causationId === undefined ? {} : { causationid: metadata.causationId }),
    ...(metadata.traceparent === undefined ? {} : { traceparent: metadata.traceparent }),
    ...(metadata.tracestate === undefined ? {} : { tracestate: metadata.tracestate }),
  };
  return Object.freeze(event);
}
