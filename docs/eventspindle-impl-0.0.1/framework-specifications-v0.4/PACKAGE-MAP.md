# EventSpindle package and naming map

**Status:** Proposed package/module IDs; brand decision accepted.

| Package | Role |
|---|---|
| `@eventspindle/core` | Domain events, deciders, command processing contracts |
| `@eventspindle/eventstore-dynamodb` | Transactional DynamoDB stream persistence, versioning, receipts |
| `@eventspindle/projection-dsql` | DSQL SQL projection adapter, transactional checkpoints |
| `@eventspindle/aws-lambda` | Standard and durable Lambda integration adapters |
| `@eventspindle/aws-cdk` | Reusable L2-style AWS infrastructure constructs |
| `@eventspindle/testing` | Slice and storage-adapter acceptance tests |
| `@eventspindle/modeling` | Model validation, IR and generation utilities (candidate) |

All names remain subject to npm/GitHub/trademark checks. Do not represent these packages as already published.

## Versioning tooling (proposed)

The AI skill and code-generation tool should expose `create-successor` and `verify-released-snapshots` operations. These might eventually be CLI commands under an EventSpindle developer tooling package; no package name or CLI interface is accepted yet. Runtime version state should use AWS-native facilities wherever adequate.
