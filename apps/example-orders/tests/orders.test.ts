import { describe, expect, it } from 'vitest';
import { asCommandId, asEventId } from '@eventspindle/core';
import { MemoryEventStore } from '@eventspindle/eventstore-memory';
import { OrderCommandHandler, orderSchemaRegistry, orderStreamId } from '../src/index';

function createHandler(): { handler: OrderCommandHandler; store: MemoryEventStore } {
  let eventSequence = 0;
  const store = new MemoryEventStore({
    schemas: orderSchemaRegistry,
    idFactory: () => {
      eventSequence += 1;
      return asEventId(`019a1234-5678-7abc-8def-${eventSequence.toString().padStart(12, '0')}`);
    },
    now: () => new Date('2026-10-27T03:41:18.615Z'),
  });
  return { handler: new OrderCommandHandler(store), store };
}

function commandId(value: number) {
  return asCommandId(`019a1234-5678-7abc-8def-${value.toString().padStart(12, '0')}`);
}

describe('order domain', () => {
  it('creates an order, supports idempotent retries, and rejects duplicate creation', async () => {
    const { handler } = createHandler();
    const command = { type: 'PlaceOrder' as const, orderId: 'order-123', customerId: 'customer-9' };
    const first = await handler.handle({ commandId: commandId(1), command });
    const retry = await handler.handle({
      commandId: commandId(1),
      command,
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    });

    const duplicate = await handler.handle({ commandId: commandId(2), command });

    expect(first.ok && first.value.events[0]).toMatchObject({
      type: 'org.eventspindle.sales.OrderPlaced',
      streamrevision: 1,
      data: { orderId: 'order-123', customerId: 'customer-9' },
    });
    expect(retry.ok && retry.value.kind).toBe('previously-committed');
    expect(retry.ok && retry.value.events[0]?.id).toBe(first.ok && first.value.events[0]?.id);
    expect(duplicate).toMatchObject({
      ok: false,
      error: { kind: 'BusinessRejection', code: 'OrderAlreadyExists' },
    });
  });

  it('uses the normalized order ID in stream identity and event payloads', async () => {
    const { handler } = createHandler();
    const result = await handler.handle({
      commandId: commandId(8),
      command: { type: 'PlaceOrder', orderId: 'cafe\u0301', customerId: 'customer-9' },
    });
    expect(result.ok && result.value.events[0]).toMatchObject({
      subject: 'sales/order/caf%C3%A9',
      data: { orderId: 'café' },
    });
  });

  it('enforces valid fulfillment and shipment transitions in stream order', async () => {
    const { handler, store } = createHandler();
    const beforeCreate = await handler.handle({
      commandId: commandId(3),
      command: { type: 'RequestFulfillment', orderId: 'order-456' },
    });
    expect(beforeCreate).toMatchObject({
      ok: false,
      error: { kind: 'BusinessRejection', code: 'InvalidOrderTransition' },
    });

    await handler.handle({
      commandId: commandId(4),
      command: { type: 'PlaceOrder', orderId: 'order-456', customerId: 'customer-9' },
    });
    const requested = await handler.handle({
      commandId: commandId(5),
      command: { type: 'RequestFulfillment', orderId: 'order-456' },
    });
    const confirmed = await handler.handle({
      commandId: commandId(6),
      command: { type: 'ConfirmShipment', orderId: 'order-456' },
    });
    const read = await store.readStream(orderStreamId('order-456'));

    expect(requested.ok && requested.value.events[0]).toMatchObject({
      type: 'org.eventspindle.sales.FulfillmentRequested',
      streamrevision: 2,
    });
    expect(confirmed.ok && confirmed.value.events[0]).toMatchObject({
      type: 'org.eventspindle.sales.ShipmentConfirmed',
      streamrevision: 3,
      sliceid: 'confirm-shipment',
    });
    expect(requested.ok && requested.value.events[0]?.sliceid).toBe('request-fulfillment');
    expect(read.ok && read.value.events.map((event) => event.streamrevision)).toEqual([1, 2, 3]);
  });

  it('rejects invalid event payloads before writing stream state or receipts', async () => {
    const { handler, store } = createHandler();
    const invalid = await handler.handle({
      commandId: commandId(7),
      command: { type: 'PlaceOrder', orderId: 'order-789', customerId: '' },
    });
    expect(invalid).toMatchObject({
      ok: false,
      error: { kind: 'BusinessRejection', code: 'InvalidCustomerId' },
    });
    const stream = await store.readStream(orderStreamId('order-789'));
    expect(stream.ok && stream.value.exists).toBe(false);
  });
});
