Feature: EventSpindle v0.0.1 stream identity, revision, and idempotent atomic append
  All scenarios are required against in-memory and real DynamoDB adapters.

  Scenario: Canonical stream identity is unambiguous
    Given bounded context "sales", aggregate type "order", and ID "a/b%1"
    When the stream ID is encoded and decoded
    Then the identity is preserved exactly
    And the canonical string differs from any stream for a different identity tuple

  Scenario: Missing stream reads as revision zero without persistence
    Given stream "sales/order/new" has never had an event
    When I read its stream
    Then exists is false and revision is 0
    And no HEAD record exists

  Scenario: First append creates stream and event atomically
    Given "sales/order/123" does not exist
    When command C1 appends OrderPlaced with expected revision 0
    Then its stream HEAD revision is 1
    And exactly one event exists with streamrevision 1
    And a durable receipt for C1 exists

  Scenario: Multi-event append assigns contiguous revisions
    Given "sales/order/123" is at revision 2
    When command C2 appends 3 events with expected revision 2
    Then the stream HEAD revision is 5
    And the new events have revisions 3, 4, and 5
    And they all share command ID C2

  Scenario: Stale nonempty append rejected
    Given "sales/order/123" is at revision 5
    When command C3 attempts to append with expected revision 4
    Then the result is StreamConflict with actual revision 5
    And no events or receipt for C3 are written

  Scenario: Concurrent creation chooses one winner
    Given "sales/order/new" has no stream HEAD
    When distinct commands C4 and C5 concurrently append at revision 0
    Then exactly one command commits
    And the losing command returns StreamConflict after classification
    And only one stream HEAD exists

  Scenario: Same command retried with identical fingerprint
    Given command C6 previously appended 2 events at resulting revision 4
    And the stream has since advanced to revision 7
    When C6 is retried with the same fingerprint and old expected revision
    Then the original committed outcome at revision 4 is returned
    And no new events are written

  Scenario: Reusing command ID with different request is rejected
    Given command C7 committed with fingerprint H1
    When C7 is submitted with fingerprint H2
    Then the result is IdempotencyKeyReuse
    And no events are written

  Scenario: Valid no-op on existing stream is durable and conditional
    Given stream "sales/order/123" is at revision 5
    When command C8 produces zero events at expected revision 5
    Then the HEAD stays at 5
    And a no-op receipt for C8 is committed
    And a retry of C8 returns the original no-op outcome

  Scenario: Valid no-op on missing stream does not reserve stream ID
    Given stream "sales/order/new" is absent
    When command C9 produces zero events at expected revision 0
    Then only a durable no-op receipt is created
    And no stream HEAD is created
    When a different command C10 creates the stream
    Then C9 replay still returns the prior no-op result

  Scenario: No-op conflicts with simultaneous stream mutation
    Given stream "sales/order/123" has revision 3
    When command C11 tries to record a no-op against revision 3
    And distinct command C12 concurrently appends an event against revision 3
    Then if C12 commits first C11 returns StreamConflict and leaves no receipt
    And if C11 commits first C12 may still append from revision 3
    And C11's no-op receipt attests only to the stream state at C11's serialization point

  Scenario: Atomic append failure leaves no partial state
    Given a prepared append has 3 event items, a HEAD mutation, and receipt
    When the transaction is cancelled before commit
    Then none of those changes is visible

  Scenario: Ambiguous commit is not assumed to fail
    Given the commit response for command C13 is lost
    When the caller retries using C13 and its unchanged fingerprint
    Then a strongly consistent receipt lookup resolves a prior commit if present
    And C13 produces no duplicate events
    And if outcome cannot be determined the result is CommitOutcomeUnknown

  Scenario: Invalid event schema cannot create a receipt
    Given command C14 would emit an event failing its pinned JSON Schema
    When the append is prepared
    Then ValidationFailure is returned
    And no HEAD, event, or receipt changes

  Scenario: Unrelated streams do not contend on global counter
    Given 100 independent aggregate streams
    When commands append concurrently to separate streams
    Then each uses only its own stream HEAD, events and command receipt
    And the event-store transaction never updates a global version counter

  Scenario: Versioned slice provenance is stable
    Given place-order slice version 1 emits an event
    When that event is saved and replayed after place-order v2 is released
    Then its sliceid, sliceversion, dataschema, id and streamrevision are unchanged
