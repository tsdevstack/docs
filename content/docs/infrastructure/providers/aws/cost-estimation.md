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
| Kong gateway | ECS Fargate | 1 vCPU, 2 GiB memory, **min 1 instance** (always on) |
| Backend services (x3) | ECS Fargate | 0.5 vCPU, 1 GiB memory, configurable min instances |
| Frontend | ECS Fargate | 0.5 vCPU, 1 GiB memory, configurable min instances |
| SPA (react-app) | S3 + CloudFront | Static bucket, no compute |
| Database | RDS PostgreSQL 16 | `db.t3.micro`, 20 GB disk |
| Cache | ElastiCache Redis 7 | `cache.t3.micro` |
| Load Balancer | Application Load Balancer | 4 listeners, target groups |
| CDN | CloudFront | Separate distributions for API, frontend, SPAs |
| WAF | AWS WAF | Managed + custom rules |
| Networking | NAT Gateway | 2 NAT Gateways (one per AZ) |
| Secrets | Secrets Manager | ~10-20 secrets |
| DNS | Route 53 | 1 hosted zone |
| Container images | ECR | ~5 repositories |
| Wake-up | Lambda | Scale-to-zero wake-up function |

You can override CPU, memory, instance counts, database tier, Redis tier, and disk size per service in `infrastructure.json`. See [Service Configuration](/docs/infrastructure/service-configuration) for all available options.

---

## Scenario 1 — Development (Scale-to-Zero)

Backend services set to `minInstances: 0`. Kong stays on (`minInstances: 1`). **Assumed traffic: ~1,000 requests/day** (testing only).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (ECS Fargate) | 1 vCPU, 2 GiB, min=1 | 1 task × 730 hrs × ($0.04048/vCPU-hr + $0.004445/GiB-hr × 2) | ~$36 |
| Backend services ×3 | 0.5 vCPU, 1 GiB, min=0 | Stopped tasks don't incur Fargate charges | ~$0-2 |
| Frontend (ECS Fargate) | 0.5 vCPU, 1 GiB, min=1 | 1 task × 730 hrs × $0.024685 | ~$18 |
| SPA bucket | S3 + CloudFront | Storage + minimal egress | ~$1 |
| RDS PostgreSQL | db.t3.micro, 20 GB | Instance + storage | ~$22 |
| ElastiCache Redis | cache.t3.micro | Single node, no replication | ~$12 |
| ALB | 4 listeners, low traffic | $0.0225/hr base + LCU charges | ~$20 |
| CloudFront | 3 distributions, low traffic | Base + transfer + requests | ~$5-10 |
| NAT Gateway | 2 gateways (one per AZ) | 2 × $0.045/hr × 730 hrs + data processing | ~$66 |
| WAF | Managed + custom rules | Web ACL + rules + requests | ~$10 |
| Secrets Manager | ~10 secrets | $0.40/secret/month | ~$4 |
| Lambda (wake-up) | Minimal invocations | Near-zero at dev scale | ~$0 |
| DNS, ECR | Minimal | Zone + image storage | ~$1-2 |
| **Total** | | | **~$195-205** |

:::danger Scale-to-zero on AWS fails requests, it does not delay them
This is not a slow first request. Kong hits an empty target group, returns **HTTP 503 with a `Retry-After` header to the caller**, and fires a wake-up Lambda that scales all ECS services to `desiredCount=1` and returns immediately without waiting. Every request during the **30-60 second** ECS provisioning window fails with 503. The client is responsible for retrying.

Because the Lambda wakes all services at once but they do not become healthy simultaneously, service-to-service calls can fail while one service is up and another is still starting, leaving multi-service operations partially applied.

This is unlike GCP and Azure, where the platform holds the request during a cold start and the caller sees latency rather than an error. **Do not use `minInstances: 0` on AWS in production.**
:::

:::warning
The NAT Gateway is the dominant cost on AWS (~$66/month fixed). This is required for containers in private subnets to reach the internet. There is no way to avoid it in the current VPC architecture.
:::

---

## Scenario 2 — Production (Always-On, Single Instance)

All services set to `minInstances: 1`. **Assumed traffic: ~100,000 requests/day** (3M/month).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (ECS Fargate) | 1 vCPU, 2 GiB, min=1 | 1 task × 730 hrs | ~$36 |
| Backend services ×3 | 0.5 vCPU, 1 GiB, min=1 each | 3 tasks × 730 hrs × ($0.02024 + $0.004445) | ~$54 |
| Frontend (ECS Fargate) | 0.5 vCPU, 1 GiB, min=1 | 1 task × 730 hrs × $0.024685 | ~$18 |
| SPA bucket | S3 + CloudFront | Storage + egress | ~$1 |
| RDS PostgreSQL | db.t3.micro, 20 GB | Instance + storage | ~$22 |
| ElastiCache Redis | cache.t3.micro | Single node | ~$12 |
| ALB | 4 listeners, moderate traffic | Base + LCU charges | ~$22-28 |
| CloudFront | 3 distributions, moderate traffic | Transfer + requests | ~$10-15 |
| NAT Gateway | 2 gateways + data processing | Fixed + traffic-based | ~$68-72 |
| WAF | Managed + custom rules | $5 + $10 + 3M × $0.60/M | ~$17 |
| Secrets Manager | ~10 secrets | — | ~$4 |
| DNS, ECR | — | — | ~$1-2 |
| **Total** | | | **~$265-285** |

---

## Scenario 3 — Production Under Load (3 Instances, 24/7)

Services auto-scale to 3 tasks average. **Assumed traffic: ~10M requests/day** (300M/month).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (ECS Fargate) | 1 vCPU, 2 GiB, avg 3 tasks | 3 × 730 hrs × $0.04934 | ~$108 |
| Backend services ×3 | 0.5 vCPU, 1 GiB, avg 3 each | 9 tasks × 730 hrs × $0.02469 | ~$162 |
| Frontend (ECS Fargate) | 0.5 vCPU, 1 GiB, avg 3 | 3 tasks × 730 hrs × $0.024685 | ~$54 |
| **WAF** | High request volume | $5 + $10 + 300M × $0.60/M | **~$195** |
| **CloudFront** | High traffic + transfer | $0.01/10k requests + egress | **~$80-200** |
| SPA bucket | S3 + CloudFront | Storage + egress at volume | ~$5-15 |
| RDS PostgreSQL | db.t3.small or db.t3.medium | Upgraded tier for load | ~$30-60 |
| ElastiCache Redis | cache.t3.small | Upgraded for load | ~$25 |
| ALB | 4 listeners, high traffic | Base + higher LCU charges | ~$30-60 |
| NAT Gateway | 2 gateways + high data processing | Fixed + $0.045/GB processed | ~$75-100 |
| Secrets Manager | — | — | ~$4 |
| DNS, ECR | — | — | ~$2 |
| **Total** | | | **~$770-990** |

:::warning Per-request charges dominate at this volume
AWS WAF bills $0.60 per million requests, so at 300M/month it alone is ~$195, more than the database and cache combined. CloudFront adds $0.01 per 10,000 requests on top. Earlier versions of this page listed WAF at ~$15-25 here, which was roughly 10x too low.
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

---

## How to Reduce Costs

- **`minInstances: 0` is a development-only trade-off, not a production cost lever.** It saves the backend Fargate lines, but every request during the 30-60s wake-up returns 503 and cross-service calls can fail mid-operation. Only use it in dev, and only if your workflow tolerates failed calls and partially applied multi-service operations. Never in production.
- **Use `db.t3.micro`** for development databases — upgrade only when needed
- **Right-size CPU/memory** — monitor actual usage and lower from defaults
- **Savings Plans** — 1-year or 3-year Fargate Compute Savings Plans save up to 52%

Override any default in `.tsdevstack/infrastructure.json`:

```json
{
  "version": "1.0.0",
  "services": {
    "auth-service": {
      "cpu": "0.5",
      "memory": "1Gi",
      "minInstances": 0,
      "maxInstances": 3
    }
  },
  "database": {
    "tier": "db.t3.small",
    "diskSize": 30
  },
  "redis": {
    "tier": "cache.t3.small"
  }
}
```

See [Service Configuration](/docs/infrastructure/service-configuration) for all available options.

---

## AWS Pricing References

- [Fargate Pricing](https://aws.amazon.com/fargate/pricing/)
- [RDS PostgreSQL Pricing](https://aws.amazon.com/rds/postgresql/pricing/)
- [ElastiCache Pricing](https://aws.amazon.com/elasticache/pricing/)
- [Elastic Load Balancing Pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)
- [CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/)
- [VPC Pricing (NAT Gateway)](https://aws.amazon.com/vpc/pricing/)
- [AWS WAF Pricing](https://aws.amazon.com/waf/pricing/)
- [Secrets Manager Pricing](https://aws.amazon.com/secrets-manager/pricing/)
- [Route 53 Pricing](https://aws.amazon.com/route53/pricing/)
- [ECR Pricing](https://aws.amazon.com/ecr/pricing/)
