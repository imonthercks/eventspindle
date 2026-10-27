/** EventSpindle Step 2 — supplemental interfaces, independent of AWS SDK. */
export type Id = string;
export type Revision = number;
export type ISOTime = string;

export interface OutboxNotification {
  readonly notificationId: Id;
  readonly commandId: Id;
  readonly streamId: string;
  readonly fromRevision: Revision;
  readonly toRevision: Revision;
  readonly eventIds: readonly Id[];
  readonly recordedAt: ISOTime; // informational, not globally commit-ordered
  readonly slice: Readonly<{ id: string; version: number }>;
}

export interface EventReference {
  readonly eventId: Id;
  readonly streamId: string;
  readonly streamRevision: Revision;
  readonly recordedAt: ISOTime;
  readonly correlationId?: Id;
  readonly causationId?: Id;
}

export interface EventRangeReader<Event> {
  /** Must return contiguous versions or a typed gap error; never synthesize missing events. */
  readRange(input: {
    streamId: string;
    afterRevision: Revision;
    throughRevision: Revision;
  }): Promise<readonly Event[]>;
}

export type ApplyResult =
  | { readonly kind: 'applied'; readonly throughRevision: Revision }
  | { readonly kind: 'duplicate'; readonly throughRevision: Revision }
  | { readonly kind: 'gap'; readonly expectedRevision: Revision; readonly receivedRevision: Revision };

export type OrderingRequirement = 'per-stream' | 'commutative';

export interface ProjectionCapabilities {
  readonly atomicCheckpoint: boolean;
  readonly ordering: readonly OrderingRequirement[];
  readonly supportsVersionIsolation: boolean;
}

export interface ProjectionAdapter<Event> {
  readonly capabilities: ProjectionCapabilities;
  /** Must atomically apply business mutation AND update checkpoint on success. */
  applyEvent(input: {
    projectionId: string;
    projectionVersion: number;
    event: Event;
  }): Promise<ApplyResult>;
  getCheckpoint(input: {
    projectionId: string;
    projectionVersion: number;
    streamId: string;
  }): Promise<Revision>;
}

export interface ProjectionProcessor {
  /** Notification is only a hint to load authoritative event history. */
  process(notification: OutboxNotification): Promise<
    | { readonly kind: 'processed'; readonly revision: Revision }
    | { readonly kind: 'retryable-failure'; readonly code: string }
    | { readonly kind: 'permanent-failure'; readonly code: string }
  >;
  reconcileKnownStream(input: {
    projectionId: string;
    projectionVersion: number;
    streamId: string;
    throughRevision?: Revision;
  }): Promise<{ readonly revision: Revision }>;
}

export interface AutomationTrigger {
  readonly sliceId: string;
  readonly sliceVersion: number;
  readonly triggeringEventId: Id;
  readonly correlationId: Id;
  readonly event: EventReference;
}
export interface AutomationStarter {
  /** Equivalent duplicate trigger must reattach/report already-started, not create new execution. */
  start(trigger: AutomationTrigger): Promise<
    | { readonly kind: 'started' | 'already-started'; readonly executionId: string }
    | { readonly kind: 'conflicting-payload' }
  >;
}
export interface CausalWait {
  /** Must handle an event that was committed before wait registration. */
  waitFor(input: {
    executionId: string;
    correlationId: Id;
    expectedEventType: string;
    timeoutSeconds: number;
  }): Promise<EventReference>;
}

export interface DeliveryTelemetry {
  recordProjectionLag(input: { projectionId: string; elapsedMs: number }): void;
  recordRetry(input: { component: string; code: string }): void;
  recordUnrecoverable(input: { streamId?: string; notificationId?: string; cause: string }): void;
}
