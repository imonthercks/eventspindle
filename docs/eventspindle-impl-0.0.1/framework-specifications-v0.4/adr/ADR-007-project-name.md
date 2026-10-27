# ADR-007: Adopt the EventSpindle project name

**Status:** Accepted  
**Date:** 2026-10-25

## Decision
Rename the working project **StreamKit** to **EventSpindle**. Use EventSpindle in package documentation, architecture diagrams, SDK namespaces, CDK constructs and AI skill identifiers.

## Proposed identifiers (availability not verified)
- Repository: `eventspindle`
- npm scope: `@eventspindle`
- Core: `@eventspindle/core`
- Event persistence: `@eventspindle/eventstore-dynamodb`
- Projection sink: `@eventspindle/projection-dsql`
- Lambda integration: `@eventspindle/aws-lambda`
- CDK: `@eventspindle/aws-cdk`
- Testing: `@eventspindle/testing`
- Skills: `eventspindle-*`

## Follow-up
Check repository, npm scope, domain and trademark availability before publication. Historic ADRs remain part of the renamed specification set.
