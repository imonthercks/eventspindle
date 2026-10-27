# v0.0.1 implementation readiness and architectural finding dispositions

| Finding | Documentation/design disposition | Runtime verification | Status |
|---|---|---|---|
| R-01 — stale decisions | Reconciled current plan and referenced accepted Step 1–5 contracts; historical specs explicitly superseded where inconsistent | Run decision lint in CI and review active docs when code is generated | **Documentation closed; CI not implemented** |
| R-02 — after-retention recovery | Explicitly scoped known-stream recovery, failure visibility, incomplete-status semantics, no false completeness | Implement health/alerts/failure destination, inject loss and verify incident/repair behavior in AWS | **Bounded design closed; runtime unproven; full discovery deferred** |

## Proceed / no-go

- **GO: M0–M1** local compiler foundations and in-memory event store, after pinned Event Modeling schema commit/checksum and locked toolchain are added in M0.
- **GO WITH CONTRACT TESTS: M2** local end-to-end simulation, once memory adapter conforms to Steps 1/2/4 and failure-boundary cases.
- **CONDITIONAL: M3–M6** AWS rollout, only after provisioning metrics/alarms/failure destination/status/auditable repair and proving actual CDK/region behavior, then running integration suite.
- **NO-GO: production claims**, exhaustive replay/reconciliation after 24-hour notification loss, exact cross-stream order, or online projection rebuild/cutover.

## Remaining deliverables (no fundamental design questions)

1. Lock upstream schema commit+checksum, Node/pnpm/Nx/Vitest/CDK/Changesets toolchain versions and generated artifact canonical hash logic.
2. Compile TypeScript Step 1/2/4/5 port contracts together; correct any shape mismatch before publishing SDK.
3. Create schema-valid four-slice example and deterministic generator/ownership tests.
4. Implement memory parity, transactions and workflow virtual clock, including explicit no-op and outbox behavior.
5. Validate AWS DynamoDB transaction budgets and ambiguous-commit reads, DSQL OCC whole-transaction retry, Durable Function version/step-idempotency support in target Region.
6. Deploy R-02 telemetry and status, test poison-event capture and retention-loss assessment, and document cleanup/permissions.

Additional M0 checks: committed `pnpm-lock.yaml`, reproducible frozen install, Nx cache invalidation when models change, uncached AWS deployment targets, and distinct Changesets versus slice-release CI workflows. See [TOOLING.md](TOOLING.md).

The plan is ready to execute as a **scoped prototype**; no software implementation or AWS operational validation has yet been performed.
