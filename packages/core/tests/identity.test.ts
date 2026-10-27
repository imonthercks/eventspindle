import { describe, expect, it } from 'vitest';
import {
  asStreamId,
  asStreamRevision,
  createRfc3339Utc,
  createUuidV7,
  decodeStreamId,
  encodeStreamId,
  isTraceparent,
} from '../src/index';

describe('canonical stream identity', () => {
  it('round-trips normalized components with path separators and percent signs', () => {
    const identity = { boundedContext: 'sales', aggregateType: 'order', aggregateId: 'a/b%1' };
    const streamId = encodeStreamId(identity);
    expect(streamId).toBe('sales/order/a%2Fb%251');
    expect(decodeStreamId(streamId)).toEqual(identity);
    expect(encodeStreamId({ ...identity, aggregateId: 'a/b%2' })).not.toBe(streamId);
  });

  it('normalizes inputs to Unicode NFC and rejects noncanonical encoded forms', () => {
    const streamId = encodeStreamId({
      boundedContext: 'sale\u0301s',
      aggregateType: 'order',
      aggregateId: '1',
    });
    expect(decodeStreamId(streamId).boundedContext).toBe('salés');
    expect(() => asStreamId('sales/order/a%2fb')).toThrow('Invalid canonical stream ID');
  });

  it('rejects invalid revisions and oversized stream keys', () => {
    expect(() => asStreamRevision(-1)).toThrow();
    expect(() => asStreamRevision(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() =>
      encodeStreamId({ boundedContext: 'a', aggregateType: 'b', aggregateId: 'x'.repeat(2042) }),
    ).toThrow();
  });

  it('generates UUIDv7 IDs with the supplied Unix millisecond timestamp', () => {
    const id = createUuidV7(() => new Date('2026-10-27T03:41:18.615Z'));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(Number.parseInt(id.replaceAll('-', '').slice(0, 12), 16)).toBe(
      Date.parse('2026-10-27T03:41:18.615Z'),
    );
  });

  it('formats only RFC 3339 UTC timestamps', () => {
    expect(createRfc3339Utc(new Date('2026-10-27T03:41:18.615Z'))).toBe('2026-10-27T03:41:18.615Z');
  });

  it('accepts valid W3C trace context flags and rejects invalid identities', () => {
    expect(isTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00')).toBe(true);
    expect(isTraceparent('ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBe(false);
    expect(isTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBe(false);
    expect(isTraceparent('00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01')).toBe(false);
  });
});
