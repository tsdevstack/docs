# Google Cloud Platform (GCP)

tsdevstack on GCP uses [Cloud Run](https://cloud.google.com/run) for all compute (backends, Kong gateway, Next.js frontends, and workers), with [Cloud SQL](https://cloud.google.com/sql) for PostgreSQL, [Memorystore](https://cloud.google.com/memorystore) for Redis, and a Global HTTPS Load Balancer with [Cloud Armor](https://cloud.google.com/security/products/armor) WAF at the edge.

GCP has the simplest scale-to-zero story — Cloud Run handles it natively with 2-8 second cold starts. No Lambda functions or wake-up mechanisms are needed. The architecture uses ~35 Terraform resources and costs approximately $100-120/month for a development environment.

## Key Characteristics

- **Compute:** Cloud Run for all services (serverless containers)
- **Data:** Cloud SQL PostgreSQL + Memorystore Redis
- **Edge:** Global HTTPS Load Balancer + Cloud Armor WAF
- **Scale-to-zero:** Native Cloud Run (simplest of all 3 providers)
- **Networking:** VPC with Private Google Access + Direct VPC Egress
- **Secrets:** Secret Manager with native environment variable mount

:::info Cost note
tsdevstack is free and open source — there are no license fees. The costs shown above are estimates for GCP cloud resources that you pay directly to Google. Actual costs depend on your usage, region, and GCP pricing changes.
:::

## Getting Started

1. [Account Setup](/infrastructure/providers/gcp/account-setup) — Create service account and configure credentials
2. [Architecture](/infrastructure/providers/gcp/architecture) — Understand what gets deployed
3. [DNS & Domains](/infrastructure/providers/gcp/dns-and-domains) — Configure custom domains and SSL
4. [CI/CD](/infrastructure/providers/gcp/cicd) — Set up Workload Identity Federation for GitHub Actions
