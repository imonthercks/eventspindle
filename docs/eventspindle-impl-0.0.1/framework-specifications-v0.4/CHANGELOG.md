# Specification changelog

## v0.4 — 2026-10-26
- Accepted immutable released Event Modeling slice versions and creation of successor versions (ADR-008).
- Added side-by-side version deployment/routing, version-pinned Lambda Durable Functions, and versioned projection rebuild/cutover rules.
- Added [SLICE-VERSIONING.md](SLICE-VERSIONING.md), nine lifecycle acceptance scenarios and slice-registry design questions.
- Kept deployment manifest/registry schema and precise AWS implementation as proposals rather than claiming tested functionality.

## v0.3 — 2026-10-25
- Renamed working project from StreamKit to **EventSpindle**; added naming ADR and package map.
- Accepted Lambda Durable Functions as preferred automation/process orchestration runtime (ADR-005).
- Accepted Event Modeling specification → TypeScript application + AWS CDK generation direction (ADR-006).
- Added proposed `@eventspindle/aws-cdk` construct family, model analyzer and AI skills.
- Clarified that generated CDK is reviewed/synthesized before deployment and that AWS-specific settings live outside the business model.
- Preserved v0.2 DynamoDB source of truth, lack of global counter, per-stream ordering, timestamp cross-stream order and pluggable DSQL-first projections.

## v0.2 — 2026-10-25
- AWS-managed-service-first runtime strategy; evaluated native event-source mapping, Durable Functions, Pipes and other native services.

## v0.1 — 2026-10-25
- Initial architecture, Event Modeling slices, requirements and decisions.
