# ADR-004 — Event replay completeness independent of timestamps

**Status:** Proposed mechanism; accepted correctness constraint  
**Date:** 2026-10-25

## Context
There is no global committed sequence. Timestamp-index reads can be eventually consistent, and notifications can be delayed, duplicated, missed, or expire. Using `recordedAt > lastTimestamp` as a replay cursor can skip late-committing events.

## Decision / constraint
Time-based queries are for event discovery/approximate chronology, not an authoritative complete replay cursor. Projection correctness must use durable history plus stream-version-aware processing, deduplication, and a complete discovery/reconciliation mechanism.

## Candidate implementation
DynamoDB Streams for fast notification; durable stream discovery and periodic reconciliation against authoritative DynamoDB history; per-stream checkpoints or event-ID ledger stored atomically with projection effects. For large rebuilds, evaluate DynamoDB export to S3 plus carefully coordinated live overlap.

## Unresolved
- Complete discovery of new streams during backfill.
- Proof of historical/live overlap coverage and safe cutover.
- Recovery after notification retention expiry.
- Storage/cost of per-stream checkpoints and event-ID deduplication in DSQL.

**Do not promote this ADR to Accepted Implementation until a tested completeness protocol is documented.**
