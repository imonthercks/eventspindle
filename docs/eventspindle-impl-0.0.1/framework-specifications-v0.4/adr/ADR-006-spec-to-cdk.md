# ADR-006: Event Modeling specifications generate TypeScript and AWS CDK

**Status:** Accepted architectural direction  
**Date:** 2026-10-25

## Context
The user wants a model-first developer experience with reusable AI skills that interpret the public [Event Modeling specification](https://github.com/dilgerma/event-modeling-spec). AWS-native execution infrastructure should be generated as source-controlled AWS CDK, not embedded in business modeling documents.

## Decision
Use the Event Modeling specification as the source for business behavior and dependencies. A validated intermediate representation feeds generation of (1) TypeScript EventSpindle handlers/workflows, (2) TypeScript AWS CDK using reusable `@eventspindle/aws-cdk` constructs, (3) executable tests, and (4) model-to-code traceability.

AWS-specific execution parameters, environment variables, networking, IAM scope, memory, timeouts and retention belong in separate, reviewable deployment configuration. **CDK is the target for infrastructure code; generated CDK synthesizes CloudFormation**, not vice versa. Generation does not deploy.

## Constraints
- Validate source documents against the pinned upstream schema version before interpretation.
- Unsupported/missing semantics (correlation, timeout, retries, compensation, command signatures) produce warnings or review tasks; do not invent business rules.
- Generated code must be deterministic where possible and readable/version-controlled.
- CDK uses least-privilege grants and requires synthesis, tests and review before deployment.
- AI skills orchestrate interpretation and edits; deterministic tooling owns parsing, validation and repeatable templates.

## Acceptance scenarios
- MG-01: A valid automation slice generates compiling workflow, CDK and traceable tests.
- MG-02: Missing compensation/timeout semantics are reported, not silently guessed.
- MG-03: Model update changes only affected generated artifacts and preserves user-owned files.
- MG-04: Generated CDK synthesizes and can be reviewed without deployment.
- MG-05: Generated IAM permissions are limited to declared event sources and commands.
