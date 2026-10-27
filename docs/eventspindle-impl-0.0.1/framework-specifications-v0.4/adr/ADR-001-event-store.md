# ADR-001 — DynamoDB as authoritative event store

**Status:** Accepted design direction  
**Date:** 2026-10-25

## Context
We want small, scalable append-only event streams for a standalone TypeScript framework. A DSQL-only implementation would simplify transactional relational projections but create more questions about event delivery. DynamoDB offers conditional transactions and natural per-stream access patterns.

## Decision
Use DynamoDB for authoritative stream events and stream-head version checks. Persist immutable events; assign contiguous versions per aggregate. Do not introduce a global shared counter.

## Consequences
- Independent streams can append without global sequence contention.
- Event/stream/head/idempotency records should commit atomically within DynamoDB.
- Requires separate event discovery/subscription and replay-completeness design.
- DynamoDB is not automatically a relational projection store.

## Open implementation items
Exact table design, command-receipt schema, event size limits, conditional transaction retry policy, and Region strategy.
