# Schema Pinning, Ownership and Traceability

## Pinned schema strategy
- Vendor `eventmodeling.schema.json` in `vendor/event-modeling-spec/<commit>/`. It currently uses **JSON Schema Draft-07**, defines four slice types, and has `additionalProperties: false` on slice objects. Source: https://github.com/dilgerma/event-modeling-spec/blob/main/eventmodeling.schema.json.
- Pin a **full 40-character immutable git commit**; record the exact downloaded file SHA-256 and upstream URL in `eventspindle.lock.json`. Do not use `main`, a floating release tag, or a live URL for validation.
- No full git commit or file hash is claimed in this document: it has not been independently captured. M0 must fetch+vendor+verify before coding.
- For JSON Schema generation of event/command payloads, independently target **Draft 2020-12**. Keep schema IDs stable and versioned; do not imply upstream Event Modeling Draft-07 defines event payload validation semantics.
- `eventspindle.lock.json` contains `upstreamSchema.{repository,commit,path,sha256,dialect}`, `generator.{version,digest}`, `manifestSchemaVersion`, `payloadSchemaDialect`, `canonicalizer.{name,version}`, and optional locked formatting/build-tool versions.
- Validation fails if vendored schema hash, lockfile values or required toolchain versions don't match. Schema upgrades are explicit compatibility changes with fixture-based migration tests.

## Directory ownership
```
models/                                  # authored official Event Modeling JSON
models/versions/<slice>/vN.json         # authored snapshots, frozen on release
config/eventspindle.yaml                # authored sidecar (routing and mappings)
eventspindle.lock.json                  # reviewed/locked source+generator versions
src/slices/<slice>/vN/behavior.ts       # developer-owned logic
src/slices/<slice>/vN/reference.ts      # developer-owned reference, if native SQL
src/generated/                          # compiler-owned, disposable and reproducible
infra/generated/                        # compiler-owned resource wiring
infra/application.ts                    # developer-owned CDK composition
scenarios/generated/                    # compiler-owned scenarios + trace map
scenarios/custom/                       # authored scenario extensions
release/                                 # immutable release manifest per version
```

Generator writes **only** to allowlisted generated directories and brand-new safe scaffold stubs via `--init` after checking target absence. Re-generation does not edit authored files. Author adds code using generated interfaces; broken contracts surface as compile errors rather than automatic patches. Full regeneration compares generated manifest checksums and refuses destructive drift by default. No region/account-specific secrets, current timestamps, or absolute workstation paths in outputs.

## Traceability and source maps
Each output symbol or scenario has references to original model file and JSON pointer, source slice/element/spec IDs, IR node ID, generator build digest. Emit `src/generated/eventspindle.trace.json`; generated test cases link to Given/When/Then specification IDs. Release snapshot has checked digests of both model and produced artifacts.

## Scenarios and tests
Given/When/Then example rows from the upstream model are normalized into executable scenarios only when preconditions, command payloads, expected emitted events/read model values, and error outcomes can be unambiguously mapped. Otherwise emit `EM003` and require an explicit fixture mapping before declaring the test executable; do not generate vacuous `expect(true).toBe(true)` or mark placeholders as passing.

## Build ownership policy
`eventspindle check-generated` regenerates in a temp directory and compares digest and paths with the committed generated manifest; CI rejects stale or modified generated output. `git` is the source of truth for authored inputs; protected CI publishes immutable release metadata and artifacts. CDK deployment revision, slice version and event schema version remain distinct.
