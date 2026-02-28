# Domain Setup

Configuring domains for tsdevstack deployments.

## Overview

All domains point to a single Load Balancer IP. The Load Balancer routes traffic based on hostname:

| Domain | Routes To |
|--------|-----------|
| `api.example.com` | Kong Gateway |
| `example.com` | Frontend (Next.js) |
| `app.example.com` | SPA apps |

## Required Secrets

Before deploying, set the base domain:

```bash
npx tsdevstack cloud-secrets:set DOMAIN --value "example.com" --env prod
```

`API_URL` and `KONG_CORS_ORIGINS` are **auto-derived** during `cloud-secrets:push` from `DOMAIN` and the domains configured in `.tsdevstack/infrastructure.json` -- you do not need to set them manually.

| Secret | Example | Set By | Purpose |
|--------|---------|--------|---------|
| `DOMAIN` | `example.com` | Manual | Base domain - infrastructure derives `api.example.com` for Kong |
| `API_URL` | `https://api.example.com` | Auto-derived from `DOMAIN` | Full API URL used by frontend apps |
| `KONG_CORS_ORIGINS` | `https://example.com,https://app.example.com` | Auto-derived from `DOMAIN` + `infrastructure.json` domains | Domains allowed to make API calls |

> **Note:** All secrets can also be set directly in your cloud provider's console (GCP Secret Manager, AWS Secrets Manager, Azure Key Vault). The CLI commands are a convenience wrapper.

## Frontend Domains

Configure frontend domains in `.tsdevstack/infrastructure.json`:

```json
{
  "prod": {
    "frontend": {
      "domain": "example.com"
    },
    "react-app": {
      "domain": "app.example.com"
    }
  }
}
```

Services are configured directly at the environment level (not nested under a `services` key).

Backend services (NestJS) don't need domains - they're accessed via Kong.

## Deployment Order

1. **Set secrets** (`DOMAIN` -- `API_URL` and `KONG_CORS_ORIGINS` are auto-derived)
2. **Configure domains** in `infrastructure.json`
3. **Deploy infrastructure** - `npx tsdevstack infra:deploy --env prod` (includes Load Balancer)
4. **Add DNS records** (A records + SSL validation records)
5. **Wait for SSL** (30-60 minutes)

## DNS Records

After deploying infrastructure, add DNS records. The CLI outputs the required values.

### A Records

Point all your domains to the Load Balancer IP:

| Record Type | Name | Value |
|-------------|------|-------|
| A | `api.example.com` | Load Balancer IP |
| A | `example.com` | Load Balancer IP |
| A | `app.example.com` | Load Balancer IP |

:::tip Email DNS records
If you're setting up DNS records for your domain, this is also a good time to add the Resend email verification records (DKIM, SPF, DMARC). See [Resend setup](/integrations/resend#2-verify-your-domain).
:::

### SSL Validation Records

For each domain, add the validation record output by the CLI. The format varies by cloud provider:

- **GCP** — Certificate Manager DNS authorization. Each domain needs a CNAME record (e.g., `_acme-challenge.api.example.com` → `...certificatemanager.goog.`). See [GCP DNS & Domains](/infrastructure/providers/gcp/dns-and-domains).
- **AWS** — ACM certificate validation. CNAME records are auto-created by Terraform in Route 53 — no manual DNS records needed if Route 53 manages your domain. See [AWS DNS & Domains](/infrastructure/providers/aws/dns-and-domains).
- **Azure** — Front Door managed TLS. Certificates are auto-provisioned once nameservers point to Azure DNS — no manual validation records needed. See [Azure DNS & Domains](/infrastructure/providers/azure/dns-and-domains).

The exact values are unique per domain and output during deployment.

### Wait for SSL Provisioning

After DNS propagates, SSL certificates take 30-60 minutes to provision. HTTPS won't work until certificates are active.

## Checking Deployment Info

If you need to retrieve the Load Balancer IP or SSL validation records after deployment:

**Option 1: Cloud Console**
- **GCP**: [Load Balancing](https://console.cloud.google.com/net-services/loadbalancing) for IP address, [Certificate Manager](https://console.cloud.google.com/security/ccm) for SSL validation records
- **AWS**: [Route 53](https://console.aws.amazon.com/route53/) for DNS records, [ACM](https://console.aws.amazon.com/acm/) for certificate status, [CloudFront](https://console.aws.amazon.com/cloudfront/) for distribution domains
- **Azure**: [DNS zones](https://portal.azure.com/#browse/Microsoft.Network%2FdnsZones) for nameservers, [Front Door](https://portal.azure.com/#browse/Microsoft.Cdn%2Fprofiles) for custom domain status and TLS certificates

**Option 2: Redeploy**

```bash
npx tsdevstack infra:deploy-lb --env prod
```

The command outputs the Load Balancer IP and SSL validation records.

## Adding a New Domain

To add a new frontend app with its own domain:

1. Add the service to `config.json`
2. Add domain to `.tsdevstack/infrastructure.json`:
   ```json
   {
     "prod": {
       "new-app": {
         "domain": "new.example.com"
       }
     }
   }
   ```
3. Deploy the service: `npx tsdevstack infra:deploy-service new-app --env prod`
4. Update Load Balancer: `npx tsdevstack infra:deploy-lb --env prod`
5. Add DNS records (A record + SSL validation record)
6. Run `npx tsdevstack cloud-secrets:push --env prod` to update auto-derived secrets (`KONG_CORS_ORIGINS` will include the new domain automatically)

## Domain Redirects

To redirect alternate domains (e.g., `.app`, `.io`) to your canonical domain, configure redirects in `infrastructure.json`:

```json
{
  "prod": {
    "loadBalancer": {
      "redirectDomains": ["example.app", "example.io"]
    }
  }
}
```

All traffic to redirect domains (and their subdomains) will 301 redirect to the canonical domain.

## Troubleshooting

### SSL Certificate Not Provisioning

1. Verify DNS records are correct (both A record and SSL validation record)
2. Check that SSL validation CNAME value matches exactly what was output
3. Wait for DNS propagation (can take up to 48 hours for some providers)
4. After fixing DNS, redeploy to refresh:
   ```bash
   npx tsdevstack infra:deploy-lb --env prod
   ```

### Wrong Domain Configuration

If you set the wrong domain in secrets or `infrastructure.json`:

1. Fix the configuration
2. Redeploy the Load Balancer:
   ```bash
   npx tsdevstack infra:deploy-lb --env prod
   ```
3. Update DNS records with the new values

### CORS Errors

If frontend apps can't call the API:

1. Verify all frontend domains are configured in `.tsdevstack/infrastructure.json` -- `KONG_CORS_ORIGINS` is auto-derived from these entries
2. Re-push secrets to regenerate `KONG_CORS_ORIGINS`:
   ```bash
   npx tsdevstack cloud-secrets:push --env prod
   ```
3. Redeploy Kong:
   ```bash
   npx tsdevstack infra:deploy-kong --env prod
   ```
