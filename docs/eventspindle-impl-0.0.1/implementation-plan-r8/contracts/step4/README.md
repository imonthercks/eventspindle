# EventSpindle v0.0.1 — Architecture Step 4, Revision 5

This package records **accepted design decisions**, not implementation results.

- `PROJECTION-CONTRACT.md` — invariants, IDs, ordering, deduplication, capabilities
- `src/projection-contracts.ts` — proposed public TypeScript interfaces
- `DSQL-TRANSACTIONS.md` — transaction algorithm and DSQL-specific failure strategy
- `REBUILD-AND-PARITY.md` — local/AWS testing parity and bounded manual rebuilding
- `tests/PROJECTION.feature` — 17 Given/When/Then scenarios
- `IMPLEMENTATION-GATE.md` — implementation scope and remaining Step 5

Preceded by Step 1 core event-store contract (r3), Step 2 delivery contract (r4), and Step 3 immutable slice release decision. No cloud resources were provisioned.
