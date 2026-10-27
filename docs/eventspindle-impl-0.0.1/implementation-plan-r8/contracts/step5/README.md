# EventSpindle v0.0.1 — Architecture Step 5 (Revision 6)

**Status:** decisions accepted; compiler and infrastructure not implemented. Prepared 2026-10-26.

This package formalizes the model-to-code contract and audits readiness against Steps 1–5.

## Files
- `COMPILER-CONTRACT.md`: exact pipeline, scope, semantic validation, stable intermediate representation, diagnostics, CLI.
- `SCHEMA-AND-OWNERSHIP.md`: pinned upstream schema, checksum and generated/developer ownership.
- `SLICE-SUCCESSORS.md`: draft/release lifecycle and successor-generation workflow.
- `src/compiler-contracts.ts`: proposed TypeScript interfaces and result types (not executable implementation).
- `tests/COMPILER.feature`: BDD acceptance scenarios (not yet executed).
- `READINESS-REVIEW.md`: consolidated decisions, remaining engineering prerequisites, and stop/go recommendation.

Source: https://github.com/dilgerma/event-modeling-spec/blob/main/eventmodeling.schema.json (the upstream schema at `main` is **not** a reproducible pin). The real CI configuration MUST replace the placeholders `UPSTREAM_COMMIT_TO_PIN` and `SHA256_TO_VERIFY` with checked-in verified values before M0 begins.

No assertion of completed implementation, reproducible builds or executed tests is made here.
