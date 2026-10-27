# Two independent release flows

- Changesets: **framework npm packages** only. The generated packages are private until publication is intentionally enabled.
- Event Modeling slices: **explicit protected Git/CI release** with pinned model/build hashes. Dev deployment is editable draft iteration.
- Neither Changesets nor CDK synth/deploy marks a slice immutable.
- Version-pinned in-flight durable executions are an M5 runtime requirement, not implemented by this bootstrap.
