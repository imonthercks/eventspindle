# ADR-003 — Per-stream versions plus cross-stream timestamp order

**Status:** Accepted  
**Date:** 2026-10-25

## Context
A transactional global counter would serialize unrelated commands and could increase burst latency. Exact cross-stream database commit order is not necessary for anticipated applications.

## Decision
- No transactional global counter or global append position in the command path.
- Stream versions are definitive for replaying an aggregate and enforcing expected-version writes.
- Cross-stream timestamp ordering is sufficient as a user/application semantic; tie-break deterministically with event ID.
- Do not promise strict cross-stream commit order.

## Consequences
- Lower risk of unrelated stream write contention.
- `recordedAt` may be assigned before commit, and clock skew may affect apparent order.
- Timestamp sorting is not proof all prior commits have been observed.
- Cross-stream order-sensitive applications must choose compatible semantics or introduce an explicitly coordinated component later.
