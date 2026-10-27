# Changelog

## r7 — 2026-10-26

- R-01: reconciled all five accepted architecture steps, clarified authority of step contracts vs historical v0.4 open questions, removed stale open gates from active decisions file.
- R-02: documented known-stream repair and 24h Streams retention boundary; added persistent incomplete status, alarm/failure capture requirements, operator runbook and negative acceptance tests.
- Updated implementation, AWS deployment, test and readiness gates. No operational capability claimed built.

## r8 — Framework Tooling Options reconciliation
- Replaced npm workspace setup and npm CLI targets with pnpm workspaces and pnpm/Nx task orchestration.
- Added [TOOLING.md](TOOLING.md) with workspace conventions, Nx cache boundaries, CDK/Vitest integration, Changesets release workflow and CI acceptance checks.
- Kept Changesets framework package releases strictly separate from immutable slice release manifests and pinning.
- Deferred Projen, custom Nx generators and remote Nx cache without altering Steps 1–5, R-01 or R-02.
