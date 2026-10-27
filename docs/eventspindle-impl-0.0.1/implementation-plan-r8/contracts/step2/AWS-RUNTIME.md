# AWS-native implementation and failure semantics

## DynamoDB and Lambda

- Persist event rows and transactional outbox notification per nonempty append. Use DynamoDB Streams with `NEW_IMAGE` and filter for `INSERT` of outbox items. Avoid modifying outbox items so notification is emitted once at source (transport redelivery can still duplicate).
- Separate standard Lambda handlers for projections and automation dispatch. Start with `batchSize: 10`, `maxBatchingWindow: 0`, `parallelizationFactor: 1`, `bisectBatchOnError: true`, `reportBatchItemFailures: true`, `retryAttempts: 3`, `maxRecordAge: 3600 seconds`; these are **starting tuning choices**, not AWS defaults or guarantees. Avoid making shard blockage invisible; track failures and iterator age. Partial batch errors must use the **DynamoDB stream sequence number**, not a domain stream revision.
- AWS documentation describes on-failure destinations and payload behavior; **prefer S3 on-failure destination** for retaining the failed invocation record payload, if supported by the selected CDK/API configuration and deployed Region. Some API/reference presentations emphasize SQS/SNS metadata-only destinations, so validate the exact CDK version and deployed event-source mapping. If using SQS instead, treat it as a failure *pointer* and retrieve authoritative events via outbox/stream IDs, not as a full persisted event copy.
- Configure CloudWatch alarms for Lambda errors/throttles, DynamoDB stream iterator age, failure objects/records, DSQL transaction retries, projection checkpoint lag and stalled durable executions.
- DynamoDB Streams has a 24-hour retention limit. `maxRecordAge` cannot extend the source retention; an S3 failure destination is not a substitute for complete source history. Choose alert thresholds substantially below retention.

## Failure matrix

| Failure | Immediate behavior | Recovery | User-visible guarantee |
|---|---|---|---|
| Duplicate outbox notification | May invoke worker again | DSQL checkpoint/event dedup or named execution | No duplicated logical business effect |
| Later revision arrives first | Do not apply out of order | Read missing revisions from DynamoDB | Contiguous per-stream progress |
| DSQL serialization conflict | Whole transaction fails | Bounded retry with state re-read | No checkpoint ahead of mutation |
| DSQL commit confirmation lost | Outcome unknown | Read checkpoint and projection identity, then retry idempotently | No unverified success |
| Projection poison event | Return batch failure | Native retry, bisection, failure capture and alert | Not silently accepted |
| Worker unavailable briefly | Iterator age increases | Native mapping resumes if within retention | Eventual recovery subject to retention |
| Stream record expires | Source delivery no longer available | Manual repair using known stream identifiers; full discovery deferred | Cannot claim automatic completeness |
| Durable execution start retried | Start request repeated | Name + same payload idempotency / conflict classification | One logical automation start |
| Durable step times out after external side effect | Step may run again | Deterministic command ID and idempotent external integration | No second business effect if integration honors key |
| Dependency event arrives early | Event may predate waiting registration | Durable process checks authoritative state and registers a correlated wait/rechecks safely | No lost dependency under tested handoff |
| Bad correlation ID or unauthorized callback | Reject | Log and quarantine | No unrelated execution resumed |

## Manual repair procedure v0.0.1

1. Record the failing event-source sequence number and, where possible, outbox notification identity, stream ID, and event revision range in failure artifacts/structured logs.
2. Operator selects known stream and projection version; read authoritative DynamoDB event range from `checkpoint + 1` through current stream HEAD.
3. Invoke projector in a controlled `reconcileKnownStream` mode. The same DSQL checkpoint mutation code applies events and rejects gaps/duplicates.
4. Verify checkpoint = last intended applied revision and query result. Retain repair audit record.
5. For lost discovery beyond retention, record explicit unresolved operational incident; **do not** report complete recovery without a separate discovery/backfill mechanism.

## Durability and versioning

AWS Lambda Durable Functions checkpoint execution progress; EventSpindle command receipts and projection checkpoints are separate durable facts. Execution start idempotency uses a deterministic name and a pinned version/alias; each step that performs effects supplies a stable command ID (e.g., hash of trigger event ID, automation version, step ID). Lambda ESM directly targeting a durable function does not itself guarantee idempotent starts; a regular Lambda dispatcher is the v0.0.1 design.
