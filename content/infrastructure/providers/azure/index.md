# Microsoft Azure

tsdevstack on Azure uses [Container Apps](https://azure.microsoft.com/en-us/products/container-apps) for backend services, [App Service](https://azure.microsoft.com/en-us/products/app-service) for Kong and Next.js, [PostgreSQL Flexible Server](https://azure.microsoft.com/en-us/products/postgresql) for databases, and [Azure Managed Redis](https://azure.microsoft.com/en-us/products/cache). [Azure Front Door](https://azure.microsoft.com/en-us/products/frontdoor) provides a unified edge service combining CDN, WAF, SSL, and load balancing in one.

Azure has the simplest architecture overall (~25-30 Terraform resources vs AWS's ~45). Front Door replaces three separate AWS services (CloudFront + ALB + ACM) with one unified service. There are two security tiers: Standard and Premium (adding Private Link origins and managed WAF rulesets).

:::info Cost
tsdevstack is free and open source — there are no license fees. You only pay Microsoft directly for the cloud resources. See [Azure Cost Estimation](/infrastructure/providers/azure/cost-estimation) for a full breakdown by scenario.
:::

## Key Characteristics

- **Compute:** Container Apps (ILB) for backends, App Service for Kong + Next.js
- **Data:** PostgreSQL Flexible Server + Azure Managed Redis
- **Edge:** Front Door (unified CDN + WAF + SSL + LB)
- **Scale-to-zero:** Container Apps KEDA HTTP scaling (automatic, 2-5s cold start)
- **Networking:** VNet with ILB-enabled Container Apps Environment
- **Secrets:** Key Vault with RBAC mode + Managed Identity (zero-credential runtime)

## Standard vs Premium Tier

| Aspect | Standard | Premium |
|--------|----------|---------|
| Origin connection | Public endpoints + Access Restrictions | Private Link (no public access) |
| WAF managed rulesets | None | DRS 2.1 + Bot Manager 1.1 |
| WAF custom rules | ~79 | ~35 (managed rulesets cover the rest) |
| Monthly cost delta | Base | +$295/month |

## Getting Started

1. [Account Setup](/infrastructure/providers/azure/account-setup) — Create App Registration and configure credentials
2. [Architecture](/infrastructure/providers/azure/architecture) — Understand what gets deployed
3. [Cost Estimation](/infrastructure/providers/azure/cost-estimation) — What you'll pay Microsoft (development, production, scaled)
4. [DNS & Domains](/infrastructure/providers/azure/dns-and-domains) — Configure Azure DNS and custom domains
5. [CI/CD](/infrastructure/providers/azure/cicd) — Set up OIDC federation for GitHub Actions
