# CreatorDB usage log

During local development, every actual CreatorDB API request is logged to
`logs/creatordb-usage.jsonl` and the server console (prefix `[CreatorDB usage]`).
The file is created on the first call and is ignored by Git. Follow it with:

```sh
tail -f logs/creatordb-usage.jsonl
```

Each request has a correlated `request_started` and `request_completed` or
`request_failed` record. Records include UTC time, request ID, endpoint, user ID
when available, a request fingerprint, HTTP status, duration, search result count,
and vendor-reported credit metadata. Identical requests have the same fingerprint.
Search, profile, performance, contact, and audience calls are logged individually;
opening a creator profile currently makes three upstream calls.

`creditsUsed` is the vendor's reported per-call usage; `creditsAvailable` is its
reported remaining balance. Missing values are **null, not zero**. Other numeric
top-level credit fields are preserved in `reportedCreditFields`. `usageStatus`
indicates whether per-call usage was reported. Failed/time-out requests may still
have incurred a vendor charge. Do not infer exact per-call costs by subtracting
balances when requests overlap. These are CreatorDB credits, separate from the
Overseed user's wallet charges. Cached results that make no vendor call produce
no vendor request record.

No API keys, request bodies, contact details, or full responses are logged.
Set `CREATORDB_USAGE_LOG_PATH` to override the file location. Production defaults
to server logs; configure durable log retention with the hosting provider rather
than relying on a serverless filesystem. An unmatched start record indicates an
interrupted or still-running request. File-write failures are reported in the
server console and do not discard the console usage record.
