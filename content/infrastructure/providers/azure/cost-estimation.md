# Azure Cost Estimation

:::tip No fees from tsdevstack
tsdevstack is free and open source. All costs on this page are paid directly to Microsoft Azure. There is no bill from tsdevstack and there never will be.
:::

These are estimates based on published Azure pricing as of March 2026 in a US region (East US). Actual costs depend on your region, traffic, and any pricing changes by Microsoft. Always verify with the official pricing pages linked at the bottom.

---

## What Gets Deployed

A typical tsdevstack project (3 NestJS backends + 1 Next.js frontend) creates these billable resources on Azure:

| Resource | Azure Service | Default Configuration |
|----------|------------|----------------------|
| Kong gateway | App Service (dedicated plan) | B1 plan, `always_on: true` |
| Frontend | App Service (shared plan) | B1 plan, `always_on: true` |
| Backend services (x3) | Container Apps (Consumption) | 0.25 vCPU, 0.5 GiB memory, configurable min instances |
| Database | PostgreSQL Flexible Server | `B_Standard_B1ms`, 32 GB disk |
| Cache | Azure Managed Redis | `Balanced_B0`, 1 GB |
| Edge / CDN / WAF / SSL | Front Door | Standard or Premium tier |
| Secrets | Key Vault | RBAC mode |
| DNS | Azure DNS | 1 zone |
| Container images | Azure Container Registry | Basic tier |

You can override CPU, memory, instance counts, database tier, Redis tier, disk size, App Service SKU, and Front Door tier in `infrastructure.json`. See [Service Configuration](/infrastructure/service-configuration) for all available options.

---

## Standard vs Premium

The biggest cost decision on Azure is the Front Door tier:

| | Standard | Premium |
|---|----------|---------|
| **Monthly base** | ~$35 | ~$330 |
| **Origin protection** | Access Restrictions + FDID header | Private Link (no public access) |
| **WAF** | ~79 custom rules | DRS 2.1 + Bot Manager + ~35 custom rules |
| **Cost difference** | — | +$295/month |

All scenarios below show Standard pricing. Add ~$295/month for Premium.

---

## Scenario 1 — Development (Scale-to-Zero, Standard)

Backend services set to `minInstances: 0` (default on Azure). Kong and Next.js always on via App Service. Minimal traffic.

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (App Service) | B1 plan, always on | Dedicated App Service plan | ~$13 |
| Frontend (App Service) | B1 plan, always on | Shared App Service plan | ~$13 |
| Backend services ×3 | 0.25 vCPU, 0.5 GiB, min=0 | Consumption billing — near-zero when idle | ~$1-5 |
| PostgreSQL Flexible Server | B_Standard_B1ms, 32 GB | 1 vCore burstable + storage | ~$14 |
| Managed Redis | Balanced B0, 1 GB | Entry-level tier | ~$13 |
| Front Door (Standard) | CDN + WAF + SSL + routing | Base fee + requests + data transfer | ~$35 |
| ACR Basic | Container Registry | 10 GB included storage | ~$5 |
| DNS, Key Vault, Logs | Minimal | — | ~$1-3 |
| **Total (Standard)** | | | **~$95-105** |
| **Total (Premium)** | | +$295 for Front Door Premium | **~$390-400** |

Cold starts after scale-to-zero: **2-5 seconds**. Container Apps use KEDA HTTP scaling — no wake-up mechanisms needed.

---

## Scenario 2 — Production (Always-On, Single Instance, Standard)

All services with `minInstances: 1`. Moderate traffic (~100k requests/day).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (App Service) | B1 plan, always on | — | ~$13 |
| Frontend (App Service) | B1 plan, always on | — | ~$13 |
| Backend services ×3 | 0.25 vCPU, 0.5 GiB, min=1 each | 3 × 730 hrs × ($0.000024/vCPU-sec + $0.000003/GiB-sec) | ~$5-15 |
| PostgreSQL Flexible Server | B_Standard_B1ms, 32 GB | — | ~$14 |
| Managed Redis | Balanced B0 | — | ~$13 |
| Front Door (Standard) | Moderate traffic | Base + requests + data | ~$38-45 |
| ACR, DNS, Key Vault, Logs | Minimal | — | ~$6-8 |
| **Total (Standard)** | | | **~$105-125** |
| **Total (Premium)** | | +$295 for Front Door Premium | **~$400-420** |

:::tip
Azure Container Apps on the Consumption plan with 0.25 vCPU / 0.5 GiB is very cheap even when always on. Upgrading App Service to S1 (~$69/plan) enables auto-scaling for Kong and Next.js.
:::

---

## Scenario 3 — Production Under Load (3 Instances, 24/7, Standard)

Services auto-scale to 3 instances average. App Service upgraded to S1 for auto-scaling. Heavy sustained traffic for 30 days.

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (App Service) | S1 plan, auto-scale | Upgraded plan | ~$69 |
| Frontend (App Service) | S1 plan, auto-scale | Upgraded plan | ~$69 |
| Backend services ×3 | 0.25 vCPU, 0.5 GiB, avg 3 each | 9 instances × 730 hrs × consumption rate | ~$15-40 |
| PostgreSQL Flexible Server | GP_Standard_D2s_v3, 32 GB | Upgraded for load (General Purpose) | ~$100-130 |
| Managed Redis | Balanced B1 | Upgraded for load | ~$25 |
| Front Door (Standard) | High traffic | Base + requests + data | ~$45-65 |
| ACR, DNS, Key Vault, Logs | — | — | ~$8-12 |
| **Total (Standard)** | | | **~$330-415** |
| **Total (Premium)** | | +$295 for Front Door Premium | **~$625-710** |

At this scale, consider [Azure Reservations](https://azure.microsoft.com/en-us/pricing/reservations/) for App Service and PostgreSQL (up to 40% savings with 1-year commitment).

---

## What Drives the Cost

| # | Cost driver | Why |
|---|------------|-----|
| 1 | **Front Door tier** | Standard ($35) vs Premium ($330). The single biggest cost variable. |
| 2 | **App Service plans** | B1 ($13/plan × 2) vs S1 ($69/plan × 2). Needed for Kong + Next.js. |
| 3 | **PostgreSQL tier** | Burstable B1ms ($14) vs General Purpose D2s ($100+). Pick based on load. |
| 4 | **Container Apps** | Very cheap on Consumption plan. Not a major cost driver. |

---

## How to Reduce Costs

- **Use Standard Front Door** unless you need Private Link or managed WAF rulesets — saves $295/month
- **Stay on B1 App Service** for development — upgrade to S1 only when you need auto-scaling
- **Keep `minInstances: 0`** on Container Apps (Azure default) — accept 2-5s cold starts
- **Use `B_Standard_B1ms`** for development databases — upgrade only when needed
- **Azure Reservations** — 1-year commitment saves up to 40% on App Service and PostgreSQL

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
    "tier": "GP_Standard_D2s_v3",
    "diskSize": 64
  },
  "redis": {
    "tier": "Balanced_B1"
  },
  "appService": {
    "kongSku": "S1",
    "nextjsSku": "S1"
  }
}
```

See [Service Configuration](/infrastructure/service-configuration) for all available options.

---

## Azure Pricing References

- [Container Apps Pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/)
- [App Service Pricing (Linux)](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/)
- [PostgreSQL Flexible Server Pricing](https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/)
- [Managed Redis Pricing](https://azure.microsoft.com/en-us/pricing/details/managed-redis/)
- [Front Door Pricing](https://azure.microsoft.com/en-us/pricing/details/frontdoor/)
- [Key Vault Pricing](https://azure.microsoft.com/en-us/pricing/details/key-vault/)
- [Container Registry Pricing](https://azure.microsoft.com/en-us/pricing/details/container-registry/)
- [Azure DNS Pricing](https://azure.microsoft.com/en-us/pricing/details/dns/)
