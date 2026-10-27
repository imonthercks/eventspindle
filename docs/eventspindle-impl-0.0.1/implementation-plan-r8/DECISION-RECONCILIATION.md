# R-01 — Accepted decision reconciliation and authoritative document order

**Disposition:** design/documentation finding closed in r7; implementation evidence pending. This file overrides historical *open-question* statements **for v0.0.1 only**. Do not mutate archived published specification snapshots. Where older text proposes different contracts, use these accepted choices and the referenced numbered step contracts.

| Area | Accepted decision | Authoritative source | Previously stale or ambiguous text |
|---|---|---|---|
| Stream ID / revisions | `boundedContext/aggregateType/aggregateId`; nonexistent revision 0; first nonempty append creates HEAD; contiguous revisions | `contracts/step1/CORE-CONTRACT.md` | r3 decision list incorrectly says stream ID/missing/empty unresolved |
| Append/idempotency | One stream per command; expected revision rejects stale; stable command ID + canonical SHA-256 fingerprint; durable no-op receipt; atomic HEAD/events/receipt | `contracts/step1/DYNAMODB-DESIGN.md` | v0.4 eventstore detailed receipt TBD |
| Outbox | Append transaction includes one outbox per nonempty batch; none for no-op; `NEW_IMAGE` filtered INSERT | `contracts/step2/DELIVERY-CONTRACT.md` | v0.4 `OPEN-QUESTIONS` OQ-12 and ARCHITECTURE describe outbox as candidate |
| Delivery/causality | At least once, ordered *per stream via revisions*, explicit automation dependency; seconds freshness target; known-stream manual repair | `contracts/step2/*`, `RECOVERY-BOUNDARY.md` | v0.4 general recovery design implies eventual complete discovery |
| Slice/release | Logical identity separate from release and deployment; local/Dev deployments are drafts; protected Git/CI explicit release; model+build hashes; in-flight exact code pinning | `SLICE-RELEASE-CONTRACT.md` | v0.4 registry lifecycle still listed open as if release trigger undecided |
| Projection | Pure-first/native allowed, per-stream checkpoint, atomic DSQL effect+checkpoint, offline bounded rebuild, version isolation | `contracts/step4/*` | v0.4 projection capability proposed |
| Compiler | Official JSON only, upstream Draft-07 pin; JSON Schema 2020-12 payloads; deterministic types/scaffolds/tests/CDK; authored/generated separated; ambiguity fails | `contracts/step5/*` | v0.4 OPEN-QUESTIONS asks AI complete behavior / author ownership |
| Runtime | DynamoDB authoritative, DSQL first SQL adapter, Lambda Durable Functions for automation, AWS CDK; no global position | Architecture v0.4 plus Step 1–5 | None; not operationally proven |

## Still legitimately open as **engineering details or deferred features**

- Exact upstream schema commit/checksum and CDK/SDK versions: implementation M0 pinning task, not reopening JSON-only policy.
- Lambda/DSQL APIs, Region permissions, stream filter and failure destination support: AWS validation tasks.
- Multi-version lifecycle UI, runtime registry implementation, automated draining: post-v0.0.1, but explicit release/pinning rules apply today.
- Complete stream discovery after notification expiry, global replay/catch-up, online projection cutover: **not supported by v0.0.1**; R-02 documented operational boundary, not a solved algorithm.
- No global total order, multi-stream transactions, HCL input or full AI-written behavior.

## Source precedence

1. This r7 `DECISION-RECONCILIATION.md` and `RECOVERY-BOUNDARY.md` for scope / hazard statements.
2. Accepted numbered Step 1/2/4/5 contracts and Step 3 `SLICE-RELEASE-CONTRACT.md` for detailed behavior.
3. r7 `IMPLEMENTATION-PLAN.md` and its operational/test documents for deliverables.
4. v0.4 specs as historical foundational material for areas not superseded; historical v0.4 OPEN-QUESTIONS remains an exploration log, **not current gate status**.

The build should fail if the current live plan reintroduces conflicting decisions. See `scripts/audit-decisions.py`.

## Framework tooling reconciliation (r8)

Framework Tooling Options selected pnpm workspaces, Nx, AWS CDK, Vitest and Changesets. Prior references to npm workspaces or `npm run` in the older implementation plan are superseded. Changesets controls npm framework package releases only; Step 3 explicit immutable slice releases remain protected and independent. Projen, bespoke Nx generators and remote cache are deferred. [TOOLING.md](TOOLING.md) is the authoritative tooling contract.
