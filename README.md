# EventSpindle v0.0.1 — M0 repository scaffold

This repository was created by the EventSpindle bootstrap script.

## Tooling

pnpm workspaces · Nx (local cache) · TypeScript · Vitest · AWS CDK · Changesets.
No Projen, remote cache, Nx generators, or deployed AWS resources.

## Start here

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm model:validate
pnpm nx run-many -t lint typecheck test build
pnpm infra:synth
pnpm changeset status
```

The bootstrap performs those checks once after installation. A lockfile should be committed.

## Important scope boundary

This is an M0 **scaffold**, not the functioning order-processing scenario. The model is schema-valid scaffolding, with business semantics and executable Given/When/Then examples still to add.
The HTTP app, in-memory event store and projections, event dispatcher, Durable Functions, DynamoDB and DSQL integrations have **not** been implemented. `pnpm dev:local`, deployment and release scripts intentionally exit nonzero until their milestones are implemented.

The pinned upstream Draft-07 schema is stored in `schemas/upstream/` with commit and SHA-256 checksum. JSON Schema 2020-12 payload schemas will be introduced during M0/M1.

Dev deployments are drafts. Changesets controls framework npm package versions only; slice releases require a separate protected CI process.
See `docs/RELEASE-BOUNDARIES.md`.
