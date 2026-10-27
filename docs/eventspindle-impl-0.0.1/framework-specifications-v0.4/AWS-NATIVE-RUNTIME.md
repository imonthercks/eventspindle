# AWS-native runtime and managed-services strategy

**Status:** Accepted design principle; specific integrations proposed pending testing  
**Captured:** 2026-10-25  
**Specification:** EventSpindle draft v0.3

## Accepted architectural principle

Prefer native AWS-managed services and Lambda capabilities over custom infrastructure code whenever the managed service fulfills the required Event Modeling scenario and its correctness guarantees. Optimize for simple code and operations, not merely the fewest AWS resources. Avoid hot global synchronization in the DynamoDB command path.

Core remains TypeScript, DynamoDB authoritative append-only event history, per-stream concurrency/versioning, timestamp-based cross-stream ordering (not strict commit order), and pluggable projection sinks with Aurora DSQL first.

## Responsibility map

| Requirement | Preferred AWS-native candidate | Custom EventSpindle responsibility | Status |
|---|---|---|---|
| Command handling | API Gateway + standard Lambda; DynamoDB TransactWriteItems | Pure decider, aggregate folding, expected versions, command receipts | Proposed |
| Live notification | DynamoDB Streams + Lambda event-source mapping | Interpret committed outbox/event changes; deduplicate | Proposed |
| Filtering/routing | EventBridge Pipes, when target semantics match | Event schema contracts and routing policy | Proposed |
| Backpressure / reliable queue | SQS standard or FIFO where ordering by message group is useful | Idempotency and per-stream continuity | Proposed |
| Retries of batch records | Lambda event source mapping, partial batch failure response, Powertools Batch Processor | Correct reporting of failed items and ordering-gate logic | Proposed |
| Relational projections | Aurora DSQL + standard Lambda | Apply read model and checkpoint atomically in DSQL; replay gaps | Accepted sink / proposed runtime |
| Long-running business workflows | Lambda Durable Functions | Business commands, side-effect idempotency, event correlation | **Accepted preferred runtime** |
| Visible cross-service orchestration | Step Functions | Domain intent and command/result mapping | Investigate |
| Projection rebuild coordination | Step Functions / Durable Functions / S3 export | Coverage proof, catch-up barrier, checkpoint semantics | Investigate |
| Monitoring | CloudWatch, X-Ray, native alarms / destinations | Domain-level metrics and meaningful alerts | Proposed |
| Steady compute loads | Lambda Managed Instances | Same projection handler contract | Later evaluation |

## Hard correctness boundaries

1. **Lambda Durable Functions checkpoints do not equal projection progress.** Durable step replay must not double-apply business effects; DSQL projection mutation and checkpoint advance remain atomic.
2. **EventBridge Pipes and event-source mappings are not the historical event store.** Native transports can filter, batch, retry and notify but need not provide complete historical replay.
3. **SQS FIFO provides order within message groups, not a global database commit order.** Message group should normally map to a stream/aggregate if order is required.
4. **Timestamps are not complete watermarks.** Timestamp indexes support discovery, but a delayed insert or eventually consistent index can introduce earlier-timestamped events after a cursor advances.
5. **Avoid vendor-service promises in portable contracts.** Store and projector interfaces should expose guarantees; AWS adapters implement them.
6. **Native-service regional availability, price, retention, payload, timeout, concurrency and source-specific ordering must be checked during implementation.**

## Recommended initial data path

1. Standard Lambda accepts command, reads DynamoDB aggregate stream, runs pure decider.
2. DynamoDB transaction conditionally appends events, advances stream head, and writes durable receipt/notification item; no global shared counter.
3. DynamoDB Streams event-source mapping invokes projector or EventBridge Pipe routes to a queue when decoupling is warranted.
4. Projection Lambda reads authoritative event records as needed; enforces per-stream order and duplicate protection.
5. Projection + checkpoint commit in one Aurora DSQL transaction; write retries and ambiguity checks remain explicit.
6. Rebuild path consumes authoritative history separately from live notifications and proves coverage before cutover.

Do not introduce SQS, Pipes or Step Functions automatically: add each only if it replaces meaningful custom code, improves recovery, or solves a distinct operational need.

## New or updated acceptance scenarios

- **NW-01 Native routing:** Given a committed notification in DynamoDB, when a Pipe or event-source mapping filters and routes, then an eligible event is eventually offered to the intended consumer; filtered events are intentionally excluded; no business effect relies on one-time delivery.
- **NW-02 Partial batch failure:** Given a batch with one failing record, when Lambda reports partial failure, then successful records do not require redundant retries where source ordering permits; failed work remains recoverable.
- **NW-03 Durable workflow restart:** Given an event-triggered durable function that has completed an external step, when execution resumes, then a retry cannot duplicate the business effect and command IDs stay stable.
- **NW-04 Projection checkpoint:** Given event delivery retries or worker termination, when a DSQL projector resumes, then SQL changes and checkpoint positions remain atomically consistent.
- **NW-05 Native transport outage:** Given a delay longer than stream/queue retention, when a projector is restored, then historical reconciliation restores all missing eligible events or the system signals a recoverable completeness failure; no false caught-up signal.
- **NW-06 Burst scaling:** Given bursts of unrelated aggregate commands, when Lambda concurrency rises, then no shared global counter increases command write contention; DynamoDB throttling and downstream queue depth are observable.

## Evaluation spikes

A. Standard Lambda event-source mapping directly to projection handler vs EventBridge Pipe → SQS → Lambda. Compare cost, ordering, retries, operations and lag.  
B. Lambda Durable Functions vs Step Functions for long-running automation and for projection rebuild orchestration; do not use either for a simple pure decider.  
C. Lambda Managed Instances vs on-demand Lambda for sustained DSQL projection workloads.  
D. DynamoDB Streams 24-hour retention and replay after gaps; prove a separate historical recovery path.  
E. Test AWS service availability in deployment Region and CDK support for selected options.

## Primary AWS references (checked 2026-10-25)

- Lambda durable functions: https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html
- 2026 durable operation / checkpoint limits: https://aws.amazon.com/about-aws/whats-new/2026/10/aws-lambda-durable-gen-limit-increase/
- EventBridge Pipes: https://aws.amazon.com/eventbridge/pipes/
- Partial batch errors: https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html
- Managed Instances: https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances.html
- SQS ESM provisioned mode: https://aws.amazon.com/blogs/compute/low-latency-high-throughput-sqs-event-processing-with-aws-lambda-provisioned-mode/

## v0.3 decision: durable process runtime and CDK generation

Lambda Durable Functions is now the preferred runtime for automation and process orchestration; basic command handlers and straightforward projection workers still use standard Lambda. Infrastructure for these capabilities should be generated as TypeScript AWS CDK from Event Modeling specifications with reviewable AWS-specific configuration, not manually repeated resource definitions. See [ADR-005](adr/ADR-005-durable-automations.md), [ADR-006](adr/ADR-006-spec-to-cdk.md), and [Model-to-code](MODEL-TO-CODE.md).

## v0.4 durable execution version pinning

Released automation implementations remain runnable while existing durable executions drain. CDK must arrange supported immutable Lambda versions/aliases or independent function deployments and version-specific trigger/callback routing; do not assume changing an alias safely migrates in-flight execution state. Query operational state using AWS-native APIs where possible before retiring resources. Stable command idempotency IDs remain required at every side-effecting step. Exact AWS CDK/Lambda Durable API shape is a validation task, not settled by this specification.
