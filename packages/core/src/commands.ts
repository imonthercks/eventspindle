import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import {
  asRequestFingerprint,
  type CommandId,
  type RequestFingerprint,
  type StreamId,
} from './identity';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface Command<TCommand> {
  readonly commandId: CommandId;
  readonly command: TCommand;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
}

export interface CommandMeaning {
  readonly streamId: StreamId;
  readonly commandType: string;
  readonly commandSchemaVersion: number;
  readonly payload: JsonValue;
}

export function assertJsonValue(
  value: unknown,
  path = '$',
  seen = new Set<object>(),
): asserts value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw new TypeError(`${path} contains an unsupported JSON number`);
    }
    return;
  }
  if (typeof value !== 'object') throw new TypeError(`${path} is not a JSON value`);
  if (seen.has(value)) throw new TypeError(`${path} contains a circular reference`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} must be a plain JSON object`);
    }
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) throw new TypeError(`${path}.${key} is undefined`);
      assertJsonValue(item, `${path}.${key}`, seen);
    }
  }
  seen.delete(value);
}

export function fingerprintCommand(meaning: CommandMeaning): RequestFingerprint {
  if (
    !meaning.commandType ||
    !Number.isSafeInteger(meaning.commandSchemaVersion) ||
    meaning.commandSchemaVersion < 1
  ) {
    throw new TypeError('Command type and positive schema version are required');
  }
  assertJsonValue(meaning.payload);
  const canonical = canonicalize({
    commandSchemaVersion: meaning.commandSchemaVersion,
    commandType: meaning.commandType,
    payload: meaning.payload,
    streamId: meaning.streamId,
  });
  if (canonical === undefined || canonical === null) {
    throw new TypeError('Command meaning could not be canonicalized');
  }
  const digest = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return asRequestFingerprint(`sha256:${digest}`);
}
