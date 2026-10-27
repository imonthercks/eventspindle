# EventSpindle Standards Profile 0.1

Status: **accepted design direction** for v0.0.1; individual naming and wire-format mappings below are proposed conventions to validate in the architecture-contract gate. This is NOT a claim of conformance without executable tests.

## Canonical standards

| Concern | Baseline | v0.0.1 obligation |
|---|---|---|
| Domain event envelope | CloudEvents 1.0, structured JSON | Required `specversion`, `id`, `source`, `type`; profile additionally requires `subject`, `time`, `datacontenttype`, `dataschema`, `data` for emitted domain events |
| Event/command payload schema | JSON Schema Draft 2020-12 | Validate at creation/ingress; load versioned and hash-pinned schema artifacts; reject unknown schema |
| Event and command identity | UUIDv7 preferred, RFC 9562 | Generate once per logical event/command and reuse after retries; accept externally provided stable idempotency keys |
| Timestamp serialization | RFC 3339 UTC | Millisecond or greater precision when available, no claim of commit order |
| Distributed tracing | W3C Trace Context | Propagate `traceparent` (and supported `tracestate`) at boundaries; do not mistake trace identity for business causality |
| Telemetry | OpenTelemetry semantic conventions | Structured logs and spans for command / append / dispatch / projection / durable step |
| Published asynchronous contracts | AsyncAPI 3.x | Optional generated output, not a hand-maintained input nor a v0.0.1 blocker |
| HTTP APIs | OpenAPI 3.1 | Optional generated output; example routes can have a lightweight checked-in contract |
| AWS transport mapping | AWS EventBridge, DynamoDB Streams | Preserve original CloudEvent `source`+`id`; keep AWS transport IDs separate; adapters must not replace domain event identity |

CloudEvents is a *logical* event representation. DynamoDB `PK`/`SK`, `HEAD`, receipts and projected SQL checkpoints are persistence metadata, not extra fields of the standardized payload schema.

## Event identity and stream revision conventions

- **CloudEvents `source`:** stable URI-reference identifying the bounded-context producer, e.g. `urn:eventspindle:example-orders`. It is *not* stream-specific in v0.0.1.
- **`subject`:** canonical aggregate stream identity, e.g. `order/123`. Encode and validate consistently; prevent aliases for the same logical stream.
- **`id`:** stable event UUIDv7; uniqueness policy is global within an EventSpindle store (stronger than CloudEvents minimum `source`+`id` uniqueness).
- **`type`:** globally meaningful, reverse-DNS-style domain event name, e.g. `org.example.orders.OrderPlaced`.
- **`dataschema`:** immutable URI for the event payload's schema version. Prefer a resolvable version-pinned registry or repository URL; local tests may use an in-memory schema catalog mapping that URI to a checked-in file.
- **`time`:** occurrence timestamp according to a consistent producer rule; it is not a database commit-order token.
- **`recordedat`:** *optional EventSpindle extension* recording when the producer prepared an event for persistence; must not drive correctness or complete replay cursors.
- **`streamrevision`:** EventSpindle CloudEvents extension of integer type; begins at 1 and is assigned by the event-store append transaction, not by the decider.
- **`commandid`, `correlationid`, `causationid`:** optional/required according to profile: `commandid` required for command-created events; `correlationid` and `causationid` should be supplied when applicable; the latter points to the direct originating message/event, not to an AWS trace span.
- **`sliceid`, `sliceversion`:** provenance of the released slice implementation, independent of event schema version or deployment revision. Required for generated state-change slices in the demo.
- **CloudEvents Sequence extension:** **not adopted** in v0.0.1 because its ordering scope is `source`, while EventSpindle's `source` spans many streams. Use `streamrevision` + `subject` instead.

Extension context names are lowercase alphanumeric; extension values must be CloudEvents-compatible simple attribute types. Implementations must not put arbitrary JSON objects in extension attributes.

### Example stored event (illustrative IDs)

```json
{
  "specversion": "1.0",
  "id": "019a1234-5678-7abc-8def-0123456789ab",
  "source": "urn:eventspindle:example-orders",
  "type": "org.example.orders.OrderPlaced",
  "subject": "order/123",
  "time": "2026-10-26T15:30:00.123Z",
  "datacontenttype": "application/json",
  "dataschema": "https://schemas.example.org/orders/OrderPlaced/v1.json",
  "streamrevision": 1,
  "commandid": "019a1234-5678-7abc-8def-0123456789ac",
  "correlationid": "019a1234-5678-7abc-8def-0123456789ac",
  "sliceid": "place-order",
  "sliceversion": 1,
  "data": { "orderId": "123", "customerId": "customer-9" }
}
```

`recordedat`, `causationid` and `traceparent` are omitted when not known. The sample URL and identifiers are illustrations, not published resources.

## Source-to-storage and transport behavior

1. Domain decider emits a typed event **intent** (`type`, `schemaVersion`, `data`) without persistence metadata.
2. The append boundary validates payload against its immutable JSON Schema and assigns event identity once, reusing it across retries.
3. The DynamoDB atomic transaction persists event envelopes, stream HEAD revision, and command receipt. The materialized CloudEvents `streamrevision` must match the `EVT` sort key; retries must preserve the original envelope.
4. DynamoDB Streams consumer reads the stored envelope, preserving its `source`, `id`, `time`, `dataschema`, and version extensions when passing it to projection/automation.
5. The EventBridge adapter maps outer `source`/`detail-type`/`detail` as needed; the canonical CloudEvent is kept intact inside `detail` unless a defined CloudEvents-compatible mapping is implemented. EventBridge message IDs do not replace CloudEvents IDs.
6. DSQL projection receipts and checkpoints use `source`+`id` for deduplication and `subject`+`streamrevision` for per-stream gap detection. Store-specific row IDs are implementation details.

## Compatibility and versioning

- Versioned JSON Schemas remain immutable after release. Add a new schema for an incompatible payload; do not silently reinterpret historical events.
- A new slice version need not produce a new event schema version; slice and event schema lifecycles remain separate.
- Upcasting historical payloads is deferred, but missing/unsupported schema versions must fail clearly.
- The Event Modeling source format is pinned independently from the payload-schema dialect and from CDK package revisions.
- AWS EventBridge Schema Registry supports JSON Schema Draft 4/OpenAPI representations rather than canonical 2020-12; any registry conversion is an explicit generated **derived** artifact, with a compatibility test, not a change to the canonical schema.

## Contract tests required before adapter deployment

**SP-01** — Every persisted domain event validates as CloudEvents 1.0 and satisfies EventSpindle required-profile fields.

**SP-02** — `source`+`id` and the complete stored envelope remain identical across retry, replay, DynamoDB Streams dispatch and projection consumption.

**SP-03** — Invalid JSON payloads, unknown `dataschema`, or conflicting schema versions are rejected *before* append; no event and no receipt falsely indicate success.

**SP-04** — Two events from one command get unique immutable IDs and consecutive `streamrevision` values, while `commandid` and correlation propagate consistently.

**SP-05** — Timestamps are RFC 3339 UTC and ordering within a stream uses revisions even when timestamps are equal, skewed, or decreasing.

**SP-06** — Correlation, causation and W3C trace context survive local/AWS boundaries without conflating any identifiers.

**SP-07** — `source` is stable per bounded context, `subject` per aggregate stream; distinct aggregates cannot share storage identity accidentally.

**SP-08** — Versioned schema registry loads pinned 2020-12 documents and immutable released slice provenance without mutating v1 artifacts.

**SP-09** — EventBridge transport adapter preserves CloudEvent identity and handles its outer AWS delivery envelope separately.

**SP-10** — Optional AsyncAPI/OpenAPI generation is deterministic and nonblocking for v0.0.1; when enabled it references the same payload schema IDs.

## Authoritative references

- CloudEvents 1.0: https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md
- CloudEvents sequence extension: https://github.com/cloudevents/spec/blob/main/cloudevents/extensions/sequence.md
- JSON Schema 2020-12: https://json-schema.org/draft/2020-12
- RFC 9562 (UUIDv7): https://www.rfc-editor.org/rfc/rfc9562
- RFC 3339 time: https://www.rfc-editor.org/rfc/rfc3339
- W3C Trace Context: https://www.w3.org/TR/trace-context/
- OpenTelemetry: https://opentelemetry.io/docs/specs/semconv/
- AsyncAPI 3: https://www.asyncapi.com/docs/reference/specification/v3.0.0
- OpenAPI 3.1: https://spec.openapis.org/oas/v3.1.0
- EventBridge schema registry dialects: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-schema-create.html
