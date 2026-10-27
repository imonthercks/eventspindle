# Event Modeling scenarios and acceptance criteria

Use valid [Event Modeling JSON specification](https://github.com/dilgerma/event-modeling-spec); keep EventSpindle-specific version metadata in sidecar manifest. The following are implementation-level Given/When/Then specifications, not a claim that this Markdown is an exact upstream JSON schema instance.

## SC-01 — Place order (STATE_CHANGE)
Given no order stream exists, when `PlaceOrder(order-123,customer-9)` with command key `c-1` is handled, then one `OrderPlaced` event is appended at stream version 1 and returned. Replaying the stream yields Placed.

## SC-02 — Duplicate and invalid commands (STATE_CHANGE)
Given `c-1` already committed, when identical command with `c-1` is retried, then the original receipt is returned and no event is appended. Given same key with different payload, reject. Given an order already exists, when another independent `PlaceOrder` is received, reject as a domain conflict.

## SC-03 — Competing writers (STATE_CHANGE)
Given both writes observed version 1, when two independent updates append expecting version 1, then no more than one succeeds. A rejected writer does not mutate the stream.

## SV-01 — Project order status (STATE_VIEW)
Given `OrderPlaced v1`, when projected, then `order_status_v1` (or local map) has `Placed` and checkpoint 1. When `FulfillmentRequested v2` arrives it becomes `FulfillmentRequested` and checkpoint 2; when `ShipmentConfirmed v3` arrives it becomes `Confirmed` and checkpoint 3.

## SV-02 — Duplicate and out-of-order delivery (STATE_VIEW)
Given checkpoint 1, receiving v3 must not mark confirmed ahead of missing v2; retrieve/apply v2 first. Re-delivery of v2/v3 must not cause duplicate effects. Projection update and checkpoint/receipt commit atomically in DSQL.

## AU-01 — Order fulfillment timer (AUTOMATION)
Given `OrderPlaced` event, when `fulfill-order@1` starts, then wait ten seconds (virtual clock local; durable checkpointed wait in AWS) and invoke `RequestFulfillment` with a stable idempotency key; one logical `FulfillmentRequested` event is committed.

## AU-02 — Duplicate trigger / durable replay (AUTOMATION)
Given the same source event is delivered twice, when the automation is started twice or durable execution resumes, then command side effects are deduplicated and a second fulfillment event is not persisted.

## TR-01 — Shipment webhook (TRANSLATION)
Given provider message `{providerEventId:'ship-55',orderId:'order-123',status:'delivered'}`, when received, then create `ConfirmShipment` with command ID derived from provider and external event ID. The domain emits `ShipmentConfirmed`. Invalid/unknown status is rejected; repeated `ship-55` is idempotent.

## V-01 — Slice-version immutability
Given `fulfill-order@1` released with saved spec hash, when source snapshot is modified, model validation fails; to change business behavior, create `fulfill-order@2` snapshot separately. Side-by-side AWS deployments are **not required** for v0.0.1.

## LOCAL-01 — Local smoke
Create order; observe version 1 and projected Placed; advance clock ten seconds; observe version 2 and FulfillmentRequested; send shipment webhook; observe version 3 and Confirmed.

## AWS-01 — Cloud parity
Perform same scenario against deployed HTTP API; poll DSQL projection with a bounded wait; observe durable execution and event-store state. Async response timing may differ, business outcomes should not.

## Standards acceptance slice — SP-01 through SP-10

Use the Given/When/Then contracts in `STANDARDS-PROFILE.md`; include the following sample cases in the shared local/AWS scenarios:

- Given one `PlaceOrder`, when it commits, then the stored event validates against CloudEvents 1.0 and `OrderPlaced/v1` JSON Schema 2020-12, and the event's `subject` and `streamrevision` agree with its stream keys.
- Given an identical retry of the same command, when it returns, then `source`+`id`, event schema URI, timestamp, slice provenance and original receipt are unchanged.
- Given a clock-skewed event, when replayed, then processing uses `streamrevision` rather than chronological `time`.
- Given a translated shipping callback with trace context, when it causes `ConfirmShipment`, then business causation/correlation and W3C trace context remain separately identifiable.
