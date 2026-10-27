import { describe, expect, it } from 'vitest';
import { encodeStreamId, fingerprintCommand } from '../src/index';

const streamId = encodeStreamId({
  boundedContext: 'sales',
  aggregateType: 'order',
  aggregateId: 'order-1',
});

describe('command fingerprinting', () => {
  it('uses RFC 8785 canonical JSON and ignores object key insertion order', () => {
    const first = fingerprintCommand({
      streamId,
      commandType: 'PlaceOrder',
      commandSchemaVersion: 1,
      payload: { orderId: 'order-1', customerId: 'customer-9' },
    });
    const second = fingerprintCommand({
      streamId,
      commandType: 'PlaceOrder',
      commandSchemaVersion: 1,
      payload: { customerId: 'customer-9', orderId: 'order-1' },
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('includes stream, type, contract version, and payload meaning', () => {
    const fingerprint = fingerprintCommand({
      streamId,
      commandType: 'PlaceOrder',
      commandSchemaVersion: 1,
      payload: { orderId: 'order-1', customerId: 'customer-9' },
    });
    expect(
      fingerprintCommand({
        streamId: encodeStreamId({
          boundedContext: 'sales',
          aggregateType: 'order',
          aggregateId: 'order-2',
        }),
        commandType: 'PlaceOrder',
        commandSchemaVersion: 1,
        payload: { orderId: 'order-1', customerId: 'customer-9' },
      }),
    ).not.toBe(fingerprint);
    expect(
      fingerprintCommand({
        streamId,
        commandType: 'PlaceOrder',
        commandSchemaVersion: 2,
        payload: { orderId: 'order-1', customerId: 'customer-9' },
      }),
    ).not.toBe(fingerprint);
  });

  it('rejects values outside the supported JSON number model', () => {
    expect(() =>
      fingerprintCommand({
        streamId,
        commandType: 'Invalid',
        commandSchemaVersion: 1,
        payload: { value: Number.MAX_SAFE_INTEGER + 1 },
      }),
    ).toThrow('unsupported JSON number');
  });
});
