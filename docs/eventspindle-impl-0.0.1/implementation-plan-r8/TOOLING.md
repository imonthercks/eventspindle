# EventSpindle v0.0.1 — Tooling and release workflow (accepted)

Source: decisions from the **Framework Tooling Options** project conversation (2026-10-26). This file is normative for M0–M1 and supersedes older `npm workspaces` and `npm run` examples. The code repository is not created by this plan.

## Tool selection

| Role | Accepted tooling | Implementation rule |
|---|---|---|
| Workspace manager | **pnpm workspaces** | `pnpm-workspace.yaml`, committed `pnpm-lock.yaml`, Corepack, root `packageManager`; prefer `workspace:*` for internal package dependencies |
| Monorepo task graph | **Nx** | Project graph and `build`, `lint`, `typecheck`, `test`, `model:validate`, `model:generate`; use local cache where deterministic |
| Lint and formatting | **Oxlint + tsgolint + Oxfmt** | Oxlint runs native and TypeScript-aware lint rules; tsgolint supplies TypeScript 7 type information; Oxfmt checks and applies repository formatting. Keep `tsc` as the authoritative compiler check. |
| Infrastructure | **AWS CDK TypeScript** | CDK app in `infra/`, managed AWS services, `cdk synth/diff/deploy/destroy` through pnpm scripts; don't cache mutating operations |
| Tests | **Vitest** | Fast unit/contract tests with shared adapter contract suite; local integration tests separate from real AWS tests |
| Framework package versioning | **Changesets** | Changelogs, version coordination and publishing for `@eventspindle/*` npm packages only |
| Dev/project generators | **Projen optional** | Not a prerequisite for M0–M1; prefer conventional hand-maintained workspace configuration first |
| Nx enhancements | **Deferred** | Do not implement custom Nx generators or configure remote cache for v0.0.1 |

## Minimal workspace configuration (target examples, not deployed code)

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'infra'
```

Root package manifest should set `private: true`, a pinned `packageManager` (exact pnpm version selected in M0), `engines.node`, scripts for local/AWS smoke and model validation, and development dependencies including `nx`, `vitest`, `typescript`, `aws-cdk`, `aws-cdk-lib`, `constructs` and `@changesets/cli`. Use compatible pinned versions confirmed in M0; avoid unverified version numbers in architecture documents.

`nx.json` should specify **explicit cacheable targets**: `build`, `typecheck`, `lint`, `format:check`, `test`, `model:validate`, `model:generate`, and pure CDK synth only if its environment and context inputs are completely captured. Type-aware lint depends on upstream builds so package declaration files are available. Prefer **not caching synth initially**; CDK context/lookup and environment inputs make incorrect cache hits expensive. Disable caching for `deploy`, `destroy`, `db:migrate`, `smoke:aws`, release/publish, and live integration testing.

For generated contracts, Nx inputs MUST capture `event-model/**/*.json`, `event-model/eventspindle.yaml`, `event-model/versions/**`, vendored upstream schema/checksum, compiler source/config, `pnpm-lock.yaml` and environment-independent generator configuration. Verify that editing any of those inputs invalidates the generated output cache; the generated output must never be trusted instead of an immutable-slice model/artifact hash check.

Recommended build dependency graph: `core -> eventstore/projection/automation ports -> adapters -> example apps -> infra`. Avoid unexpected circular references, with AWS packages depending on domain packages but not vice versa. Use Nx affected tasks in PR CI; for first setup, `nx run-many` is easier to reason about and serves as baseline parity check.

## Release boundaries: two intentionally distinct workflows

### A. Framework npm package releases — Changesets

- Contributors add `.changeset/*.md` changeset files when changing publishable framework packages.
- Protected CI runs tests, builds, release checks and Changesets version/publish workflow; a Changesets release PR may update `@eventspindle/*` package versions, lockfile and changelogs.
- Start with packages private if not yet intended for npm; M0 enables validation/status without committing to publishing v0.0.1 to npm.
- Package versioning can be independently versioned or coordinated through a Changesets fixed/linked configuration chosen when publication requires it; do **not** couple versions to slice lifecycle.

### B. Event Modeling slice releases — dedicated protected workflow

- Draft slices can be iterated and deployed to Dev without becoming released.
- A protected `slice:release` operation validates pinned schema, scenarios, release hashes, generated outputs, implementation artifact digest, and immutable manifest recording identity `boundedContext/sliceId@version`.
- A released slice stays immutable even if a new framework package version ships. Production deployment pins the precise slice artifact, and running Durable Functions pin the exact code revision, including drafts.
- Changesets must **never** mutate or publish a slice release manifest or decide which slice version is active. CI should enforce the separation.

## Expected local task entry points

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm model:validate
pnpm nx run-many -t lint typecheck test build format:check
pnpm format
pnpm nx affected -t lint typecheck test build
pnpm dev:local
pnpm smoke:local
pnpm infra:synth
pnpm changeset status
```

`pnpm lint` runs Oxlint with type-aware rules across the workspace; Nx package lint targets build their dependencies first. `pnpm format` applies Oxfmt, while `format:check` is non-mutating and cacheable. `pnpm changeset` is used when a publishable framework package change requires a changeset.

## CI acceptance gates (M0–M1)

1. Frozen pnpm install is reproducible from clean checkout; wrong lockfile/manager fails fast.
2. Nx correctly runs dependent package tests/builds; changing a model, schema or compiler invalidates generation/test caches.
3. Vitest adapter-contract tests run uncached on demand and pass consistently; cache is not relied on as proof of release compliance.
4. CDK TypeScript synth is reproducible under documented context and env; deploy/destroy/migrations are never read from cache.
5. Changesets tooling validates framework npm release metadata, while separate checks protect released slice manifests/hashes.
6. R-01 decision audit and R-02 recovery-boundary tests stay mandatory even if Nx would otherwise return cached outputs.

## Deferred deliberately

Projen-based synthesis, custom Nx generators, remote/distributed cache, monorepo automation beyond existing Nx targets, and advanced Changesets release policies. Do not let any of them delay M0–M1.
