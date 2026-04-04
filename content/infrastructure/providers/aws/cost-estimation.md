# AWS Cost Estimation

:::tip No fees from tsdevstack
tsdevstack is free and open source. All costs on this page are paid directly to Amazon Web Services. There is no bill from tsdevstack and there never will be.
:::

These are estimates based on published AWS pricing as of March 2026 in a US region (us-east-1). Actual costs depend on your region, traffic, and any pricing changes by Amazon. Always verify with the official pricing pages linked at the bottom.

---

## What Gets Deployed

A typical tsdevstack project (3 NestJS backends + 1 Next.js frontend) creates these billable resources on AWS:

| Resource | AWS Service | Default Configuration |
|----------|------------|----------------------|
| Kong gateway | ECS Fargate | 1 vCPU, 2 GiB memory, **min 1 instance** (always on) |
| Backend services (x3) | ECS Fargate | 0.5 vCPU, 1 GiB memory, configurable min instances |
| Frontend | ECS Fargate | 0.25 vCPU, 512 MiB memory, configurable min instances |
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

You can override CPU, memory, instance counts, database tier, Redis tier, and disk size per service in `infrastructure.json`. See [Service Configuration](/infrastructure/service-configuration) for all available options.

---

## Scenario 1 — Development (Scale-to-Zero)

Backend services set to `minInstances: 0`. Kong stays on (`minInstances: 1`). Minimal traffic (testing only).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (ECS Fargate) | 1 vCPU, 2 GiB, min=1 | 1 task × 730 hrs × ($0.04048/vCPU-hr + $0.004445/GiB-hr × 2) | ~$36 |
| Backend services ×3 | 0.5 vCPU, 1 GiB, min=0 | Stopped tasks don't incur Fargate charges | ~$0-2 |
| Frontend (ECS Fargate) | 0.25 vCPU, 512 MiB, min=1 | 1 task × 730 hrs | ~$8-12 |
| RDS PostgreSQL | db.t3.micro, 20 GB | Instance + storage | ~$22 |
| ElastiCache Redis | cache.t3.micro | Single node, no replication | ~$12 |
| ALB | 4 listeners, low traffic | $0.0225/hr base + LCU charges | ~$20 |
| CloudFront | 3 distributions, low traffic | Base + transfer + requests | ~$5-10 |
| NAT Gateway | 2 gateways (one per AZ) | 2 × $0.045/hr × 730 hrs + data processing | ~$66 |
| WAF | Managed + custom rules | Web ACL + rules + requests | ~$10 |
| Secrets Manager | ~10 secrets | $0.40/secret/month | ~$4 |
| Lambda (wake-up) | Minimal invocations | Near-zero at dev scale | ~$0 |
| DNS, ECR | Minimal | Zone + image storage | ~$1-2 |
| **Total** | | | **~$185-200** |

Cold starts after scale-to-zero: **30-60 seconds** (ECS provisioning time). Kong detects the 502 from an empty target group and triggers a wake-up Lambda that starts all ECS services.

:::warning
The NAT Gateway is the dominant cost on AWS (~$66/month fixed). This is required for containers in private subnets to reach the internet. There is no way to avoid it in the current VPC architecture.
:::

---

## Scenario 2 — Production (Always-On, Single Instance)

All services set to `minInstances: 1`. Moderate traffic (~100k requests/day).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (ECS Fargate) | 1 vCPU, 2 GiB, min=1 | 1 task × 730 hrs | ~$36 |
| Backend services ×3 | 0.5 vCPU, 1 GiB, min=1 each | 3 tasks × 730 hrs × ($0.02024 + $0.004445) | ~$54 |
| Frontend (ECS Fargate) | 0.25 vCPU, 512 MiB, min=1 | 1 task × 730 hrs | ~$8-12 |
| RDS PostgreSQL | db.t3.micro, 20 GB | Instance + storage | ~$22 |
| ElastiCache Redis | cache.t3.micro | Single node | ~$12 |
| ALB | 4 listeners, moderate traffic | Base + LCU charges | ~$22-28 |
| CloudFront | 3 distributions, moderate traffic | Transfer + requests | ~$10-15 |
| NAT Gateway | 2 gateways + data processing | Fixed + traffic-based | ~$68-72 |
| WAF | Managed + custom rules | Web ACL + rules + higher request volume | ~$12-15 |
| Secrets Manager | ~10 secrets | — | ~$4 |
| DNS, ECR | — | — | ~$1-2 |
| **Total** | | | **~$260-280** |

---

## Scenario 3 — Production Under Load (3 Instances, 24/7)

Services auto-scale to 3 instances average. Heavy sustained traffic for 30 days.

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (ECS Fargate) | 1 vCPU, 2 GiB, avg 3 tasks | 3 × 730 hrs × $0.04934 | ~$108 |
| Backend services ×3 | 0.5 vCPU, 1 GiB, avg 3 each | 9 tasks × 730 hrs × $0.02469 | ~$162 |
| Frontend (ECS Fargate) | 0.25 vCPU, 512 MiB, avg 3 | 3 tasks × 730 hrs | ~$25-35 |
| RDS PostgreSQL | db.t3.small or db.t3.medium | Upgraded tier for load | ~$30-60 |
| ElastiCache Redis | cache.t3.small | Upgraded for load | ~$25 |
| ALB | 4 listeners, high traffic | Base + higher LCU charges | ~$30-50 |
| CloudFront | High traffic + transfer | — | ~$20-40 |
| NAT Gateway | 2 gateways + high data processing | Fixed + $0.045/GB processed | ~$75-100 |
| WAF | High request volume | — | ~$15-25 |
| Secrets Manager | — | — | ~$4 |
| DNS, ECR | — | — | ~$2 |
| **Total** | | | **~$525-650** |

At this scale, consider [Fargate Compute Savings Plans](https://aws.amazon.com/savingsplans/compute-pricing/) (up to 52% savings with 3-year commitment).

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

- **Set `minInstances: 0`** for all backend services in development — accept 30-60s cold starts, pay near-zero for idle compute
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

See [Service Configuration](/infrastructure/service-configuration) for all available options.

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
