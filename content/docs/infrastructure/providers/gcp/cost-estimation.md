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
| Kong gateway | Cloud Run | 1 vCPU, 1 GiB memory, **min 1 instance** (always on) |
| Backend services (x3) | Cloud Run | 1 vCPU, 512 MiB memory, configurable min instances |
| Frontend | Cloud Run | 1 vCPU, 512 MiB memory, configurable min instances |
| SPA (react-app) | GCS bucket + Cloud CDN | Static bucket, no compute |
| Database | Cloud SQL PostgreSQL 16 | `db-f1-micro`, 10 GB disk |
| Cache | Memorystore Redis 7 | `BASIC` tier, 1 GB |
| Load Balancer | Global HTTPS LB | Static IP, forwarding rules |
| WAF | Cloud Armor | Standard tier, OWASP rule set |
| Secrets | Secret Manager | ~10-20 secrets |
| DNS | Cloud DNS | 1 managed zone |
| Container images | Artifact Registry | ~5 images |

You can override CPU, memory, instance counts, database tier, Redis tier, and disk size per service in `infrastructure.json`. See [Service Configuration](/docs/infrastructure/service-configuration) for all available options.

---

## Scenario 1 — Development (Scale-to-Zero)

Backend services and frontend set to `minInstances: 0`. Kong stays on (`minInstances: 1`). **Assumed traffic: ~1,000 requests/day** (testing only).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (Cloud Run) | 1 vCPU, 1 GiB, min=1 | 730 hrs idle at $0.0000025/vCPU-sec + $0.0000025/GiB-sec | ~$13 |
| Backend services ×3 | 1 vCPU, 512 MiB, min=0 | Scaled to zero when idle — billed per request | ~$1-5 |
| Frontend | 1 vCPU, 512 MiB, min=0 | Scaled to zero when idle — billed per request | ~$1-3 |
| SPA bucket | GCS + Cloud CDN | Storage + minimal egress | ~$1 |
| Cloud SQL | db-f1-micro, 10 GB | Shared-core instance + storage | ~$10 |
| Memorystore Redis | BASIC, 1 GB | Billed per GiB-hour | ~$7 |
| Load Balancer | 5 forwarding rules, low traffic | Rules + data processing ($0.008-0.012/GB) | ~$2 |
| Cloud Armor | 1 policy, ~6 WAF rules | $5/policy + $1/rule + $0.75/million requests | ~$12 |
| DNS, Secrets, Registry | Minimal | ~$0.20/zone + ~$0.06/secret-version/month | ~$1 |
| **Total** | | | **~$45-55** |


Cold starts after scale-to-zero: **2-8 seconds**. Cloud Run handles this natively — no wake-up mechanisms needed.

:::tip Why Kong is only ~$13
tsdevstack deploys Cloud Run services with `cpuIdle: true`, which is request-based billing. A `minInstances: 1` instance that is not serving requests bills CPU at the reduced idle rate of $0.0000025/vCPU-second rather than the active rate of $0.000024/vCPU-second. In a dev environment the gateway sits idle nearly all month, so an always-on Kong costs far less than a full-rate calculation suggests.
:::

---

## Scenario 2 — Production (Always-On, Single Instance)

All services set to `minInstances: 1`. **Assumed traffic: ~100,000 requests/day** (3M/month).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (Cloud Run) | 1 vCPU, 1 GiB, min=1 | Idle CPU + memory 730 hrs + active CPU for 3M requests | ~$18 |
| Backend services ×3 | 1 vCPU, 512 MiB, min=1 each | Idle CPU + memory 730 hrs + active CPU per request | ~$39 |
| Frontend | 1 vCPU, 512 MiB, min=1 | 1 instance × 730 hrs | ~$13 |
| SPA bucket | GCS + Cloud CDN | Storage + egress | ~$1 |
| Cloud SQL | db-f1-micro, 10 GB | Same as dev (upgrade if needed) | ~$10 |
| Memorystore Redis | BASIC, 1 GB | Same as dev | ~$7 |
| Load Balancer | 5 rules, moderate traffic | Rules + data processing | ~$5-10 |
| Cloud Armor | 1 policy, ~6 rules | $5 + $6 + 3M × $0.75/M | ~$13 |
| DNS, Secrets, Registry | Minimal | — | ~$1 |
| **Total** | | | **~$105-115** |

Cloud Run has two billing modes: *CPU allocated during requests* (request-based, the tsdevstack default) and *CPU always allocated* (instance-based). Under request-based billing an always-on instance pays memory for the full 730 hours, CPU at the idle rate while waiting, and the active CPU rate only while serving a request. The figures above assume ~3M requests/month at roughly 150ms of CPU each. Slower or heavier requests push these lines up toward the active rate.

---

## Scenario 3 — Production Under Load (3 Instances, 24/7)

**Assumed traffic: ~10M requests/day** (300M/month). At this volume every service is effectively serving continuously, so CPU bills at the active rate for most of the month. Whether that arrives as 2 saturated instances or 3 at partial load barely changes the bill: what you pay for is total active vCPU-seconds, and traffic sets that.

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (Cloud Run) | 1 vCPU, 1 GiB | ~2-3 inst, near-continuous active CPU | ~$140 |
| Backend services ×3 | 1 vCPU, 512 MiB each | ~6-9 inst, near-continuous active CPU | ~$395 |
| Frontend | 1 vCPU, 512 MiB | ~2-3 inst, near-continuous active CPU | ~$130 |
| **Cloud Run requests** | 300M/month | $0.40/million | **~$120** |
| **Cloud Armor** | 1 policy, ~6 rules | $5 + $6 + 300M × $0.75/M | **~$236** |
| SPA bucket | GCS + Cloud CDN | Storage + egress at volume | ~$5-15 |
| Cloud SQL | db-g1-small or db-n1-standard-1 | Upgraded tier for load | ~$25-50 |
| Memorystore Redis | BASIC, 1 GB | Same | ~$7 |
| Load Balancer | High traffic | 5 rules + ~3 TB data processing | ~$40-60 |
| DNS, Secrets, Registry | — | — | ~$1 |
| **Total** | | | **~$1,100-1,160** |

:::warning Per-request charges dominate at this volume
Cloud Armor bills $0.75 per million requests, so at 300M/month it alone is ~$236, more than the database, cache, and load balancer combined. Together with Cloud Run's $0.40/million, per-request fees are ~$356 of this total. Earlier versions of this page listed Cloud Armor at ~$15-20 here, which was roughly 10x too low.
:::

:::warning GCP is the expensive option at this scale
Cloud Run's active CPU rate is $0.0864/vCPU-hour, which is **2.1x** AWS Fargate's $0.04048. GCP is the cheapest of the three providers when your services sit idle and the most expensive when they are saturated.
:::

:::tip Switch billing mode above ~81% utilization
Instance-based billing (`cpuIdle: false`) is a flat $0.0648/vCPU-hour, versus $0.0864 while active under the default request-based mode. At this volume that cuts the compute lines by roughly 25%, around $165/month. Also consider [Cloud Run committed use discounts](https://cloud.google.com/run/cud) (up to 17% savings).
:::

---

## Cloud Run Billing, and Why Kong Is Not $70

An earlier version of this page listed Kong at ~$70/month. That came from `730 hrs × ($0.0864/vCPU-hr + $0.009/GiB-hr)`, which applies Cloud Run's **active** CPU rate to every second of the month. It is not one of the two rates Cloud Run actually charges.

For 1 vCPU + 1 GiB over 730 hours:

| Mode | Monthly |
|------|---------|
| Request-based (`cpuIdle: true`, the tsdevstack default), fully idle | ~$13 |
| Instance-based (`cpuIdle: false`), any utilization | ~$53 |
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

---

## What Drives the Cost

| # | Cost driver | Why |
|---|------------|-----|
| 1 | **Cloud Run compute** | Driven by request volume and duration, not just instance count. Idle `minInstances` are cheap; busy ones are not. Scale-to-zero saves the most. |
| 2 | **Cloud SQL tier** | `db-f1-micro` is cheap (~$10), but `db-n1-standard-1` is ~$50. Pick based on load. |
| 3 | **Cloud Armor** | $5/policy + $1/rule adds up. Still much cheaper than Cloud Armor Enterprise ($3,000/mo). |
| 4 | **Memorystore** | Fixed cost for provisioned capacity. 1 GB BASIC is the minimum. |

---

## How to Reduce Costs

- **Set `minInstances: 0`** for backend services and the frontend **in dev** — accept 2-8s cold starts, pay near-zero for idle compute. Kong is clamped to at least 1 regardless, and production should stay at 1.
- **Use `db-f1-micro`** for dev databases — upgrade only when needed
- **Right-size CPU/memory** — monitor actual usage and lower from defaults if your services don't need 1 vCPU
- **Committed use discounts** — 1-year commitment saves up to 17% on Cloud Run compute

Override any default in `.tsdevstack/infrastructure.json`:

```json
{
  "version": "1.0.0",
  "services": {
    "auth-service": {
      "cpu": "0.5",
      "memory": "256Mi",
      "minInstances": 0,
      "maxInstances": 3
    }
  },
  "database": {
    "tier": "db-g1-small",
    "diskSize": 20
  },
  "redis": {
    "tier": "STANDARD_HA",
    "memoryGb": 2
  }
}
```

See [Service Configuration](/docs/infrastructure/service-configuration) for all available options.

---

## GCP Pricing References

- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Cloud SQL Pricing](https://cloud.google.com/sql/pricing)
- [Memorystore for Redis Pricing](https://cloud.google.com/memorystore/docs/redis/pricing)
- [Cloud Load Balancing Pricing](https://cloud.google.com/load-balancing/pricing)
- [Cloud Armor Pricing](https://cloud.google.com/armor/pricing)
- [Secret Manager Pricing](https://cloud.google.com/secret-manager/pricing)
- [Cloud DNS Pricing](https://cloud.google.com/dns/pricing)
- [Artifact Registry Pricing](https://cloud.google.com/artifact-registry/pricing)