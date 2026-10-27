# AWS CDK deployment plan

## First-class AWS resources
- DynamoDB single-region event table: `PK` / `SK` strings, on-demand, Streams NEW_IMAGE, enable PITR when compatible with sandbox policy; `RemovalPolicy.RETAIN` for durable state outside dedicated throwaway environments.
- API Gateway HTTP API or Lambda function URL for demo endpoints; prefer HTTP API if routes/authorization need to evolve. Lambda function URL is a smaller initial deployment, but exposes a separate public-endpoint security decision.
- Node.js Lambda for command API and translation endpoint; share compiled domain code with local process.
- DynamoDB Streams -> Lambda projector event source mapping with INSERT-only event item filtering, `TRIM_HORIZON`, small batch, bounded retries, bisect, failure destination and CloudWatch alarms.
- Aurora DSQL cluster and IAM association; schema migrations in separate explicit deployment step. Use IAM authentication token renewal in Node DB client; keep credentials out of env variables.
- DSQL projection worker Lambda with IAM least privilege and network access as required by cluster setup. Apply projection mutation + checkpoint or receipt in the same DB transaction.
- Lambda Durable Function for `fulfill-order@1`, with version-qualified invocation; CDK Lambda `durableConfig`, execution permissions and retention. Separate stream dispatcher invokes with stable execution identity.
- EventBridge Scheduler **not needed** for a ten-second durable wait. Avoid extra SQS/EventBridge Pipes layer initially unless delivery requirements justify it.

## Suggested high-level CDK constructs (proposed APIs)

```typescript
const eventStore = new EventSpindleEventStore(this, 'OrdersEvents', { streamEnabled: true });
const handler = new EventSpindleStateChange(this, 'OrdersCommandApi', { eventStore, entry: 'apps/example-orders/src/aws/api.ts' });
const projection = new EventSpindleStateView(this, 'OrderStatusV1', { source: eventStore, adapter: 'dsql', entry: 'apps/example-orders/src/aws/projector.ts' });
const automation = new EventSpindleAutomation(this, 'FulfillOrderV1', { source: eventStore, version: 1, entry: 'apps/example-orders/src/aws/fulfill.ts' });
const translation = new EventSpindleTranslation(this, 'ShippingWebhookV1', { commandApi: handler, entry: 'apps/example-orders/src/aws/shipping.ts' });
```

These are design sketches. If CDK construct composition takes longer than the actual vertical slice, first deploy ordinary AWS CDK resources and extract reusable wrappers in a refactor.

## Durable Function integration considerations

AWS CDK includes `durableConfig` on Lambda Function and qualified version/alias invocation requirements. Consult pinned SDK docs at implementation time. Do not implement durable checkpoints with custom DynamoDB tables. Keep stable command idempotency keys as defense against repeated durable steps. Local deterministic workflow is only a simulation.

## Suggested deployment sequence
1. Configure AWS account/region; verify DSQL and Durable Functions are available in that region and account. Run `cdk bootstrap` if needed.
2. `pnpm infra:synth` and inspect resources, IAM permissions and removal policies.
3. Deploy event table, command/translation API and durable functions.
4. Deploy DSQL cluster, establish DB roles/IAM authorization, apply explicit SQL migrations.
5. Deploy/wire stream projection mapping and durable workflow dispatcher, using `TRIM_HORIZON` on initial creation.
6. Run `pnpm smoke:aws` with unique IDs, bounded wait and resource cleanup.
7. Review CloudWatch logs/errors, DSQL connection behavior, Lambda retries, and estimated ongoing costs.
8. `cdk destroy` on sandbox stack only; intentionally retained data requires separate cleanup.

## Operational hazards
- Streams retention is 24 hours: v0.0.1 does not promise arbitrary projection rebuild after downtime. Alarm on iterator age and failures; replay beyond retention remains future work.
- Lambda delivery is at least once; idempotency is nonoptional. DynamoDB transaction stream records for multiple items may arrive separately.
- CDK event-source mapping changes take time to settle; use starting position `TRIM_HORIZON` to avoid creation gaps.
- DSQL OCC conflicts require whole-transaction retry; ensure checkpoint and projection are committed together.
- No automatic global event timestamp completeness semantics.
- AWS request and response paths must use unique sandbox identifiers and authentication or access controls; do not expose unauthenticated production-like endpoints.

## References
- https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html
- https://docs.aws.amazon.com/lambda/latest/dg/durable-getting-started-iac.html
- https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html
- https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda.Function.html
- https://docs.aws.amazon.com/aurora-dsql/latest/userguide/

## Standards mapping (r2)

- Keep a canonical CloudEvents 1.0 event envelope in DynamoDB `EVT` records. DynamoDB Streams `NewImage` wraps that persisted envelope rather than becoming the canonical event.
- For EventBridge, carry the original CloudEvent without replacing its `id` with the AWS `id`; implement and test an explicit envelope mapping if an EventBridge bus is added later.
- Deploy no central counter, UUID-based global cursor or timestamp-only completeness checkpoint. A strongly typed `subject` and stream revision determine per-aggregate consumption.
- OpenTelemetry / W3C trace propagation is instrumentation, not an idempotency or business-correlation substitute.
- Keep canonical JSON Schema Draft 2020-12 in source/versioned assets; EventBridge registry support for Draft 4 must be treated as an optional separately generated compatibility view.


## R-02 deployment requirements (must implement before AWS smoke-test signoff)

1. DynamoDB Streams `NEW_IMAGE` outbox mapping with explicit filters and verified iterator position, `ReportBatchItemFailures`, bounded retry/maximum record age, and an on-failure destination with sufficient payload/pointer to retrieve authoritative events. Retention is 24 hours; no setting overrides the source-retention bound.
2. Configure S3 on-failure destination if supported and validated by the pinned CDK/Region. Otherwise SQS with a **persistent failure pointer** plus complete stream ID/revision and an authoritative event-reader repair path. Verify payload details through deployment tests; a DLQ alone cannot discover unseen expired records.
3. CloudWatch alarms: stream `IteratorAge`, Lambda errors/throttles, mapping failure notifications, projection latency, stuck checkpoints, dead-letter/failure destination arrivals, automation start failures and absent expected processing signals. Set early warning strictly below source retention (initial recommendation: 15 min warning, 1 h urgent, configurable after measurements). An empty failure destination is **not** proof of global completeness.
4. Implement durable incident/runbook tracking of `HEALTHY`, `DEGRADED`, `RECOVERY_INCOMPLETE` per subscription/environment. A period of unobservable delivery, retention expiry, disabled mapping, or acknowledged record loss automatically blocks completeness claims until manually assessed. Do not auto-clear `RECOVERY_INCOMPLETE` based only on low IteratorAge.
5. Manual `reconcileKnownStream(projectionInstance, streamId)` replays from atomic checkpoint+1 to authoritative HEAD; report verified result per known stream. Must never infer all streams were visited.
6. Run `OPERATIONS-AND-TESTS.md` faults, alarm and runbook tests before M3–M6 AWS acceptance.
