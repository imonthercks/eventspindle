# Step 4 — Projection adapter contract (accepted architecture, v0.0.1)

Status: **Design accepted; not yet implemented or integration-tested**. Supersedes the preliminary Step 4 proposals.

## Accepted decisions

1. Authoring is hybrid: **prefer pure `evolve` transformations**; allow database-native SQL handlers for specialized read models. A native handler must provide a pure in-memory reference implementation for v0.0.1 parity tests.
2. Checkpoints are **per projection instance and per event stream**, never a global event position. Event IDs are used to detect duplicate or inconsistent deliveries as appropriate.
3. Support **basic bounded manual offline rebuild** using authoritative DynamoDB event history. Not a zero-downtime online rebuild.

## Guarantees and scope

- Identity: `(boundedContext, projectionId, version, instanceId)` identifies projection state and its checkpoint namespace. Different versions cannot share mutable state/checkpoints; a separate instance can stage a rebuild of the same version.
- For each `(instance, streamId)`, applied revisions are contiguous, starting at `1`. Checkpoint `0` indicates no events applied for that stream.
- A duplicate event at revision `<= checkpoint` is ignored *after verifying consistency where possible*. An event with `revision == checkpoint + 1` may be applied. A larger revision yields a gap; retrieve the missing authoritative range first.
- A revision equal to the checkpoint but with a different event ID is **not** accepted as a harmless duplicate; detect/log it as integrity failure using last-event ID or authoritative lookup.
- Projection mutation(s) and corresponding checkpoint advance occur in **one adapter transaction**. An uncertain commit is reconciled by reading checkpoint, not blindly claiming success.
- A pure transformation must be deterministic, side-effect-free, and have no clock/random/network dependence. Side effects and output messages do not belong in projection transactions.
- For shared cross-stream read models, commutative/associative change operations or declared causal dependencies are required; otherwise a globally deterministic result cannot be guaranteed.
- Event envelope and payload validation occur before applying a projection. Unknown incompatible schema is a terminal failure until corrected/upcast.
- Target projection freshness is seconds, measured as lag/latency; it is not a contractual upper bound. Reads remain eventually consistent.

## Adapter boundary

`ProjectionStore.transact()` must provide atomic, isolated storage mutation plus checkpoint writes. A driver-specific `SqlProjectionTransaction` may extend the base transaction contract, but the domain-facing `PureProjection` must remain portable. Native SQL handlers must have a pure reference reducer and parity tests.

The `ProjectionProcessor` owns event shape/schema validation, checkpoint comparison, range repair and retry classification. The store owns its transaction, DSQL SQL execution (if enabled), and persisting the checkpoint within that transaction. Use a repository/command-style mutable state abstraction locally rather than expose DSQL driver objects to business code.

### Idempotency rule

For a stream checkpoint of `n`:

- event revision `n+1`: apply projection changes, set checkpoint to `n+1`, commit.
- event revision `<=n`: no new business effect; if same-revision ID mismatch detected, reject as integrity failure.
- event revision `>n+1`: return gap and fetch exactly `n+1...receivedRevision-1` from authoritative stream before retrying target event.

If checkpoint is ahead of a replay request, return duplicate; the checkpoint must not regress. Checkpoint existence, projection state, and version-scoped tables are maintained consistently.

### Event-ID deduplication

For a projection consuming one contiguous authoritative stream, checkpoint plus `lastEventId` is sufficient to avoid duplicate effects. If specialized native projections intentionally permit non-contiguous processing or fan-out, the adapter must opt into a durable `(projectionInstance, eventId)` receipt table *inside the same transaction*; this is outside the default contiguous algorithm in v0.0.1. An event ID should not map to two conflicting `(streamId,revision)` values.

### Cross-stream note

Each source stream has its own checkpoint. That is compatible with event store design without a global counter. A shared projection that overwrites a single field based on last-arrival-wins events across streams is NOT deterministic. The application must restrict it to order-independent updates or declare causal coordination.
