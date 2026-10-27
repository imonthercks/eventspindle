# R-02 — v0.0.1 failure discovery and recovery boundary

**Decision:** bounded, observable recovery is supported. **Automatic complete discovery and reconciliation after DynamoDB Streams retention expires is NOT supported** in v0.0.1. DynamoDB remains the authoritative event history; lack of stream discovery, not loss of event history, prevents a blanket completeness claim.

## Contract and scope

- Every committed nonempty append writes a transactional outbox notification, keyed by stream and revision range, plus durable events and receipt. Stream consumers may receive duplicates/reorder; authoritative event range + per-stream checkpoint repairs **known** gaps.
- DynamoDB Streams has 24-hour retention. Consumer retry limits and on-failure destinations may capture attempted but unsuccessful processing; **they cannot recover records that were never durably captured, expired without being observed or whose stream IDs are unknown**.
- No global event counter or exact time-index completeness claim; neither event timestamp, UUIDv7, a GSI, `TRIM_HORIZON`, a quiet backlog, nor empty DLQ proves all streams processed.
- Basic manual repair: given `(subscription or projection instance, streamId)` read checkpoint and stream HEAD, apply [checkpoint+1, HEAD] with contiguity + dedup, persist mutation/checkpoint atomically, produce audit receipt. May also retry captured known outbox ranges. Do not use this for an unbounded unknown set of streams.
- Offline manual projection rebuild: only an explicitly enumerated stable stream set with recorded per-stream high-watermarks. Cannot claim live completeness or global catch-up.

## Operational states and claims

| Status | Entry | What it permits | How to exit |
|---|---|---|---|
| `HEALTHY` | Verified running mapping, bounded age, no unresolved incidents | Operationally healthy **within the monitored observation window only**; no global completeness claim | Enter DEGRADED on operational anomaly |
| `DEGRADED` | Age threshold, mapping disabled, failures, unobserved processing, throttling, stuck checkpoint | Serving stale queries with visible warning; investigate/capture failures | Evidence of bounded backlog replay and checks for known streams, with no unobserved window |
| `RECOVERY_INCOMPLETE` | Retention horizon crossed, confirmed dropped records, unknown stream coverage or an unprovable notification window | No successful replay/completeness certification; known-stream repair allowed | Human-approved restoration plan with independent exhaustive discovery/backfill evidence, or retain unresolved incident and explicitly accept partial demo state. v0.0.1 offers no automated path to certify exhaustive recovery. |

Never automatically clear `RECOVERY_INCOMPLETE` because IteratorAge falls or a retry queue is empty. Persist incident ID, first/last uncertain times, impacted consumers, records/ranges known, repair attempts and operator disposition. For v0.0.1 a durable ops record can live in an AWS-owned incident destination and structured logs/runbook; if application routes rely on the status, use an explicit strongly read status record (e.g. DynamoDB operational state), not CloudWatch logs as control state.

## Monitoring and failure evidence (AWS)

- Alarm on DynamoDB Streams mapping `IteratorAge`, mapping/Lambda `Errors`, `Throttles`, unprocessed-failure destination, projection lag, stuck checkpoint and automation-start failures. Monitor lack of expected worker heartbeat where there is known work; quiet traffic by itself is not an error.
- Configurable warning and urgent thresholds well before 24 hours (initial warning at 15 min backlog, urgent at 1 h; tune through testing); a heartbeat or monitoring outage creates DEGRADED, not healthy.
- Configure Lambda `ReportBatchItemFailures`, finite retries/max age, and verified on-failure destination. Prefer S3 full invocation/record capture *where deployed service/CDK supports it*; otherwise SQS pointer with sufficient context to retrieve authoritative rows. AWS delivery failures and poison records must page/log with durable incident IDs and remediation status.
- Operational repair records include notification ID, original stream/revision range when known, Lambda mapping/sequence ID, projection or slice version, error, trace/correlation IDs where present, timestamps, attempt count, and command/outbox identity.
- The 24-hour retention horizon is hard. Alert thresholds are operational objectives, not guaranteed loss prevention. An alarm breach requires assessment of actual coverage.

## Runbook

1. Disable or quarantine affected worker if its outputs are unsafe; keep authoritative command/event writes intact unless another incident requires a pause.
2. Record issue window, affected consumer, iterator lag, destination failures, deployment/mapping changes, and known stream IDs. Transition status to DEGRADED or RECOVERY_INCOMPLETE as warranted.
3. For each **known** failed notification or stream, read authoritative HEAD/checkpoint and run `reconcileKnownStream` with dry-run, then apply. Verify checkpoint, event ID match and read-model correctness; log repair receipt.
4. If source retention may have expired or an unobserved window exists, mark RECOVERY_INCOMPLETE. Do **not** mark recovered solely because known examples now match. Define a future complete inventory/archive/export discovery process or document explicit nonproduction limitation.
5. Only clear DEGRADED upon evidence no loss window existed and processing caught up. RECOVERY_INCOMPLETE requires independent coverage proof not provided by this version.

## Acceptance boundaries

- A duplicate/reordered notification yields one logical effect and correct checkpoint.
- Within-retention detected failure produces alert + persisted failure context, and known stream repair succeeds.
- Simulated source-expiry/unseen stream produces RECOVERY_INCOMPLETE and a visible incident; **no `replayComplete=true`**.
- A known-stream reconciliation never claims to discover previously unknown streams.
- M3–M6 smoke tests fail if failure destination, alarm coverage, incident visibility or operator runbook tests are missing.

**Result:** R-02 is closed as a **documented limitation and implementation gate**, not as a claim that expired notification recovery has been solved.
