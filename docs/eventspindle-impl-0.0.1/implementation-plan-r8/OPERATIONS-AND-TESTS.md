# Required observability implementation and acceptance matrix

## Deliverables to implement

1. `DeliveryHealth` port and AWS adapter to expose `HEALTHY | DEGRADED | RECOVERY_INCOMPLETE` per environment and subscription. Persist incident transitions and operator audit data outside ephemeral Lambda memory. Local adapter supports fault injection.
2. `reconcileKnownStream` command with projection-instance ID, stream ID, optional bounded `toRevision`, dry-run, idempotent repair receipt and guarded authorization. Return `repaired`, `already-current`, `gap`, `failed` or `incomplete-coverage`; never `all-streams-recovered`.
3. Outbox event source mapping + failure destination with exact destination payload verified; CloudWatch metrics/alarms and a runbook link in diagnostic output.
4. Instrument `IteratorAge`, oldest pending known notification, projection processing duration/checkpoint staleness, number of unresolved failure artifacts, and automation dispatch retries. Include alarm tests, not only code synth.
5. CI static decision audit + Step 1–5 contract tests; AWS integration suite requires live test environment, not mock-only proof.

## Gherkin acceptance criteria

```gherkin
Feature: Bounded event delivery recovery and honest operational status
  Scenario: Known stream repaired after a missed outbox notification
    Given a projection checkpoint for stream sales/order/123 is 2
    And authoritative event history contains revisions 3 through 5
    When an authorized operator reconciles that known stream through revision 5
    Then revisions 3 through 5 are applied in sequence exactly once logically
    And projection mutation and checkpoint 5 commit atomically
    And a durable repair audit record identifies the stream and revision range

  Scenario: Duplicate notification after reconciliation
    Given the projection checkpoint is 5
    When the outbox notification for revisions 3 through 5 is redelivered
    Then no projection business effect is duplicated
    And the checkpoint stays 5

  Scenario: Failure destination and alert are observable
    Given a consumer has a poison outbox notification
    When retries are exhausted under the configured policy
    Then a durable failure artifact identifies the original record or a retrievable authoritative pointer
    And an alert is emitted with the affected consumer and incident identifier
    And delivery health is not HEALTHY

  Scenario: Retention expiry with an unknown unprocessed stream
    Given a new stream was created during a delivery outage
    And its notification expired before the consumer observed it
    And no complete stream inventory is available
    When the outage is assessed
    Then the consumer state is RECOVERY_INCOMPLETE
    And the system does not assert complete replay or full recovery
    And repairing an unrelated known stream does not clear the incident

  Scenario: Iterator age returns to zero after an unobserved loss window
    Given a retention gap produced an unresolved RECOVERY_INCOMPLETE incident
    When the mapping resumes and IteratorAge becomes zero
    Then the incident remains unresolved
    And health does not become HEALTHY automatically

  Scenario: Within-retention mapping failure
    Given a notification remains available in DynamoDB Streams
    When the projection worker is disabled and later restored before retention expires
    Then the consumer reprocesses the notification or captures a failure artifact
    And the projection catches up or reports a visible DEGRADED incident

  Scenario: No-op command produces no delivery artifact
    Given a valid command is an idempotent no-op
    When its receipt is committed
    Then no outbox notification is created
    And no projection checkpoint is advanced
```

## Gate checklist

- **M0–M2 local:** `RecoveryBoundary` scenarios pass against memory adapter; missing AWS alarms are not a blocker.
- **M3+ AWS deploy acceptance:** CDK synthesizes alarm, mapping and failure destination; live tests demonstrate nonempty failure artifact, alarm, status transition and known-stream repair. Failed record context confirmed in the actual selected destination.
- **Production:** prohibited by this v0.0.1 recovery scope without an explicit separate operational risk approval and recovery design.
