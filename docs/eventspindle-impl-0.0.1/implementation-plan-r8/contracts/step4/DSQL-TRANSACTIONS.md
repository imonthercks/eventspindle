# Aurora DSQL transaction and checkpoint design

## Tables (illustrative; validate exact DSQL SQL dialect in integration tests)

```sql
CREATE TABLE projection_checkpoint (
  instance_key varchar(240) NOT NULL,
  stream_id varchar(512) NOT NULL,
  revision bigint NOT NULL,
  last_event_id varchar(64),
  PRIMARY KEY (instance_key, stream_id)
);

CREATE TABLE order_summary_v1 (
  instance_key varchar(240) NOT NULL,
  order_id varchar(128) NOT NULL,
  status varchar(48) NOT NULL,
  PRIMARY KEY (instance_key, order_id)
);
```

For v0.0.1, deploy/create tables outside processing transactions using schema migration infrastructure. DSQL does not permit mixing DDL and DML in one transaction.

## Algorithm — transaction for one event

1. Validate CloudEvent, payload against versioned JSON Schema, and projection's accepted event types before DB transaction.
2. Begin transaction (using DSQL's Node.js connector/transaction retry helper where appropriate).
3. Read checkpoint for `(instance_key, stream_id)`; interpret missing as revision 0.
4. If `event.streamrevision <= checkpoint`, confirm identity when available and return duplicate **without projection mutation**.
5. If `event.streamrevision > checkpoint + 1`, abort/no mutation; request range repair from EventStore.
6. If exactly next revision, perform projection changes **and** upsert/insert-or-update checkpoint to new revision in the **same transaction**. Maintain write/write conflict on checkpoint row for parallel event attempts. For first-event races where checkpoint absent, concurrent inserts must allow at most one commit; loser retries transaction and observes duplicate/gap.
7. Commit. A successful response is returned only after commit confirmation.
8. On SQLSTATE `40001` (`OC000` data conflict or `OC001` schema conflict), retry entire transaction with bounded exponential backoff + jitter; after exhaustion return transient failure for Lambda retry. Never retry just the failed statement.
9. On network/unknown commit outcome, read checkpoint with a fresh connection. If checkpoint >= requested revision and event identity matches, return duplicate/successful prior commit; otherwise retry processing as an idempotent operation. Do not infer success from a transport timeout.

**Production coding caution:** Do not issue broad destructive `DELETE` or `TRUNCATE` operations on a serving instance. Provision a new empty projection instance for rebuilds. DSQL transaction scope/limits and selected SQL commands require integration verification; these examples specify invariants, not tested SQL statements.

## Native SQL projection handler

An optional `DsqlProjectionTransaction` exposes a parameterized SQL query capability under `@eventspindle/projection-dsql`. SQL handler logic runs inside the above checkpoint transaction; it must not open separate transactions, call external services, or advance checkpoint manually. The DSQL adapter commits after both handler and checkpoint actions. Authors must supply equivalent pure reference behavior for local parity.

## Operational design

- Small transactions; do not combine many unrelated streams in one SQL transaction.
- No global checkpoint row or hot global index.
- Monitor processing lag, OCC retry counts, gap repairs and poison events.
- Use the official Aurora DSQL Node.js connector to handle IAM token lifetimes and pooling.
- Keep current serving projection instance until manual rebuilt instance is explicitly verified and promoted in a later release (promotion not part of v0.0.1).

## Sources

- https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-concurrency-control.html
- https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-ddl.html
- https://docs.aws.amazon.com/aurora-dsql/latest/userguide/SECTION_program-with-dsql-connector-for-node-postgres.html
