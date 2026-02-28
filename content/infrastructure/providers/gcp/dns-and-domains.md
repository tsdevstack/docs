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

| Record Type | Registrar Host Field | Value | Purpose |
|-------------|---------------------|-------|---------|
| A | `api` | Load Balancer IP | API traffic |
| A | `@` (or blank) | Load Balancer IP | Frontend traffic |
| A | `app` | Load Balancer IP | SPA traffic |

For redirect domains on a **separate TLD** (e.g., `example.io` redirecting to `example.com`), add an A record in that domain's DNS zone:

| Record Type | Registrar Host Field | Value | Purpose |
|-------------|---------------------|-------|---------|
| A | `@` (or blank) | Load Balancer IP | Redirect domain |

:::warning Registrar host field
Most domain registrars automatically append your domain to the host field. Enter only the **relative** part — e.g., `api` instead of `api.example.com`. Using the full domain name would create a record at `api.example.com.example.com`, which is incorrect. For the root domain, use `@` or leave the host field blank.
:::

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

For a domain `example.com`, the registrar entries would be:

| Record Type | Registrar Host Field | Value |
|-------------|---------------------|-------|
| CNAME | `_acme-challenge.api` | `...authorize.certificatemanager.goog.` |
| CNAME | `_acme-challenge` | `...authorize.certificatemanager.goog.` |

:::warning Use relative host names
The CLI outputs **fully qualified domain names** (e.g., `_acme-challenge.api.example.com`). When entering these at your registrar, drop the base domain suffix — enter `_acme-challenge.api` instead of `_acme-challenge.api.example.com`. Most registrars auto-append your domain, so using the full name would create a record at `_acme-challenge.api.example.com.example.com`.
:::

For redirect domains on a separate TLD, create the CNAME in **that domain's** DNS zone. For example, if `example.io` is a redirect domain, add the CNAME record in the `example.io` DNS zone with host `_acme-challenge`.

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

1. **Check CNAME host names** — the most common mistake is entering the full domain name in the registrar's host field. Use relative names (e.g., `_acme-challenge.api`, not `_acme-challenge.api.example.com`). You can verify with:
   ```bash
   # Should return the certificatemanager.goog value:
   dig CNAME _acme-challenge.api.example.com +short

   # If this returns the value instead, your host field is wrong:
   dig CNAME _acme-challenge.api.example.com.example.com +short
   ```
2. Verify A records are also pointing to the Load Balancer IP
3. Check that the CNAME value matches exactly what Certificate Manager shows
4. Wait for DNS propagation (can take up to 48 hours for some registrars)
5. After fixing DNS, redeploy to refresh: `npx tsdevstack infra:deploy-lb --env prod`
