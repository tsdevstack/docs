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

- **Backend services (NestJS):** Not behind the load balancer. Kong calls them over Cloud Map inside the VPC
- **Next.js frontends:** Routed via host-based rules on the ALB listener (port 443)
- **Kong Gateway:** Catch-all on port 443 for API traffic
- **Workers:** Background job processors, no load balancer
- Service discovery via Cloud Map (`{service}.{project}.local`)
- Auto-scaling based on CPU utilization (target 70%) between `minInstances` and `maxInstances`. Every service, Kong included, runs at least one task: AWS has no scale-to-zero, and `minInstances: 0` fails validation

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

For setup and usage, see [Object Storage](/docs/features/object-storage).

## Edge: CloudFront + ALB + WAF

**CloudFront:**
- Separate distributions for API, Next.js, and each SPA
- TLS termination, edge caching, HTTP/2
- Sends `X-Origin-Verify` header to prevent origin bypass

**ALB (Application Load Balancer):**
- 2 listeners:
  - HTTP:80 > Redirect to HTTPS
  - HTTPS:443 > External traffic (host-based routing: Next.js domains > ECS, catch-all > Kong, validates `X-Origin-Verify`)
- Target groups for Kong and each Next.js frontend only. Backend services have no target group and no listener: nothing on the internet can reach them without going through Kong

**AWS WAF:**
- AWS Managed Rules: Common Rule Set, SQLi Rule Set, Known Bad Inputs, IP Reputation List, Anonymous IP List, Linux Rule Set
- Custom rules for Node.js prototype pollution and `child_process` injection
- SSRF protection (blocks metadata endpoint 169.254.169.254)
- Rate limiting: 1000 requests per 60 seconds per IP (configurable via `infrastructure.json`, translated to 5000 per 5-minute AWS window)
- Custom rules via byte match, rate-based, and geo match statements in `infrastructure.json`
- See [Service Configuration — WAF Rules](/docs/infrastructure/service-configuration#waf-rules) for configuration details

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
| `alb-sg` | 443 and 80 from 0.0.0.0/0 | ECS tasks | Load balancer |
| `ecs-sg` | 8080 from the ALB and from other ECS tasks | All outbound | Service containers (Kong reaches services here) |
| `rds-sg` | 5432 from ECS | None | Database access |
| `redis-sg` | 6379 from ECS | None | Cache access |

## Service Discovery

AWS uses a dual approach:

| Source > Target | Method | Why |
|-----------------|--------|-----|
| Kong > Services | Cloud Map DNS (`http://{service}.{project}.local:8080`) | Direct calls inside the VPC; backends stay private |
| Service > Service | Cloud Map DNS (`{service}.{project}.local`) | Direct calls, no ALB overhead |

`infra:deploy` writes each service's Cloud Map URL to Secrets Manager (`{SERVICE}_URL`), and `infra:build-kong` resolves the Kong config's service URLs from those secrets. Kong also fetches the auth-service's OIDC discovery document and signing keys over Cloud Map.

## No Scale-to-Zero

Fargate cannot hold a request while a stopped task starts, and backends are not reachable from outside the VPC, so there is nothing that could wake a service on demand. Every ECS service runs at least one task; `minInstances: 0` fails validation with a hint. Services scale up and down on CPU between `minInstances` and `maxInstances`.

This keeps AWS on the same model as GCP and Azure: private backends, Kong as the only way in. It does cost more in development than scale-to-zero would; see [AWS Cost Estimation](/docs/infrastructure/providers/aws/cost-estimation). If you need scale-to-zero for development environments, GCP and Azure support it natively.

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

See [AWS Cost Estimation](/docs/infrastructure/providers/aws/cost-estimation) for a detailed breakdown across development, production, and scaled scenarios, with links to official AWS pricing pages.

## Async Messaging

Async messaging uses Redis Streams on the same ElastiCache instance used for caching and BullMQ. No additional AWS resources are created — messaging is a framework-level feature that runs on existing infrastructure. See [Async Messaging](/docs/features/async-messaging) for details.

## Terraform Resources

AWS deployments create approximately 45 Terraform resources including VPC, subnets, NAT gateways, security groups, ALB with target groups, ECS cluster and services, auto-scaling policies, RDS instance, ElastiCache cluster, CloudFront distributions, WAF rules, Route 53 records, and IAM roles. Scheduled jobs add EventBridge schedules and a job invoker Lambda.
