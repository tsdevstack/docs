# AWS DNS & Domains

Provider-specific DNS configuration and SSL certificate setup for AWS deployments.

## Overview

AWS uses Route 53 for DNS management and ACM (AWS Certificate Manager) for SSL certificates. Route 53 must manage DNS for your domain **before** the first deployment if using custom domains.

**Why Route 53 is required:** ACM certificates need DNS validation records. Terraform auto-creates these records in Route 53. Without Route 53, deployment fails with a chicken-and-egg problem — CloudFront needs a validated certificate, but the certificate can't validate without DNS records.

## Step 1: Create Hosted Zone

1. Go to [Route 53](https://console.aws.amazon.com/route53/)
2. Click **Hosted zones** > **Create hosted zone**
3. **Domain name:** Your domain (e.g., `example.com`)
4. **Type:** Public hosted zone
5. Click **Create hosted zone**

## Step 2: Copy NS Records

After creation, Route 53 shows 4 NS (nameserver) records:

```
ns-123.awsdns-45.com
ns-678.awsdns-90.co.uk
ns-234.awsdns-56.net
ns-789.awsdns-01.org
```

Copy all 4 nameservers.

## Step 3: Update Domain Registrar

Go to your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.):

1. Find **Nameservers** or **DNS settings**
2. Change to **Custom nameservers**
3. Enter the 4 Route 53 NS records
4. Save changes

:::warning
If your domain is already on Cloudflare or another DNS provider, you're moving DNS management to Route 53. Copy any existing DNS records before switching.
:::

## Step 4: Wait for Propagation

DNS propagation takes 15 minutes to 48 hours (usually under 1 hour).

```bash
# Verify nameservers have propagated
dig NS example.com +short
# Should return Route 53 nameservers
```

## Step 5: Deploy

```bash
npx tsdevstack infra:deploy --env dev
```

Terraform will:
1. Create ACM certificate
2. Auto-create DNS validation records in Route 53
3. Wait for certificate to become ISSUED (~5 minutes)
4. Create CloudFront with validated certificate
5. Create Route 53 A records pointing to CloudFront

**All automated in a single command.**

## What Gets Created in Route 53

| Record Type | Name | Points To |
|-------------|------|-----------|
| CNAME | `_validation.example.com` | ACM validation (auto-managed) |
| A (Alias) | `api.example.com` | CloudFront distribution |
| A (Alias) | `spa.example.com` | SPA CloudFront distribution |

## Redirect Domains

To redirect alternate domains (e.g., `example.com` > `example.app`), each redirect domain needs its own Route 53 hosted zone.

### Setup

1. Create a hosted zone for the redirect domain in Route 53
2. Update the redirect domain's nameservers at its registrar to point to Route 53
3. Add to `infrastructure.json`:
   ```json
   {
     "dev": {
       "loadBalancer": {
         "redirectDomains": ["example.com"]
       }
     }
   }
   ```
4. Deploy: `npx tsdevstack infra:deploy --env dev`

Terraform creates an ACM certificate, CloudFront Function (for 301 redirect with path preservation), CloudFront distribution, and Route 53 A records — all automatically.

## Checking DNS Info in the Console

All DNS records are auto-managed by Terraform. To verify:

- **Route 53:** [Console](https://console.aws.amazon.com/route53/) > Hosted zones > click your domain — shows A records, CNAME validation records
- **ACM:** [Console](https://console.aws.amazon.com/acm/) > click your certificate — status should be **Issued**. Check **us-east-1** region for CloudFront certificates
- **CloudFront:** [Console](https://console.aws.amazon.com/cloudfront/) > click your distribution — shows the `*.cloudfront.net` domain and alternate domain names

## No Custom Domain?

If `DOMAIN` secret is not set, services use default AWS URLs:
- **API:** `alb-12345.us-east-1.elb.amazonaws.com`
- **CloudFront:** `d1234567890.cloudfront.net`

Route 53 is not required in this case.

## Troubleshooting

### "no matching Route 53 Hosted Zone found"

The hosted zone doesn't exist or the domain name doesn't match exactly. Verify the hosted zone exists in Route 53 and the `DOMAIN` secret matches.

### Certificate stuck on PENDING_VALIDATION

1. Check Route 53 for the CNAME validation record
2. Verify nameservers at registrar match Route 53
3. Wait for propagation (can take up to 48 hours)
4. Run `dig NS example.com +short` to verify

### "Certificate not yet validated"

ACM certificate validation takes ~5 minutes. Terraform waits up to 10 minutes. If it times out, the certificate usually validates on the next `infra:deploy` run.

## Cost

- **Route 53 Hosted Zone:** ~$0.50/month per hosted zone
- **DNS Queries:** ~$0.40 per million queries
- **ACM Certificates:** Free
