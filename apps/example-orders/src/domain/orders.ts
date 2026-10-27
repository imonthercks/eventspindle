import {
  encodeStreamId,
  fingerprintCommand,
  type Command,
  type CommandId,
  type Decider,
  type Decision,
  type JsonValue,
  type StreamId,
  type StreamRevision,
} from '@eventspindle/core';
import type {
  AppendResult,
  EventStore,
  EventStoreFailure,
  StoreOutcome,
} from '@eventspindle/eventstore';

export type OrderCommand =
  | { readonly type: 'PlaceOrder'; readonly orderId: string; readonly customerId: string }
  | { readonly type: 'RequestFulfillment'; readonly orderId: string }
  | { readonly type: 'ConfirmShipment'; readonly orderId: string };

function isOrderCommand(value: unknown): value is OrderCommand {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const command = value as Record<string, unknown>;
  if (typeof command.orderId !== 'string') return false;
  if (command.type === 'PlaceOrder') return typeof command.customerId === 'string';
  return command.type === 'RequestFulfillment' || command.type === 'ConfirmShipment';
}

function normalizeOrderCommand(command: OrderCommand): OrderCommand {
  return { ...command, orderId: command.orderId.normalize('NFC') };
}

function sliceForCommand(command: OrderCommand): string {
  switch (command.type) {
    case 'PlaceOrder':
      return 'place-order';
    case 'RequestFulfillment':
      return 'request-fulfillment';
    case 'ConfirmShipment':
      return 'confirm-shipment';
  }
}

export type OrderEvent =
  | {
      readonly type: 'org.eventspindle.sales.OrderPlaced';
      readonly schemaVersion: 1;
      readonly data: { readonly orderId: string; readonly customerId: string };
    }
  | {
      readonly type: 'org.eventspindle.sales.FulfillmentRequested';
      readonly schemaVersion: 1;
      readonly data: { readonly orderId: string };
    }
  | {
      readonly type: 'org.eventspindle.sales.ShipmentConfirmed';
      readonly schemaVersion: 1;
      readonly data: { readonly orderId: string };
    };

export type OrderStatus = 'Placed' | 'FulfillmentRequested' | 'Confirmed';

export interface OrderState {
  readonly orderId: string | null;
  readonly customerId: string | null;
  readonly status: OrderStatus | null;
}

function isJsonObject(value: JsonValue): value is { readonly [key: string]: JsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export type OrderDecision = Decision<OrderEvent>;

export type HandleOrderCommandInput = Command<OrderCommand>;

export type OrderCommandResult =
  | { readonly ok: true; readonly value: AppendResult }
  | {
      readonly ok: false;
      readonly error:
        | EventStoreFailure
        | { readonly kind: 'BusinessRejection'; readonly code: string; readonly message: string };
    };

export function initialOrderState(): OrderState {
  return { orderId: null, customerId: null, status: null };
}

export function evolveOrder(
  state: OrderState,
  event: { readonly type: string; readonly data: JsonValue },
): OrderState {
  switch (event.type) {
    case 'org.eventspindle.sales.OrderPlaced': {
      if (
        !isJsonObject(event.data) ||
        typeof event.data.orderId !== 'string' ||
        typeof event.data.customerId !== 'string'
      ) {
        throw new TypeError('Stored OrderPlaced event has invalid data');
      }
      const { orderId, customerId } = event.data;
      return { orderId, customerId, status: 'Placed' };
    }
    case 'org.eventspindle.sales.FulfillmentRequested':
      return { ...state, status: 'FulfillmentRequested' };
    case 'org.eventspindle.sales.ShipmentConfirmed':
      return { ...state, status: 'Confirmed' };
    default:
      throw new TypeError(`Unsupported order event: ${event.type}`);
  }
}

export function decideOrder(command: OrderCommand, state: OrderState): OrderDecision {
  if (!command.orderId) {
    return {
      ok: false,
      error: { code: 'InvalidOrderId', message: 'orderId must be a non-empty string' },
    };
  }
  switch (command.type) {
    case 'PlaceOrder':
      if (!command.customerId) {
        return {
          ok: false,
          error: { code: 'InvalidCustomerId', message: 'customerId must be a non-empty string' },
        };
      }
      if (state.status !== null) {
        return {
          ok: false,
          error: { code: 'OrderAlreadyExists', message: 'An order already exists with this ID' },
        };
      }
      return {
        ok: true,
        events: [
          {
            type: 'org.eventspindle.sales.OrderPlaced',
            schemaVersion: 1,
            data: { orderId: command.orderId, customerId: command.customerId },
          },
        ],
      };
    case 'RequestFulfillment':
      if (state.status !== 'Placed') {
        return {
          ok: false,
          error: {
            code: 'InvalidOrderTransition',
            message: 'Only a placed order can be fulfilled',
          },
        };
      }
      return {
        ok: true,
        events: [
          {
            type: 'org.eventspindle.sales.FulfillmentRequested',
            schemaVersion: 1,
            data: { orderId: command.orderId },
          },
        ],
      };
    case 'ConfirmShipment':
      if (state.status !== 'FulfillmentRequested') {
        return {
          ok: false,
          error: {
            code: 'InvalidOrderTransition',
            message: 'Only a fulfilled order can be confirmed',
          },
        };
      }
      return {
        ok: true,
        events: [
          {
            type: 'org.eventspindle.sales.ShipmentConfirmed',
            schemaVersion: 1,
            data: { orderId: command.orderId },
          },
        ],
      };
  }
}

export const orderDecider: Decider<OrderState, OrderCommand, OrderEvent> = {
  initialState: initialOrderState,
  evolve: evolveOrder,
  decide: decideOrder,
};

export class OrderCommandHandler {
  constructor(
    private readonly store: EventStore,
    private readonly source = 'urn:eventspindle:sales',
  ) {}

  async handle(input: HandleOrderCommandInput): Promise<OrderCommandResult> {
    if (!isOrderCommand(input.command)) {
      return {
        ok: false,
        error: { kind: 'ValidationFailure', message: 'Unsupported or malformed order command' },
      };
    }
    const command = normalizeOrderCommand(input.command);
    let streamId: StreamId;
    let requestFingerprint: ReturnType<typeof fingerprintCommand>;
    try {
      streamId = encodeStreamId({
        boundedContext: 'sales',
        aggregateType: 'order',
        aggregateId: command.orderId,
      });
      requestFingerprint = fingerprintCommand({
        streamId,
        commandType: command.type,
        commandSchemaVersion: 1,
        payload: command,
      });
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: 'ValidationFailure',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

    const receiptResult = await this.store.getCommandReceipt(input.commandId);
    if (!receiptResult.ok) return receiptResult;
    if (receiptResult.value !== null) {
      if (receiptResult.value.requestFingerprint !== requestFingerprint) {
        return { ok: false, error: { kind: 'IdempotencyKeyReuse', commandId: input.commandId } };
      }
      return this.append({
        ...input,
        requestFingerprint,
        streamId: receiptResult.value.streamId,
        expectedRevision: receiptResult.value.expectedRevision,
        events: [],
      });
    }

    const streamResult = await this.store.readStream(streamId);
    if (!streamResult.ok) return streamResult;
    const state = streamResult.value.events.reduce(evolveOrder, initialOrderState());
    const decision = decideOrder(command, state);
    if (!decision.ok) {
      return {
        ok: false,
        error: {
          kind: 'BusinessRejection',
          code: decision.error.code,
          message: decision.error.message,
        },
      };
    }
    return this.append({
      ...input,
      command,
      requestFingerprint,
      streamId,
      expectedRevision: streamResult.value.revision,
      events: decision.events,
    });
  }

  private async append(
    input: {
      readonly commandId: CommandId;
      readonly requestFingerprint: ReturnType<typeof fingerprintCommand>;
      readonly streamId: StreamId;
      readonly expectedRevision: StreamRevision;
      readonly events: readonly OrderEvent[];
      readonly command: OrderCommand;
    } & Pick<
      HandleOrderCommandInput,
      'correlationId' | 'causationId' | 'traceparent' | 'tracestate'
    >,
  ): Promise<OrderCommandResult> {
    const result = await this.store.append({
      ...input,
      source: this.source,
      provenance: { sliceId: sliceForCommand(input.command), sliceVersion: 1 },
    });
    return result.ok ? { ok: true, value: result.value } : result;
  }
}

export function orderStreamId(orderId: string): StreamId {
  return encodeStreamId({ boundedContext: 'sales', aggregateType: 'order', aggregateId: orderId });
}
