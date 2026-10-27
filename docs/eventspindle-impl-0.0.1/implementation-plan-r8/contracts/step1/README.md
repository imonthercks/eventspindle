# EventSpindle v0.0.1 — Core Contract Gate (Revision 3)

**Status:** Six user choices ACCEPTED. The contracts in this package are normative for the first implementation; implementation remains unverified until the same contract suite passes against memory and real DynamoDB.

## Contents
- `CORE-CONTRACT.md` — canonical stream identity, revision, idempotency, consistency, errors and append algorithm.
- `DYNAMODB-DESIGN.md` — DynamoDB keys, transactional actions, edge cases, retry procedure.
- `src/contracts.ts` — suggested TypeScript public interfaces (compile-target sketch; app types supplied by caller).
- `ACCEPTANCE.feature` — Gherkin scenarios for both adapters.
- `IMPLEMENTATION-GATE.md` — readiness checklist, scope boundaries, references.

## Accepted decisions
1. Canonical stream ID = bounded context + aggregate type + aggregate ID.
2. Stream is first created atomically with its first event; no persisted empty HEAD.
3. Stale expected revisions are rejected by default; no automatic business re-decision.
4. Durable command ID + canonical request fingerprint is the idempotency key.
5. Successful commands returning zero events generate a durable no-op receipt.
6. A command targets exactly one stream in v0.0.1; it may emit multiple events on that stream.

The preexisting [standards profile](../eventspindle-v0.0.1-plan-r2/STANDARDS-PROFILE.md) remains in force: CloudEvents 1.0, JSON Schema 2020-12, UUIDv7 preferred, UTC RFC 3339 timestamps and W3C Trace Context. The code here specializes that profile without altering it.
