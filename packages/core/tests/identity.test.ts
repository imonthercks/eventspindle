import { describe, expect, it } from 'vitest';
import { formatStreamId } from '../src/index';

describe('Stream identity', () => {
  it('uses bounded context, aggregate type, and aggregate ID', () => {
    expect(
      formatStreamId({ boundedContext: 'sales', aggregateType: 'order', aggregateId: '123' }),
    ).toBe('sales/order/123');
  });
});
