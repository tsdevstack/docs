# GCP Cost Estimation

:::tip No fees from tsdevstack
tsdevstack is free and open source. All costs on this page are paid directly to Google Cloud. There is no bill from tsdevstack and there never will be.
:::

These are estimates based on published GCP pricing as of July 2026 in a US region (us-central1). Actual costs depend on your region, traffic, and any pricing changes by Google. Always verify with the official pricing pages linked at the bottom.

:::info 2026 pricing pressure
The AI buildout is squeezing server hardware supply, and that is expected to reach cloud list prices in the second half of 2026. As of July 2026 the GCP rates on this page are unchanged. Server memory contract prices rose sharply through the first half of 2026, and there is typically a 6 to 9 month lag before that shows up in cloud pricing, with forecasts pointing to roughly 5-10% general increases.

On GCP the most exposed lines are **Cloud SQL** and **Memorystore**, which are priced off provisioned memory, followed by **Cloud Run** compute. Load balancer and Cloud Armor fees are the least exposed. If you are budgeting past Q3 2026, add a 10% buffer on the database and cache lines.
:::

---

## What Gets Deployed

A typical tsdevstack project (3 NestJS backends + 1 Next.js frontend) creates these billable resources on GCP:

| Resource | GCP Service | Default Configuration |
|----------|------------|----------------------|
| Kong gateway | Cloud Run | 1 vCPU, 1 GiB memory, **min 1 instance** (always on), plus a trace collector next to it (0.25 vCPU, 256 MiB) |
| Backend services (x3) | Cloud Run | 1 vCPU, 512 MiB memory, configurable min instances |
| Frontend | Cloud Run | 1 vCPU, 512 MiB memory, configurable min instances |
| SPA (react-app) | GCS bucket + Cloud CDN | Static bucket, no compute |
| Database | Cloud SQL PostgreSQL 15 | `db-f1-micro`, 10 GB disk |
| Cache | Memorystore Redis 7 | `BASIC` tier, 1 GB |
| Load Balancer | Global HTTPS LB | Static IP, forwarding rules |
| WAF | Cloud Armor | Standard tier, OWASP rule set |
| Secrets | Secret Manager | ~10-20 secrets |
| DNS | Cloud DNS | 1 managed zone |
| Container images | Artifact Registry | ~5 images |
| Traces | Cloud Trace | Every request (`tracing.sampleRate` 1) |
| Dashboard | Cloud Monitoring | 1 per environment, free |

You can override CPU, memory, instance counts, database tier, Redis tier, and disk size per service in `infrastructure.json`. See [Service Configuration](/docs/infrastructure/service-configuration) for all available options.

---

## Scenario 1 — Development (Scale-to-Zero)

Backend services and frontend set to `minInstances: 0` in `infrastructure.json` (the default is 1). Kong stays on (`minInstances: 1`). Messages for the backend services wait in Redis until a request starts them, which is fine for testing. **Assumed traffic: ~1,000 requests/day** (testing only).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong + collector (Cloud Run) | 1.25 vCPU, 1.25 GiB, min=1 | 730 hrs idle at $0.0000025/vCPU-sec + $0.0000025/GiB-sec | ~$16 |
| Backend services ×3 | 1 vCPU, 512 MiB, min=0 | Scaled to zero when idle — billed per request | ~$1-5 |
| Frontend | 1 vCPU, 512 MiB, min=0 | Scaled to zero when idle — billed per request | ~$1-3 |
| SPA bucket | GCS + Cloud CDN | Storage + minimal egress | ~$1 |
| Cloud SQL | db-f1-micro, 10 GB | Shared-core instance + storage | ~$10 |
| Memorystore Redis | BASIC, 1 GB | Billed per GiB-hour | ~$7 |
| Load Balancer | 4 forwarding rules (IPv4 and IPv6, HTTPS and HTTP redirect), low traffic | $0.025/hour covers the first 5 rules (~$18) + $0.008/GiB processed; addresses on forwarding rules are free | ~$18-19 |
| Cloud Armor | 1 policy, ~6 WAF rules | $5/policy + $1/rule + $0.75/million requests | ~$12 |
| DNS, Secrets, Registry | Minimal | ~$0.20/zone + ~$0.06/secret-version/month | ~$1 |
| Traces (Cloud Trace) | ~240k spans | Within the 2.5 million free spans | $0 |
| **Total** | | 16 + (1-5) + (1-3) + 1 + 10 + 7 + (18-19) + 12 + 1 + 0 | **~$67-74** |


Cold starts after scale-to-zero: **2-8 seconds**. Cloud Run handles this natively — no wake-up mechanisms needed.

:::tip Why Kong is only ~$16
tsdevstack deploys Kong with `cpuIdle: true`, which is request-based billing. A `minInstances: 1` instance that is not serving requests bills CPU at the reduced idle rate of $0.0000025/vCPU-second rather than the active rate of $0.000024/vCPU-second. In a dev environment the gateway sits idle nearly all month, so an always-on Kong costs far less than a full-rate calculation suggests. Kong's instance has 1.25 vCPU and 1.25 GiB: Kong's own 1 vCPU and 1 GiB, plus 0.25 vCPU and 256 MiB for the collector that sends Kong's spans to Cloud Trace.
:::

---

## Scenario 2 — Production (Always-On, Single Instance)

All services at `minInstances: 1` (the default). **Assumed traffic: ~100,000 requests/day** (3M/month).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong + collector (Cloud Run) | 1.25 vCPU, 1.25 GiB, min=1 | Idle CPU + memory 730 hrs + active CPU for 3M requests | ~$22 |
| Backend services ×3 | 1 vCPU, 512 MiB, min=1 each | Instance-based: 730 hrs × ($0.0648/vCPU-hr + 0.5 × $0.0072/GiB-hr) | ~$50 each, ~$150 |
| Frontend | 1 vCPU, 512 MiB, min=1 | 1 instance × 730 hrs | ~$13 |
| SPA bucket | GCS + Cloud CDN | Storage + egress | ~$1 |
| Cloud SQL | db-f1-micro, 10 GB | Same as dev (upgrade if needed) | ~$10 |
| Memorystore Redis | BASIC, 1 GB | Same as dev | ~$7 |
| Load Balancer | 4 rules, moderate traffic | $18.25 for the rules + data processing | ~$19-21 |
| Cloud Armor | 1 policy, ~6 rules | $5 + $6 + 3M × $0.75/M | ~$13 |
| DNS, Secrets, Registry | Minimal | — | ~$1 |
| Traces (Cloud Trace) | ~24M spans | (24M - 2.5M free) × $0.20/M | ~$4 |
| **Total** | | 22 + 150 + 13 + 1 + 10 + 7 + (19-21) + 13 + 1 + 4 | **~$240-242** |

Cloud Run has two billing modes: *CPU allocated during requests* (request-based) and *CPU always allocated* (instance-based).

- **Kong and the frontend** use request-based billing. An always-on instance pays memory for the full 730 hours, CPU at the idle rate while waiting, and the active CPU rate only while serving a request. The figures above assume ~3M requests/month at roughly 150ms of CPU each. Slower or heavier requests push these lines up toward the active rate.
- **NestJS services with `minInstances` 1 or more** use instance-based billing: CPU and memory for every second, with no per-request fee. Their CPU stays on between requests, so message handlers and background work run while no request comes in. Request-based, the same instance would be ~$13, but it would get CPU only during requests. Services with `minInstances: 0` keep request-based billing.

---

## Scenario 3 — Production Under Load (3 Instances, 24/7)

**Assumed traffic: ~10M requests/day** (300M/month). At this volume every service is effectively serving continuously, so CPU bills at the active rate for most of the month. Whether that arrives as 2 saturated instances or 3 at partial load barely changes the bill: what you pay for is total active vCPU-seconds, and traffic sets that.

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong + collector (Cloud Run) | 1.25 vCPU, 1.25 GiB | ~2-3 inst, near-continuous active CPU | ~$175 |
| Backend services ×3 | 1 vCPU, 512 MiB each | ~6-9 inst, instance-based: 730 hrs × $0.0684 each | ~$300-450 |
| Frontend | 1 vCPU, 512 MiB | ~2-3 inst, near-continuous active CPU | ~$130 |
| **Cloud Run requests** | 300M/month | $0.40/million | **~$120** |
| **Cloud Armor** | 1 policy, ~6 rules | $5 + $6 + 300M × $0.75/M | **~$236** |
| SPA bucket | GCS + Cloud CDN | Storage + egress at volume | ~$5-15 |
| Cloud SQL | db-g1-small or db-n1-standard-1 | Upgraded tier for load | ~$25-50 |
| Memorystore Redis | BASIC, 1 GB | Same | ~$7 |
| Load Balancer | High traffic | $18.25 for the rules + ~3 TB data processing at $0.008/GiB | ~$40-60 |
| DNS, Secrets, Registry | — | — | ~$1 |
| **Traces (Cloud Trace)** | ~2.4 billion spans at `sampleRate` 1 | (2,400M - 2.5M free) × $0.20/M | **~$480** |
| **Total** | | | **~$1,520-1,725** |
| **Total with `sampleRate` 0.01** | | Traces ~$4 | **~$1,045-1,250** |

:::warning Per-request charges dominate at this volume
Cloud Armor bills $0.75 per million requests, so at 300M/month it alone is ~$236, more than the database, cache, and load balancer combined. Together with Cloud Run's $0.40/million, per-request fees are ~$356 of this total. Budget by requests first at this volume.

Traces are per request too. At the default `tracing.sampleRate` of 1 they are the largest line. Keep 1 in 100 traces (`"tracing": { "sampleRate": 0.01 }`) and they cost ~$4. See [Traces and Dashboards](#traces-and-dashboards).
:::

:::warning GCP is the expensive option at this scale
Cloud Run's active CPU rate is $0.0864/vCPU-hour, which is **2.1x** AWS Fargate's $0.04048. GCP is the cheapest of the three providers when your services sit idle and the most expensive when they are saturated.
:::

:::tip Switch billing mode above ~81% utilization
Instance-based billing is a flat $0.0648/vCPU-hour, versus $0.0864 while active under request-based billing. NestJS services with `minInstances` 1 or more already use it. For Kong and the frontend, request-based billing costs more above ~81% utilization. Also consider [Cloud Run committed use discounts](https://cloud.google.com/run/cud) (up to 17% savings).
:::

---

## Cloud Run Billing, and Why Kong Is Not $70

An earlier version of this page listed Kong at ~$70/month. That came from `730 hrs × ($0.0864/vCPU-hr + $0.009/GiB-hr)`, which applies Cloud Run's **active** CPU rate to every second of the month. It is not one of the two rates Cloud Run actually charges.

For 1 vCPU + 1 GiB over 730 hours:

| Mode | Monthly |
|------|---------|
| Request-based (`cpuIdle: true`: Kong, the frontend, NestJS services with `minInstances: 0`), fully idle | ~$13 |
| Instance-based (`cpuIdle: false`: workers, NestJS services with `minInstances` 1 or more), any utilization | ~$53 |
| Request-based, fully saturated | ~$70 |

It is reasonable to assume Kong is expensive because every request passes through it. Kong does see 100% of traffic, but that is not what drives the bill. Kong runs with a request concurrency of 1000, and under request-based billing CPU is charged while **any** request is in flight, not per request. One thousand concurrent requests cost the same CPU-second as one.

So the billed fraction of the month is `1 - e^(-arrival_rate × request_duration)`, not the sum of request durations:

| Traffic | Requests/sec | Busy | Kong cost |
|---------|-------------|------|-----------|
| A few per day (dev) | ~0 | 0% | ~$13 |
| 100k/day (Scenario 2) | 1.2 | 6% | ~$18 |
| 1M/day | 11.6 | 44% | ~$50 |
| 10M/day | 115.7 | 100% | ~$189* |

*Above ~10M requests/day the $0.40/million request charge overtakes compute.

Kong only reaches ~$70 at roughly 5M requests/day sustained, at which point it would have scaled past one instance anyway.

The figures above are for Kong alone. The trace collector on the same instance adds a quarter to each (0.25 vCPU and 256 MiB on top of Kong's 1 vCPU and 1 GiB).

---

## What Drives the Cost

| # | Cost driver | Why |
|---|------------|-----|
| 1 | **Cloud Run compute** | An always-on NestJS service is ~$50/month: its CPU stays on. Kong and the frontend are driven by request volume and duration: idle ones are cheap, busy ones are not. Scale-to-zero saves the most. |
| 2 | **Cloud SQL tier** | `db-f1-micro` is cheap (~$10), but `db-n1-standard-1` is ~$50. Pick based on load. |
| 3 | **Cloud Armor** | $5/policy + $1/rule adds up. Still much cheaper than Cloud Armor Enterprise ($3,000/mo). |
| 4 | **Memorystore** | Fixed cost for provisioned capacity. 1 GB BASIC is the minimum. |
| 5 | **Traces** | $0.20 per million spans after 2.5 million free. Small until traffic is high; `tracing.sampleRate` sets it. |

---

## How to Reduce Costs

- **Set `minInstances: 0`** for backend services and the frontend **in dev**: accept 2-8s cold starts and messages that wait for the next request, and pay near-zero for idle compute. Kong is clamped to at least 1 regardless, and production should stay at 1. See [minInstances](/docs/infrastructure/service-configuration#mininstances).
- **Use `db-f1-micro`** for dev databases — upgrade only when needed
- **Right-size CPU/memory**: monitor actual usage and lower from defaults if your services don't need 1 vCPU (a NestJS service with `minInstances` 1 or more needs 1 vCPU or more)
- **Committed use discounts**: a 1-year commitment saves up to 17% on Cloud Run compute
- **Lower `tracing.sampleRate`** in busy production environments: 0.1 keeps 1 trace in 10 and cuts the trace bill by 90%

Override any default in `.tsdevstack/infrastructure.json`:

```json
{
  "version": "1.0.0",
  "dev": {
    "auth-service": {
      "minInstances": 0,
      "maxInstances": 3
    },
    "database": {
      "tier": "db-g1-small",
      "diskSize": 20
    }
  },
  "prod": {
    "tracing": { "sampleRate": 0.1 }
  }
}
```

See [Service Configuration](/docs/infrastructure/service-configuration) for all available options.

---

## Scheduled Jobs

Each scheduled job, of either kind, is one Cloud Scheduler job. A cron job also runs as a Cloud Run Job, billed for the time it runs. A trigger's call is a request to the service, billed as one.

| Item | Price | Notes |
|------|-------|-------|
| Schedules (Cloud Scheduler) | $0.10 per job per month | The first 3 jobs of the billing account are free |
| Cron job runs (Cloud Run Jobs) | $0.000018 per vCPU-second, $0.000002 per GiB-second | From the start of the run's instance to its end |
| Trigger calls | The service's own request billing | |

Example: **a cron job that runs once a day for 1 minute** at the default 1 vCPU and 2 GiB (our assumption). That is 1,800 seconds a month: 1,800 × ($0.000018 + 2 × $0.000002) = **~$0.04 a month**, plus its schedule.

## Traces and Dashboards

The trace lines above assume **~8 spans per request** (Kong, the service, its database queries). A request that calls more services or runs more queries makes more spans.

| Item | Price | Notes |
|------|-------|-------|
| Traces (Cloud Trace) | $0.20 per million spans | The first 2.5 million spans each month are free, per billing account |
| Dashboard (Cloud Monitoring) | Free | Its metrics are free platform metrics |
| Slow queries (Cloud SQL Query Insights) | Free | On by default |
| Reading and following logs (`infra:logs`, `--follow`) | Free | |

`tracing.sampleRate` sets the share of traces kept, and the trace bill with it. See [Traces and Dashboards](/docs/features/traces-and-dashboards#sampling).

## Storage Access Logs

With storage buckets, every read and write of their files is logged: Cloud Storage's Data Access audit logs, in Cloud Logging. Logs of the other buckets in the project (the Terraform state, the SPA buckets) are dropped before they are stored, so they cost nothing.

| Item | Price | Notes |
|------|-------|-------|
| Access logs (Cloud Logging) | $0.50 per GiB | The first 50 GiB each month are free, per project, shared with every other log. Kept 30 days |

Example: **~1.5 KB per access** (our estimate). A million reads and writes make about 1.5 GB, which fits in the free 50 GiB of most projects. Past it, a million costs about $0.75. Every file counts: a page that shows 20 images from a bucket makes 20 reads.

---

## GCP Pricing References

- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Cloud Scheduler Pricing](https://cloud.google.com/scheduler/pricing)
- [Cloud SQL Pricing](https://cloud.google.com/sql/pricing)
- [Memorystore for Redis Pricing](https://cloud.google.com/memorystore/docs/redis/pricing)
- [Cloud Load Balancing Pricing](https://cloud.google.com/load-balancing/pricing)
- [Cloud Armor Pricing](https://cloud.google.com/armor/pricing)
- [Secret Manager Pricing](https://cloud.google.com/secret-manager/pricing)
- [Cloud DNS Pricing](https://cloud.google.com/dns/pricing)
- [Artifact Registry Pricing](https://cloud.google.com/artifact-registry/pricing)
- [Google Cloud Observability Pricing](https://cloud.google.com/stackdriver/pricing) (Cloud Trace, Cloud Logging)