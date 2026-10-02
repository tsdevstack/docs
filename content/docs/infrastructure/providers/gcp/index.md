# Google Cloud Platform (GCP)

tsdevstack on GCP uses [Cloud Run](https://cloud.google.com/run) for all compute (backends, Kong gateway, Next.js frontends, and workers), with [Cloud SQL](https://cloud.google.com/sql) for PostgreSQL, [Memorystore](https://cloud.google.com/memorystore) for Redis, and a Global HTTPS Load Balancer with [Cloud Armor](https://cloud.google.com/security/products/armor) WAF at the edge.

Cloud Run scales to zero natively, with 2-8 second cold starts, so `minInstances: 0` is a real option for development environments. (Azure supports it too; AWS does not.) The architecture uses ~35 Terraform resources.

:::info Cost
tsdevstack is free and open source — there are no license fees. You only pay Google directly for the cloud resources. See [GCP Cost Estimation](/docs/infrastructure/providers/gcp/cost-estimation) for a full breakdown by scenario.
:::

## Key Characteristics

- **Compute:** Cloud Run for all services (serverless containers)
- **Data:** Cloud SQL PostgreSQL + Memorystore Redis
- **Edge:** Global HTTPS Load Balancer + Cloud Armor WAF
- **Scale-to-zero:** Native Cloud Run (`minInstances: 0`)
- **Networking:** VPC with Private Google Access + Direct VPC Egress
- **Secrets:** Secret Manager with native environment variable mount

## Getting Started

1. [Account Setup](/docs/infrastructure/providers/gcp/account-setup) — Create service account and configure credentials
2. [Architecture](/docs/infrastructure/providers/gcp/architecture) — Understand what gets deployed
3. [Cost Estimation](/docs/infrastructure/providers/gcp/cost-estimation) — What you'll pay Google (dev, prod, scaled)
4. [DNS & Domains](/docs/infrastructure/providers/gcp/dns-and-domains) — Configure custom domains and SSL
5. [CI/CD](/docs/infrastructure/providers/gcp/cicd) — Set up Workload Identity Federation for GitHub Actions
