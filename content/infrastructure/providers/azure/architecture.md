# Azure Architecture

What gets deployed when you run `infra:deploy` on Azure and how traffic flows through the system.

## High-Level Architecture

```
                                Internet
                                    |
                                    v
                    +-------------------------------+
                    |   Azure Front Door            |
                    |   - WAF (custom + managed)    |
                    |   - CDN (global edge caching) |
                    |   - Managed SSL certificates  |
                    |   - Load balancing             |
                    +------+--------+--------+------+
                           |        |        |
                           v        v        v
                    api.x.com  app.x.com  spa.x.com
                           |        |        |
                           v        v        v
                   +--------+  +--------+  +----------+
                   | Kong   |  | Next.js|  | Blob     |
                   | App Svc|  | App Svc|  | Storage  |
                   +----+---+  +--------+  +----------+
                        |
                [VNet integration]
                [Private DNS zone]
                        |
          +-------------+-------------+
          |             |             |
          v             v             v
   +-----------+  +-----------+  +-----------+
   |auth-svc   |  |bff-svc    |  |offers-svc |
   |Container  |  |Container  |  |Container  |
   |App (ILB)  |  |App (ILB)  |  |App (ILB)  |
   +-----+-----+  +-----+-----+  +-----+-----+
         |               |               |
         v               v               v
+----------------+ +---------------+ +---------------+
| PostgreSQL     | | Managed Redis | | Key Vault     |
| Flexible Server| | (Balanced B0) | | (RBAC mode)   |
+----------------+ +---------------+ +---------------+
```

## Standard vs Premium Tier

The architecture has two security tiers controlled by the `frontdoorPremium` toggle in `infrastructure.json`.

### Standard — secure by default

Standard is the default and provides strong security within Azure's constraints. Front Door terminates TLS at the edge, applies WAF rules, and forwards traffic to your origins. Since Azure Standard Front Door doesn't include Microsoft's managed WAF rulesets, tsdevstack generates ~79 custom WAF rules that cover the same ground: SQLi, XSS, path traversal, command injection, SSRF, scanner fingerprints, known CVEs, rate limiting, and protocol abuse.

Origin protection uses App Service Access Restrictions — a **platform-level** networking feature. The generated Terraform sets `ip_restriction_default_action = "Deny"` on each App Service, with a single Allow rule for the `AzureFrontDoor.Backend` service tag filtered by the Front Door instance's FDID (`x_azure_fdid` header). Traffic that doesn't match is rejected by Azure's platform before it ever reaches your container. The origins do have public endpoints, but the platform denies any request that didn't come through your specific Front Door instance.

### Premium — Private Link + managed rulesets (+$295/month)

Premium adds two things. First, **Private Link origins** — Front Door connects to App Service over Azure's backbone network instead of the public internet. Your origins have zero public surface. Second, **Microsoft managed WAF rulesets** (DRS 2.1 Default Rule Set + Bot Manager 1.1) — professionally maintained rules updated by Microsoft's security team. With managed rulesets handling SQLi, XSS, and common attack patterns, the custom rule count drops from ~79 to ~35 (covering rate limiting, restricted paths, scanner fingerprints, CVE patterns, and protocol abuse that managed rulesets don't address).

### Comparison

| Aspect | Standard | Premium |
|--------|----------|---------|
| SKU | `Standard_AzureFrontDoor` | `Premium_AzureFrontDoor` |
| Origin connection | Public endpoints + Access Restrictions (FDID validation) | Private Link (zero public surface) |
| WAF managed rulesets | None (not available on Standard) | DRS 2.1 + Bot Manager 1.1 |
| WAF custom rules | ~79 (full coverage written by tsdevstack) | ~35 (managed rulesets cover the rest) |
| Monthly cost delta | Base (~$35) | +$295/month (~$330 total) |

Standard is production-ready — the 79 custom WAF rules provide equivalent coverage to the managed rulesets. Premium is worth it when you need Private Link for compliance requirements (e.g. zero public surface) or prefer Microsoft-maintained WAF rules over custom ones.

WAF rules can be customized via `infrastructure.json`. See [Service Configuration — WAF Rules](/infrastructure/service-configuration#waf-rules) for details.

## Compute: App Service + Container Apps

**App Service (Kong + Next.js):**
- Kong and Next.js run on App Service (not Container Apps) for:
  - Front Door Access Restrictions with FDID header validation
  - Always-available gateway (`always_on: true`)
- Default SKU: B1 (~$13/month per plan). S1 (~$69/month) for auto-scaling
- VNet integrated for outbound traffic to Container Apps

**Container Apps (NestJS backends):**
- Consumption plan with ILB (Internal Load Balancer) — no public IP
- KEDA HTTP scaling enables scale-from-zero with automatic wake-up (2-5s cold start)
- Services are VNet-accessible only via ILB static IP + private DNS zone

## Data: PostgreSQL + Managed Redis

**PostgreSQL Flexible Server:**
- VNet-integrated (postgres subnet, no public access)
- Databases created directly by Terraform (no Lambda job like AWS)
- Default: `B_Standard_B1ms` (~$14/month, burstable)
- Migrations run via Container Apps Jobs (in VNet, can reach PostgreSQL)

**Azure Managed Redis:**
- `Balanced_B0` (~$13/month) with `EnterpriseCluster` policy
- Private endpoint only (no public access)
- TLS required, dynamic port (from Terraform output)

:::info
**BullMQ compatibility:** Azure Managed Redis uses `EnterpriseCluster` clustering policy. BullMQ requires a `{bull}` prefix to force all keys to the same hash slot, avoiding `CROSSSLOT` errors. This is Azure-specific — GCP and AWS don't use clustering at the basic tier.
:::

## Edge: Front Door

Azure Front Door replaces three AWS services (CloudFront + ALB + ACM) with one unified service.

**Features:**
- CDN with global edge caching
- WAF (custom rules or managed rulesets depending on tier)
- Managed SSL certificates (auto-provisioned)
- Load balancing across origin groups

**Standard tier WAF (~79 custom rules):**

| Priority Range | Category |
|----------------|----------|
| 100-199 | Rate limiting |
| 200-299 | Restricted paths + methods |
| 300-399 | Scanner fingerprints |
| 400-499 | Known CVE patterns |
| 500-899 | SQLi, XSS, path traversal, Node.js, command injection |
| 900-999 | File + protocol abuse |

**Premium tier:** Bands 500-899 are replaced by Microsoft's managed rulesets (DRS 2.1 + Bot Manager), with ~35 custom rules covering rate limiting, restricted paths, scanner fingerprints, CVE patterns, and protocol abuse.

## Networking

```
VNet: 10.0.0.0/16
|
+-- Subnet: container-apps (10.0.0.0/23)
|   +-- Container Apps Environment (ILB, private IP only)
|
+-- Subnet: postgres (10.0.2.0/28)
|   +-- PostgreSQL Flexible Server
|
+-- Subnet: private-endpoints (10.0.3.0/28)
|   +-- Azure Managed Redis Private Endpoint
|
+-- Subnet: app-service-integration (10.0.4.0/25)
|   +-- App Service VNet integration (Kong + Next.js outbound)
|
+-- Private DNS Zones
    +-- private.postgres.database.azure.com
    +-- privatelink.redis.azure.net
    +-- {cae-default-domain} (Container Apps wildcard A record)
```

Kong (App Service) resolves Container App FQDNs via a private DNS zone with a wildcard A record pointing to the CAE internal static IP.

## Secrets: Key Vault

**RBAC mode** (not legacy Access Policies). Two principals with different roles:

| Principal | Role | Purpose |
|-----------|------|---------|
| Service Principal (from `cloud:init`) | Key Vault Secrets Officer | CLI: read + write + delete |
| Managed Identity (from Terraform) | Key Vault Secrets User | Runtime: read-only |

**Zero-credential runtime:** Container Apps only need `SECRETS_PROVIDER=azure` and `AZURE_KEYVAULT_NAME` as env vars. Managed Identity handles authentication automatically.

Secret naming auto-transforms underscores to hyphens: `DATABASE_URL` > `DATABASE-URL`.

## Scale-to-Zero

Container Apps use KEDA HTTP scaling — services scale to zero when idle and wake automatically on the next request (2-5s cold start). No wake-up mechanisms needed.

Kong runs on App Service with `always_on: true` — always available with no cold start.

## Security

- **Standard:** Front Door validates requests via Access Restrictions with FDID header matching
- **Premium:** Front Door connects via Private Link (zero public surface on App Service origins)
- Backend services are in ILB Container Apps Environment (no public IP)
- NSG rules: Allow LoadBalancer + VNet traffic, deny all others
- Managed Identity for zero-credential runtime (no secrets in containers)

## Cost Estimation

See [Azure Cost Estimation](/infrastructure/providers/azure/cost-estimation) for a detailed breakdown across development (scale-to-zero), production (always-on), and scaled scenarios, including Standard vs Premium tier comparisons and links to official Azure pricing pages.

## Terraform Resources

Azure deployments create approximately 25-30 Terraform resources — the fewest of all three providers. This includes VNet, subnets, Container Apps Environment, App Service plans, Front Door profile with WAF policy, PostgreSQL Flexible Server, Managed Redis, Key Vault, ACR, DNS zones, and Managed Identity role assignments.
