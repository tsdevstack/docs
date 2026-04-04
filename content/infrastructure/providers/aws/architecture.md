# AWS Architecture

What gets deployed when you run `infra:deploy` on AWS and how traffic flows through the system.

## High-Level Architecture

```
                                Internet
                                    |
            +-----------------------+-----------------------+
            |                       |                       |
            v                       v                       v
+-----------------------+ +-----------------------+ +-----------------+
| CloudFront (API)      | | CloudFront (Next.js)  | | CloudFront (SPA)|
| api.example.com       | | app.example.com       | | spa.example.com |
| + WAF + Origin header | | + WAF + Origin header | | + WAF           |
+-----------+-----------+ +-----------+-----------+ +--------+--------+
            |                       |                        |
            +-----------+-----------+                        v
                        v                          +---------+---------+
            +-----------+-----------+              | S3 Bucket         |
            | ALB (Port 443)        |              | (Private, OAC)    |
            | Host-based routing:   |              +-------------------+
            | API domain -> Kong    |
            | Frontend -> Next.js   |
            | + X-Origin-Verify     |
            +-----------+-----------+       +-----------------+
                        |                   | S3 (Storage)    |
                        v                   | App buckets     |
            +-----------+-----------+------>| (Private, IAM)  |
            |     VPC              |        +-----------------+
            |  ECS Fargate         |
            |  Kong -> Services    |
            |  Next.js Frontend    |
            |  RDS + ElastiCache   |
            +-----------------------+
```

### Traffic Flows

| Domain | CloudFront | Origin | Protection |
|--------|------------|--------|------------|
| `api.example.com` | API distribution | ALB > Kong > ECS | WAF + Origin header |
| `app.example.com` | Next.js distribution | ALB > ECS (host-based) | WAF + Origin header |
| `spa.example.com` | SPA distribution | S3 bucket | WAF + OAC |

## Compute: ECS Fargate

All containerized services run on ECS Fargate in private VPC subnets:

- **Backend services (NestJS):** Routed via Kong on the internal ALB listener (port 8443)
- **Next.js frontends:** Routed via host-based rules on the external ALB listener (port 443)
- **Kong Gateway:** Catch-all on port 443 for API traffic
- **Workers:** Background job processors, no load balancer
- Service discovery via Cloud Map (`{service}.{project}.local`)
- Auto-scaling based on CPU utilization

Next.js services must expose a `/health` route (included in the framework template by default).

| Tier | vCPU | Memory | Use Case |
|------|------|--------|----------|
| micro | 0.25 | 512MB | Dev/test |
| small | 0.5 | 1GB | Light workloads |
| medium | 1 | 2GB | Production services |
| large | 2 | 4GB | High-traffic services |

## Data: RDS + ElastiCache

**RDS PostgreSQL 16:**
- Separate databases per service (auth_db, offers_db, kong_db)
- Private subnets only (no public access)
- Tiers: `db.t3.micro` (dev) through `db.r6g.large` (prod)
- Multi-AZ: No (dev) / Yes (prod)
- Automated backups with 7-day retention

**ElastiCache Redis 7:**
- Rate limiting, session cache, BullMQ queues
- Private subnets only, password required, encryption at rest + in transit
- Tiers: `cache.t3.micro` (dev) through `cache.r6g.large` (prod)

## Storage: S3

When storage buckets are configured in `config.json`, Terraform creates S3 buckets:

- One bucket per logical name: `{project}-{name}-{env}-{accountId}` (e.g., `tsdevstack-uploads-dev-123456789012`)
- Account ID suffix ensures global uniqueness across S3's global namespace
- Block all public access enabled
- Server-side encryption (AES-256)
- CORS set to `*` (presigned URLs are the security boundary)

**IAM:** Each ECS task role gets `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, and `s3:ListBucket` permissions on all storage buckets.

No access keys in containers — ECS tasks use IAM Task Roles automatically.

For setup and usage, see [Object Storage](/features/object-storage).

## Edge: CloudFront + ALB + WAF

**CloudFront:**
- Separate distributions for API, Next.js, and each SPA
- TLS termination, edge caching, HTTP/2
- Sends `X-Origin-Verify` header to prevent origin bypass

**ALB (Application Load Balancer):**
- 4 listeners:
  - HTTP:80 > Redirect to HTTPS
  - HTTPS:443 > External traffic (host-based routing: Next.js domains > ECS, catch-all > Kong, validates `X-Origin-Verify`)
  - HTTPS:8443 > Internal (Kong upstream routing via Host headers)
  - HTTP:8080 > Internal (Kong OIDC discovery, path-based routing)

**AWS WAF:**
- AWS Managed Rules: Common Rule Set, SQLi Rule Set, Known Bad Inputs, IP Reputation List, Anonymous IP List, Linux Rule Set
- Custom rules for Node.js prototype pollution and `child_process` injection
- SSRF protection (blocks metadata endpoint 169.254.169.254)
- Rate limiting: 1000 requests per 60 seconds per IP (configurable via `infrastructure.json`, translated to 5000 per 5-minute AWS window)
- Custom rules via byte match, rate-based, and geo match statements in `infrastructure.json`
- See [Service Configuration — WAF Rules](/infrastructure/service-configuration#waf-rules) for configuration details

**Access Logging:**
- ALB access logs to S3 bucket (ELB service principal policy, 90-day lifecycle)
- CloudFront standard logs to S3 bucket (per-distribution prefixes, 90-day lifecycle)
- WAF logs to CloudWatch Log Groups (`aws_wafv2_logging_configuration` for CloudFront WAF)

## Networking

```
VPC: 10.0.0.0/16
|
+-- Public Subnets (10.0.1.0/24, 10.0.2.0/24)
|   +-- NAT Gateway (per AZ)
|   +-- ALB (Internet-facing)
|
+-- Private Subnets (10.0.10.0/24, 10.0.20.0/24)
|   +-- ECS Fargate tasks (Kong + services)
|
+-- Database Subnets (10.0.100.0/24, 10.0.200.0/24)
    +-- RDS PostgreSQL
    +-- ElastiCache Redis
```

| Security Group | Inbound | Outbound | Purpose |
|---------------|---------|----------|---------|
| `alb-sg` | 443 from 0.0.0.0/0 | ECS tasks | Load balancer |
| `ecs-sg` | ALB health checks | All outbound | Service containers |
| `rds-sg` | 5432 from ECS | None | Database access |
| `redis-sg` | 6379 from ECS | None | Cache access |

## Service Discovery

AWS uses a dual approach:

| Source > Target | Method | Why |
|-----------------|--------|-----|
| Kong > Services | ALB with Host headers (port 8443) | Wake-up mechanism via upstream failover |
| Service > Service | Cloud Map DNS (`{service}.{project}.local`) | Direct calls, no ALB overhead |

## Scale-to-Zero

AWS scale-to-zero is more complex than GCP. Kong uses upstream failover to detect when services are at zero tasks and triggers a wake-up Lambda.

**How it works:**
1. Request arrives at Kong
2. Kong routes to the service via ALB (port 8443)
3. If the service is at zero tasks, ALB returns 502
4. Kong's post-function plugin intercepts the 502
5. Fire-and-forget call to wake-up Lambda
6. Lambda wakes **ALL** ECS services (not just the requested one)
7. Kong returns 503 with `Retry-After: 45` to the client
8. Client retries after 30-60 seconds — services now running

**Why wake all services?** Services depend on each other. If only one wakes up, its calls to other services would fail.

**Kong must always run** (`minInstances: 1`) — it's the orchestrator that detects unhealthy upstreams and triggers wake-up. Cost: ~$9-15/month.

:::tip
For production environments with regular traffic, `minInstances: 1` is the safe choice — it avoids the 30-60 second cold start on the first request after scale-down. Scale-to-zero works well for development and staging where occasional cold starts are acceptable.
:::

## SPA Deployment

SPAs deploy to S3 with CloudFront:
- S3 bucket: private (no public access), versioning enabled
- CloudFront OAC (Origin Access Control) with SigV4 signing
- 403/404 errors redirect to `index.html` for client-side routing

## Secrets: Secrets Manager

Secrets are injected into ECS task definitions as environment variables via ARN references.

```
secrets/
+-- tsdevstack/dev/shared/          # Shared across services
+-- tsdevstack/dev/auth-service/    # Per-service secrets
+-- tsdevstack/dev/kong/            # Kong-specific
```

## Cost Estimation

See [AWS Cost Estimation](/infrastructure/providers/aws/cost-estimation) for a detailed breakdown across development (scale-to-zero), production (always-on), and scaled scenarios, with links to official AWS pricing pages.

## Async Messaging

Async messaging uses Redis Streams on the same ElastiCache instance used for caching and BullMQ. No additional AWS resources are created — messaging is a framework-level feature that runs on existing infrastructure. See [Async Messaging](/features/async-messaging) for details.

## Terraform Resources

AWS deployments create approximately 45 Terraform resources including VPC, subnets, NAT gateways, security groups, ALB with target groups, ECS cluster and services, RDS instance, ElastiCache cluster, CloudFront distributions, WAF rules, Lambda functions, CloudWatch alarms, Route 53 records, and IAM roles.
