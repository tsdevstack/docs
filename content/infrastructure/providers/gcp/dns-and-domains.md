# GCP DNS & Domains

Provider-specific DNS configuration and SSL certificate setup for GCP deployments.

## Overview

GCP uses a Global HTTPS Load Balancer with a static IP. All domains (API, frontends, redirects) point to this single IP via A records. SSL certificates are managed by Certificate Manager with DNS authorization.

## Finding the Load Balancer IP

After running `infra:deploy-lb`, the CLI displays the Load Balancer IP. To find it in the console:

1. Go to [Network services > Load balancing](https://console.cloud.google.com/net-services/loadbalancing)
2. Click on your load balancer (named `{projectName}-lb`)
3. The **Frontend** section shows the static IP address

Alternatively: **VPC network > IP addresses** > look for `{projectName}-lb-ip`

## DNS Records

Point all your domains to the Load Balancer IP with A records:

| Record Type | Host | Value | Purpose |
|-------------|------|-------|---------|
| A | `api.example.com` | Load Balancer IP | API traffic |
| A | `example.com` | Load Balancer IP | Frontend traffic |
| A | `app.example.com` | Load Balancer IP | SPA traffic |
| A | `redirect.example.io` | Load Balancer IP | Redirect domains |

Create these records at your domain registrar.

## SSL Certificate Validation

GCP uses Certificate Manager with DNS authorization. Each domain needs a CNAME record for validation.

### Finding Validation Records

1. Navigate to [Security > Certificate Manager](https://console.cloud.google.com/security/ccm)
2. Click the **DNS Authorizations** tab
3. Each domain has an authorization entry showing:
   - **DNS Record Name** — the CNAME host to create (e.g., `_acme-challenge.api.example.com`)
   - **DNS Record Type** — always `CNAME`
   - **DNS Record Data** — the value to point to (e.g., `abc123...authorize.certificatemanager.goog.`)
4. Create these CNAME records at your domain registrar

The `infra:deploy-lb` command also prints all required DNS records after a successful deployment.

### Example Records

| Record Type | Host | Value |
|-------------|------|-------|
| CNAME | `_acme-challenge.api.example.com` | `...authorize.certificatemanager.goog.` |
| CNAME | `_acme-challenge.example.com` | `...authorize.certificatemanager.goog.` |

## Checking Certificate Status

1. Navigate to [Security > Certificate Manager > Certificates](https://console.cloud.google.com/security/ccm/list/certificates)
2. Click on the certificate (named `{projectName}-cert`)
3. Status should be **ACTIVE** once DNS records propagate (can take up to 60 minutes)
4. If stuck on **PROVISIONING**, verify your CNAME records are correctly set

## Redirect Domains

To redirect alternate domains (e.g., `.io`, `.app`) to your canonical domain:

1. Add redirect domains to `infrastructure.json`:
   ```json
   {
     "prod": {
       "loadBalancer": {
         "redirectDomains": ["example.io", "example.app"]
       }
     }
   }
   ```
2. Deploy: `npx tsdevstack infra:deploy-lb --env prod`
3. Add A records for each redirect domain pointing to the Load Balancer IP
4. Add SSL validation CNAME records for each redirect domain

## Troubleshooting

### SSL Certificate Not Provisioning

1. Verify DNS records are correct (both A record and SSL validation CNAME)
2. Check that SSL validation CNAME value matches exactly what Certificate Manager shows
3. Wait for DNS propagation (can take up to 48 hours for some registrars)
4. After fixing DNS, redeploy to refresh: `npx tsdevstack infra:deploy-lb --env prod`
