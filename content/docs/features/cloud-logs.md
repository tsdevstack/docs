# Cloud Logs

`infra:logs` reads the logs of a deployed environment from your terminal. It covers every service, worker, frontend, Kong, migration run and scheduled job, plus the load balancer and WAF in front of them. The command and its output are the same on GCP, AWS and Azure.

## List the sources

Without a source name, the command lists the sources of the environment and when each one last logged:

```bash
npx tsdevstack infra:logs --env dev
```

```
Log sources in dev, with each one's last line (UTC):

  auth-service            service    2026-11-01 11:25:12
  bff-service             service    2026-11-01 11:14:00
  offers-service          service    2026-11-01 11:18:38
  auth-worker             worker     2026-11-01 11:16:00
  frontend                frontend   2026-11-01 11:16:58
  kong                    kong       2026-11-01 11:20:08
  migrate-auth-service    migration  2026-11-01 11:14:44
  migrate-offers-service  migration  2026-11-01 11:18:01
  db-init                 db-init    2026-11-01 11:12:30
  cleanup-tokens          job        2026-11-01 08:00:13
  sync-api-key-usage      job        2026-11-01 11:25:20
  edge                    edge       2026-11-01 11:08:05

Read one source:   npx tsdevstack infra:logs <source> --env dev
Read all sources:  npx tsdevstack infra:logs --all --env dev
```

| Type | What it is |
|------|------------|
| `service` | A NestJS service |
| `worker` | A detached worker |
| `frontend` | A Next.js app |
| `kong` | The gateway. The load balancer's health checks are left out |
| `migration` | Migration runs of a service with a database (`migrate-<service>`) |
| `db-init` | The database setup that `infra:deploy` runs: each service's database users and their access |
| `job` | Runs of a scheduled job |
| `bucket` | Every read and write of a storage bucket's files (`bucket-<name>`) |
| `edge` | The load balancer and the WAF |

SPAs log nothing of their own. Their requests show under `edge`. The list looks back 30 days.

## Read the logs

```bash
# One source
npx tsdevstack infra:logs auth-worker --env dev

# Every source in one timeline
npx tsdevstack infra:logs --all --env dev
```

The command prints every line of the time window, oldest first, as the pages arrive. The window is the last hour unless you set one. There is no line limit: narrow the output with the filters below.

```
auth-worker in dev, 2026-11-01 11:15:30 to 2026-11-01 11:15:50 (times in UTC)
2026-11-01 11:15:34.961  auth-worker  platform  INFO   google.cloud.run.v2.Services.UpdateService
2026-11-01 11:15:36.667  auth-worker  platform  INFO   Starting new instance. Reason: MANUAL_OR_CUSTOMER_MIN_INSTANCE - Instance started because of customer-configured min-instances or manual scaling.
2026-11-01 11:15:45.852  auth-worker  app       INFO   [Worker] Starting worker for auth-service
2026-11-01 11:15:46.369  auth-worker  app       INFO   [ResendEmailProvider] Resend email provider initialized
2026-11-01 11:15:46.442  auth-worker  app       INFO   [Worker] Worker started, health on :8080
2026-11-01 11:15:47.551  auth-worker  platform  INFO   STARTUP HTTP probe succeeded after 6 attempts for container "auth-service-1" on port 8080 path "/health".
```

Each line shows the time, the source, the kind, the level and the message. A line from a NestJS service adds its context (`[Worker]`), the error name and message, and the correlation ID. Every other field is in `--json`.

The three kinds:

| Kind | Lines |
|------|-------|
| `app` | What your code writes |
| `platform` | What the cloud says about running it: deploys, instance starts and stops, crashes, health checks, access to storage buckets |
| `edge` | Requests at the load balancer, and what the WAF blocked |

Platform lines belong to their service, so a service's own source shows why it restarted.

```
2026-11-01 11:08:05.095  edge  edge      WARN   GET api.example.com/blog/robots.txt 400 255ms
```

## Storage bucket access

Each storage bucket has its own source, `bucket-<name>`. A line is one read or write of a file: the operation, the file, the error when it failed, who did it and from where.

```
2026-11-09 12:00:00.000  bucket-uploads  platform  INFO   GetObject avatars/u1.png by shop-auth-service-task from 203.0.113.5
```

- The operation is the cloud's own name: `storage.objects.get` on GCP, `GetObject` on AWS, `GetBlob` on Azure.
- Who: the service's identity (its service account on GCP, its task role on AWS). A browser that uses a signed URL shows the service that signed it, with the browser's address. Azure names how the request signed in: `OAuth` for a service, `SAS` for a signed URL.
- A refused or missing file is a warning, a failure on the cloud's side an error. `--level warn` shows only those.
- Listing a bucket shows `(bucket)` in place of a file.

Logging every access costs a little per million. See your provider's cost page.

## Filters

| Option | What it does |
|--------|--------------|
| `--since <time>` | Start of the window: `30m`, `1h` (default), `2d`, or a UTC time such as `2026-11-01T14:00` |
| `--until <time>` | End of the window (default: now) |
| `--level <level>` | This level and above: `debug`, `info`, `warn`, `error`, `fatal` |
| `--kind <kind>` | Only `app`, `platform` or `edge` lines |
| `--grep <text>` | Lines that contain this text, in any case (the message and the fields) |
| `--json` | One JSON object per line |

Times are UTC, in the options and in the output. A time without a zone counts as UTC.

`--level` leaves out lines without a level: Kong and other plain text. The command says so once. The Next.js apps' lines have levels when `instrumentation.ts` calls `logConsoleAsJson` (the template does; see [telemetry](/docs/packages/telemetry#logconsoleasjsonoptions)). Lines from your NestJS services carry pino's levels. Platform lines get theirs from the cloud: on AWS a crash or failed start is `error`, a failed health check `warn`, and a deploy `info`.

The header and the notices go to standard error and the lines to standard output, so `--json` output pipes cleanly:

```bash
npx tsdevstack infra:logs auth-service --env prod --since 2h --level error --json > errors.jsonl
```

A JSON line holds `time`, `source`, `kind`, `level`, `message`, `fields` and `raw`, the provider's own record.

## Watch new lines

`--follow` prints new lines as they are written, until you press Ctrl+C:

```bash
npx tsdevstack infra:logs auth-service --env dev --follow
npx tsdevstack infra:logs --all --env dev --follow --level warn
```

- It shows only lines written after it starts. For earlier lines, run the command without `--follow`. `--since` and `--until` don't work with it.
- `--level`, `--kind`, `--grep` and `--json` work as usual.
- It stops by itself after 1 hour. Add `--no-time-limit` to keep it going until Ctrl+C.
- When a connection drops, it reconnects on its own, up to 3 tries in a row, and says that lines written in between may be missing.
- Lines print as they arrive, so lines from different sources can be slightly out of order.

What each cloud streams:

| | GCP | AWS | Azure |
|---|-----|-----|-------|
| Services and workers | Live | Live | Live |
| Frontends and Kong | Live | Live | Live (App Service's request log: every 30 seconds, 1 to 10 minutes late) |
| Migrations, db-init and scheduled jobs | Live | Live | Every 30 seconds, 1 to 10 minutes late |
| Storage buckets | Live | Live, after CloudTrail's own delay | Every 30 seconds, 1 to 10 minutes late |
| Edge | Live | Live | Every 30 seconds, 1 to 10 minutes late |
| Cost | Free | $0.01 per session minute after 1,800 free minutes a month | Free |

**GCP.** One live stream from Cloud Logging covers every source. Google allows 10 at once per project, the Logs Explorer's live mode included.

**AWS.** CloudWatch Live Tail, one session per 10 log groups. The WAF log lives in us-east-1 and gets a session of its own. The command says how many sessions it opened. AWS bills each session by the minute, and `--all` on a typical project opens 2 or 3, so an hour of it uses 120 to 180 of the free minutes. That's why `--follow` stops after an hour unless you add `--no-time-limit`. AWS allows 15 sessions at once per account and region. Platform lines (deploys, stopped tasks) come from ECS, checked every 10 seconds. A log group created after the command started, such as a migration's first run, is followed the next time you run it.

**Azure.** Services and workers stream live. Each running replica has its own stream, and the command checks for new replicas every 10 seconds, so a deploy or a scale-out shows up. Their platform events stream live too.

Kong and the Next.js apps stream live from App Service's own log stream (the app's Kudu site, the same one `az webapp log tail` reads): everything the app prints, and App Service's container events (image pulls, starts, stops) as platform lines. Lines show up about 1 to 3 seconds after they're written. The stream doesn't say which instance a line comes from. App Service's request log (one line per request, written by Azure, not by the app) isn't in that stream, so it comes from Log Analytics. Kong prints its own line for every request, live; Next.js doesn't, so a page request shows up only in that late log. With Front Door Premium the apps have no public access, their log stream included, so Kong and the Next.js apps come from Log Analytics instead.

The stream signs in with the environment's credentials and needs deploy rights on the app, which Contributor includes. It sends what App Service writes to the app's log files, which the deploy turns on: an environment deployed with an older CLI shows no Kong or Next.js lines in `--follow` until its next `infra:deploy`.

Jobs, storage buckets and edge have no live stream, so the command reads them from Log Analytics every 30 seconds. Their lines show up 1 to 10 minutes after they are written (Front Door itself takes a few minutes to deliver its logs), and the command says which sources come late.

## Follow one request

Every line a NestJS service writes inside a request carries the request's `trace_id`, the request line included. Search for it across every source:

```bash
npx tsdevstack infra:logs --all --env prod --since 1h --grep 4bf92f3577b34da6a3ce929d0e0e4736
```

You get the lines of every service the request passed through, in order. On GCP, Cloud Run's request lines for Kong and the services match too. The Next.js apps' lines carry the ID when `instrumentation.ts` calls `logConsoleAsJson`. Kong's own lines are plain text without the ID. The request line also carries `correlationId` (Kong's request ID, returned to the client as `X-Correlation-ID`), so a support ticket with that ID works too. See [Traces and Dashboards](/docs/features/traces-and-dashboards) for the full trace.

## Log level of deployed services

Deployed NestJS services and workers log at `info`. Set `logLevel` per service in `infrastructure.json` to change it:

```json
{
  "dev": {
    "auth-service": { "logLevel": "debug" }
  }
}
```

The levels are pino's: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. The change applies with the next deploy. Locally, `.env` sets `LOG_LEVEL=debug`.

## Kong's startup warnings

Every time Kong starts, locally or in the cloud, it logs dozens of lines like this one:

```
[warn] ... rate-limiting: config.redis_host is deprecated, please use config.redis.host instead (deprecated after 4.0)
```

They come from Kong 3.9 itself (Kong issue 14418), not from your config: tsdevstack only sets the new `redis` fields. Rate limiting works as configured. You can ignore them.

## Per provider

| | GCP | AWS | Azure |
|---|-----|-----|-------|
| Store | Cloud Logging | CloudWatch Logs | Log Analytics |
| Edge lines | Load balancer and Cloud Armor | WAF log | Front Door access and WAF logs |
| Delay before a line shows | Seconds | Seconds | 1 to 10 minutes |
| Storage bucket access | Cloud Storage's audit logs, seconds | CloudTrail data events, about 5 minutes on average | Blob logs (`StorageBlobLogs`), 1 to 10 minutes |
| Reading costs | Nothing | Nothing | Nothing on the Analytics plan |

**GCP.** Google allows 60 log reads per minute per project. Reading many sources over a long window can reach that limit. The command keeps the lines it printed, stops, and prints a Logs Explorer link with the same query. Reading needs the Logs Viewer role (`roles/logging.viewer`), which `infra:bootstrap` adds to the deploy account. A project set up with an older CLI runs `infra:bootstrap --env <env>` once.

**AWS.** ECS keeps no platform logs in CloudWatch. The command builds the platform lines from ECS service events and stopped tasks (reason and exit code). ECS keeps stopped tasks for about an hour. The edge source is the WAF log; the CloudFront and load balancer access logs are files in S3 and are not read. The WAF log leaves out the `Authorization`, `Cookie` and frontend token headers.

**Azure.** Lines arrive in Log Analytics 1 to 10 minutes after they are written. Container Apps write to resource-specific tables (`ContainerAppConsoleLogs`, `ContainerAppSystemLogs`). An environment deployed with an older CLI wrote to other tables; those older lines don't show.

## Personal data

Logs hold what your code and the platform wrote: email addresses, IP addresses, URLs with their query strings. The command shows them as stored and masks nothing. Use them to debug; don't copy them elsewhere. The logger already redacts common fields such as `password` and `token` (see [PII redaction](/docs/features/observability#pii-redaction)).

## From an AI agent

The MCP server has a `get_logs` tool with the same filters. It returns the newest 200 lines of the window and says which lines it left out, so the agent narrows the query instead of reading a truncated result. It has no `--follow`: a tool call returns once. Because logs can hold personal data, the tool tells the agent to ask you before every read. See [MCP Server](/docs/features/mcp-server).
