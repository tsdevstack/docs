# Amazon Web Services (AWS)

tsdevstack on AWS uses [ECS Fargate](https://aws.amazon.com/fargate/) for backend services, [App Runner](https://aws.amazon.com/apprunner/) for Next.js frontends, [RDS](https://aws.amazon.com/rds/) PostgreSQL for databases, and [ElastiCache](https://aws.amazon.com/elasticache/) for Redis. [CloudFront](https://aws.amazon.com/cloudfront/) provides CDN and edge caching, with [AWS WAF](https://aws.amazon.com/waf/) for security.

The AWS architecture is more complex than GCP due to the scale-to-zero mechanism — Kong uses upstream failover to a Lambda function that wakes ECS services when they've scaled to zero. The architecture uses ~45 Terraform resources.

:::info Cost
tsdevstack is free and open source — there are no license fees. You only pay Amazon directly for the cloud resources. See [AWS Cost Estimation](/infrastructure/providers/aws/cost-estimation) for a full breakdown by scenario.
:::

## Key Characteristics

- **Compute:** ECS Fargate for backends + Kong, App Runner for Next.js
- **Data:** RDS PostgreSQL + ElastiCache Redis
- **Edge:** CloudFront + ALB + AWS WAF
- **Scale-to-zero:** Kong upstream failover + Lambda wake-up (more complex than GCP)
- **Networking:** VPC with public/private subnets, NAT Gateway, Cloud Map for service discovery
- **Secrets:** Secrets Manager with ECS container injection

## Getting Started

1. [Account Setup](/infrastructure/providers/aws/account-setup) — Create AWS accounts and IAM users
2. [Architecture](/infrastructure/providers/aws/architecture) — Understand what gets deployed
3. [Cost Estimation](/infrastructure/providers/aws/cost-estimation) — What you'll pay Amazon (development, production, scaled)
4. [DNS & Domains](/infrastructure/providers/aws/dns-and-domains) — Configure Route 53 and custom domains
5. [CI/CD](/infrastructure/providers/aws/cicd) — Set up OIDC federation for GitHub Actions
