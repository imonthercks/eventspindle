import {
  asCommandId,
  asRequestFingerprint,
  asStreamId,
  asStreamRevision,
  buildStoredEvent,
  createRfc3339Utc,
  createUuidV7Factory,
  decodeStreamId,
  isTraceparent,
  type EventId,
  type JsonValue,
  type PayloadSchemaRegistry,
  type StoredCloudEvent,
} from '@eventspindle/core';
import type {
  AppendRequest,
  AppendResult,
  CommandReceipt,
  EventStore,
  EventStoreFailure,
  StoreOutcome,
  StreamRead,
} from '@eventspindle/eventstore';

export const moduleName = '@eventspindle/eventstore-memory' as const;

export interface MemoryEventStoreOptions {
  readonly schemas: PayloadSchemaRegistry;
  readonly idFactory?: () => EventId;
  readonly now?: () => Date;
  readonly beforeCommit?: () => void | Promise<void>;
  readonly afterCommit?: () => void | Promise<void>;
}

function failure<T>(error: EventStoreFailure): StoreOutcome<T> {
  return { ok: false, error };
}

function success<T>(value: T): StoreOutcome<T> {
  return { ok: true, value };
}

function immutableJson<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) immutableJson(child);
    Object.freeze(value);
  }
  return value;
}

function copyEvent<T extends JsonValue>(event: StoredCloudEvent<T>): StoredCloudEvent<T> {
  return immutableJson(JSON.parse(JSON.stringify(event)) as StoredCloudEvent<T>);
}

function copyReceipt(receipt: CommandReceipt): CommandReceipt {
  return Object.freeze({
    ...receipt,
    eventIds: Object.freeze([...receipt.eventIds]),
    eventRevisions: Object.freeze([...receipt.eventRevisions]),
  });
}

export class MemoryEventStore implements EventStore {
  private readonly heads = new Map<string, number>();
  private readonly streams = new Map<string, StoredCloudEvent[]>();
  private readonly receipts = new Map<string, CommandReceipt>();
  private readonly eventIds = new Set<string>();
  private readonly prepared = new Map<
    string,
    {
      readonly requestFingerprint: string;
      readonly expectedRevision: number;
      readonly events: readonly StoredCloudEvent[];
      readonly timestamp: Date;
    }
  >();
  private readonly idFactory: () => EventId;
  private readonly now: () => Date;
  private lockTail: Promise<void> = Promise.resolve();

  constructor(private readonly options: MemoryEventStoreOptions) {
    this.idFactory = options.idFactory ?? createUuidV7Factory();
    this.now = options.now ?? (() => new Date());
  }

  async readStream(streamId: AppendRequest['streamId']): Promise<StoreOutcome<StreamRead>> {
    return this.withLock(() => {
      try {
        decodeStreamId(streamId);
      } catch (error) {
        return failure({ kind: 'ValidationFailure', message: messageOf(error) });
      }
      const revision = this.heads.get(streamId) ?? 0;
      const events = (this.streams.get(streamId) ?? []).filter(
        (event) => event.streamrevision <= revision,
      );
      if (
        events.length !== revision ||
        events.some((event, index) => event.streamrevision !== index + 1)
      ) {
        return failure({
          kind: 'InfrastructureFailure',
          cause: new Error(`Non-contiguous event history for ${streamId}`),
        });
      }
      return success({
        exists: revision > 0,
        streamId,
        revision: asStreamRevision(revision),
        events: Object.freeze(events.map(copyEvent)),
      });
    });
  }

  async getCommandReceipt(
    commandId: AppendRequest['commandId'],
  ): Promise<StoreOutcome<CommandReceipt | null>> {
    return this.withLock(() => {
      try {
        asCommandId(commandId);
      } catch (error) {
        return failure({ kind: 'ValidationFailure', message: messageOf(error) });
      }
      const receipt = this.receipts.get(commandId);
      return success(receipt === undefined ? null : copyReceipt(receipt));
    });
  }

  async append(input: AppendRequest): Promise<StoreOutcome<AppendResult>> {
    return this.withLock(async () => {
      let commandId: AppendRequest['commandId'];
      let fingerprint: AppendRequest['requestFingerprint'];
      try {
        commandId = asCommandId(input.commandId);
        fingerprint = asRequestFingerprint(input.requestFingerprint);
      } catch (error) {
        return failure({ kind: 'ValidationFailure', message: messageOf(error) });
      }

      const oldReceipt = this.receipts.get(commandId);
      if (oldReceipt !== undefined) {
        if (
          oldReceipt.requestFingerprint !== fingerprint ||
          oldReceipt.streamId !== input.streamId
        ) {
          return failure({ kind: 'IdempotencyKeyReuse', commandId });
        }
        return success(this.resultFromReceipt(oldReceipt, 'previously-committed'));
      }

      let streamId: AppendRequest['streamId'];
      let expectedRevision: number;
      try {
        streamId = asStreamId(input.streamId);
        expectedRevision = asStreamRevision(input.expectedRevision);
        if (!input.source || !/^[a-z][a-z\d+.-]*:/i.test(input.source)) {
          throw new TypeError('Event source must be a stable absolute URI reference');
        }
        if (
          !input.provenance.sliceId ||
          !Number.isSafeInteger(input.provenance.sliceVersion) ||
          input.provenance.sliceVersion < 1
        ) {
          throw new TypeError('Event slice provenance is invalid');
        }
        if (input.traceparent !== undefined && !isTraceparent(input.traceparent)) {
          throw new TypeError('traceparent is not a valid W3C traceparent');
        }
        if (input.events.length + expectedRevision > Number.MAX_SAFE_INTEGER) {
          throw new RangeError('Append exceeds the maximum safe stream revision');
        }
      } catch (error) {
        return failure({ kind: 'ValidationFailure', message: messageOf(error) });
      }

      const currentRevision = this.heads.get(streamId) ?? 0;
      if (currentRevision !== expectedRevision) {
        return failure({
          kind: 'StreamConflict',
          streamId,
          expectedRevision: asStreamRevision(expectedRevision),
          actualRevision: asStreamRevision(currentRevision),
        });
      }

      let prepared = this.prepared.get(commandId);
      if (
        prepared &&
        (prepared.requestFingerprint !== fingerprint ||
          prepared.expectedRevision !== expectedRevision)
      ) {
        this.prepared.delete(commandId);
        prepared = undefined;
      }

      if (!prepared) {
        let timestamp: Date;
        let storedEvents: StoredCloudEvent[];
        try {
          timestamp = this.now();
          if (!Number.isFinite(timestamp.getTime())) throw new TypeError('Invalid event timestamp');
          storedEvents = input.events.map((pending, index) =>
            buildStoredEvent(
              pending,
              {
                source: input.source,
                streamId,
                revision: expectedRevision + index + 1,
                commandId,
                eventId: this.idFactory(),
                time: timestamp,
                provenance: input.provenance,
                ...(input.correlationId === undefined
                  ? {}
                  : { correlationId: input.correlationId }),
                ...(input.causationId === undefined ? {} : { causationId: input.causationId }),
                ...(input.traceparent === undefined ? {} : { traceparent: input.traceparent }),
                ...(input.tracestate === undefined ? {} : { tracestate: input.tracestate }),
              },
              this.options.schemas,
            ),
          );
        } catch (error) {
          return failure({ kind: 'ValidationFailure', message: messageOf(error) });
        }
        if (
          new Set(storedEvents.map((event) => event.id)).size !== storedEvents.length ||
          storedEvents.some((event) => this.eventIds.has(event.id))
        ) {
          return failure({
            kind: 'ValidationFailure',
            message: 'Event IDs must be unique in the store',
          });
        }
        prepared = {
          requestFingerprint: fingerprint,
          expectedRevision,
          events: storedEvents.map(copyEvent),
          timestamp,
        };
        this.prepared.set(commandId, prepared);
      }
      const { timestamp, events: storedEvents } = prepared;

      try {
        await this.options.beforeCommit?.();
      } catch (error) {
        return failure({ kind: 'TransientFailure', cause: error });
      }

      const resultingRevision = expectedRevision + storedEvents.length;
      const receipt: CommandReceipt = copyReceipt({
        commandId,
        requestFingerprint: fingerprint,
        streamId,
        expectedRevision: asStreamRevision(expectedRevision),
        resultingRevision: asStreamRevision(resultingRevision),
        outcome: storedEvents.length === 0 ? 'no-op' : 'appended',
        eventIds: storedEvents.map((event) => event.id),
        eventRevisions: storedEvents.map((event) => event.streamrevision),
        committedAt: createRfc3339Utc(timestamp),
      });

      if (storedEvents.length > 0) {
        this.streams.set(streamId, [
          ...(this.streams.get(streamId) ?? []),
          ...storedEvents.map(copyEvent),
        ]);
        this.heads.set(streamId, resultingRevision);
        storedEvents.forEach((event) => this.eventIds.add(event.id));
      }
      this.receipts.set(commandId, receipt);
      this.prepared.delete(commandId);
      try {
        await this.options.afterCommit?.();
      } catch {
        return failure({ kind: 'CommitOutcomeUnknown', commandId });
      }
      return success({
        kind: 'committed',
        receipt: copyReceipt(receipt),
        events: Object.freeze(storedEvents.map(copyEvent)),
      });
    });
  }

  private resultFromReceipt(receipt: CommandReceipt, kind: AppendResult['kind']): AppendResult {
    const streamEvents = this.streams.get(receipt.streamId) ?? [];
    const events = receipt.eventRevisions.map((revision) => streamEvents[revision - 1]);
    if (events.some((event) => event === undefined)) {
      throw new Error(`Receipt ${receipt.commandId} references missing stream events`);
    }
    return {
      kind,
      receipt: copyReceipt(receipt),
      events: Object.freeze(events.map((event) => copyEvent(event!))),
    };
  }

  private async withLock<T>(operation: () => T | Promise<T>): Promise<T> {
    const previous = this.lockTail;
    let release!: () => void;
    this.lockTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
