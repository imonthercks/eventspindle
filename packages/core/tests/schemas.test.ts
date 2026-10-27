import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import { createPayloadSchemaRegistry } from '../src/index';

const uri = 'https://schemas.example.test/order/v1.json';
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: uri,
  type: 'object',
  properties: { orderId: { type: 'string' } },
  required: ['orderId'],
  additionalProperties: false,
};
const integrity = `sha256:${createHash('sha256')
  .update(canonicalize(schema) ?? '')
  .digest('hex')}`;

describe('versioned payload schema registry', () => {
  it('validates known schema versions and rejects invalid or unknown schemas', () => {
    const registry = createPayloadSchemaRegistry([
      { type: 'example.OrderPlaced', version: 1, uri, integrity, schema },
    ]);
    expect(registry.resolve('example.OrderPlaced', 1)).toEqual({ uri });
    expect(() => registry.validate(uri, { orderId: '1' })).not.toThrow();
    expect(() => registry.validate(uri, { orderId: 1 })).toThrow('does not satisfy');
    expect(() => registry.resolve('example.OrderPlaced', 2)).toThrow('Unknown event schema');
    expect(() => registry.validate('https://schemas.example.test/unknown', {})).toThrow(
      'Unknown dataschema',
    );
  });

  it('rejects schema identity collisions and mutable dialect assumptions', () => {
    expect(() =>
      createPayloadSchemaRegistry([
        { type: 'example.A', version: 1, uri, integrity, schema },
        { type: 'example.B', version: 1, uri, integrity, schema },
      ]),
    ).toThrow('Duplicate payload schema registration');
    expect(() =>
      createPayloadSchemaRegistry([
        {
          type: 'example.Legacy',
          version: 1,
          uri,
          integrity,
          schema: { ...schema, $schema: 'http://json-schema.org/draft-07/schema#' },
        },
      ]),
    ).toThrow('Draft 2020-12');
  });

  it('rejects a schema that does not match its integrity pin', () => {
    expect(() =>
      createPayloadSchemaRegistry([
        {
          type: 'example.OrderPlaced',
          version: 1,
          uri,
          integrity: `sha256:${'0'.repeat(64)}`,
          schema,
        },
      ]),
    ).toThrow('integrity mismatch');
  });
});
