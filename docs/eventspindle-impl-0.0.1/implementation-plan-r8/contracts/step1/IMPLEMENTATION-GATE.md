# M-1 architecture-contract gate update

## Six choices: accepted

| Choice | State | Verification |
|---|---|---|
| Bounded-context/aggregate-type/ID stream identity | Accepted | Round-trip encoding and collision tests |
| No persistent empty streams | Accepted | First nonempty append creates HEAD + EVT atomically |
| Reject stale expected revision by default | Accepted | Concurrent writes / create races |
| Command ID + request fingerprint | Accepted | Matching retry, differing payload rejection, ambiguous response |
| Durable no-op receipt | Accepted | Transaction includes HEAD revision/existence ConditionCheck |
| Single-stream command scope | Accepted | API rejects multi-stream append requests |

## Required to proceed to SDK implementation

1. Implement and test canonical stream codec (Unicode normalization, path escaping, maximum DynamoDB key lengths).
2. Select and test canonical JSON hashing library and command receipt serializer; document payload numeric constraints.
3. Select concrete UUIDv7 generator, schema validator and pinned schema catalog.
4. Prove in-memory and DynamoDB append/receipt implementations against all acceptance scenarios.
5. Write an AWS integration test that injects concurrent first appends, no-op/append races and lost commit responses.
6. Add automated contract checks for CloudEvents extensions, payload schema and immutable slice provenance.

## Explicitly not closed by this decision

- Delivery semantics, causal processing, projection checkpoints or projection completeness (architecture-review Steps 2/5).
- Upstream Event Modeling JSON Schema revision pin and AI generation reconciliation (Step 3).
- Multi-stream atomic transactions, cross-Region transactions, globally sequenced replay, strong chronological order across streams.

## Alignment with implementation plan Revision 2

**M-1:** core contracts now specified, not yet verified. **M1:** implement memory event store first. **M3:** implement DynamoDB event store with same tests. Nothing here requires changing the M2 local workflow design or the AWS orchestration decision. Promotion of this document from specified to verified requires passing tests; writing a specification alone is not implementation completion.

## References

- DynamoDB TransactWriteItems: https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html
- DynamoDB transaction isolation and stream propagation: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
- CloudEvents 1.0: https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md
- JSON Schema Draft 2020-12: https://json-schema.org/draft/2020-12
- RFC 8785 JSON canonicalization: https://www.rfc-editor.org/rfc/rfc8785
