# API Keys

API keys give machines access to your API without a user login. A partner, an integration or a script sends a key in the `x-api-key` header, and the gateway checks it before anything reaches your services.

Keys are **not tied to users**. Each key belongs to a named **consumer**, for example `acme-corp`: whoever you issued it to. Admins create, limit, rotate and revoke keys at runtime through the auth-service admin API. Changes take effect on the next request, with no redeploy.

This page covers the full auth template (the `auth-service` that `init` creates). Projects without it can still use keys by writing them to Redis themselves; see [Managing keys without the auth service](#managing-keys-without-the-auth-service).

## How it works

```
client ── x-api-key ──> gateway
                          │  exact route match     only @PartnerApi() operations, else 404
                          │  per-IP ceiling        600 requests per minute per client IP (default)
                          │  API key check         key lookup and limits in Redis: 401, 429 or 503
                          │  /api removed          the service receives the path it serves
                          ▼
                        your service   (req.apiKey = { id, consumer })

admin ── JWT ──> auth-service /auth/v1/admin/api-keys
                   │  writes the key record to Redis, then Postgres
                   └─ sync-api-key-usage job: week and month totals to Postgres
```

- Keys only reach endpoints marked `@PartnerApi()`, under the `/api` prefix. Every other endpoint has no `/api` route, so a key gets 404 there. See [Gateway Routing](/docs/building-apis/gateway-routing#partner-api-routes).
- The gateway validates the key on every request against Redis. Nothing but Redis is on the request path: the auth-service can be down or scaled to zero and keys keep working.
- Keys are 256-bit random strings, shown once when created, and stored only as a SHA-256 hash, in Postgres and in Redis. The gateway never forwards the key to your services; they receive the key id and the consumer name instead.

## Marking endpoints for API keys

```typescript
import { Controller, Get, Version } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PartnerApi, Partner } from '@tsdevstack/nest-common';

@Controller('plans')
export class PlansController {
  @Get()
  @Version('1')
  @ApiBearerAuth()   // logged-in users at /offers/v1/plans
  @PartnerApi()      // API keys at /api/offers/v1/plans
  getPlans(@Partner() consumer?: string) {
    // consumer is the key's consumer name on API key calls, undefined for users
  }
}
```

After adding `@PartnerApi()`, regenerate the gateway config (`npx tsdevstack sync` locally; `infra:generate-kong`, `infra:build-kong`, `infra:deploy-kong` in the cloud).

On a key request, the gateway sends two headers to your service: `X-Api-Key-Id` (the key id) and `X-Api-Key-Consumer` (the consumer name). `AuthGuard` turns them into `req.authType === 'apiKey'`, `req.service === 'partner'` and `req.apiKey = { id, consumer }`; `req.user` is never set. Read them with `@Partner()` (the consumer name) or `@ApiKey()` (`{ id, consumer }`). Your service only trusts these headers on requests that came through the gateway; see [Protected Routes](/docs/authentication/protected-routes#partner-api-endpoints).

## Creating and managing keys

All key management goes through the auth-service admin API. Every endpoint needs a JWT from a user with the `ADMIN` system role (`Authorization: Bearer <token>`); how to become the first admin is in [Managing Users](/docs/authentication/managing-users#the-first-admin). There is no UI: use curl, Swagger or the generated client.

Through the gateway the endpoints live under the auth-service prefix:

| Method | Path | Body | Success |
|---|---|---|---|
| `GET` | `/auth/v1/admin/api-keys?consumer=<name>` | none | 200, list of keys, newest first (`consumer` is optional) |
| `POST` | `/auth/v1/admin/api-keys` | [Create](#create-a-key) | 201, the key including `key` (shown once) |
| `GET` | `/auth/v1/admin/api-keys/:id` | none | 200, the key |
| `PATCH` | `/auth/v1/admin/api-keys/:id` | [Update](#update-limits-and-expiry) | 200, the updated key |
| `POST` | `/auth/v1/admin/api-keys/:id/revoke` | none | 200, the revoked key |
| `POST` | `/auth/v1/admin/api-keys/:id/rotate` | `{ "graceHours": 168 }` (optional) | 201, `{ newKey, previousKey }` |
| `GET` | `/auth/v1/admin/api-keys/:id/usage` | none | 200, saved usage per period |

The generated client (`@shared/auth-service-client`) has them as `adminListApiKeys`, `adminCreateApiKey`, `adminGetApiKey`, `adminUpdateApiKey`, `adminRevokeApiKey`, `adminRotateApiKey` and `adminGetApiKeyUsage`.

### The key object

Every endpoint except usage returns keys in this shape. It never contains the key itself, except `key` in a create or rotate response.

| Field | Meaning |
|---|---|
| `id` | Key id; your services see it as `X-Api-Key-Id` |
| `name` | Label for admins, 1 to 100 characters |
| `prefix` | The first 12 characters of the key (`tsk_` plus 8), to recognize it |
| `consumer` | Who the key is for; your services see it as `X-Api-Key-Consumer` |
| `limitPerMinute`, `limitPerHour`, `limitPerDay`, `limitPerWeek`, `limitPerMonth` | The key's own limits; `null` means the gateway default applies (see [Limits](#limits)) |
| `status` | `ACTIVE` or `REVOKED` |
| `expired` | `true` once `expiresAt` has passed (an `ACTIVE` key can be expired) |
| `expiresAt` | When the key stops working; `null` for no expiry |
| `lastUsedAt` | Last use as copied by the [usage job](#the-usage-job); `null` until the job has seen a request |
| `revokedAt` | When the key was revoked |
| `createdById` | The admin who created the key (audit only; the key does not belong to them) |
| `createdAt`, `updatedAt` | Timestamps |

### Create a key

```bash
curl -X POST http://localhost:8000/auth/v1/admin/api-keys \
  -H "Authorization: Bearer <admin-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production integration",
    "consumer": "acme-corp",
    "limitPerMinute": 60,
    "limitPerMonth": 100000,
    "expiresAt": "2027-06-30T23:59:59Z"
  }'
```

| Field | Required | Rules |
|---|---|---|
| `name` | Yes | 1 to 100 characters |
| `consumer` | Yes | See [consumer names](#consumer-names) |
| `limitPerMinute` ... `limitPerMonth` | No | Integers from 1 to 2147483647. Leave one out to use the gateway default for that window |
| `expiresAt` | No | ISO 8601 with `Z` or an explicit offset (`+02:00`), in the future, before year 10000. Leave it out for a key without expiry |

The response is the key object plus `key`, the key itself (`tsk_` followed by 43 characters). **It is shown this one time only.** Only its hash is stored, so a lost key cannot be recovered; rotate it instead. Hand it to the consumer over a secure channel.

A consumer can have several keys, for example one per environment or integration. Limits are per key, not per consumer.

### Consumer names

- Kebab-case: lowercase letters, digits and single hyphens, starting with a letter (`acme-corp`, `partner2`).
- At most 64 characters.
- Not `internal` or `partner`, and not ending in `-service`: your services use `req.service` values like these for other kinds of callers.

Anything else gets 400 with the reason.

### Update limits and expiry

`PATCH` changes `name`, any of the five limits, or `expiresAt`. A field you leave out stays as it is. `null` removes a limit (the gateway default applies again) or removes the expiry.

```bash
curl -X PATCH http://localhost:8000/auth/v1/admin/api-keys/<id> \
  -H "Authorization: Bearer <admin-access-token>" \
  -H "Content-Type: application/json" \
  -d '{ "limitPerMinute": 600, "limitPerMonth": null, "expiresAt": null }'
```

Changes apply at the gateway on the key's next request. Unlike creating, an update accepts an `expiresAt` in the past: the key expires immediately. An expired key can be brought back by moving `expiresAt` into the future. A revoked key cannot be updated (409).

### Revoke

`POST /auth/v1/admin/api-keys/:id/revoke` stops the key on its next request: the gateway answers 401 `api_key_revoked`. Revoking cannot be undone; issue a new key instead. Revoking an already revoked key returns 200 and changes nothing. Revoked keys stay in the list as history.

### Rotate

Rotation replaces a key without an outage:

```bash
curl -X POST http://localhost:8000/auth/v1/admin/api-keys/<id>/rotate \
  -H "Authorization: Bearer <admin-access-token>" \
  -H "Content-Type: application/json" \
  -d '{ "graceHours": 72 }'
```

- A new key is created with the same name, consumer, limits and expiry. The response has it as `newKey`, including `key` (shown once).
- The old key keeps working for the grace period: its expiry becomes the earlier of its current expiry and now plus `graceHours`. The response has it as `previousKey`.
- `graceHours` is 0 to 2160 (90 days), 168 (7 days) by default. `0` ends the old key immediately.
- Both keys work during the grace, with separate counters.
- Revoked keys and expired keys cannot be rotated (409). For an expired key, extend its expiry first.

To end the grace early, revoke the old key.

### Usage

`GET /auth/v1/admin/api-keys/:id/usage` returns the saved request totals, newest period first:

```json
[
  { "period": "2026-W40", "count": 1234 },
  { "period": "2026-09", "count": 20510 }
]
```

- Periods are ISO weeks (`2026-W40`, weeks start Monday 00:00 UTC) and calendar months (`2026-09`, UTC).
- `count` is the number of requests the gateway admitted in that period, as of the last run of the [usage job](#the-usage-job). Rejected requests are not counted.
- `count` is a JSON number, or a decimal string for values above 2^53 - 1.

Totals only move when the usage job runs: every 5 minutes in the cloud once it is scheduled, and only when you call it locally.

### Error responses

| Status | When |
|---|---|
| 400 | Invalid body or query: consumer name, limits, `expiresAt` format, an expiry in the past on create, `graceHours` out of range |
| 401 | Missing or invalid access token |
| 403 | The caller is not an active admin. The role in the token is checked first, then the auth-service re-reads the caller from the database, so a demoted admin loses access immediately |
| 404 | No key with that id |
| 409 | The key is revoked (update, rotate) or expired (rotate), or another admin changed the same key while the request ran (reload and retry) |
| 429 | More than 1,000 admin API key requests per hour from one admin |
| 503 | Redis is unavailable. Nothing was changed; retry later |

## Limits

Each key can limit five windows: **minute, hour, day, week and month**. All windows are fixed calendar windows in UTC: a minute starts at second 0, a day at 00:00 UTC, a week on Monday 00:00 UTC (ISO week), a month on the 1st at 00:00 UTC.

When a window is at its limit, the gateway answers 429 until that window ends:

- `rate_limit_exceeded` for the minute, hour and day windows,
- `quota_exceeded` for the week and month windows.

Rejected requests do not count. Every window is checked and counted in one atomic step in Redis, so several gateway instances share the same counters and a burst cannot overshoot a limit.

### Defaults from the global rate limiter

`kong.user.yml` has a global `rate-limiting` plugin that limits every caller (the generated file starts with `minute: 100`). On API key routes it works as the **default for every key**, counted per key instead of per IP:

- For each window, a key uses its own limit when it has one, otherwise the global value for that window. A key's own limit can be higher or lower than the global one, so you can sell a higher tier.
- The global `minute`, `hour`, `day` and `month` values become the defaults. The global limiter has no `week`, so there is no default week limit. `second` and `year` do not exist for keys: `generate-kong` warns and ignores them on API key routes.
- There is no way to make a key unlimited in a window that has a global default: give it a very high limit instead.
- Without an enabled global `rate-limiting` plugin, keys without their own limits are only bounded by the [per-IP ceiling](#the-per-ip-ceiling).
- Logged-in users and public routes keep the global limiter as before, per IP.

The defaults are copied into the gateway config when it is generated. After changing the global limiter, run `npx tsdevstack sync` locally, or `infra:generate-kong`, `infra:build-kong` and `infra:deploy-kong` in the cloud. Limits set on a key through the admin API need nothing of that: they apply on the next request.

### Rate-limit headers

Every admitted request gets headers for each window that has a limit (the key's own or a default):

| Header | Value |
|---|---|
| `X-RateLimit-Limit-Minute`, `-Hour`, `-Day`, `-Week`, `-Month` | The limit of that window |
| `X-RateLimit-Remaining-Minute`, `-Hour`, `-Day`, `-Week`, `-Month` | Requests left in that window |
| `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` | The window with the fewest requests left (seconds until it resets) |

A 429 from a key limit carries the same headers plus `Retry-After`: seconds until the exceeded window ends (the longest one, when several are exceeded).

## Expiry and trials

Any key can have an expiry. From the second `expiresAt` is reached, the gateway answers 401 `api_key_expired`; no job is involved. Keys without an expiry work until they are revoked.

There is no separate trial concept. A trial is a key with low limits and a near expiry. To upgrade a trial, update the limits and move or remove the expiry; the next request already runs on the new terms.

## Gateway responses

What callers of your API get from the gateway on API key routes. Every error body is JSON with `error` and `message`:

```json
{ "error": "api_key_revoked", "message": "API key revoked" }
```

| Status | `error` | `message` | Cause |
|---|---|---|---|
| 400 | `too_many_headers` | Too many request headers | More than 1,000 request headers |
| 401 | `api_key_missing` | An API key is required | No `x-api-key` header, an empty one, or the header sent twice |
| 401 | `invalid_api_key` | Invalid API key | Unknown key |
| 401 | `api_key_revoked` | API key revoked | The key was revoked |
| 401 | `api_key_expired` | API key expired | `expiresAt` has passed |
| 429 | `rate_limit_exceeded` | API rate limit exceeded | Minute, hour or day limit reached |
| 429 | `quota_exceeded` | API quota exceeded | Week or month limit reached |
| 503 | `index_unavailable` | API key index unavailable, retry later | Redis lost its data and the key index is being rebuilt (see [Failure behavior](#failure-behavior)) |
| 503 | `gateway_unavailable` | API key validation unavailable, retry later | Redis is unreachable or full, or a key record the gateway cannot read |

Headers on these responses:

- Every 401 has `WWW-Authenticate: Key realm="tsdevstack"`.
- Every 429 has `Retry-After` and the rate-limit headers above.
- Every 503 has `Retry-After: 5`.

Two more responses come from elsewhere in the gateway:

- **404** (`no Route matched with those values`): the path or method is not an `@PartnerApi()` operation. See [Exact routes](/docs/building-apis/gateway-routing#exact-routes).
- **429** with `{ "message": "API rate limit exceeded" }` and no `error` field: the [per-IP ceiling](#the-per-ip-ceiling). It carries `X-RateLimit-Limit-Minute`, `X-RateLimit-Remaining-Minute`, `RateLimit-*` and `Retry-After`.

A revoked or expired key answers `api_key_revoked` or `api_key_expired` for about a day. After that its record is gone from Redis and the answer becomes `invalid_api_key`.

CORS headers on these responses come from your global `cors` plugin, like everywhere else. Browsers can only send `x-api-key` if it is in that plugin's allowed `headers`, as it is in the generated `kong.user.yml`.

## The per-IP ceiling

API key routes have a second limit that has nothing to do with keys: at most **600 requests per minute from one client IP** by default, whatever key they carry, valid or not. It runs before the key check, so it also counts guessing attempts with made-up keys. It is not a usage limit; give heavy users higher key limits and keep the ceiling as a safety net.

On API key routes the ceiling takes the place of the global limiter, which becomes the per-key default described above. Change it in `.tsdevstack/config.json`:

```json
{
  "framework": {
    "apiKeys": {
      "ipLimitPerMinute": 1200
    }
  }
}
```

It must be a positive integer; anything else makes `generate-kong` and `infra:generate-kong` fail with an error. Like other gateway config, a change needs `npx tsdevstack sync` locally, or `infra:generate-kong`, `infra:build-kong` and `infra:deploy-kong` in the cloud.

If many legitimate clients share one IP address (a corporate proxy, a NAT), raise the ceiling.

:::info Local development
Locally the gateway takes the client IP from a client-sent `X-Forwarded-For` header, so the ceiling can be bypassed on your machine. In the cloud the client IP comes from your load balancer.
:::

## Failure behavior

API key validation **fails closed**: when the gateway cannot check a key, the request gets 503 and never reaches your service. Logged-in users and public routes are not affected by any of this.

| Situation | What happens |
|---|---|
| Redis unreachable from the gateway | 503 `gateway_unavailable` until Redis is back. No restart needed |
| Redis full | Redis runs with `noeviction` everywhere, so it never drops keys silently. Writes fail: API key calls get 503, admin key changes get 503 with nothing changed. Background jobs (BullMQ) are affected too, so alert on Redis memory |
| Redis lost its data (restart without persistence, failover, flush) | The auth-service rebuilds the key index from Postgres. Until then, keys get 503 `index_unavailable`. Keys created or changed since the loss already work |
| Admin change while Redis is down | 503, nothing changed |
| auth-service down or scaled to zero | Key validation is unaffected; only the admin API waits for it |

### How the index is rebuilt

Postgres is the source of truth for keys; Redis holds a copy the gateway reads (the index). The auth-service writes every change to Redis first and then to Postgres, and undoes the Redis write if Postgres fails, so the two do not drift.

When Redis loses its data, a marker key (`apikey:meta`) disappears with it. A key the gateway cannot find while the marker is missing gets 503 `index_unavailable` instead of 401, so your callers retry instead of treating their key as invalid. The auth-service rebuilds the index when the marker is missing:

- when it starts (if Redis is reachable),
- every time its Redis connection comes back after an outage,
- every time the [usage job](#the-usage-job) runs.

The rebuild writes the record of every active key that has no record yet, never overwriting one, so it cannot bring back a revoked key. It adds the week and month totals saved by the usage job to the counters, so quotas survive the loss up to the last job run. Minute, hour and day counters start from zero. Only one auth-service instance rebuilds at a time. The marker is written last.

:::warning Resetting the key index by hand
To reset the index, flush Redis completely, then call the usage job (locally: `curl -X POST http://localhost:3001/auth/jobs/sync-api-key-usage`) or restart the auth-service. Flushing a running Redis does not reconnect the auth-service, so the rebuild waits for one of these.

Never delete only `apikey:meta` while the counters are still there. The rebuild would add the saved week and month totals on top of the live counters and count that usage twice.
:::

## The usage job

The auth-service has a job endpoint, `POST /auth/jobs/sync-api-key-usage`, that:

1. rebuilds the key index if Redis lost it,
2. copies the current and previous week and month totals of every key from Redis to Postgres (a saved total never goes down),
3. copies each key's last-used time (`lastUsedAt`).

When the index is still missing because another instance is rebuilding it, the job copies nothing and returns `success: false`; the next run catches up.

The job is not scheduled for you. Add it to `scheduledJobs` of **every cloud environment** in `.tsdevstack/infrastructure.json`:

```json
{
  "staging": {
    "scheduledJobs": [
      {
        "name": "sync-api-key-usage",
        "schedule": "*/5 * * * *",
        "targetService": "auth-service",
        "endpoint": "/auth/jobs/sync-api-key-usage",
        "method": "POST"
      }
    ]
  }
}
```

The endpoint includes the auth-service prefix (`/auth` unless you changed it). `infra:generate` prints a warning with the exact entry for your project when an environment does not have it. Deploy it with `npx tsdevstack infra:deploy-schedulers --env <env>` (a full `infra:deploy` includes schedulers).

Without the job, usage totals and `lastUsedAt` never reach Postgres, week and month quotas restart from zero after a Redis loss, and a lost index is only rebuilt when the auth-service restarts or reconnects to Redis. See [Scheduled Jobs](/docs/features/scheduled-jobs) for how jobs work.

## Local development

Everything runs locally: the gateway image includes the key plugin, and Redis is part of the generated `docker-compose.yml`.

1. After upgrading the CLI, run `npx tsdevstack sync` so the gateway image and config are regenerated.
2. Become admin and get an access token: [Managing Users](/docs/authentication/managing-users#local-walkthrough).
3. Create a key with the curl call from [Create a key](#create-a-key) and copy `key` from the response.
4. Call an `@PartnerApi()` endpoint through the gateway:

```bash
curl http://localhost:8000/api/offers/v1/plans \
  -H "x-api-key: tsk_..."
```

Scheduled jobs do not run locally. To see usage totals or `lastUsedAt`, call the job by hand:

```bash
curl -X POST http://localhost:3001/auth/jobs/sync-api-key-usage
```

Use the auth-service port from `.tsdevstack/config.json` if you changed it. Locally `SchedulerGuard` lets the call through without credentials.

## User-owned keys

Keys belong to consumers, and only admins manage them. If your product needs self-service keys (each user creates keys for their own account), build that on top: add your own endpoints in the auth-service that reuse its key service, check that the caller owns the account, and record which user or account a key belongs to in your own table. The gateway only cares about the Redis record described below.

## Managing keys without the auth service

Projects without the auth template (`"template": null`) get the same gateway behavior: `@PartnerApi()` routes still check keys against Redis. Nothing writes keys for you, so `generate-kong` prints a note when your project has `@PartnerApi()` routes and no auth template. Your own tooling writes the key records described here. This section is a public, versioned contract.

### Requirements

- Write to the same Redis the gateway uses (the `REDIS_HOST`, `REDIS_PORT` and `REDIS_PASSWORD` secrets), database 0.
- Redis must be one endpoint: standalone, a primary endpoint, or a cluster endpoint that proxies commands. The gateway does not follow cluster redirects. Every generated environment already works this way.
- Keep Redis on `noeviction` (the framework configures it everywhere).
- Your tooling writes the records and the marker; the gateway maintains the counters.

### Key names

`<h>` is the SHA-256 of the key exactly as clients send it in `x-api-key` (UTF-8), as 64 lowercase hex characters. The braces are part of the name: they are a Redis Cluster hash tag that keeps all entries of one key in one slot.

| Redis key | Written by | Content |
|---|---|---|
| `apikey:{<h>}:rec` | You | The key record (JSON, below) |
| `apikey:{<h>}:min:<start>` | Gateway | Admitted requests in the minute starting at `<start>` (epoch seconds) |
| `apikey:{<h>}:hour:<start>` | Gateway | Same, per hour |
| `apikey:{<h>}:day:<start>` | Gateway | Same, per UTC day |
| `apikey:{<h>}:week:<start>` | Gateway | Same, per ISO week (`<start>` is Monday 00:00 UTC) |
| `apikey:{<h>}:month:<YYYY-MM>` | Gateway | Same, per UTC calendar month |
| `apikey:{<h>}:lu` | Gateway | Last use, epoch seconds |
| `apikey:meta` | You | The index marker |

Other names under `apikey:` are reserved (the auth-service uses `apikey:rebuild-lock` and `apikey:{<h>}:seeded:...` for its rebuild). Don't write anything else under that prefix.

### The record

```json
{"v":1,"id":"c0a8f1d2-5b6e-4f3a-9d7c-1e2f3a4b5c6d","consumer":"acme-corp","status":"active","limits":{"minute":60,"month":100000},"expiresAt":1814399999}
```

| Field | Required | Rules |
|---|---|---|
| `v` | Yes | Record format version: `1` |
| `id` | Yes | 1 to 128 characters of letters, digits, `.`, `_`, `-`. Sent to your services as `X-Api-Key-Id` |
| `consumer` | Yes | Same characters and length. Sent as `X-Api-Key-Consumer` |
| `status` | Yes | `active` or `revoked` (lowercase) |
| `limits` | Yes | Object with any of `minute`, `hour`, `day`, `week`, `month`; each an integer from 1 to 2147483647. `{}` for no limits of its own (the defaults apply) |
| `expiresAt` | No | Epoch seconds (integer). The key is expired from that second on |

- Leave out absent fields. `null` is invalid.
- Times are integer epoch seconds, UTC.
- The auth-service writes the fields in the order shown (`v`, `id`, `consumer`, `status`, `limits` from minute to month, `expiresAt`); the gateway does not depend on the order. Unknown extra fields are ignored.
- A record that breaks these rules gets 503 `gateway_unavailable` and an error line in the gateway log.

Expiry (TTL) of the record entry:

| Key state | Redis expiry |
|---|---|
| Active, no `expiresAt` | None |
| Active with `expiresAt` | One day after `expiresAt` |
| Revoked | One day after the revocation |

Revoke by writing the full record with `"status":"revoked"` and a one-day TTL, not by deleting it: during that day callers get `api_key_revoked` instead of `invalid_api_key`. Every change is a full record write; there is no field-level update.

What the gateway does with the counters, so you can read them: minute, hour and day counters exist only while a limit applies to that window and expire at the end of their window. Week and month counters count every admitted request, with or without a limit, and expire one day after their window ends, so you can still read the final total of a finished period. `lu` is written at most once a minute and expires after 30 days without use.

### The marker

`apikey:meta` tells the gateway that the index is complete. While it exists, a key without a record gets 401 `invalid_api_key`. While it is missing, the gateway assumes Redis lost its data and answers 503 `index_unavailable`.

- Write it after you have written every record, and write it again after Redis loses its data. The auth-service writes `{"v":1,"rebuiltAt":<epoch seconds>}`; only its existence counts.
- Never give it a TTL, and never delete it on its own.

### Example

With `redis-cli`, for a client that sends `x-api-key: tsk_example`:

```bash
# <h> = sha256 hex of the key
printf '%s' 'tsk_example' | shasum -a 256

redis-cli -a "$REDIS_PASSWORD" SET 'apikey:{<h>}:rec' \
  '{"v":1,"id":"key-1","consumer":"acme-corp","status":"active","limits":{"minute":60}}'
redis-cli -a "$REDIS_PASSWORD" SET apikey:meta '{"v":1,"rebuiltAt":1790709764}'
```

In a Node.js project, `@tsdevstack/nest-common` exports the contract as code, so your tooling cannot drift from it:

```typescript
import {
  API_KEY_INDEX_MARKER_KEY,
  buildApiKeyRecordKey,
  encodeApiKeyRecord,
  getApiKeyRecordExpireAt,
  hashApiKey,
} from '@tsdevstack/nest-common';
import type { ApiKeyRecord } from '@tsdevstack/nest-common';

const record: ApiKeyRecord = {
  v: 1,
  id: 'key-1',
  consumer: 'acme-corp',
  status: 'active',
  limits: { minute: 60 },
};
const now = Math.floor(Date.now() / 1000);

const redisKey = buildApiKeyRecordKey(hashApiKey(rawKey)); // apikey:{<h>}:rec
const value = encodeApiKeyRecord(record); // validates, then serializes
const expireAt = getApiKeyRecordExpireAt(record, now); // epoch seconds or null
// SET redisKey value (with EXAT expireAt when it is not null),
// then SET API_KEY_INDEX_MARKER_KEY once the index is complete
```

The package also exports `validateApiKeyRecord`, `decodeApiKeyRecord`, `buildApiKeyCounterKey`, `buildApiKeyLastUsedKey`, the window helpers (`getApiKeyWindowStart`, `getApiKeyWindowEnd`, `getApiKeyWindowId`, `getApiKeyCounterExpireAt`) and the `API_KEY_*` constants.

### Compatibility

The record format is versioned by `v`. Newer gateway versions keep reading every earlier record version, and a breaking change to the format gets a new `v`. Records your tooling wrote for version 1 keep working after a CLI upgrade. A record with a `v` the gateway does not know (written by newer tooling than the gateway) gets 503 `gateway_unavailable`; upgrade the CLI and rebuild the gateway.

## Migrating from static partner keys

Earlier versions configured partner keys as consumers with `keyauth_credentials` in `kong.user.yml`, with the key values in `.secrets.user.json`. Those keys no longer work: partner routes only check keys in Redis. `generate-kong` and `infra:generate-kong` warn while `kong.user.yml` still has such consumers.

To move your partners over without an outage:

1. Upgrade and add the API key parts of the auth-service (see the [release notes](/docs/releases/v0.8.0)).
2. Deploy the auth-service, then create a key per partner through the admin API and hand the keys over. The old keys keep working until the gateway is redeployed.
3. Regenerate and redeploy the gateway (`npx tsdevstack sync` locally; `infra:generate-kong`, commit `infrastructure/kong/<env>/kong.yml`, `infra:build-kong`, `infra:deploy-kong` in the cloud). From here only the new keys work.
4. Remove the consumers from `kong.user.yml` and the old key values from `.secrets.user.json` and each cloud environment (`npx tsdevstack cloud-secrets:remove <KEY> --env <env>`).

Partner keys are not secrets of your project anymore. Nothing about them goes into `.secrets.user.json` or the cloud secret manager.
