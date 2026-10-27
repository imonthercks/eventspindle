# Slice Successor and Release Workflow

## Identity and change policy
Logical ID: `{boundedContext}/{sliceId}`; versioned ID: `{boundedContext}/{sliceId}@{version}`; deployment: `{environment}/{sliceId}@{version}+{artifactDigest}`. Stream identity remains `{boundedContext}/{aggregateType}/{aggregateId}` and is never silently changed by slice versioning.

## Create successor command
`eventspindle slice create-version --slice sales/fulfill-order --from 1 --to 2`

Preflight:
1. Resolve existing source version/model snapshot and ownership manifest. Fail if source unknown or destination exists.
2. Allocate a new **draft** version in authored config, copy initial model snapshot as a starting point, create fresh developer-owned handler files only when absent; never modify predecessor's released snapshot, behavior, generated outputs or artifact.
3. Generate successor-specific types/scaffolds/CDK registration; keep stable business event IDs and schemas unless explicitly evolved; emit compatibility report for impacted consumers, commands, events, read models and dependencies.
4. Dev can deploy draft repeatedly, each deployment pinned by artifact hash/qualified Lambda version, preserving any in-flight executions at their precise code revision.
5. `slice release` is an explicit CI operation gated on schema/semantic validation, accepted scenario results, compatibility, hashes, artifact retention and registry update. Immutable released version may not change even for bug fixes; create another successor.
6. New execution routing can move to the successor, but existing durable workflows stay pinned; old projections keep their instances/checkpoints until eligible for retirement.

## Required release record
`{ identity, version, sourceModelDigest, normalizedIrDigest, generatorDigest, manifestDigest, schemaCommit, schemaDigest, artifactDigest, immutableArtifactRef, createdByCI, releaseTimestamp }`. The timestamp is release metadata **not** an input to deterministic generation. The release manifest must be protected and tamper-evident; CI verifies hashes before promotion to another environment. Signing is recommended for production, not mandatory for the local demo.

## Registry source of truth
Version-controlled manifest + CI artifact registry. Runtime state only for current routing, active execution pins and projection-instance lifecycle. Do **not** introduce a separate DynamoDB slice registry for v0.0.1.

## Guards
Reject attempts to release a version identifier already released with different hashes, to overwrite predecessor outputs, to promote rebuilt bytes under an existing release, and to delete referenced runtime artifacts while executions remain. Dev deployments alone never create released status.
