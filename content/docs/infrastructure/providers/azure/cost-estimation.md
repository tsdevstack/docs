# Azure Cost Estimation

:::tip No fees from tsdevstack
tsdevstack is free and open source. All costs on this page are paid directly to Microsoft Azure. There is no bill from tsdevstack and there never will be.
:::

These are estimates based on published Azure pricing as of July 2026 in a US region (East US). Actual costs depend on your region, traffic, and any pricing changes by Microsoft. Always verify with the official pricing pages linked at the bottom.

:::info 2026 pricing pressure
The AI buildout is squeezing server hardware supply, and that is expected to reach cloud list prices in the second half of 2026. As of July 2026 the Azure rates on this page are unchanged, including Container Apps consumption at $0.000024/vCPU-second and $0.000003/GiB-second.

Server memory contract prices rose sharply through the first half of 2026, and there is typically a 6 to 9 month lag before that shows up in cloud pricing, with forecasts pointing to roughly 5-10% general increases. The most exposed lines here are **PostgreSQL Flexible Server** and **Managed Redis**, which are priced off provisioned memory, followed by **App Service** plans. Front Door base fees are the least exposed. If you are budgeting past Q3 2026, add a 10% buffer on the database and cache lines.
:::

---

## What Gets Deployed

A typical tsdevstack project (3 NestJS backends + 1 Next.js frontend) creates these billable resources on Azure:

| Resource | Azure Service | Default Configuration |
|----------|------------|----------------------|
| Kong gateway | App Service (dedicated plan) | B1 plan, `always_on: true` |
| Frontend | App Service (shared plan) | B1 plan, `always_on: true` |
| Backend services (x3) | Container Apps (Consumption) | 0.5 vCPU, 1 GiB memory, configurable min instances |
| SPA (react-app) | Blob Storage + Front Door | Static container, no compute |
| Database | PostgreSQL Flexible Server | `B_Standard_B1ms`, 32 GB disk |
| Cache | Azure Managed Redis | `Balanced_B0`, 1 GB |
| Edge / CDN / WAF / SSL | Front Door | Standard or Premium tier |
| Secrets | Key Vault | RBAC mode |
| DNS | Azure DNS | 1 zone |
| Kong private endpoint (with Next.js apps) | Private Link + private DNS zone | 1 endpoint, the Next.js servers' path to Kong |
| Container images | Azure Container Registry | Basic tier |

You can override CPU, memory, instance counts, database tier, Redis tier, disk size, App Service SKU, and Front Door tier in `infrastructure.json`. See [Service Configuration](/docs/infrastructure/service-configuration) for all available options.

---

## Standard vs Premium

The biggest cost decision on Azure is the Front Door tier:

| | Standard | Premium |
|---|----------|---------|
| **Monthly base** | ~$35 | ~$412.50 |
| **Origin protection** | Access Restrictions + FDID header | Private Link (no public access) |
| **WAF** | ~79 custom rules | DRS 2.1 + Bot Manager + ~35 custom rules |
| **Cost difference** | — | +$377.50/month |

All scenarios below show Standard pricing. Add ~$377.50/month for Premium. (Base fees verified against the Azure Retail Prices API, July 2026.)

---

## Scenario 1 — Development (Scale-to-Zero, Standard)

Backend services set to `minInstances: 0` (default on Azure). Kong and Next.js always on via App Service. **Assumed traffic: ~1,000 requests/day** (testing only).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (App Service) | B1 plan, always on | Dedicated App Service plan | ~$13 |
| Frontend (App Service) | B1 plan, always on | Shared App Service plan | ~$13 |
| Backend services ×3 | 0.5 vCPU, 1 GiB, min=0 | Consumption billing — free grant covers idle | ~$0-3 |
| SPA bucket | Blob Storage + Front Door | Storage + minimal egress | ~$1 |
| PostgreSQL Flexible Server | B_Standard_B1ms, 32 GB | 1 vCore burstable + storage | ~$14 |
| Managed Redis | Balanced B0, 1 GB | Entry-level tier | ~$13 |
| Front Door (Standard) | CDN + WAF + SSL + routing | Base fee + requests + data transfer | ~$35 |
| ACR Basic | Container Registry | 10 GB included storage | ~$5 |
| DNS, Key Vault, Logs | Minimal | — | ~$1-3 |
| Kong private endpoint | Next.js servers to Kong | $0.01/hour + $0.01/GB processed + $0.50 DNS zone | ~$8 |
| **Total (Standard)** | | | **~$103-108** |
| **Total (Premium)** | | +$377.50 for Front Door Premium | **~$481-486** |

Cold starts after scale-to-zero: **2-5 seconds**. Container Apps use KEDA HTTP scaling — no wake-up mechanisms needed.

---

## Scenario 2 — Production (Always-On, Single Instance, Standard)

All services with `minInstances: 1`. **Assumed traffic: ~100,000 requests/day** (3M/month).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (App Service) | B1 plan, always on | — | ~$13 |
| Frontend (App Service) | B1 plan, always on | — | ~$13 |
| Backend services ×3 | 0.5 vCPU, 1 GiB, min=1 each | 3.9M vCPU-sec at idle rate + 7.5M GiB-sec, less free grant | ~$39 |
| SPA bucket | Blob Storage + Front Door | Storage + egress | ~$1 |
| PostgreSQL Flexible Server | B_Standard_B1ms, 32 GB | — | ~$14 |
| Managed Redis | Balanced B0 | — | ~$13 |
| Front Door (Standard) | Moderate traffic | $35 base + 3M × $0.011/10k | ~$38-45 |
| ACR, DNS, Key Vault, Logs | Minimal | — | ~$6-8 |
| Kong private endpoint | Next.js servers to Kong | $0.01/hour + $0.01/GB processed + $0.50 DNS zone | ~$8 |
| **Total (Standard)** | | | **~$143-158** |
| **Total (Premium)** | | +$377.50 for Front Door Premium | **~$521-536** |

:::tip
Container Apps idle billing keeps this moderate: a `minInstances: 1` replica with no requests bills vCPU at $0.000003/sec instead of the active $0.000024/sec, and the first 180,000 vCPU-seconds and 360,000 GiB-seconds a month are free. Kong and Next.js run one instance each on B1. Autoscale needs a Standard plan (S1, ~$69 per instance) with `maxInstances` above `minInstances`; see [Azure App Service plans](/docs/infrastructure/service-configuration#azure-app-service-plans).
:::

---

## Scenario 3 — Production Under Load (3 Instances, 24/7, Standard)

Services auto-scale to 3 replicas on average. App Service runs S1 with autoscale (`minInstances: 1`, `maxInstances` above it). Kong and the frontend are assumed to average one instance each; every extra instance adds ~$69. **Assumed traffic: ~10M requests/day** (300M/month).

| Resource | Configuration | How it's calculated | Est. monthly |
|----------|--------------|---------------------|-------------|
| Kong (App Service) | S1 plan, autoscale, avg 1 instance (assumed) | $69 per instance | ~$69 |
| Frontend (App Service) | S1 plan, autoscale, avg 1 instance (assumed) | $69 per instance | ~$69 |
| **Backend services ×3** | 0.5 vCPU, 1 GiB, avg 3 each | 11.8M vCPU-sec mostly at **active** rate + 23.7M GiB-sec | **~$250** |
| **Front Door (Standard)** | High traffic | $35 base + 300M × $0.011/10k | **~$250-380** |
| SPA bucket | Blob Storage + Front Door | Storage + egress at volume | ~$5-15 |
| PostgreSQL Flexible Server | GP_Standard_D2s_v3, 32 GB | Upgraded for load (General Purpose) | ~$100-130 |
| Managed Redis | Balanced B1 | Upgraded for load | ~$25 |
| ACR, DNS, Key Vault, Logs | — | — | ~$8-12 |
| Kong private endpoint | Next.js servers to Kong | $7.30 + $0.01/GB processed (assumed under 200 GB) + $0.50 DNS zone | ~$8-10 |
| **Total (Standard)** | | | **~$788-960** |
| **Total (Premium)** | | +$377.50 for Front Door Premium | **~$1,166-1,338** |

:::warning The Container Apps idle discount disappears under load
At moderate traffic these replicas bill at $0.000003/vCPU-sec. Once they are serving continuously they bill at $0.000024/vCPU-sec, the same active rate as Cloud Run, which is why this line jumps from ~$39 to ~$250. Front Door's $0.011 per 10,000 requests is the other dominant line at this volume. Earlier versions of this page listed these at ~$15-40 and ~$45-65, which was far too low.
:::

At this scale, consider [Azure Reservations](https://azure.microsoft.com/en-us/pricing/reservations/) for App Service and PostgreSQL (up to 40% savings with 1-year commitment).

---

## What Drives the Cost

| # | Cost driver | Why |
|---|------------|-----|
| 1 | **Front Door tier** | Standard ($35) vs Premium ($412.50). The single biggest cost variable. |
| 2 | **App Service plans** | Billed per instance: B1 ~$13, S1 ~$69 a month. Two plans (Kong, Next.js), at least one instance each. |
| 3 | **PostgreSQL tier** | Burstable B1ms ($14) vs General Purpose D2s ($100+). Pick based on load. |
| 4 | **Container Apps** | Very cheap on Consumption plan. Not a major cost driver. |

---

## How to Reduce Costs

- **Use Standard Front Door** unless you need Private Link or managed WAF rulesets — saves $377.50/month
- **Stay on B1 App Service** for development, one instance per plan. Move to S1 only when you need autoscale, and keep `maxInstances` at what you are willing to pay for
- **Keep `minInstances: 0`** on Container Apps **in development** — accept 2-5s cold starts
- **Use `B_Standard_B1ms`** for development databases — upgrade only when needed
- **Azure Reservations** — 1-year commitment saves up to 40% on App Service and PostgreSQL

:::warning Azure defaults to scale-to-zero in every environment
Unlike GCP, which defaults to `minInstances: 1`, and AWS, which has no scale-to-zero at all, Azure's service default is `minInstances: 0`. That applies to production too, so unless you set it explicitly your production backend services will scale to zero and every cold request pays the 2-5s startup penalty, plus database connection pool warmup on top.

Set it per environment in `.tsdevstack/infrastructure.json`:

```json
{
  "version": "1.0.0",
  "prod": {
    "auth-service": { "minInstances": 1 }
  }
}
```

Kong is unaffected: it is clamped to at least 1 on all providers regardless of configuration.
:::

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
      "tier": "GP_Standard_D2s_v3",
      "diskSize": 64
    },
    "redis": {
      "tier": "Balanced_B1"
    },
    "appService": {
      "kongSku": "S1",
      "nextjsSku": "S1"
    },
    "kong": { "minInstances": 1, "maxInstances": 3 }
  }
}
```

See [Service Configuration](/docs/infrastructure/service-configuration) for all available options.

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
