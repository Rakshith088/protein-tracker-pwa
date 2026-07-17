# Sync — design & setup

Cross-device sync for the tracker. One tiny serverless function in this repo +
a Redis-compatible KV store on Vercel. localStorage stays the source of truth
on-device; sync is a background copy, never a gate — the app works fully
offline and a sync failure never blocks logging.

Decided 2026-07-17 (supersedes CONTEXT §10's backend rejection: multi-device
is now a real need). Chosen over Google Sheets (OAuth pain in an iOS PWA),
GitHub-as-storage (PAT hygiene on a phone), and Supabase (more moving parts
than one user needs).

## Architecture

```
iPhone PWA ──┐                       ┌─ Vercel KV / Upstash Redis
             ├── PUT/GET /api/sync ──┤   key:  pt:sha256(token)
laptop PWA ──┘      (this repo)      └─ value: the schema-4 export JSON
```

- **The sync payload IS the existing export** (`collectAll()`, schema 4).
  No second format; anything the coach export carries, sync carries.
- **Auth = one bearer token**, generated on-device (24 random bytes,
  base64url). Paste the same token into Settings on the second device.
  No accounts, no OAuth. The KV key is the token's SHA-256, so raw tokens
  never appear in the store.
- **Push**: debounced ~4 s after any data change.
- **Pull**: on every launch; merged into local, then pushed back if the
  merge produced something the server didn't have.

## API contract

`/api/sync` — single resource: the caller's snapshot.
All requests: `Authorization: Bearer <token>`, token `[A-Za-z0-9_-]{20,128}`.
All errors: `{ "error": { "code", "message" } }`.

| Method | Success | Errors |
|---|---|---|
| `GET` | `200` stored payload | `401` bad/missing token · `404 NOT_FOUND` nothing stored yet · `503 KV_UNAVAILABLE` |
| `PUT` (body = export payload) | `200 { ok, exported }` | `401` · `409 STALE` (+ `serverExported`) server copy is newer — pull, merge, retry · `413 TOO_LARGE` > 900 KB · `422 INVALID_PAYLOAD` · `503` |

Validation at the boundary only: `app === "protein-tracker"`, `schema >= 4`,
`logs` is an object, `exported` is an ISO date. The server never inspects
deeper — it is a dumb, authenticated blob store with a staleness check.

`409` is the concurrency story: the server refuses a PUT whose `exported`
is older than what it holds, so an out-of-date device can never clobber a
newer snapshot. The client answers a 409 by pulling, merging, and pushing
the merge.

## Merge semantics (client-side, pure function in sync.js)

Sequential single-user use means conflicts are rare; the merge is built for
the real scenarios (new phone, cleared cache, occasional laptop use):

| Data | Rule |
|---|---|
| `logs` | union of days; a day on both sides → union of entries **by id** |
| `weights`, `waist` | union by date; same date → the newer snapshot wins |
| `targetlog` | union by timestamp |
| `targets` | from the snapshot with the newer `exported` |
| `customFoods`, `meals` | union by name/id; clash → newer snapshot wins |
| `taps` | per-key max (counts only ever grow) |

Known trade-off, accepted: deleting a log entry on device A while device B
still holds it can resurrect it on the next merge (union has no tombstones).
In sequential use this doesn't happen; if it ever does, delete it again.

## One-time setup (Vercel dashboard — needs your click)

1. Vercel project → **Storage** → create a Redis/KV store
   (Marketplace → Upstash Redis, free tier) and **connect it to this project**.
2. That injects env vars automatically. The function accepts either pair:
   `KV_REST_API_URL` + `KV_REST_API_TOKEN`, or
   `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
3. Deploy (push). Then in the app: Settings → Sync → **Enable sync** on the
   phone, copy the token, **Use existing token** on any other device.

## Security notes, honestly

- The token is a bearer secret: whoever has it can read/write the data.
  It lives in localStorage and in the KV key hash — never in URLs, never
  logged, and the server never echoes it.
- Data is nutrition logs — low sensitivity — stored unencrypted in the KV
  (beyond the provider's at-rest encryption).
- Same-origin only; no CORS headers on purpose.
- Free-tier bounds: Upstash caps requests at 1 MB (we enforce 900 KB —
  years of headroom at ~0.5 KB/day of logs; the app warns via the storage
  line long before that).
