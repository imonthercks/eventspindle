# In-memory parity and bounded offline rebuild

## Parity test harness

Run one domain event fixture set through:

- Pure projection reducer backed by `InMemoryProjectionStore` (baseline).
- DSQL storage of the same pure projection changes.
- For native SQL handlers: the native DSQL handler and its **mandatory pure reference reducer**.

Compare final canonical projected rows/objects and per-stream checkpoint revisions. Do not compare incidental commit order or database-generated timestamps. Test duplicates, gaps, out-of-order deliveries, concurrent same-stream deliveries, serialization retries, and unknown commit recovery. Run in-memory unit/contract tests in CI; run DSQL integration tests against a disposable real DSQL cluster in AWS. A local PostgreSQL container is not a substitute for DSQL's OCC behavior.

## Explicit bounded manual rebuild

1. Operator chooses projection version/instance, a **stable explicit stream list**, and per-stream inclusive high-watermarks captured while writes are paused or otherwise verified stable.
2. Create new empty projection instance: new checkpoint namespace and isolated state/table partition. Do not reset a serving projection.
3. Read each stream's authoritative events from revisions `1..highWatermark`, validate and apply sequentially. Different streams may be interleaved only if projection operations are order-independent, or processing order is specified by causal dependencies.
4. Fail closed if authoritative history is missing, incompatible, or checkpoints have gaps; do not silently skip.
5. Compare event counts, checkpoint values and expected read-model state with reference fixtures; produce report.
6. Leave rebuilt instance non-serving. v0.0.1 **does not** implement continuous catch-up, point-in-time snapshot handshake, or atomic traffic cutover.

## Boundaries

- Rebuilding history across all streams is not promised; stream discovery can be a supplied manifest/catalog and must be complete for the selected scope.
- No guaranteed live consistency while writes continue.
- No S3 event archive or >24h delivery failure recovery in this release, although authoritative DynamoDB history remains available by stream.
- No automatic zero-downtime replacement or projection state migration.
