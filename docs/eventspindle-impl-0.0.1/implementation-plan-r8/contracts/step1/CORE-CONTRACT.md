# Normative core event-store contracts — v0.0.1

## C-01 Canonical stream identity

A stream is the history of exactly one aggregate instance in exactly one bounded context. Its **logical** identity is the tuple `(boundedContext, aggregateType, aggregateId)`; all components are non-empty, case-sensitive, Unicode NFC-normalized strings. Applications must not create multiple spellings for one logical entity. `streamId` is a canonical opaque string made by percent-encoding each normalized component as a URI path segment, joining them with `/`, e.g. `sales/order/order-123`. Slashes inside IDs are encoded (`/` -> `%2F`); literal `%` is escaped. A canonical parsing/round-trip test is required. No automatic lowercasing or heuristic pluralization.

The CloudEvents `source` identifies the producing bounded context (stable URI-reference, e.g. `urn:eventspindle:sales`). The CloudEvents `subject` equals the canonical stream ID; `streamrevision` is an EventSpindle CloudEvents extension, not the CloudEvents Sequence extension. Changing a slice version does not change stream identity.

**Scope:** one AWS account and Region, one authoritative write Region, and one event store namespace in v0.0.1. Cross-tenant uniqueness, migration between bounded contexts, aliases and active-active multi-Region writes are deferred.

## C-02 Revision semantics

- A missing stream is represented to callers by `{exists:false, revision:0, events:[]}`. This is a *read result*, not a persisted empty HEAD.
- First **nonempty** successful append expects revision 0, inserts HEAD and EVT#000000000001... in the same transaction. HEAD revision equals highest committed event revision.
- Any nonempty append on an existing stream expects its exact current revision `N`; `k` events get revisions `N+1 ... N+k`, and HEAD becomes `N+k`.
- Revision numbers are signed-safe nonnegative integers represented in TypeScript as `number`, validated with `Number.isSafeInteger`, never float; event revisions start at 1. Rev > MAX_SAFE_INTEGER is rejected (future bigint support would require a versioned API change).
- Stream revisions never decrease, skip numbers, or change on a no-op.
- `StreamConflict` is returned for a stale expected revision; absent stream expecting >0 and existing stream expecting 0 are conflicts. Business decisions are **not** automatically rerun on stream conflict.
- New stream + zero events **does not create HEAD**. A durable command receipt can record the successful no-op against a missing stream with expected revision 0. This does not reserve stream identity; a later different command can create it. Replay of the no-op command returns the original receipt even after the stream subsequently exists.

## C-03 Commands, fingerprints and receipts

`commandId` is a caller-stable UUID (UUIDv7 preferred) and unique in the store namespace. The command API defines a canonical fingerprint over *immutable request meaning*: stream identity, command type, command payload, and command schema/contract version (plus tenant namespace if added). Use canonical JSON serialization (RFC 8785 JCS recommended; choose/test a library) followed by SHA-256; exclude transient transport headers, clocks, retries and trace context. Store a representation such as `sha256:<lowercase hex>`. Define JSON number handling and JSON-only payload constraints; don't hash arbitrary JS objects directly.

A receipt is immutable and includes command ID, request fingerprint, stream ID, expected revision, resulting revision, outcome (`appended` | `no-op`), stable IDs and event revisions of emitted events, and creation timestamp. Store sufficient information to return the *same logical result* after retry; retrieving events by stored revisions is valid if event history remains authoritative and immutable. No receipt for business rejection or pre-validation failure in v0.0.1 (these may be re-evaluated on retry).

- First check: if receipt exists + matching fingerprint, return prior result, **before** treating the caller's old expected revision as stale.
- Receipt exists + different fingerprint -> `IdempotencyKeyReuse` even if a stream changed.
- Two simultaneous identical commands -> at most one receipt/effect; loser resolves by strongly consistent receipt read.
- Receipt has no TTL in v0.0.1; expiry introduces an explicit retention policy later.
- No-op receipts are committed transactionally with a condition on current HEAD state (or its absence); the condition must still be true at commit.

## C-04 Atomic append and metadata

A successful nonempty append atomically persists HEAD, all event items, and one command receipt. All event IDs, CloudEvents envelope attributes (except revision assigned from expected revision), and fingerprints are created/validated prior to transaction submission and reused for transient network retries. On a business re-decision after a rejected stale command, use a **new logical command** or an explicit caller-level retry contract; do not reuse a committed command ID with changed request meaning.

Event envelope follows CloudEvents 1.0 structured JSON with required EventSpindle profile fields: `specversion`, `id`, `source`, `type`, `subject`, `time`, `datacontenttype`, `dataschema`, `data`, plus `streamrevision`, `commandid`, `sliceid`, `sliceversion`; correlation/causation/tracing where available. JSON Schema 2020-12 validation occurs before persistence. `time` and optional `recordedat` do not provide a globally ordered commit cursor. Event IDs are unique per event and must not change upon retry or transport delivery.

No global version counter, global commit order, atomic multi-stream appends, or transactional DSQL read-model writes in v0.0.1. DynamoDB Streams is a delivery mechanism and is not a source of truth for historical events.

## C-05 Failure categories and explicit policy

- `ValidationFailure`: invalid command/event payload, identity, revision, schema or fingerprint before persistence.
- `BusinessRejection`: decider rejected a command; no receipt or events.
- `StreamConflict`: expected stream revision is stale (includes concurrent creation and no-op conditional check failure).
- `IdempotencyKeyReuse`: same command ID, different request fingerprint.
- `TransientFailure`: throttling, overlapping transactions, network failure *known* to have made no commit; bounded backoff may retry **same prepared transaction** after checking receipt where appropriate.
- `CommitOutcomeUnknown`: timeout/network loss while or after committing where outcome cannot be inferred; resolve via strongly consistent command receipt reads and retriable same prepared transaction, otherwise surface unknown without claiming failure.
- `InfrastructureFailure`: unrecoverable storage/configuration issue.

**Priority:** Check existing receipt first; after transaction cancellation, inspect receipt first (it may be a duplicate race), then inspect stream HEAD to distinguish stale revision from retryable DynamoDB transaction conflict. Cancellation codes alone are not enough to infer domain cause. Retry transient conflicts only within a bounded policy; never return success without confirming a receipt/commit.

## C-06 Read semantics

`readStream` uses a strongly consistent HEAD read and a strongly consistent paginated query of event items, constrained to the captured HEAD revision. Because a DynamoDB Query is not an atomic multi-item snapshot, the adapter must verify that revisions 1...N are all present and contiguous and retry/fail explicitly if an incomplete page set is observed. Concurrent appends above N do not alter the captured prefix. Return a typed missing-stream result, not a synthesized persisted HEAD.

An in-memory store must emulate transactional atomicity and duplicate command arbitration even under concurrent async callers (e.g. a mutex protecting both stream state and command receipt across the mutation). Avoid introducing a *production* global lock; in-memory synchronization is only for the test adapter.

## C-07 Explicitly deferred

Full multi-stream atomic commits; global positions; globally complete time-based replay; cross-Region active-active writes; permanent transport ordered delivery; replay after Streams retention; snapshots; command receipt garbage collection; legacy schema upcasting; projection transactional correctness (separate architecture-gate section).
