# Amazon Web Services (AWS)

tsdevstack on AWS uses [ECS Fargate](https://aws.amazon.com/fargate/) for all containerized services (backends, Next.js frontends, workers), [RDS](https://aws.amazon.com/rds/) PostgreSQL for databases, and [ElastiCache](https://aws.amazon.com/elasticache/) for Redis. [CloudFront](https://aws.amazon.com/cloudfront/) provides CDN and edge caching, with [AWS WAF](https://aws.amazon.com/waf/) for security.

Backend services run in private subnets and are reachable only inside the VPC: Kong calls them directly through Cloud Map service discovery, the same private model as on GCP and Azure. Fargate has no scale-to-zero, so every service keeps at least one task running. The architecture uses ~45 Terraform resources.

:::info Cost
tsdevstack is free and open source — there are no license fees. You only pay Amazon directly for the cloud resources. See [AWS Cost Estimation](/docs/infrastructure/providers/aws/cost-estimation) for a full breakdown by scenario.
:::

## Key Characteristics

- **Compute:** ECS Fargate for all services (backends, Next.js, Kong, workers)
- **Data:** RDS PostgreSQL + ElastiCache Redis
- **Edge:** CloudFront + ALB + AWS WAF
- **Scaling:** CPU-based auto-scaling between `minInstances` (at least 1) and `maxInstances`; no scale-to-zero
- **Networking:** VPC with public/private subnets, NAT Gateway, Cloud Map for service discovery (Kong to services, and service to service)
- **Secrets:** Secrets Manager with ECS container injection

## Getting Started

1. [Account Setup](/docs/infrastructure/providers/aws/account-setup) — Create AWS accounts and IAM users
2. [Architecture](/docs/infrastructure/providers/aws/architecture) — Understand what gets deployed
3. [Cost Estimation](/docs/infrastructure/providers/aws/cost-estimation) — What you'll pay Amazon (development, production, scaled)
4. [DNS & Domains](/docs/infrastructure/providers/aws/dns-and-domains) — Configure Route 53 and custom domains
5. [CI/CD](/docs/infrastructure/providers/aws/cicd) — Set up OIDC federation for GitHub Actions
