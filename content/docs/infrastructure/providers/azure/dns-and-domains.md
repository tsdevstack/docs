# Azure DNS & Domains

Provider-specific DNS configuration and SSL certificate setup for Azure deployments.

## Overview

Azure uses Azure DNS for domain management and Front Door for TLS certificate provisioning. Once nameservers point to Azure DNS, Front Door **automatically** validates domains and provisions managed TLS certificates — no manual DNS validation records are needed.

## Step 1: Deploy Infrastructure

When `baseDomain` is configured, `infra:deploy` creates an Azure DNS zone automatically.

```bash
npx tsdevstack infra:deploy --env dev
```

The CLI displays the Azure DNS zone nameservers after deployment.

## Step 2: Find Azure DNS Nameservers

If you need to find the nameservers later:

1. Go to the [Azure Portal](https://portal.azure.com)
2. Search for **"DNS zones"**
3. Click on your DNS zone (e.g., `example.com`)
4. The **Overview** page shows the **Name server** records (4 values)
5. Copy all 4 nameservers (e.g., `ns1-03.azure-dns.com`, `ns2-03.azure-dns.net`, etc.)

## Step 3: Update Domain Registrar

Go to your domain registrar (Namecheap, Cloudflare, GoDaddy, etc.):

1. Find **Nameservers** or **DNS settings**
2. Change to **Custom nameservers**
3. Enter the 4 Azure DNS nameservers (one per field, no trailing dots)
4. Save changes

**Propagation:** DNS changes take 15 minutes to 48 hours (usually under 1 hour).

```bash
# Verify propagation
dig NS example.com +short
# Should return Azure DNS nameservers
```

## SSL Certificates

Front Door provisions managed TLS certificates automatically once DNS is configured. No manual validation records are needed.

### Checking Custom Domain Status

1. Navigate to **Front Door and CDN profiles** in the portal
2. Click your Front Door profile (e.g., `{projectName}-{env}-fd`)
3. Click **Domains** in the left sidebar
4. Each custom domain shows:
   - **Domain validation state** — should be `Approved`
   - **HTTPS certificate status** — should be `Succeeded`
5. If stuck on `Pending`, ensure nameservers are correctly pointed to Azure DNS

### Standard vs Premium SSL

- **Standard:** Front Door connects to public App Service endpoints, validates via FDID header
- **Premium:** Front Door connects via Private Link (no public endpoints needed)

Both tiers use Front Door Managed Certificates — auto-provisioned and auto-renewed.

## What Terraform Manages

Once nameservers point to Azure DNS, Terraform handles everything else:

- CNAME records for Front Door endpoints
- TXT records for domain validation
- A records for apex domains
- TLS certificate provisioning via Front Door Managed Certificates

**You only need to set nameservers once per domain.** All other DNS records are created and managed by `infra:deploy`.

## Domain Changes

Front Door custom domain `host_name` is `ForceNew` in Terraform (destroy + recreate). The deploy command handles this with three-phase auto-recovery:

1. Targeted apply to remove route associations
2. Full apply to replace custom domains
3. Regenerate full config to re-associate routes

This handles domain changes without manual intervention.

## Troubleshooting

### Domain stuck on "Pending"

1. Verify nameservers at your registrar match Azure DNS
2. Check DNS propagation: `dig NS example.com +short`
3. Wait for propagation (can take up to 48 hours)
4. Redeploy: `npx tsdevstack infra:deploy --env dev`

### SKU Upgrade (Standard to Premium)

Upgrading from Standard to Premium triggers custom domain re-provisioning. This takes ~30-45 minutes and happens automatically during `infra:deploy`.
