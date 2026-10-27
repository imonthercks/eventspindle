# Slice versioning and lifecycle specification (v0.4)

**Status:** Accepted principles, proposed concrete manifest/runtime APIs. See [ADR-008](adr/ADR-008-immutable-slices.md).

## Core identity

`SliceRef = { sliceId: string, version: number }`; all generated source, deployment metadata, tests and traceability refer to a specific slice version. Human-readable examples: `fulfill-order@1`, `fulfill-order@2`, `order-summary@2`.

Keep separate identifiers for command/event schema versions, projection state schema versions, and CDK/Lambda asset deployments. A released model snapshot is read-only; its content hash is verified on generation/deploy.

## Lifecycle

| Status | Allowed | Disallowed |
|---|---|---|
| Draft | Edit and regenerate | Treat as immutable published contract |
| Released | Deploy, test, activate | Mutate frozen model or behavioral implementation contract |
| Active | Route new work here | Implicitly migrate older workflows |
| Draining | Finish existing work | Route new work, unless explicitly overridden for recovery |
| Retired | Preserve metadata/history | Remove required compatibility paths or historical references |

This is an intended logical lifecycle; implementation can use separate desired state and observed operational status, rather than one overloaded field.

## Proposed sidecar manifest (not part of upstream Event Modeling schema)

```yaml
model:
  source: ./event-model.json
slices:
  fulfill-order:
    activeVersion: 2
    versions:
      1:
        model: ./versions/fulfill-order/v1.json
        digest: sha256:<computed-at-release>
        implementation: ./src/fulfill-order/v1
        desiredLifecycle: draining
      2:
        model: ./versions/fulfill-order/v2.json
        digest: sha256:<computed-at-release>
        implementation: ./src/fulfill-order/v2
        desiredLifecycle: active
        supersedes: 1
```

Digest value is a placeholder, not a valid hash. The release tool computes it over canonicalized snapshot content and locks the association.

## Version-specific deployment examples (proposed APIs)

```typescript
new EventSpindleAutomation(this, 'FulfillOrder', {
  sliceId: 'fulfill-order',
  versions: {
    1: { entry: 'src/fulfill-order/v1/handler.ts', lifecycle: 'draining' },
    2: { entry: 'src/fulfill-order/v2/handler.ts', lifecycle: 'active' }
  },
  routeNewExecutionsTo: 2
});

new EventSpindleStateView(this, 'OrderSummaryV2', {
  slice: { id: 'order-summary', version: 2 },
  handler: { entry: 'src/order-summary/v2/projector.ts' },
  destination: { adapter: 'dsql', schema: 'order_summary_v2' },
  deployment: { startMode: 'rebuild', promoteWhenReady: false }
});
```

These are illustrative EventSpindle interfaces, **not implemented packages or validated AWS CDK types**. The automation construct must use supported AWS Durable Function deployment/version APIs, checked against the SDK when implemented.

## End-to-end example — Fulfill Order v1 → v2

- `place-order@1`: state change from `PlaceOrder` to `OrderPlaced`; no change required for this workflow rollout.
- `order-summary@1`: state view from order events to DSQL; remains available.
- `fulfill-order@1`: durable automation requests payment, awaits authorization, requests shipment.
- `payment-result@1`: translation of payment webhook to `RecordPayment` command.
- New `fulfill-order@2`: adds inventory reservation and compensation before payment/shipment; **do not mutate v1**.
- New incoming `OrderPlaced` triggers v2 after routing switch; older durable executions remain on v1 until completed.
- `order-summary@2` is an independent future change; its model/schema and DSQL state/checkpoint are versioned separately and can be replayed alongside v1.

## Compatibility checks before activation

1. Validate upstream Event Modeling document and the selected frozen slice snapshot.
2. Verify referenced event/command contracts; prohibit unacknowledged breaking changes.
3. Check new-execution routing, callback correlation and stable command IDs.
4. Synthesize generated CDK, compare resource replacement/deletion against existing durable obligations.
5. Run scenario and compatibility tests across old and new versions.
6. For state views, verify replay completeness and readiness boundary *before* routing queries.

## Runtime registry proposal

Store desired slice identities, model digests, dependencies and active version in source control. Runtime observations (running executions, projection progress, drain eligibility) may use AWS APIs and/or a minimal operational registry if necessary. **The storage mechanism is open**: avoid a custom central service unless operational needs justify it.

## Explicit non-goals

- Automatically translating in-flight durable execution checkpoints to a new business version.
- Automatically modifying old event records.
- Pretending timestamp-based event discovery establishes replay completeness.
- Automatic deletion of retired version infrastructure without dependency/drain verification.
