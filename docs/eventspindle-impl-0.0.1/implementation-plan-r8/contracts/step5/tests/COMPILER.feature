Feature: Deterministic Event Model compiler and released slice protection

  Scenario: Valid four-slice Event Model
    Given the pinned Draft-07 Event Modeling schema is present with its verified hash
    And the Event Model defines supported state-change, state-view, automation and translation slices
    When I validate and plan generation
    Then validation succeeds
    And the plan includes typed contracts, scaffolds, tests and CDK wiring for each slice

  Scenario: Identical input yields bit-identical generated files
    Given an unchanged model, manifest, lockfile and generator version
    When I generate twice in clean isolated directories
    Then every generated path and SHA-256 digest is identical

  Scenario: Upstream schema is pinned rather than fetched from main
    Given the lockfile contains a concrete upstream commit and schema SHA-256
    When the local vendored schema hash does not match
    Then validation fails with LOCK_MISMATCH
    And no source or generated files change

  Scenario: Event Model Draft-07 and payload Draft 2020-12 are distinct
    Given the official Event Model passes its pinned Draft-07 validator
    When the compiler generates an OrderPlaced payload schema
    Then the payload schema declares JSON Schema Draft 2020-12

  Scenario: Invalid dependency fails before writing output
    Given a dependency references an unknown element ID
    When I generate
    Then I receive EM001 with a model JSON pointer and hint
    And no existing generated files are replaced

  Scenario: Ambiguous aggregate stream mapping fails
    Given an order command could target two aggregates without a declared mapping
    When I generate
    Then I receive EM002
    And the compiler does not infer an aggregate

  Scenario: Unsupported cross-stream ordering is rejected
    Given a slice expects strictly ordered commits across independent streams
    When I validate semantics
    Then I receive EM006

  Scenario: Missing executable scenario fixture does not falsely pass
    Given a Given/When/Then scenario cannot be mapped to a concrete expected outcome
    When I generate tests
    Then I receive EM003
    And no passing assertion is fabricated

  Scenario: Generator does not mutate developer-authored behavior
    Given a developer has edited src/slices/place-order/v1/behavior.ts
    When I regenerate with unchanged model
    Then the developer-owned file is byte-identical

  Scenario: Tampered generated file is detected
    Given a user edits a file in src/generated
    When I run check-generated
    Then it fails with GENERATED_DRIFT
    And does not silently overwrite the modification

  Scenario: Source schema field cannot be represented safely
    Given a Decimal field has no configured precision-safe serialization
    When I validate
    Then I receive EM005 with an actionable hint

  Scenario: Creating a successor leaves predecessor untouched
    Given sales/fulfill-order@1 is released
    When I create draft sales/fulfill-order@2
    Then version 1's model, authored code and artifact hashes remain unchanged
    And version 2 receives independent generated bindings

  Scenario: Dev deployment is not release
    Given sales/fulfill-order@2 is a draft
    When I deploy it repeatedly to Dev
    Then the slice remains draft
    And each in-flight durable execution stays pinned to its original artifact revision

  Scenario: Release requires compatibility, test and digest gate
    Given a candidate slice version has unexecuted scenario tests
    When protected CI attempts to release it
    Then release fails
    And no released manifest is created

  Scenario: Released slice cannot be modified in place
    Given sales/fulfill-order@2 is released with recorded hashes
    When the source model or build artifact changes under version 2
    Then validation rejects the change with EM009

  Scenario: New deployments use the released artifact bytes
    Given sales/fulfill-order@2 has an immutable artifact digest
    When it is promoted to another environment
    Then the deployment uses exactly those artifact bytes
    And the event-sourcing aggregate stream identities remain unchanged
