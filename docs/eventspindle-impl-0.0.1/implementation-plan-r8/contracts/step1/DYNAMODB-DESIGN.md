# DynamoDB implementation design — v0.0.1

## Layout

One table `EventSpindleStore` with keys `PK` and `SK`, both strings. No GSI or global counter required for aggregate reads. Prefixes distinguish item kinds:

| PK | SK | Meaning |
|---|---|---|
| `STREAM#sales/order/order-123` | `HEAD` | revision 4, aggregate identity, creation timestamp |
| `STREAM#sales/order/order-123` | `EVT#00000000000000000001` | CloudEvents envelope for event revision 1 |
| `STREAM#sales/order/order-123` | `EVT#00000000000000000002` | Event revision 2 |
| `COMMAND#<uuid>` | `RECEIPT` | immutable request fingerprint and committed outcome |

Use fixed-width revisions for lexical sorting; width supports the numeric contract. Ensure no user-controlled `PK` prefix collision by canonical stream encoding. Receipt IDs are store-global, not per-stream. A command receipt's item is distinct from the stream HEAD. No-op command on absent stream creates only a receipt (see special condition below).

**Optional later:** a separate head metadata index / work-discovery registry, or timestamp-bucketed discovery. Neither is in the command transaction for v0.0.1.

## Transaction action sets

### New stream, N ≥ 1 events

1. `Put` HEAD with `attribute_not_exists(PK)` and revision `N`.
2. `Put` N unique event items (conditional nonexistence), with stream revisions 1...N.
3. `Put` receipt with `attribute_not_exists(PK)`, storing original outcome and fingerprint.

### Existing stream at revision R, N ≥ 1 events

1. `Update` HEAD with `ConditionExpression #revision = :expected` and `SET #revision = :new` where `:new=R+N`.
2. `Put` N event items, conditional nonexistence.
3. `Put` receipt, conditional nonexistence.

### Valid no-op against an existing stream

1. `ConditionCheck` HEAD revision equals expected R.
2. `Put` no-op receipt conditional nonexistence.

### Valid no-op against a missing stream, expected R=0

1. `ConditionCheck` HEAD `attribute_not_exists(PK)`.
2. `Put` no-op receipt conditional nonexistence. No HEAD is inserted.

**DynamoDB caveat:** TransactWriteItems rejects multiple actions against *the same item*. In no-op transactions, the HEAD `ConditionCheck` and receipt `Put` target separate items. In eventful appends, the HEAD is updated or inserted exactly once; do not add a separate `ConditionCheck` on HEAD in the same transaction. <https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html>

Transaction limits: <=100 distinct actions, <=4 MB total action item data, <=400 KB per item. For the accepted single-stream scope, refuse batches exceeding limits before calling DynamoDB. Single-region transactional atomicity only.

## Idempotency and retries

- Strongly consistent `GetItem` of command receipt before command execution when possible, plus transactionally conditional receipt `Put` for correctness.
- Receipt fingerprint mismatch -> `IdempotencyKeyReuse`.
- Same-ID concurrent appends: one transaction commits; losing transaction rereads receipt, returns the same result if fingerprint matches.
- Use optional DynamoDB `ClientRequestToken` on retries of the **exact same `TransactWriteItems` arguments**. AWS idempotency token window is 10 minutes, so token is *not* the durability contract; the receipt is. Regenerating timestamps or IDs while reusing a client token will cause parameter mismatch.
- On transaction cancellation, check receipt; if absent, strongly read HEAD. Distinguish changed expected revision from overlapping transient conflicts. Retry cancellation only when classification justifies it.
- An unresolved timeout around COMMIT remains `CommitOutcomeUnknown`, not `StreamConflict` or `TransactionFailed` by assumption. Repeat strongly consistent receipt lookup with bounded backoff; if still unknown, the caller can safely retry the same command ID/fingerprint.
- `recordedat` is set before transaction; not authoritative commit time.

## Atomicity, observability and access control

Head/event/receipt actions are all within the same DynamoDB transaction and same AWS Region. Enable DynamoDB Streams (`NEW_IMAGE`) for later async projections, but accept that records from one transaction may arrive separately/interleaved and be redelivered. Tests may read event history directly. Least-privilege IAM: GetItem, Query, TransactWriteItems on table, plus stream permissions for the projection worker only. Emit metrics for conflict classifications, retries, unknown outcomes and consumed capacity.

## Read correctness caveat

Strongly read HEAD R. Query only event SK <= EVT#R with `ConsistentRead=true` and pagination, validating contiguous 1...R. This is not an atomic snapshot of multiple items (DynamoDB Query is read-committed), but immutable event history and the captured bound allow a stable prefix provided all committed appends create all records transactionally. If incomplete, fail/retry; never replay a partial stream as complete.

## Safety of receipt after later stream changes

Receipt stores the **resulting revision for the command**, not the current stream head. On replay, return its saved outcome; never compute a new resulting revision from the current head. Event references, IDs, and/or envelopes may be dereferenced by those saved positions. This is especially important for the no-op on a nonexistent stream, which can be replayed after another command later creates the stream.
