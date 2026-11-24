# AWS Cost Estimation

:::tip No fees from tsdevstack
tsdevstack is free and open source. All costs on this page are paid directly to Amazon Web Services. There is no bill from tsdevstack and there never will be.
:::

These are estimates based on published AWS pricing as of July 2026 in a US region (us-east-1). Actual costs depend on your region, traffic, and any pricing changes by Amazon. Always verify with the official pricing pages linked at the bottom.

:::info 2026 pricing pressure
The AI buildout is squeezing server hardware supply, and that is expected to reach cloud list prices in the second half of 2026. As of July 2026 every AWS rate on this page is unchanged: Fargate is still $0.04048/vCPU-hr and $0.004445/GB-hr, and NAT Gateway is still $0.045/hr.

AWS raised GPU instance prices 15% in January 2026, the first increase of its kind, but tsdevstack provisions no GPUs so that does not apply here. General purpose EC2 rates went down 3-7% over the same period.

Looking ahead, server memory contract prices rose sharply through the first half of 2026, and there is typically a 6 to 9 month lag before that reaches cloud list prices, with forecasts pointing to roughly 5-10% general increases. The most exposed lines here are **RDS** and **ElastiCache**, which are priced off provisioned memory, followed by **Fargate** compute. NAT Gateway, ALB, and CloudFront fees are the least exposed. If you are budgeting past Q3 2026, add a 10% buffer on the database and cache lines.
:::

---

## What Gets Deployed

A typical tsdevstack project (3 NestJS backends + 1 Next.js frontend) creates these billable resources on AWS:

| Resource | AWS Service | Default Configuration |
|----------|------------|----------------------|
| Kong gateway | ECS Fargate | 0.25 vCPU, 1 GiB memory, **min 1 instance** (always on); a trace collector runs in the same task and takes 256 MiB of it |
| Backend services (x3) | ECS Fargate | 0.25 vCPU, 512 MiB memory, **min 1 instance** each (always on) |
| Frontend | ECS Fargate | 0.25 vCPU, 512 MiB memory, **min 1 instance** (always on) |
| SPA (react-app) | S3 + CloudFront | Static bucket, no compute |
| Database | RDS PostgreSQL 15 | `db.t3.micro`, 20 GB disk, per-query statistics (Database Insights, 7 days free) |
| Cache | ElastiCache Redis 7 | `cache.t3.micro` |
| Load Balancer | Application Load Balancer | 2 listeners (HTTP redirect, HTTPS), target groups for Kong and Next.js |
| CDN | CloudFront | Separate distributions for API, frontend, SPAs; a CloudFront function on the API and frontend distributions sets the client address header (billed per million invocations, free tier; not in the totals below) |
| WAF | AWS WAF | Managed + custom rules |
| Networking | NAT Gateway | 2 NAT Gateways (one per AZ) |
| Secrets | Secrets Manager | ~10-20 secrets |
| DNS | Route 53 | 1 hosted zone |
| Container images | ECR | ~5 repositories |
| Traces | X-Ray (CloudWatch Transaction Search) | Every request (`tracing.sampleRate` 1) |
| Dashboard | CloudWatch | 1 per environment |

AWS has no scale-to-zero: every ECS service runs at least one task, and `minInstances: 0` fails validation. Backend services are reachable only inside the VPC (Kong calls them over Cloud Map), so there is no public entry point that could wake a stopped service.

Services, Next.js apps and workers run at 0.25 vCPU / 512 MiB, the smallest Fargate size, unless you set `cpu` or `memory` for them. Kong runs at 0.25 vCPU / 1 GiB, because its task also holds the trace collector. If you set only one of the two, the other comes from 0.5 vCPU / 1 GiB (Kong: 1 vCPU / 2 GiB).

You can override CPU, memory, instance counts, database tier, Redis tier, and disk size per service in `infrastructure.json`. See [Service Configuration](/docs/infrastructure/service-configuration) for all available options.

---

## Scenario 1: Development (Always-On, Low Traffic)

All services at the default `minInstances: 1`, the minimum on AWS. **Assumed traffic: ~1,000 requests/day** (testing only).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (ECS Fargate) | 0.25 vCPU, 1 GiB, min=1 | 1 task × 730 hrs × ($0.04048/vCPU-hr × 0.25 + $0.004445/GiB-hr × 1) | ~$11 |
| Backend services ×3 | 0.25 vCPU, 512 MiB, min=1 each | 3 tasks × 730 hrs × $0.01234 | ~$27 |
| Frontend (ECS Fargate) | 0.25 vCPU, 512 MiB, min=1 | 1 task × 730 hrs × $0.01234 | ~$9 |
| SPA bucket | S3 + CloudFront | Storage + minimal egress | ~$1 |
| RDS PostgreSQL | db.t3.micro, 20 GB | Instance + storage | ~$22 |
| ElastiCache Redis | cache.t3.micro | Single node, no replication | ~$12 |
| ALB | 2 listeners, low traffic | $0.0225/hr base + LCU charges (assumed minimal) | ~$20 |
| CloudFront | 3 distributions, low traffic | Base + transfer + requests | ~$5-10 |
| NAT Gateway | 2 gateways (one per AZ) | 2 × $0.045/hr × 730 hrs + data processing | ~$66 |
| WAF | Managed + custom rules | Web ACL + rules + requests | ~$10 |
| Secrets Manager | ~10 secrets | $0.40/secret/month | ~$4 |
| DNS, ECR | Minimal | Zone + image storage | ~$1-2 |
| Traces (X-Ray) | ~240k spans, ~0.24 GB | $0.35/GB | ~$0 |
| Dashboard (CloudWatch) | 1 dashboard | Free within the account's first 3, else $3 | ~$0-3 |
| **Total** | | | **~$188-197** |

:::info Why development costs this much on AWS
Earlier versions let backend services scale to zero on AWS, which took the backend line close to $0. That relied on sending Kong's traffic to backends through the public load balancer so that a stopped service could be woken up, and the mechanism failed requests with 503 for 30 to 60 seconds while tasks started. Backends are now private and always on, like on GCP and Azure. It is the honest trade: about $27 more per month for three small backends, in exchange for private networking and no failed requests. For cheap throwaway environments, GCP and Azure scale to zero natively; on AWS, keep development environments small (see below) and tear down ones you don't use with `infra:destroy`.
:::

:::warning
The NAT Gateway is the dominant cost on AWS (~$66/month fixed). This is required for containers in private subnets to reach the internet. There is no way to avoid it in the current VPC architecture.
:::

---

## Scenario 2 — Production (Always-On, Single Instance)

All services at `minInstances: 1`, the same footprint as Scenario 1 with more traffic. **Assumed traffic: ~100,000 requests/day** (3M/month).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (ECS Fargate) | 0.25 vCPU, 1 GiB, min=1 | 1 task × 730 hrs × $0.01457 | ~$11 |
| Backend services ×3 | 0.25 vCPU, 512 MiB, min=1 each | 3 tasks × 730 hrs × $0.01234 | ~$27 |
| Frontend (ECS Fargate) | 0.25 vCPU, 512 MiB, min=1 | 1 task × 730 hrs × $0.01234 | ~$9 |
| SPA bucket | S3 + CloudFront | Storage + egress | ~$1 |
| RDS PostgreSQL | db.t3.micro, 20 GB | Instance + storage | ~$22 |
| ElastiCache Redis | cache.t3.micro | Single node | ~$12 |
| ALB | 2 listeners, moderate traffic | Base + LCU charges | ~$22-28 |
| CloudFront | 3 distributions, moderate traffic | Transfer + requests | ~$10-15 |
| NAT Gateway | 2 gateways + data processing | Fixed + traffic-based | ~$68-72 |
| WAF | Managed + custom rules | $5 + $10 + 3M × $0.60/M | ~$17 |
| Secrets Manager | ~10 secrets | — | ~$4 |
| DNS, ECR | — | — | ~$1-2 |
| Traces (X-Ray) | ~24M spans, ~24 GB | $0.35/GB | ~$8 |
| Dashboard (CloudWatch) | 1 dashboard | — | ~$0-3 |
| **Total** | | | **~$212-231** |

---

## Scenario 3 — Production Under Load (3 Instances, 24/7)

Services auto-scale to 3 tasks average at the default size (an assumption: at 0.25 vCPU this load may need more tasks or bigger ones, which raises the compute lines). **Assumed traffic: ~10M requests/day** (300M/month).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (ECS Fargate) | 0.25 vCPU, 1 GiB, avg 3 tasks | 3 × 730 hrs × $0.01457 | ~$32 |
| Backend services ×3 | 0.25 vCPU, 512 MiB, avg 3 each | 9 tasks × 730 hrs × $0.01234 | ~$81 |
| Frontend (ECS Fargate) | 0.25 vCPU, 512 MiB, avg 3 | 3 tasks × 730 hrs × $0.01234 | ~$27 |
| **WAF** | High request volume | $5 + $10 + 300M × $0.60/M | **~$195** |
| **CloudFront** | High traffic + transfer | $0.01/10k requests + egress | **~$80-200** |
| SPA bucket | S3 + CloudFront | Storage + egress at volume | ~$5-15 |
| RDS PostgreSQL | db.t3.small or db.t3.medium | Upgraded tier for load | ~$30-60 |
| ElastiCache Redis | cache.t3.small | Upgraded for load | ~$25 |
| ALB | 2 listeners, high traffic | Base + higher LCU charges | ~$30-60 |
| NAT Gateway | 2 gateways + high data processing | Fixed + $0.045/GB processed | ~$75-100 |
| Secrets Manager | — | — | ~$4 |
| DNS, ECR | — | — | ~$2 |
| **Traces (X-Ray)** | ~2.4 billion spans, ~2,400 GB at `sampleRate` 1 | $0.35/GB | **~$840** |
| Dashboard (CloudWatch) | 1 dashboard | — | ~$0-3 |
| **Total** | | | **~$1,426-1,644** |
| **Total with `sampleRate` 0.01** | | Traces ~$8 | **~$594-812** |

:::warning Per-request charges dominate at this volume
AWS WAF bills $0.60 per million requests, so at 300M/month it alone is ~$195, more than the database and cache combined. CloudFront adds $0.01 per 10,000 requests on top. Earlier versions of this page listed WAF at ~$15-25 here, which was roughly 10x too low.

Traces are per request too. At the default `tracing.sampleRate` of 1 they are the largest line. Keep 1 in 100 traces (`"tracing": { "sampleRate": 0.01 }`) and they cost ~$8. See [Traces and Dashboards](#traces-and-dashboards).
:::

Unlike Cloud Run, Fargate bills for allocated task time regardless of how busy the tasks are, so the compute lines here do not shift with utilization. At this scale, consider [Fargate Compute Savings Plans](https://aws.amazon.com/savingsplans/compute-pricing/) (up to 52% savings with 3-year commitment).

---

## What Drives the Cost

| # | Cost driver | Why |
|---|------------|-----|
| 1 | **NAT Gateway** | ~$66/month fixed regardless of traffic. Required for private subnet internet access. |
| 2 | **ECS Fargate compute** | Per-second billing for running tasks. More instances = higher cost. |
| 3 | **ALB** | Base hourly rate + LCU-based charges that scale with traffic. |
| 4 | **RDS tier** | `db.t3.micro` is cheap (~$22), but `db.t3.medium` is ~$60. Pick based on load. |
| 5 | **Traces** | $0.35 per GB of spans. Small until traffic is high; `tracing.sampleRate` sets it. |

---

## How to Reduce Costs

- **Scale-to-zero is not available on AWS.** Every service keeps at least one task, so the number of services is a direct cost lever: each service at the default 0.25 vCPU / 512 MiB is ~$9/month running 24/7.
- **Tear down idle environments**: `npx tsdevstack infra:destroy --env <env>` removes an environment you don't need right now
- **Use `db.t3.micro`** for development databases — upgrade only when needed
- **Right-size CPU/memory** — monitor actual usage and lower from defaults
- **Savings Plans** — 1-year or 3-year Fargate Compute Savings Plans save up to 52%
- **Lower `tracing.sampleRate`** in busy production environments: 0.1 keeps 1 trace in 10 and cuts the trace bill by 90%

Override any default in `.tsdevstack/infrastructure.json`:

```json
{
  "version": "1.0.0",
  "prod": {
    "auth-service": {
      "cpu": "0.5",
      "memory": "1Gi",
      "minInstances": 1,
      "maxInstances": 3
    },
    "database": {
      "tier": "db.t3.small",
      "diskSize": 30
    },
    "redis": {
      "tier": "cache.t3.small"
    },
    "tracing": { "sampleRate": 0.1 }
  }
}
```

See [Service Configuration](/docs/infrastructure/service-configuration) for all available options.

---

## Scheduled Jobs

EventBridge Scheduler starts both kinds. A cron job runs as a Fargate task, billed for the time it runs. A trigger runs the job function, a small Lambda that calls the service.

| Item | Price | Notes |
|------|-------|-------|
| Schedules (EventBridge Scheduler) | $1.00 per million starts | The first 14 million starts each month are free |
| Cron job runs (Fargate) | $0.04048 per vCPU-hour, $0.004445 per GB-hour | Per second, from the image pull to the end of the task, at least 1 minute |
| Trigger calls (Lambda, 256 MB) | Lambda's request and duration pricing | Lambda's free tier covers 1 million requests and 400,000 GB-seconds a month |

Example: **a cron job that runs once a day**, at the default 1 vCPU and 2 GB, **about 90 seconds a run with the image pull** (our assumption). That is 0.75 hours a month: 0.75 × ($0.04048 + 2 × $0.004445) = **~$0.04 a month**. A trigger every 5 minutes is about 8,600 calls a month, inside Lambda's free tier.

## Traces and Dashboards

The trace lines above assume **~8 spans per request** (Kong, the service, its database queries) and **~1 KB per span**. Both are estimates: a request that calls more services or runs more queries makes more spans.

| Item | Price | Notes |
|------|-------|-------|
| Traces (X-Ray through Transaction Search) | $0.35 per GB of spans (first 10 TB) | 1% of spans indexed for search is included; more indexing is $0.75 per million spans |
| Dashboard (CloudWatch) | $3 per month | The first 3 dashboards in the account are free |
| Dashboard log panels | $0.005 per GB scanned | Charged each time the per-service panels load; a long time range on a busy environment scans more |
| Slow queries (Database Insights, standard) | Free | 7 days of history |
| Reading logs (`infra:logs`) | Free | |
| Following logs (`infra:logs --follow`) | $0.01 per Live Tail session minute | 1,800 minutes a month are free. One session per 10 log groups; `--all` on a typical project opens 2 or 3, and the command prints the count |
| Container Insights | Off | Not deployed, not billed |

:::warning Transaction Search is account-wide
`infra:deploy` turns on Transaction Search for the AWS account. From then on, X-Ray spans from every app in the account are billed this way, and it stays on after `infra:destroy`.
:::

`tracing.sampleRate` sets the share of traces kept, and the trace bill with it. See [Traces and Dashboards](/docs/features/traces-and-dashboards#sampling).

## Storage Access Logs

With storage buckets, every read and write of their files is logged: S3 data events from a CloudTrail trail of their own, sent to CloudWatch Logs. The trail records only data events, so the account's own events aren't paid twice.

| Item | Price | Notes |
|------|-------|-------|
| Data events (CloudTrail) | $0.10 per 100,000 events | |
| Delivery to CloudWatch Logs | $0.25 per GB | CloudTrail's charge |
| CloudWatch Logs | $0.50 per GB ingested | Kept 30 days |
| S3 copy of the events | Storage only | CloudTrail always writes one, to the CloudTrail bucket (kept 90 days) |

Example: **~1.5 KB per access** (our estimate). A million reads and writes cost about $1.00 in events, $0.38 in delivery and $0.75 in CloudWatch: about $2.10. Every file counts: a page that shows 20 images from a bucket makes 20 reads.

---

## AWS Pricing References

- [Fargate Pricing](https://aws.amazon.com/fargate/pricing/)
- [EventBridge Pricing](https://aws.amazon.com/eventbridge/pricing/) (Scheduler)
- [Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [RDS PostgreSQL Pricing](https://aws.amazon.com/rds/postgresql/pricing/)
- [ElastiCache Pricing](https://aws.amazon.com/elasticache/pricing/)
- [Elastic Load Balancing Pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)
- [CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/)
- [VPC Pricing (NAT Gateway)](https://aws.amazon.com/vpc/pricing/)
- [AWS WAF Pricing](https://aws.amazon.com/waf/pricing/)
- [Secrets Manager Pricing](https://aws.amazon.com/secrets-manager/pricing/)
- [Route 53 Pricing](https://aws.amazon.com/route53/pricing/)
- [ECR Pricing](https://aws.amazon.com/ecr/pricing/)
- [CloudWatch Pricing](https://aws.amazon.com/cloudwatch/pricing/) (X-Ray spans, dashboards, Logs Insights)
- [CloudTrail Pricing](https://aws.amazon.com/cloudtrail/pricing/) (storage access logs)
