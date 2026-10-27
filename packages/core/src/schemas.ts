import Ajv2020, { type AnySchema, type ValidateFunction } from 'ajv/dist/2020';
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import type { JsonValue } from './commands';

export interface PayloadSchemaDefinition {
  readonly type: string;
  readonly version: number;
  readonly uri: string;
  readonly integrity: string;
  readonly schema: AnySchema;
}

interface RegisteredSchema {
  readonly uri: string;
  readonly validate: ValidateFunction;
}

export interface PayloadSchemaRegistry {
  resolve(type: string, version: number): { readonly uri: string };
  validate(uri: string, payload: unknown): asserts payload is JsonValue;
}

export function createPayloadSchemaRegistry(
  definitions: readonly PayloadSchemaDefinition[],
): PayloadSchemaRegistry {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const byTypeVersion = new Map<string, RegisteredSchema>();
  const byUri = new Map<string, RegisteredSchema>();
  for (const definition of definitions) {
    if (!definition.type || !Number.isSafeInteger(definition.version) || definition.version < 1) {
      throw new TypeError('Schema type and positive version are required');
    }
    const key = `${definition.type}@${definition.version}`;
    if (byTypeVersion.has(key) || byUri.has(definition.uri)) {
      throw new TypeError(`Duplicate payload schema registration: ${key}`);
    }
    const schema = definition.schema as Record<string, unknown>;
    if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
      throw new TypeError(`Schema ${definition.uri} must use JSON Schema Draft 2020-12`);
    }
    if (schema.$id !== definition.uri) {
      throw new TypeError(`Schema $id must match its immutable URI: ${definition.uri}`);
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(definition.integrity)) {
      throw new TypeError(`Schema ${definition.uri} requires a SHA-256 integrity pin`);
    }
    const canonicalSchema = canonicalize(definition.schema);
    if (canonicalSchema === undefined || canonicalSchema === null) {
      throw new TypeError(`Schema ${definition.uri} cannot be canonicalized`);
    }
    const digest = createHash('sha256').update(canonicalSchema, 'utf8').digest('hex');
    if (`sha256:${digest}` !== definition.integrity) {
      throw new TypeError(`Schema integrity mismatch for ${definition.uri}`);
    }
    const registered = { uri: definition.uri, validate: ajv.compile(definition.schema) };
    byTypeVersion.set(key, registered);
    byUri.set(definition.uri, registered);
  }
  return Object.freeze({
    resolve(type: string, version: number) {
      const schema = byTypeVersion.get(`${type}@${version}`);
      if (!schema) throw new TypeError(`Unknown event schema: ${type}@${version}`);
      return { uri: schema.uri };
    },
    validate(uri: string, payload: unknown): asserts payload is JsonValue {
      const schema = byUri.get(uri);
      if (!schema) throw new TypeError(`Unknown dataschema: ${uri}`);
      if (!schema.validate(payload)) {
        const details = schema.validate.errors
          ?.map((error) => `${error.instancePath || '/'} ${error.message}`)
          .join('; ');
        throw new TypeError(`Payload does not satisfy ${uri}${details ? `: ${details}` : ''}`);
      }
    },
  });
}
