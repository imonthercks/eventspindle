# Step 2 — Delivery and causal processing contracts

## 1. Processing path

1. The existing Step 1 transaction conditionally appends 1–N events to one aggregate stream, advances its HEAD, and stores a command receipt. For nonempty event batches, **also insert one immutable outbox notification item in that same DynamoDB transaction**. This changes the DynamoDB adapter transaction composition but not the public event-store API.
2. Notification contains `notificationId`, `commandId`, `streamId`, `fromRevision`, `toRevision`, `eventIds`, creation time, and source slice provenance. The domain event rows, not notification payloads, remain authoritative.
3. DynamoDB Streams `NEW_IMAGE` (or `NEW_AND_OLD_IMAGES` if justified) forwards only new outbox notification items to a standard Lambda dispatcher / projection worker via filtered event-source mapping. Filter on item type and `INSERT`, with explicit integration testing of the chosen Stream image shape.
4. A projection worker loads the actual event range from the event store, applying strictly increasing versions **per stream** to its projection adapter. It does not assume outbox items for one stream arrive in order. Duplicate and delayed notifications are expected.
5. Another dispatcher starts version-pinned Lambda Durable Function executions for automation triggers; a deterministic execution name derived from `(slice id, slice version, trigger event id)` is used for each logically triggered automation.
6. Successful handling means the projection transaction commits or the durable execution start is acknowledged as idempotently accepted. Stream delivery alone is not success.

The first release may use two native event-source mappings (projection and automation) filtered to outbox items. Avoid a general custom event-routing service unless evidence justifies it. If Lambda concurrency or cross-service coupling necessitates SQS/EventBridge later, keep the public ports unchanged.

## 2. Processing semantics

**Ordering:** Events in `readStream` always follow contiguous `streamrevision`; no ordering is promised across different streams. `recordedat`/CloudEvents `time` are informational and do not provide a complete global cursor. An outbox notification covers one contiguous range but delivery of different outbox records can be out of order.

**Delivery:** At least once; notifications may duplicate, reorder across items, or arrive late. Lambda event-source mapping checkpointing is a transport concern, not a projection completion record.

**No-op commands:** A valid no-op persists its Step 1 receipt and creates **no outbox notification**.

**Projection update:** Each adapter guarantees atomic application of its business mutation(s) and durability of its checkpoint for an individual `(projection id, slice version, stream id)`; if it cannot guarantee this, it cannot claim `atomicCheckpoint` capability. For DSQL, checkpoint and changed read-model rows must be committed in one DSQL transaction, guarded by expected checkpoint version.

**Duplicate:** If `incoming.revision <= checkpoint`, ignore only after verifying same event identity where necessary; a mismatching identity at a previously applied revision indicates corruption. When a batch overlaps current progress, apply only missing events.

**Gap:** When the first new event is revision `checkpoint + k`, `k > 1`, fetch missing versions from DynamoDB. Do not commit later events until earlier revisions have been applied. Missing events are recoverable errors, not success. A stream without checkpoint begins at revision zero.

**Cross-stream projection:** V0.0.1 demonstrates independent per-stream order-summary views; a general cross-stream strongly consistent, order-sensitive reduction is out of scope. Event-ID deduplication alone is not sufficient for all cross-stream processors; a future adapter capability must define it.

**Freshness:** Target seconds under healthy conditions. Measure `now - oldest unprocessed notification time` and projection-lag distribution. Never claim bounded staleness or synchronous read-your-writes solely because the nominal target is seconds.

**Causality:** CloudEvents `correlationid` and `causationid` document relationships, but no physical delivery order. A durable process explicitly waits for an event, validates required domain state against authoritative sources, and issues stable-id commands. Its correlation subscriptions/callback registration and results must be authenticated, validated, and deduplicated; no generic `waitForEvent` primitive is assumed to exist in AWS itself. How callbacks are wired is a narrow v0.0.1 implementation decision.

**Automation versioning:** Immutable slice versions; new starts routed to current active version; existing durable executions stay on the qualified, pinned implementation version. Lifecycle resources are not deleted while referenced.

## 3. Exactly-once claims

Do **not** claim exactly-once delivery or exactly-once step execution. Claim only:
- **Event append effect:** at most one commit per stable command ID/fingerprint as established in Step 1.
- **DSQL projection effect:** exactly one logical committed effect per `(projection, slice version, stream revision)` assuming retry/reconciliation eventually delivers the event and the adapter transaction succeeds.
- **Durable automation effects:** stable execution-start identity and idempotent downstream commands; AWS durable steps can retry until checkpoints complete.

These are conditional guarantees, not global end-to-end exactly-once execution.

## 4. Scope boundaries

- Within 24 hours, native Streams retries and retained failure context can support repair. Outages beyond retention require recovery directly from authoritative event storage, plus **complete stream discovery**, which is deliberately not guaranteed in v0.0.1.
- Manual reconciliation is **for a known stream or captured failed notification**, not a claim of complete replay from a timestamp across all streams. Never mark a projection globally complete based only on timestamp-index scans.
- Strict global chronological processing, full historical/live handoff, automatic backfill and multi-aggregate state-view consistency are deferred.
