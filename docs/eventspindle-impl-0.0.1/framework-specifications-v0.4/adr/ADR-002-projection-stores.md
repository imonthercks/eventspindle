# ADR-002 — Pluggable projection stores; Aurora DSQL first

**Status:** Accepted  
**Date:** 2026-10-25

## Context
Event history and query models need different storage capabilities. Relational read models benefit from SQL, while event append benefits from DynamoDB's independent stream writes.

## Decision
Define a projection destination interface independent of the event store. Build Aurora DSQL as the first relational projection adapter. Leave room for alternative projection sinks.

## Consequences
- DynamoDB events and DSQL projections are eventually consistent.
- No atomic transaction spans event append and relational projection update.
- The sink should atomically record projection effects and processing progress in its own database transaction.
- Read-your-writes behavior, if needed, uses explicit freshness/version tokens.

## Open implementation items
Adapter API, checkpoint schema, event deduplication, transaction retry/error handling, projection versioning and atomic cutover.
