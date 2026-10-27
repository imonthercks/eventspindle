# Event Modeling → EventSpindle → AWS CDK generation specification

**Status:** Accepted direction; detailed generator contracts proposed.  
**Version:** 0.3 (2026-10-25)

## Source of truth and compilation pipeline

```text
Event Modeling specification (pinned schema/version)
   + optional app-owned AWS deployment configuration
      → schema validation and reference resolution
      → typed, provider-neutral intermediate model
      → generation plan / warnings / traceability
      → TypeScript EventSpindle application code
      → TypeScript CDK through @eventspindle/aws-cdk
      → executable tests from acceptance scenarios
      → CDK synth, typecheck, tests, human review
```

The Event Modeling specification is the source of business intent; deployment overrides are the source of AWS runtime choices. Do not add Lambda memory sizes or table ARNs to the business model. A missing business decision must remain unresolved until specified.

## First AI skills and generators

| Skill | Inputs | Generated outputs | Status |
|---|---|---|---|
| `eventspindle-model-analyzer` | Model JSON, pinned schema | Diagnostics, resolved intermediate representation | Proposed first dependency |
| `eventspindle-automation` | Automation slice + related events/commands | Durable workflow TS, CDK TS, tests, traceability | First POC target |
| `eventspindle-state-change` | Command/event state-change slices | Deciders, handlers, contracts, tests | Planned |
| `eventspindle-state-view` | View slice | Projection handler, DSQL migration, checkpoints/tests | Planned |
| `eventspindle-translation` | Translation slice | External adapter, commands, tests | Planned |

## Proposed generated layout

```text
src/generated/automations/fulfill-order.workflow.ts
infra/generated/fulfill-order.construct.ts
tests/generated/fulfill-order.spec.ts
.model-generated/traceability.json
eventspindle.aws.yaml
```

The generated output is source code, not an implicit cloud deployment. Generated files are clearly labeled; protected user-authored files are not overwritten without diff/review.

## CDK constructs (proposed)
- `EventSpindleEventStore` — DynamoDB tables, stream configuration, grants
- `EventSpindleCommandHandler` — normal Lambda runtime, invocation/permissions
- `EventSpindleProjection` — mapping/routing, worker, permissions for configured sink
- `EventSpindleAutomation` — durable Lambda runtime, triggers, correct invoker permissions
- `EventSpindleTranslation` — external input routing, validation and command dispatch

Construct APIs, availability of specific CDK L2/L1 resources, and exact durable Lambda configuration are implementation-time research items, not guaranteed APIs in this draft.

## Example deployment configuration (proposed, not Event Modeling schema)

```yaml
# eventspindle.aws.yaml
defaults:
  region: us-east-1
  projectionStore: dsql
automations:
  fulfill-order:
    runtime: lambda-durable
    memoryMb: 512
    timeout: 7d
```

Settings shown are examples, not verified defaults or guaranteed valid deployment-time limits.

## Generation guarantees
1. Model element IDs map to generated code, test names and CDK resources.
2. Generation is idempotent for unchanged inputs, pinned tooling and options.
3. Validation blocks generation on unresolved references and malformed schemas.
4. Unknown business semantics produce explicit TODOs/review blockers.
5. Typecheck, tests and CDK synthesis run before any deployment.
6. No generated action invents compensation, deadlines, authorization policies or external side effects.
7. Workflow command idempotency is derived from stable workflow/step and triggering-event identity.

## First proof of concept
Select one `AUTOMATION` slice such as order fulfillment. Generate a Durable Function, its EventSpindle command client integration, a CDK construct, and scenarios covering duplicate triggers, workflow restart, timeout handling and model-to-code traceability. The skill should pin and report the upstream schema revision used.

## v0.4 — Successor-slice generation

The AI skill/generator must offer a `create-successor` flow: read immutable released `slice@N`, generate frozen successor source `slice@(N+1)` in a new location, produce a model/contract compatibility report, TypeScript SDK code, AWS CDK deployment configuration, tests and traceability; never rewrite released N. Generate version-aware automation routing for **new** executions while preserving in-flight durable executions. Generate independently checkpointed/read-model storage for new projection versions. A sidecar manifest identifies slices and hashes; do not extend the upstream Event Modeling schema with AWS/lifecycle fields. See [SLICE-VERSIONING.md](SLICE-VERSIONING.md).
