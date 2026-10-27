# Agent instructions

## Repository structure and tooling

- This is a pnpm workspace containing `packages/*`, `apps/*`, and `infra`. Use pnpm, not npm workspace commands; keep `pnpm-lock.yaml` in sync with manifest changes and use `pnpm install --frozen-lockfile` for reproducible installs.
- Nx orchestrates package `build`, `typecheck`, `lint`, and `test` targets. Preserve explicit project dependencies and cache only deterministic tasks; live AWS operations, migrations, and integration tests must not be cached.
- Use strict TypeScript and existing Vitest, Oxlint, and Oxfmt tooling. Keep domain packages framework-agnostic and free of AWS imports; put runtime-specific adapters in their dedicated packages.

## Accepted v0.0.1 architecture

- Follow `docs/eventspindle-impl-0.0.1/implementation-plan-r8/IMPLEMENTATION-PLAN.md`, `STANDARDS-PROFILE.md`, and the normative contracts under `contracts/step1`. These decisions are accepted; do not reopen them during implementation.
- A stream is keyed by the NFC-normalized tuple `(boundedContext, aggregateType, aggregateId)`, encoded as three percent-encoded URI path segments. Missing streams read as revision 0; the first nonempty append creates revision 1. Streams are single-aggregate and append transactions never use a global sequence.
- Command IDs are stable UUIDs. Fingerprint immutable command meaning (stream, command type, contract version, JSON payload) using RFC 8785 canonical JSON and SHA-256; exclude tracing and transport noise. Matching retries return the durable receipt before stale-revision checks; reusing an ID with different meaning is rejected. Successful no-op commands also receive receipts without creating empty streams.
- Stored domain events use the CloudEvents 1.0 structured envelope and the accepted profile: bounded-context `source`, canonical stream `subject`, and append-assigned `streamrevision`. Keep event IDs and prepared envelopes stable across retries. Validate payloads against versioned JSON Schema 2020-12 definitions with integrity pins before append.
- A stale expected revision is a conflict, not a reason to rerun business decisions. Keep business rejection, validation failure, stream conflict, idempotency reuse, and unknown commit outcomes explicit.
- The memory event store is a deterministic demo/test adapter; its streams and receipts do not survive process restart. Do not describe it as durable storage.
- Released slice artifacts are immutable. Changesets versions framework packages only; slice release/versioning is separate.
- The recovery boundary in `RECOVERY-BOUNDARY.md` remains mandatory: known-stream replay does not establish complete stream discovery or recovery readiness.

## Development checks

Use the pinned Node version in `.nvmrc` and pnpm version in root `package.json`. For M1 domain/store changes, run the relevant Nx `test`, `typecheck`, `lint`, and `build` targets; run model validation and infrastructure synthesis when changes affect those surfaces.
