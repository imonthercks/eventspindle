import { describe, expect, it } from 'vitest';
import {
  asCommandId,
  asEventId,
  asStreamRevision,
  createPayloadSchemaRegistry,
  encodeStreamId,
  fingerprintCommand,
  type JsonValue,
} from '@eventspindle/core';
import { MemoryEventStore } from '../src/index';

const streamId = encodeStreamId({
  boundedContext: 'sales',
  aggregateType: 'order',
  aggregateId: '123',
});
const eventSchemaUri = 'https://schemas.example.test/order-event/v1.json';
const eventPayloadSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: eventSchemaUri,
  type: 'object',
  properties: { orderId: { type: 'string' }, status: { type: 'string' } },
  required: ['orderId', 'status'],
  additionalProperties: false,
};
const schemas = createPayloadSchemaRegistry([
  {
    type: 'example.OrderEvent',
    version: 1,
    uri: eventSchemaUri,
    integrity: 'sha256:d0dea39826b1c6bdc808295f41934dd482f5a88a566efc1de6225faac71ed2f6',
    schema: eventPayloadSchema,
  },
]);

let eventSequence = 0;
const idFactory = () => {
  eventSequence += 1;
  return asEventId(`00000000-0000-7000-8000-${eventSequence.toString().padStart(12, '0')}`);
};

function makeStore(
  options: Partial<Omit<ConstructorParameters<typeof MemoryEventStore>[0], 'schemas'>> = {},
) {
  eventSequence = 0;
  return new MemoryEventStore({
    schemas,
    idFactory,
    now: () => new Date('2026-10-27T03:41:18.615Z'),
    ...options,
  });
}

function request(
  commandId: string,
  expectedRevision: number,
  events: readonly {
    readonly type: string;
    readonly schemaVersion: number;
    readonly data: JsonValue;
  }[],
  fingerprintPayload: JsonValue = { action: commandId },
) {
  const command = asCommandId(`00000000-0000-7000-8000-${commandId.padStart(12, '0')}`);
  return {
    commandId: command,
    requestFingerprint: fingerprintCommand({
      streamId,
      commandType: 'TestCommand',
      commandSchemaVersion: 1,
      payload: fingerprintPayload,
    }),
    streamId,
    expectedRevision: asStreamRevision(expectedRevision),
    source: 'urn:eventspindle:sales',
    events,
    provenance: { sliceId: 'test-slice', sliceVersion: 1 },
  };
}

function event(orderId: string, status = 'Placed') {
  return { type: 'example.OrderEvent', schemaVersion: 1, data: { orderId, status } };
}

describe('memory event store', () => {
  it('reads a missing stream at revision zero without creating it', async () => {
    const store = makeStore();
    const result = await store.readStream(streamId);
    expect(result).toEqual({
      ok: true,
      value: { exists: false, streamId, revision: 0, events: [] },
    });
  });

  it('atomically appends events with consecutive CloudEvents stream revisions', async () => {
    const store = makeStore();
    const result = await store.append(
      request('1', 0, [event('123'), event('123', 'FulfillmentRequested')]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.receipt).toMatchObject({
      expectedRevision: 0,
      resultingRevision: 2,
      outcome: 'appended',
      eventRevisions: [1, 2],
    });
    expect(result.value.events.map((stored) => stored.streamrevision)).toEqual([1, 2]);
    expect(
      result.value.events.every((stored) => stored.commandid === result.value.receipt.commandId),
    ).toBe(true);
    expect(
      result.value.events.every(
        (stored) => stored.subject === streamId && stored.source === 'urn:eventspindle:sales',
      ),
    ).toBe(true);
    expect(
      result.value.events.every(
        (stored) => stored.id !== result.value.events[0]?.id || stored === result.value.events[0],
      ),
    ).toBe(true);
    const read = await store.readStream(streamId);
    expect(read.ok && read.value.revision).toBe(2);
  });

  it('returns an original receipt before checking its now-stale expected revision', async () => {
    const store = makeStore();
    const first = request('2', 0, [event('123')]);
    const original = await store.append(first);
    await store.append(request('3', 1, [event('123', 'FulfillmentRequested')]));
    const retried = await store.append(first);
    expect(original.ok && retried.ok).toBe(true);
    if (original.ok && retried.ok) {
      expect(retried.value.kind).toBe('previously-committed');
      expect(retried.value.receipt).toEqual(original.value.receipt);
      expect(retried.value.events).toEqual(original.value.events);
    }
  });

  it('reuses prepared event IDs after a known pre-commit failure', async () => {
    let first = true;
    const store = makeStore({
      beforeCommit: () => {
        if (first) {
          first = false;
          throw new Error('transaction rejected before commit');
        }
      },
    });
    const input = request('14', 0, [event('123')]);
    const failed = await store.append(input);
    const retried = await store.append(input);
    expect(failed).toMatchObject({ ok: false, error: { kind: 'TransientFailure' } });
    expect(retried.ok && retried.value.events[0]?.id).toBe('00000000-0000-7000-8000-000000000001');
  });

  it('rejects command ID reuse when the request fingerprint differs', async () => {
    const store = makeStore();
    await store.append(request('4', 0, [event('123')]));
    const conflict = await store.append(request('4', 0, [event('123')], { action: 'different' }));
    expect(conflict).toEqual({
      ok: false,
      error: {
        kind: 'IdempotencyKeyReuse',
        commandId: asCommandId('00000000-0000-7000-8000-000000000004'),
      },
    });
  });

  it('creates durable no-op receipts without reserving missing streams', async () => {
    const store = makeStore();
    const noop = request('5', 0, []);
    const original = await store.append(noop);
    await store.append(request('6', 0, [event('123')]));
    const replay = await store.append(noop);
    const read = await store.readStream(streamId);
    expect(original.ok && original.value.receipt.outcome).toBe('no-op');
    expect(replay.ok && replay.value.kind).toBe('previously-committed');
    expect(read.ok && read.value.revision).toBe(1);
  });

  it('records conditional no-op receipts on existing streams', async () => {
    const store = makeStore();
    await store.append(request('15', 0, [event('123')]));
    const noop = request('16', 1, []);
    const first = await store.append(noop);
    const replay = await store.append(noop);
    expect(first.ok && first.value.receipt).toMatchObject({
      outcome: 'no-op',
      expectedRevision: 1,
      resultingRevision: 1,
      eventIds: [],
    });
    expect(replay.ok && replay.value.kind).toBe('previously-committed');
    const read = await store.readStream(streamId);
    expect(read.ok && read.value.revision).toBe(1);
  });

  it('detects stale and concurrent first writes as stream conflicts', async () => {
    const store = makeStore();
    const [left, right] = await Promise.all([
      store.append(request('7', 0, [event('123')])),
      store.append(request('8', 0, [event('123')])),
    ]);
    expect([left, right].filter((result) => result.ok)).toHaveLength(1);
    expect(
      [left, right].filter((result) => !result.ok && result.error.kind === 'StreamConflict'),
    ).toHaveLength(1);
    const stale = await store.append(request('9', 0, [event('123')]));
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error).toMatchObject({ kind: 'StreamConflict', actualRevision: 1 });
  });

  it('does not commit invalid schemas or known pre-commit failures', async () => {
    const store = makeStore();
    const invalid = await store.append(
      request('10', 0, [
        { type: 'example.OrderEvent', schemaVersion: 1, data: { orderId: '123' } },
      ]),
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.kind).toBe('ValidationFailure');
    const read = await store.readStream(streamId);
    const receipt = await store.getCommandReceipt(
      asCommandId('00000000-0000-7000-8000-000000000010'),
    );
    expect(read.ok && read.value.exists).toBe(false);
    expect(receipt.ok && receipt.value).toBeNull();

    const failed = makeStore({
      beforeCommit: () => {
        throw new Error('transaction rejected');
      },
    });

    const outcome = await failed.append(request('11', 0, [event('123')]));
    const failedRead = await failed.readStream(streamId);
    expect(outcome).toMatchObject({ ok: false, error: { kind: 'TransientFailure' } });
    expect(failedRead.ok && failedRead.value.exists).toBe(false);
  });

  it('rejects event ID collisions without changing the stream', async () => {
    const duplicateId = asEventId('00000000-0000-7000-8000-000000000001');
    const store = makeStore({ idFactory: () => duplicateId });
    const first = await store.append(request('17', 0, [event('123')]));
    const second = await store.append(request('18', 1, [event('123', 'FulfillmentRequested')]));
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, error: { kind: 'ValidationFailure' } });
    const read = await store.readStream(streamId);
    expect(read.ok && read.value.revision).toBe(1);
  });

  it('reports an ambiguous commit and resolves it through the durable receipt on retry', async () => {
    let first = true;
    const store = makeStore({
      afterCommit: () => {
        if (first) {
          first = false;
          throw new Error('lost commit response');
        }
      },
    });
    const original = request('12', 0, [event('123')]);
    const unknown = await store.append(original);
    expect(unknown).toMatchObject({ ok: false, error: { kind: 'CommitOutcomeUnknown' } });
    const retry = await store.append({
      ...original,
      traceparent: 'not-a-valid-traceparent',
      expectedRevision: asStreamRevision(99),
    });
    expect(retry.ok && retry.value.kind).toBe('previously-committed');
    const stream = await store.readStream(streamId);
    expect(stream.ok && stream.value.revision).toBe(1);
  });

  it('preserves stable event identity and canonical profile metadata', async () => {
    const store = makeStore();
    const result = await store.append(request('13', 0, [event('123')]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.events[0]).toMatchObject({
      specversion: '1.0',
      id: '00000000-0000-7000-8000-000000000001',
      source: 'urn:eventspindle:sales',
      subject: streamId,
      time: '2026-10-27T03:41:18.615Z',
      datacontenttype: 'application/json',
      dataschema: eventSchemaUri,
      streamrevision: 1,
      commandid: asCommandId('00000000-0000-7000-8000-000000000013'),
      sliceid: 'test-slice',
      sliceversion: 1,
    });
  });
});
