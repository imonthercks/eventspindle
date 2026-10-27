# EventSpindle v0.0.1 implementation blueprint

Status: **implementation-ready for the controlled local M0–M2 build**, not shipped code or production-approved. Reconciled baseline r8, 2026-10-26.

Goal: run one Event Modeling example locally using only process memory, then deploy the same domain logic on AWS with DynamoDB as event store, Aurora DSQL as first SQL projection store, and Lambda Durable Functions for automation. CDK defines AWS infrastructure. Model-to-code AI skills and immutable slice versioning are represented in source organization but a complete generator/registry is **not** required for this first version.

**Revision r8 (2026-10-26):** retains architecture-review remediation and adds accepted tooling: pnpm, Nx (local cache), Vitest, CDK and Changesets, with slice releases managed separately. No runtime code is claimed to be implemented.

## Documents
- [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) — phases, task breakdown, acceptance gates, commands.
- [SCENARIOS.md](SCENARIOS.md) — Event Modeling slices and executable acceptance criteria.
- [STANDARDS-PROFILE.md](STANDARDS-PROFILE.md) — adopted standards, CloudEvents field mappings, schema and tracing rules, interoperability tests.
- [CONTRACTS.md](CONTRACTS.md) — TypeScript ports, event envelopes, adapter semantics.
- [AWS-DEPLOYMENT.md](AWS-DEPLOYMENT.md) — CDK resources, integration, deployment/cleanup and security.
- [TEST-PLAN.md](TEST-PLAN.md) — local/AWS contract suites, fault testing, benchmarks.
- [TOOLING.md](TOOLING.md) — pnpm/Nx/CDK/Vitest/Changesets setup, caching rules and CI lifecycle.
- [DECISIONS-AND-DEFERRED.md](DECISIONS-AND-DEFERRED.md) — settled design, proposed choices, exclusions and risks.

These are an additive v0.0.1 delivery blueprint alongside the v0.4 architecture specifications; they do not imply that v0.4 is implemented.


**Revision 3 update:** [Step 3 slice release contract](SLICE-RELEASE-CONTRACT.md) records accepted separation of draft deployment and immutable release and identifies remaining gates.

## Architecture review remediation r8

- [DECISION-RECONCILIATION.md](DECISION-RECONCILIATION.md): R-01 decision matrix, supersession rules and precise deferred scope.
- [RECOVERY-BOUNDARY.md](RECOVERY-BOUNDARY.md): R-02 retained-notification window, discovery limitation, degraded status and operator workflow.
- [OPERATIONS-AND-TESTS.md](OPERATIONS-AND-TESTS.md): CDK monitoring/failure capture implementation tasks, fault injection and go/no-go gates.
- [contracts/](contracts/): Versioned Steps 1, 2, 4 and 5 full contract packages; Step 3 in `SLICE-RELEASE-CONTRACT.md`.
- [RELEASE-READINESS.md](RELEASE-READINESS.md): scoped readiness verdict and engineering gates.

All existing archived specification packages remain historical. Do not assume R-02 complete historical stream discovery exists.
