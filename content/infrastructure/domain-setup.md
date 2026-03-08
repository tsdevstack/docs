# Domain Setup

Configuring domains for tsdevstack deployments.

## Overview

All domains route through the load balancer, which directs traffic based on hostname:

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

1. **Set secrets** (`DOMAIN` — `API_URL` and `KONG_CORS_ORIGINS` are auto-derived)
2. **Configure domains** in `infrastructure.json`
3. **Set up DNS** (provider-specific — see below)
4. **Deploy infrastructure** — `npx tsdevstack infra:deploy --env prod`
5. **Wait for SSL** (varies by provider)

## DNS Setup

DNS configuration differs by cloud provider:

| Provider | DNS Management | A Records | SSL Certificates |
|----------|---------------|-----------|-----------------|
| **GCP** | Your domain registrar | Manual — point to Load Balancer IP | Manual — add CNAME validation records |
| **AWS** | Route 53 (nameservers moved to AWS) | Auto-created by Terraform | Auto-created and validated by Terraform |
| **Azure** | Azure DNS (nameservers moved to Azure) | Auto-created by Terraform | Auto-provisioned by Front Door |

Follow your provider's DNS guide:

- [GCP DNS & Domains](/infrastructure/providers/gcp/dns-and-domains) — manual A records + SSL validation CNAMEs at your registrar
- [AWS DNS & Domains](/infrastructure/providers/aws/dns-and-domains) — move nameservers to Route 53, everything else is automated
- [Azure DNS & Domains](/infrastructure/providers/azure/dns-and-domains) — move nameservers to Azure DNS, everything else is automated

:::tip Email DNS records
When setting up DNS, this is also a good time to add the Resend email verification records (DKIM, SPF, DMARC). See [Resend setup](/integrations/resend#2-verify-your-domain).
:::

## Checking Deployment Info

If you need to retrieve deployment details (IPs, DNS records, certificate status) after deployment, check your provider's console:

- **GCP**: [Load Balancing](https://console.cloud.google.com/net-services/loadbalancing) for IP address, [Certificate Manager](https://console.cloud.google.com/security/ccm) for SSL validation records
- **AWS**: [Route 53](https://console.aws.amazon.com/route53/) for DNS records, [ACM](https://console.aws.amazon.com/acm/) for certificate status, [CloudFront](https://console.aws.amazon.com/cloudfront/) for distribution domains
- **Azure**: [DNS zones](https://portal.azure.com/#browse/Microsoft.Network%2FdnsZones) for nameservers, [Front Door](https://portal.azure.com/#browse/Microsoft.Cdn%2Fprofiles) for custom domain status and TLS certificates

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

- **GCP**: Check that A records and SSL validation CNAMEs are correct at your registrar. Enter relative host names (e.g., `api`), not full domain names. See [GCP DNS & Domains](/infrastructure/providers/gcp/dns-and-domains).
- **AWS**: Check that nameservers at your registrar point to Route 53. Run `dig NS example.com +short` to verify. See [AWS DNS & Domains](/infrastructure/providers/aws/dns-and-domains).
- **Azure**: Check that nameservers at your registrar point to Azure DNS. See [Azure DNS & Domains](/infrastructure/providers/azure/dns-and-domains).

DNS propagation can take up to 48 hours. After fixing DNS, redeploy: `npx tsdevstack infra:deploy --env prod`

### Wrong Domain Configuration

If you set the wrong domain in secrets or `infrastructure.json`:

1. Fix the configuration
2. Redeploy: `npx tsdevstack infra:deploy --env prod`
3. For GCP, update DNS records at your registrar with the new values

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
