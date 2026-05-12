---
title: 'Migrating off AWS App Runner before the April 30 deadline'
description: 'AWS is closing App Runner to new customers on April 30, 2026. Notes from a production Next.js migration to ECS Express Mode.'
date: '2026-04-14'
sidebar: false
outline: false
head:
  - - link
    - rel: canonical
      href: 'https://tsdevstack.dev/blog/migrating-off-aws-app-runner-before-the-april-30-deadline'
  - - meta
    - property: 'og:title'
      content: 'Migrating off AWS App Runner before the April 30 deadline'
  - - meta
    - property: 'og:description'
      content: 'AWS is closing App Runner to new customers on April 30, 2026. Notes from a production Next.js migration to ECS Express Mode.'
  - - meta
    - property: 'og:image'
      content: 'https://tsdevstack.dev/blog/migration-aws-app-runner.webp'
  - - meta
    - property: 'og:type'
      content: 'article'
  - - meta
    - property: 'article:published_time'
      content: '2026-04-14'
  - - meta
    - name: 'twitter:card'
      content: 'summary_large_image'
  - - meta
    - name: 'twitter:image'
      content: 'https://tsdevstack.dev/blog/migration-aws-app-runner.webp'
  - - script
    - type: 'application/ld+json'
    - '{"@context":"https://schema.org","@type":"Article","headline":"Migrating off AWS App Runner before the April 30 deadline","author":{"@type":"Person","name":"gyorgy"},"datePublished":"2026-04-14","dateModified":"2026-04-14","image":"https://tsdevstack.dev/blog/migration-aws-app-runner.webp","mainEntityOfPage":"https://tsdevstack.dev/blog/migrating-off-aws-app-runner-before-the-april-30-deadline"}'
---

![Migrating off AWS App Runner before the April 30 deadline](/blog/migration-aws-app-runner.webp)

# Migrating off AWS App Runner before the April 30 deadline

_Published April 14, 2026 by gyorgy_

AWS is shutting the door on App Runner for new customers effective April 30, 2026. If you're running production workloads on it, existing apps keep working for now, but there are no new features coming, and "maintenance mode" at AWS historically means "start planning your migration."

I just finished a migration off App Runner for a production Next.js frontend, and wanted to write down what I learned in case it's useful to anyone else facing the same deadline.

## The options

AWS officially recommends **ECS Express Mode** as the direct App Runner replacement. It's a newer single-resource abstraction that auto-provisions an ECS cluster, service, ALB, security groups, auto-scaling, and CloudWatch logging. One Terraform resource, one deploy, done.

The other options:

- **Standard ECS Fargate**. More moving parts, years of battle-testing, full control.
- **AWS Lambda + API Gateway**. True scale-to-zero, good for infrequent API traffic, cold starts on anything else.
- **Lightsail containers**. Simpler than ECS, cheaper for small workloads.
- **Google Cloud Run**. If you're open to leaving AWS, this is genuinely the best container-in-a-box experience on any cloud.
- **fly.io / Render / Railway**. PaaS experience outside AWS.

For our use case (production Next.js behind CloudFront with a real VPC, Kong gateway, and backend services on the same infrastructure), ECS Fargate was the natural fit. Express Mode looked appealing on paper, but I went with standard Fargate instead.

## Why not ECS Express Mode

Three reasons:

**1. Terraform bug.** The `aws_ecs_express_gateway_service` resource had an open issue (hashicorp/terraform-provider-aws#45792, "Provider produced inconsistent result after apply") that would have blocked deploys. Fixable with workarounds, but not something I wanted to own.

**2. "Managed abstraction" fatigue.** App Runner was also supposed to be the easy path. It lasted four years before being sidelined. Express Mode is newer than App Runner was when I first used it. I wasn't willing to bet a second production frontend on another abstraction that might get sunset in 18 months.

**3. ALB duplication.** Express Mode auto-creates its own ALB. If you already have an ALB for other services (like I did for a Kong gateway routing backend services), you end up paying for two. Around $16/month extra for the overlap. Not huge, but annoying and unnecessary.

Standard ECS Fargate uses the ALB you already have. Same pattern as every other service in the cluster. Boring, predictable, stable.

## What the migration actually looked like

The architecture ended up like this:

```plaintext
Browser
  ↓
CloudFront (caching + WAF)
  ↓ X-Origin-Verify header
ALB (port 443, host-based routing)
  ↓                    ↓
Next.js target      Kong target
group               group
  ↓                    ↓
ECS Fargate         Kong gateway
(Next.js)              ↓
                    Backend services
```

Next.js containers run in private VPC subnets. ALB listener rules use host-based routing to split frontend traffic (`example.com` → Next.js target group) from API traffic (any host + X-Origin-Verify header → Kong target group). CloudFront in front for caching, SSL, and WAF.

For origin protection, I stuck with `X-Origin-Verify` header validation on the ALB rule. The AWS-managed CloudFront prefix list is a cleaner option (allow only CloudFront IPs at the security group level) but it's more moving parts and one more thing to update when AWS changes its prefix list. The header check was good enough.

## Gotchas I hit

**Health checks.** Next.js needs a `/health` endpoint returning 200 for ALB target group health checks. This is obvious in retrospect but it was our first failed deploy. Add it to your `app/health/route.ts` before you migrate, not during.

**Single-phase deploy.** The App Runner + CloudFront setup I had was a two-phase deploy: Terraform creates App Runner, CLI collects the URL, Terraform runs again with the URL as a CloudFront origin. With ECS behind an ALB that already exists at plan time, this goes away. One `terraform apply`, no two-phase dance. Genuinely nicer.

**Private subnets from the start.** App Runner services are publicly routable on the internet, with WAF-only protection and no network-level isolation. ECS Fargate in private subnets gives you proper network boundaries. Don't skip this. Put your container in private subnets with no public IP, only allow ingress from the ALB security group.

**Auto-scaling.** Express Mode gives you auto-scaling for free. Standard Fargate requires configuring target-tracking scaling policies yourself. One extra Terraform resource, but you have actual control over what the scaling metric is.

## What about scale-to-zero?

This is the pain point for everyone moving off App Runner. Standard Fargate does not scale to zero. You always pay for at least one running task. If your workload has long idle periods, this is a real cost difference.

For production workloads this is usually fine (you want at least one container warm anyway). For dev/staging environments or low-traffic side projects, you have three options:

1. **Cloud Run on GCP**. Actual scale-to-zero, sub-second cold starts, no ALB needed.
2. **Lambda + API Gateway**. Scale-to-zero, but cold starts hurt if your app isn't designed for them.
3. **Scheduled shutdowns**. `eventbridge` rules to scale the ECS service to 0 at night, back to 1 in the morning. Crude but effective for dev environments.

If your app is a very low traffic fastapi backend (as in the Reddit thread that prompted this article), honestly, Cloud Run is probably the right answer. AWS just doesn't have a real equivalent right now.

## Would I do it again?

Yeah, for a production workload with an existing VPC and other services, the standard Fargate path was the right call. The migration was not fun but the result is cleaner than App Runner. Single-phase deploys, private networking, no dependency on a deprecated service.

If I were starting fresh with a brand new single service and no existing infrastructure, I'd look harder at Cloud Run or fly.io. AWS's container story below ECS is just not compelling anymore.

## The tsdevstack angle

I build a multi-cloud TypeScript framework called [tsdevstack](https://tsdevstack.dev) that generates production infrastructure from a config file. The App Runner to ECS Fargate migration above is what shipped in v0.2.0. Framework users who were deploying Next.js frontends via App Runner can now re-run `infra:deploy` and the framework handles the migration automatically.

One thing worth mentioning given the scale-to-zero discussion above: tsdevstack implements scale-to-zero on AWS for services that set `minInstances: 0` in config. Since ECS Fargate doesn't have native scale-to-zero, the framework generates a three-layer mechanism: a CloudWatch alarm scales the service to zero when idle (CPU below 5% for 15 minutes), and a wake-up Lambda spins it back up when the first request hits the ALB and returns 502. Kong catches the 502, fires the wake-up call, and returns a 503 with `Retry-After: 30` so the client retries automatically. Cold start is around 30-60 seconds, which is significant compared to Cloud Run or Container Apps, but it's real scale-to-zero on AWS and it works. Kong itself stays at `minInstances >= 1` so there's always something to trigger the wake-up.

If you're tired of writing Terraform by hand for every AWS migration AWS forces on you, take a look. [Docs here](https://tsdevstack.dev), repo at [github.com/tsdevstack](https://github.com/tsdevstack).

---

_Tags: aws, terraform, devops, cloud_
