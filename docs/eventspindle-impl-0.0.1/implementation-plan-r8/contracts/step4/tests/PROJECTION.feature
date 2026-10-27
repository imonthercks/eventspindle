Feature: EventSpindle projection adapter correctness v0.0.1
  Projection updates and checkpoints are atomic, idempotent, and per stream.

  Scenario: Apply first event to a fresh projection instance
    Given projection "sales/order-summary@1" instance "a" has no checkpoints
    When OrderPlaced at revision 1 for stream "sales/order/123" is processed
    Then the order summary row is created
    And checkpoint for that instance and stream is 1

  Scenario: Apply contiguous revisions
    Given the checkpoint for "sales/order/123" is 1
    When events at revisions 2 and 3 are processed
    Then the events are applied in stream revision order
    And the checkpoint becomes 3

  Scenario: Duplicate delivery has no additional effects
    Given revision 3 was committed with event ID "e3"
    When the same revision 3 event "e3" is delivered again
    Then the processor reports duplicate
    And projection state and checkpoint remain unchanged

  Scenario: Conflicting event identity is not silently accepted
    Given revision 3 was committed with event ID "e3"
    When revision 3 is delivered with a different event ID "wrong"
    Then the event is rejected or reconciled against authoritative history
    And no business mutation is applied

  Scenario: Revision gap triggers authoritative range repair
    Given the checkpoint for "sales/order/123" is 1
    When revision 4 arrives
    Then the projection does not apply revision 4 immediately
    And revisions 2 and 3 are requested from the authoritative event store
    And after applying revisions 2 and 3, revision 4 is applied
    And the checkpoint becomes 4

  Scenario: Projection mutation fails before commit
    Given the checkpoint is 1
    When applying revision 2 raises an error inside the transaction
    Then neither projection mutation nor checkpoint 2 is committed
    And revision 2 can be safely retried

  Scenario: Checkpoint persistence fails before commit
    Given the checkpoint is 1
    When the checkpoint update fails after proposed projection changes
    Then the entire projection transaction is rolled back

  Scenario: Concurrent same-stream deliveries
    Given the checkpoint is 1
    When two workers concurrently process revision 2
    Then at most one transaction commits the business effect
    And the other worker resolves as duplicate or retries after a conflict
    And checkpoint remains 2

  Scenario: DSQL optimistic conflict retries entire transaction
    Given a DSQL transaction fails with SQLSTATE 40001
    When the adapter retries
    Then it re-reads the checkpoint and reruns the entire transaction
    And it never retries only the last SQL statement

  Scenario: Ambiguous commit is reconciled
    Given a transaction to apply revision 2 returned an unknown outcome
    When the processor checks the stored checkpoint and event identity
    Then it reports prior success if commit is confirmed
    Otherwise it safely retries or reports a transient failure

  Scenario: Projection instances and versions are isolated
    Given instances "a" and "b" of projection version 2 exist
    And projection version 1 is serving
    When revision 1 is applied to version 2 instance "b"
    Then no state or checkpoint for version 1 or instance "a" changes

  Scenario: Shared projection must not depend on arrival order
    Given two independent streams contribute to a shared projection
    When both processing orders are tested using the same events
    Then the resulting state must be equal or the definition must declare causal coordination

  Scenario: In-memory and DSQL pure projection agree
    Given a fixed set of valid CloudEvents
    When the pure definition runs using both adapters
    Then projected state and per-stream checkpoints are equal

  Scenario: Native SQL and pure reference agree
    Given a native SQL projection and its mandatory reference reducer
    When a common event fixture is processed
    Then logical projected states and checkpoints are equal

  Scenario: Offline rebuild from bounded stable streams
    Given a stable explicit list of streams and their inclusive high-watermarks
    When a new empty instance is rebuilt from revision 1 on each stream
    Then its checkpoints equal the declared high-watermarks
    And its projected state matches the expected reference
    And query routing remains unchanged

  Scenario: Rebuild fails on missing authoritative history
    Given an event is missing from a required stream range
    When offline rebuild encounters the gap
    Then the rebuild fails with missing-history
    And the new instance is not promoted

  Scenario: Rebuild cannot silently update a serving instance
    Given projection instance "serving" currently serves queries
    When an operator attempts a destructive rebuild in place
    Then the operation is rejected
