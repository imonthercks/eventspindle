# Step 2 implementation gate and follow-up validation

## Approved for v0.0.1

- [x] Seconds-level **target** for normal projection freshness (eventually consistent)
- [x] No strict cross-stream delivery ordering / no global sequence
- [x] Native DynamoDB Streams event-source mapping and filtered outbox notifications
- [x] Stable event IDs and deduplicated application effects
- [x] Per-stream version checks and DSQL projection checkpoint transaction
- [x] Explicit causal dependencies in version-pinned Lambda Durable Functions
- [x] Bounded native retries and captured failed records; manual known-stream reconciliation
- [x] Immutable slice-version routing retained

## Code/testing work before claiming the design works

- [ ] Implement Step 1 transaction expansion to include outbox notifications only on nonempty appends.
- [ ] Verify DynamoDB Streams filtering and actual event-source mapping delivery with deployed CDK.
- [ ] Verify specific AWS CDK support/Region for S3 failure destinations; fallback with SQS metadata + source read.
- [ ] Run exactly the same event ordering/idempotency scenarios against in-memory and AWS adapters.
- [ ] Demonstrate that DSQL updates/checkpoint commit atomically under transaction conflicts.
- [ ] Demonstrate unknown commit-result recovery from checkpoint state.
- [ ] Wire a real correlated durable wait that cannot lose a prerequisite event arriving early.
- [ ] Confirm version-qualified Lambda Durable Functions remain available while old executions drain.
- [ ] Add CloudWatch alarms and structured correlation/causation telemetry.
- [ ] Exercise a known-stream manual repair using DynamoDB authoritative reads.
- [ ] Document outage >24h as unresolved and test detection/alerting.

## Explicitly deferred

- Provable complete multi-stream historical rebuild and live-capture handoff.
- Automatic reconstruction of events missed after DynamoDB Streams retention.
- Global timestamp cursor treated as a complete subscription position.
- Globally ordered or strongly consistent cross-stream projections.
- General-purpose causal dependency graph engine.
- Automated remediation/orchestration of all failed records.

## Relationship to earlier gate

Step 1 core event-store contracts (r3) stay accepted. The Step 2 contract is now **design complete, implementation verification pending**. The remaining architecture gates concern slice registry/model-schema validation and projection adapter capability details. v0.0.1 implementation can proceed incrementally once the appropriate contracts are integrated, but none of these checkboxes is evidence of deployed functionality.

## Official references checked 2026-10-26

- Lambda DynamoDB mapping parameters: https://docs.aws.amazon.com/lambda/latest/dg/services-ddb-params.html
- Partial-batch processing: https://docs.aws.amazon.com/lambda/latest/dg/services-ddb-batchfailurereporting.html
- Failed invocation capture: https://docs.aws.amazon.com/lambda/latest/dg/services-dynamodb-errors.html
- Durable start and step idempotency: https://docs.aws.amazon.com/lambda/latest/dg/durable-execution-idempotency.html
- Durable execution SDK: https://docs.aws.amazon.com/lambda/latest/dg/durable-execution-sdk.html
