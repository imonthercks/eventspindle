# Step 5 — Compiler Pipeline Contract

## Accepted decisions
1. **Single input**: the upstream official Event Modeling JSON specification; no HCL/YAML import for v0.0.1. An EventSpindle-owned sidecar manifest is permitted for deployment, versioning and mappings, but is **not** an alternative Event Model format.
2. **Deterministic generation** of strongly typed command/event contracts, validation/schema artifacts, handler scaffolds, execution/test scaffolds and CDK wiring. The generator **does not invent business decision logic**.
3. **Disjoint ownership**: generated paths are exclusively compiler-owned; developer-authored behavior never overwritten.
4. **Strict ambiguity**: schema-valid but semantically ambiguous/incomplete models yield actionable errors and a nonzero exit code; no unspecified business behavior generated.

## Canonical compiler stages

1. **Load inputs**: UTF-8 JSON bytes from a single explicit model path, sidecar manifest, local pinned JSON Schema and lockfile. Reject malformed JSON, duplicate object keys (custom checked parser or token-level precheck), unspecified schema revision, missing references, or paths outside workspace.
2. **Validate upstream structure**: use AJV configured for JSON Schema Draft-07 against a vendored immutable schema file verified by SHA-256. Upstream `$schema` is Draft-07. Never silently fetch the schema from a moving branch.
3. **Validate EventSpindle manifest**: independent versioned EventSpindle schema (initially Draft 2020-12), require valid context/slice IDs, immutable releases, model mappings, uniqueness, supported adapter declarations, and no links to mutable released assets.
4. **Semantic validation**: create symbol tables and resolve slice IDs, element IDs, dependencies and specification `linkedId` references; verify element roles and slice type consistency; verify bounded-context namespace; detect duplicate/conflicting names, cycles requiring coordination, omitted aggregate mappings, untyped payloads, unsupported field mappings or nonrepresentable given/when/then expectations. Errors must point to model JSON pointer and actionable remediation. Warnings are allowed only for nonbehavioral issues.
5. **Normalize into IR**: for each slice, materialize stable logical identity `{boundedContext, sliceId}`, slice kind, owned and referenced elements, commands/events/readmodels, schema definitions, scenario assertions and source spans; resolve version from the sidecar. Sort set-like collections by stable ID; preserve ordered workflow steps and ordered scenario assertions. Never use filesystem enumeration order, current clock, locale, environment IDs, AWS account, or nondeterministic iteration in outputs.
6. **Plan**: enumerate expected files, type names, registration, imports, CDK bindings and test files; fail on destination collisions or missing required configuration before writing anything. The plan can be emitted as machine-readable JSON for AI agents.
7. **Generate into staging directory**: type-safe TypeScript types, JSON Schema 2020-12 for event/command payloads (separate from Draft-07 model schema), CloudEvents mapping helpers, scaffolds for all four slice types, Gherkin fixtures and test adapters, infrastructure integration descriptors/CDK construct stubs. Record `sourceSliceId`, `sourceElementId`, `sourceSpecId` and model JSON pointer in generation trace map.
8. **Verify and commit atomically**: compare file hashes and a prior generated-files manifest; never overwrite developer paths; verify TypeScript formatting/build/test scaffold compilation and output ownership. On failure leave old generated tree intact. Publish changed generated tree and manifest via atomic directory rename or carefully journaled replacement. Reject hand-edited generated paths unless an explicit clean/regenerate operation is invoked; never delete unknown user files.
9. **Release validation** (separate command): execute full validation, generated/artifact integrity checks and acceptance/compatibility test gates; capture pinned upstream commit+sha, IR/model digest, generator exact version/digest, manifest/config digest, artifact digest, immutable artifact reference. A release is an explicit protected CI transition; Dev deployment isn't a release.

## Supported v0.0.1 slice mapping

| Type | Generated and owned by tool | Developer responsibility | Initial runtime |
|---|---|---|---|
| `STATE_CHANGE` | command/event types, decider interface, handler wiring, fixtures | `decide` and `evolve` logic | memory/DynamoDB |
| `STATE_VIEW` | typed reducer contract, projection registration/checkpoint wiring, fixture tests | reducer or native handler + pure reference | memory/DSQL |
| `AUTOMATION` | trigger types, correlated command/wait port, version-pinned registration, test harness | workflow steps, explicit dependency conditions | deterministic local runner/Lambda Durable Functions |
| `TRANSLATION` | input/command types, adapter wiring, fixtures | provider-specific mapping + verification | local input adapter/AWS Lambda |

Generator must not pretend to derive a complete business process from a title or text-only scenario. Unsupported required source features are **errors**. Generated scenarios may require developer-completed fixtures and stay explicitly pending until complete; they MUST NOT be counted as passing tests.

## Public CLI contract (proposed)
```
eventspindle validate --model models/order.json --config eventspindle.yaml
eventspindle plan --model models/order.json --config eventspindle.yaml --format json
eventspindle generate --model models/order.json --config eventspindle.yaml
eventspindle check-generated --model models/order.json --config eventspindle.yaml
eventspindle slice create-version --slice sales/fulfill-order --from 1 --to 2
eventspindle slice release --slice sales/fulfill-order --version 2  # protected CI only
```
Exit codes: `0` success, `2` input/schema invalid, `3` semantic/unsupported model, `4` ownership/drift collision, `5` tooling/internal error, `6` release policy/test failure. Diagnostics JSON and human modes preserve stable diagnostic codes and source pointers.

## Semantic linting examples
- `EM001`: unresolved event/command dependency; show JSON pointer and candidate IDs.
- `EM002`: missing aggregate type or ambiguous stream identity mapping.
- `EM003`: scenario expectation not machine-representable; requires explicit fixture/adapter.
- `EM004`: unsupported feature for chosen slice type.
- `EM005`: schema field incompatible with JSON payload contract (e.g., `Decimal` mapping unspecified).
- `EM006`: dependency requires a global event order; unsupported in v0.0.1.
- `EM007`: model specifies a generated name collision.
- `EM008`: missing or ambiguous trigger-to-slice/version routing.
- `EM009`: release model or implementation digest changed without new release.

## Type mapping: fail rather than silently truncate
`String` -> string; `Boolean` -> boolean; `Int`, `Long`, `Number`, `Double` require explicit safe-integer/precision policies; `Decimal` defaults to string with validated decimal grammar (never silent JS float conversion); `Date` -> ISO date string; `DateTime` -> RFC 3339 string; `UUID` -> canonical UUID string; `Custom` requires explicit registered schema. `List`/`Single`, `optional` and nested fields map to JSON Schema and TS consistently. Any unknown or underspecified mapping is a hard error.

## Replay and determinism
From identical model bytes, manifest, schema lock, generator build, formatting tools and configuration, generation produces byte-for-byte identical outputs. Use a canonical stable JSON serialization for hashing; specify and lock the canonicalization implementation (RFC 8785 recommended subject to numeric constraints). The CLI must support fully offline validation/generation after dependencies are installed. Golden fixtures and output digest comparisons are mandatory tests.
