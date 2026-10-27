import { randomBytes } from 'node:crypto';

export type Brand<T, Name extends string> = T & { readonly __brand: Name };
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

const MAX_STREAM_ID_BYTES = 2041;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/;
const TRACEPARENT_PATTERN = /^[\da-f]{2}-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/;

function normalizeComponent(value: string, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.normalize('NFC');
}

function isCanonicalComponent(value: string): boolean {
  try {
    return encodeURIComponent(decodeURIComponent(value)) === value;
  } catch {
    return false;
  }
}

export function encodeStreamId(identity: AggregateIdentity): StreamId {
  const parts = [
    normalizeComponent(identity.boundedContext, 'boundedContext'),
    normalizeComponent(identity.aggregateType, 'aggregateType'),
    normalizeComponent(identity.aggregateId, 'aggregateId'),
  ];
  const streamId = parts.map(encodeURIComponent).join('/');
  if (Buffer.byteLength(streamId, 'utf8') > MAX_STREAM_ID_BYTES) {
    throw new RangeError(`Canonical stream ID exceeds ${MAX_STREAM_ID_BYTES} UTF-8 bytes`);
  }
  return streamId as StreamId;
}

export function decodeStreamId(streamId: string): AggregateIdentity {
  if (typeof streamId !== 'string' || Buffer.byteLength(streamId, 'utf8') > MAX_STREAM_ID_BYTES) {
    throw new TypeError('Invalid canonical stream ID');
  }
  const parts = streamId.split('/');
  if (
    parts.length !== 3 ||
    parts.some((part) => part.length === 0 || !isCanonicalComponent(part))
  ) {
    throw new TypeError('Invalid canonical stream ID');
  }
  const [boundedContext, aggregateType, aggregateId] = parts.map(decodeURIComponent);
  if (
    boundedContext === undefined ||
    aggregateType === undefined ||
    aggregateId === undefined ||
    [boundedContext, aggregateType, aggregateId].some((part) => part.normalize('NFC') !== part)
  ) {
    throw new TypeError('Stream ID components must be NFC-normalized');
  }
  return { boundedContext, aggregateType, aggregateId };
}

export function asStreamId(value: string): StreamId {
  decodeStreamId(value);
  return value as StreamId;
}

export function asCommandId(value: string): CommandId {
  if (!UUID_PATTERN.test(value)) throw new TypeError('commandId must be a UUID');
  return value as CommandId;
}

export function asEventId(value: string): EventId {
  if (!UUID_PATTERN.test(value)) throw new TypeError('eventId must be a UUID');
  return value as EventId;
}

export function asRequestFingerprint(value: string): RequestFingerprint {
  if (!FINGERPRINT_PATTERN.test(value)) {
    throw new TypeError('request fingerprint must be sha256:<64 lowercase hex characters>');
  }
  return value as RequestFingerprint;
}

export function asStreamRevision(value: number): StreamRevision {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('stream revision must be a non-negative safe integer');
  }
  return value as StreamRevision;
}

export function createUuidV7(now: () => Date = () => new Date()): string {
  const milliseconds = now().getTime();
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0 || milliseconds > 0xffffffffffff) {
    throw new RangeError('UUIDv7 timestamp must fit in 48 bits');
  }
  const bytes = randomBytes(16);
  bytes[0] = milliseconds / 0x10000000000;
  bytes[1] = (milliseconds / 0x100000000) % 0x100;
  bytes[2] = (milliseconds / 0x1000000) % 0x100;
  bytes[3] = (milliseconds / 0x10000) % 0x100;
  bytes[4] = (milliseconds / 0x100) % 0x100;
  bytes[5] = milliseconds % 0x100;
  bytes[6] = 0x70 | (bytes[6]! & 0x0f);
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createUuidV7Factory(now?: () => Date): () => EventId {
  return () => asEventId(createUuidV7(now));
}

export function createRfc3339Utc(date: Date): RFC3339UTC {
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid timestamp');
  return asRfc3339Utc(date.toISOString());
}

export function asRfc3339Utc(value: string): RFC3339UTC {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new TypeError('Timestamp must be RFC 3339 UTC with millisecond precision');
  }
  return value as RFC3339UTC;
}

export function isTraceparent(value: string): boolean {
  if (!TRACEPARENT_PATTERN.test(value)) return false;
  const [version, traceId, parentId] = value.split('-');
  return version !== 'ff' && traceId !== '0'.repeat(32) && parentId !== '0'.repeat(16);
}
