# EventSpindle v0.0.1

pnpm workspaces · Nx · strict TypeScript · Vitest · AWS CDK.

## Current implementation

M1 implements the pure order domain, canonical stream identity, CloudEvents 1.0 event construction, versioned and integrity-pinned JSON Schema 2020-12 validation, and an atomic in-memory event store with transactional command receipts. Memory state, including receipts, is lost on process restart. The order scenario supports create, fulfillment, and shipment-confirmation transitions. M2 local HTTP, projection, and automation work and all AWS runtime adapters remain pending.

The selected M1 conventions are:

- Command fingerprints use RFC 8785 canonical JSON (`canonicalize`) and SHA-256 over stream, command type, contract version, and payload. Trace and transport metadata are excluded.
- Event IDs use an injectable UUIDv7 factory; event timestamps use an injectable RFC 3339 UTC clock.
- The memory adapter serializes mutations for deterministic transaction behavior, reuses prepared envelopes on known transient retries, and reports ambiguous post-commit outcomes rather than claiming failure.
- Example payload schemas use versioned `urn:eventspindle:schema:` IDs mapped to checked-in JSON files and verified against SHA-256 pins.

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm model:validate
pnpm nx run-many -t lint typecheck test build
pnpm infra:synth
```

`pnpm dev:local`, AWS deployment, projection, and automation scripts remain intentionally unimplemented until their milestones.

Changesets controls framework package versions only; slice releases require a separate protected CI process. See `docs/RELEASE-BOUNDARIES.md`.
