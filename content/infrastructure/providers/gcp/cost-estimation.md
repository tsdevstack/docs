# GCP Cost Estimation

:::tip No fees from tsdevstack
tsdevstack is free and open source. All costs on this page are paid directly to Google Cloud. There is no bill from tsdevstack and there never will be.
:::

These are estimates based on published GCP pricing as of March 2026 in a US region (us-central1). Actual costs depend on your region, traffic, and any pricing changes by Google. Always verify with the official pricing pages linked at the bottom.

---

## What Gets Deployed

A typical tsdevstack project (3 NestJS backends + 1 Next.js frontend) creates these billable resources on GCP:

| Resource | GCP Service | Default Configuration |
|----------|------------|----------------------|
| Kong gateway | Cloud Run | 1 vCPU, 1 GiB memory, **min 1 instance** (always on) |
| Backend services (x3) | Cloud Run | 1 vCPU, 512 MiB memory, configurable min instances |
| Frontend | Cloud Run | 1 vCPU, 512 MiB memory, configurable min instances |
| Database | Cloud SQL PostgreSQL 16 | `db-f1-micro`, 10 GB disk |
| Cache | Memorystore Redis 7 | `BASIC` tier, 1 GB |
| Load Balancer | Global HTTPS LB | Static IP, forwarding rules |
| WAF | Cloud Armor | Standard tier, OWASP rule set |
| Secrets | Secret Manager | ~10-20 secrets |
| DNS | Cloud DNS | 1 managed zone |
| Container images | Artifact Registry | ~5 images |

You can override CPU, memory, instance counts, database tier, Redis tier, and disk size per service in `infrastructure.json`. See [Service Configuration](/infrastructure/service-configuration) for all available options.

---

## Scenario 1 — Development (Scale-to-Zero)

Backend services and frontend set to `minInstances: 0`. Kong stays on (`minInstances: 1`). Minimal traffic (testing only).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (Cloud Run) | 1 vCPU, 1 GiB, min=1 | 1 instance × 730 hrs × per-vCPU + per-GiB rate | ~$70 |
| Backend services ×3 | 1 vCPU, 512 MiB, min=0 | Scaled to zero when idle — billed per request | ~$1-5 |
| Frontend | 1 vCPU, 512 MiB, min=0 | Scaled to zero when idle — billed per request | ~$1-3 |
| Cloud SQL | db-f1-micro, 10 GB | Shared-core instance + storage | ~$10 |
| Memorystore Redis | BASIC, 1 GB | Billed per GiB-hour | ~$7 |
| Load Balancer | 5 forwarding rules, low traffic | Rules + data processing ($0.008-0.012/GB) | ~$2 |
| Cloud Armor | 1 policy, ~6 WAF rules | $5/policy + $1/rule + $0.75/million requests | ~$12 |
| DNS, Secrets, Registry | Minimal | ~$0.20/zone + ~$0.06/secret-version/month | ~$1 |
| **Total** | | | **~$100-115** |

Cold starts after scale-to-zero: **2-8 seconds**. Cloud Run handles this natively — no wake-up mechanisms needed.

---

## Scenario 2 — Production (Always-On, Single Instance)

All services set to `minInstances: 1`. Moderate traffic (~100k requests/day).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (Cloud Run) | 1 vCPU, 1 GiB, min=1 | 1 instance × 730 hrs | ~$70 |
| Backend services ×3 | 1 vCPU, 512 MiB, min=1 each | 3 instances × 730 hrs (always-allocated rate) | ~$50-70 |
| Frontend | 1 vCPU, 512 MiB, min=1 | 1 instance × 730 hrs | ~$17-25 |
| Cloud SQL | db-f1-micro, 10 GB | Same as dev (upgrade if needed) | ~$10 |
| Memorystore Redis | BASIC, 1 GB | Same as dev | ~$7 |
| Load Balancer | 5 rules, moderate traffic | Rules + data processing | ~$5-10 |
| Cloud Armor | 1 policy, ~6 rules | Policy + rules + request volume | ~$12-15 |
| DNS, Secrets, Registry | Minimal | — | ~$1 |
| **Total** | | | **~$170-210** |

Cloud Run has two billing modes: *CPU allocated during requests* (cheaper idle, higher per-request) and *CPU always allocated* (flat rate). With `minInstances: 1`, always-allocated is typically more cost-effective.

---

## Scenario 3 — Production Under Load (3 Instances, 24/7)

Services auto-scale to 3 instances average. Heavy sustained traffic for 30 days.

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (Cloud Run) | 1 vCPU, 1 GiB, avg 3 instances | 3 × 730 hrs | ~$210 |
| Backend services ×3 | 1 vCPU, 512 MiB, avg 3 each | 9 instances × 730 hrs | ~$150-200 |
| Frontend | 1 vCPU, 512 MiB, avg 3 instances | 3 × 730 hrs | ~$50-70 |
| Cloud SQL | db-g1-small or db-n1-standard-1 | Upgraded tier for load | ~$25-50 |
| Memorystore Redis | BASIC, 1 GB | Same | ~$7 |
| Load Balancer | Higher traffic volume | Rules + data processing | ~$15-30 |
| Cloud Armor | Higher request volume | Policy + rules + $0.75/million requests | ~$15-20 |
| DNS, Secrets, Registry | — | — | ~$1 |
| **Total** | | | **~$475-590** |

At this scale, consider [Cloud Run committed use discounts](https://cloud.google.com/run/cud) (up to 17% savings).

---

## What Drives the Cost

| # | Cost driver | Why |
|---|------------|-----|
| 1 | **Cloud Run compute** | The more instances running 24/7, the higher the bill. Scale-to-zero saves the most. |
| 2 | **Cloud SQL tier** | `db-f1-micro` is cheap (~$10), but `db-n1-standard-1` is ~$50. Pick based on load. |
| 3 | **Cloud Armor** | $5/policy + $1/rule adds up. Still much cheaper than Cloud Armor Enterprise ($3,000/mo). |
| 4 | **Memorystore** | Fixed cost for provisioned capacity. 1 GB BASIC is the minimum. |

---

## How to Reduce Costs

- **Set `minInstances: 0`** for all services in dev — accept 2-8s cold starts, pay near-zero for idle compute
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

See [Service Configuration](/infrastructure/service-configuration) for all available options.

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