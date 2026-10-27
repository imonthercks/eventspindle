Feature: EventSpindle Step 2 delivery, ordering and causal processing
  Background:
    Given Step 1 stream append and command receipts are correct
    And one stream's events have contiguous revisions

  Scenario: Notification and event commit atomically
    When a command appends two events to an order stream
    Then the stream HEAD and both events and command receipt and one outbox item commit atomically
    And the outbox item references the contiguous two-event revision range

  Scenario: Failed append emits no notification
    When a transaction fails its expected stream revision condition
    Then no events are committed
    And no outbox notification is committed

  Scenario: No-op does not emit an event notification
    When a valid command produces no events
    Then a durable command receipt commits
    And no outbox notification is created

  Scenario: Stream notifications are delivered at least once
    Given an order stream has events at revisions 1 and 2
    When the same outbox notification is delivered twice
    Then the projection reflects each event's effects once
    And its checkpoint is 2

  Scenario: Later revisions arrive before earlier ones
    Given the projection checkpoint is 1
    And the committed order stream has revisions 2 through 4
    When a notification for revision 4 arrives before the notification for revision 2
    Then the projection fetches missing revisions from authoritative DynamoDB
    And it commits revisions 2, 3 and 4 in order
    And its checkpoint becomes 4

  Scenario: Projection failure is atomic
    Given the projection checkpoint is 2
    When an event update fails before its DSQL transaction commits
    Then the projection business state remains at revision 2
    And the checkpoint remains 2

  Scenario: Unknown DSQL commit result can be reconciled
    Given an event has been submitted to the projection transaction
    When the Lambda loses commit confirmation
    Then it reads the current projection checkpoint before retrying
    And the event has no duplicate logical effect

  Scenario: Duplicate automation notification starts one logical process
    Given FulfillOrder slice version 1 is active
    When the same OrderPlaced event is dispatched three times
    Then each dispatch derives the same execution name and input
    And one durable execution is started

  Scenario: Active-version routing does not migrate existing executions
    Given FulfillOrder version 1 has a running execution
    When FulfillOrder version 2 is activated for new triggers
    Then the existing execution continues on version 1
    And a new trigger starts version 2

  Scenario: Durable step retries do not duplicate commands
    Given a durable step issued RequestFulfillment with a deterministic command ID
    When the step restarts before its completion checkpoint
    Then the retried step issues the same command ID and fingerprint
    And the Step 1 command receipt prevents a second business effect

  Scenario: Cross-stream causal order is not assumed
    Given PaymentAuthorized is committed in a payment stream
    And its notification arrives before OrderPlaced in an order stream
    When the fulfillment automation evaluates its prerequisites
    Then it does not assume notification arrival order is causal order
    And it verifies the prerequisite from authoritative state or a correlated wait

  Scenario: Dependency arrives before wait registration
    Given PaymentAuthorized is committed before the automation registers its wait
    When the automation starts waiting for PaymentAuthorized
    Then the correlation mechanism finds the already completed dependency or reconciles authoritative state
    And the automation does not wait forever for a notification that already passed

  Scenario: Poison record is captured for manual repair
    Given a malformed notification repeatedly fails the projection worker
    When bounded Lambda retries are exhausted
    Then failure information is written to the configured destination
    And an alert identifies the failed stream notification or source sequence number
    And the record is not reported as processed

  Scenario: Operator reconciles a known stream
    Given notification delivery failed for revisions 5 and 6
    And the current DSQL checkpoint is 4
    When an operator reconciles that known stream through revision 6
    Then the runtime loads events 5 and 6 from DynamoDB
    And the projection checkpoint becomes 6
    And an audit record records the repair

  Scenario: Historical expiry is not silently considered recovered
    Given a consumer has been stopped beyond DynamoDB Streams retention
    When the worker resumes
    Then it does not claim global projection completeness
    And an operator action is required to assess undiscovered streams

  Scenario: Healthy projection freshness is measured
    Given a projection worker is processing without failures
    When its projected events are queried
    Then the system exposes projection lag metrics
    And the operational target is seconds rather than a hard consistency guarantee
