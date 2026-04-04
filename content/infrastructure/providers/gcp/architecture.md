# GCP Architecture

What gets deployed when you run `infra:deploy` on GCP and how traffic flows through the system.

## High-Level Architecture

```
                    Internet
                        |
                        v
          +-----------------------------+
          | Google Cloud Load Balancer  |
          | (TLS termination, WAF)      |
          +----+-------------------+----+
               |                   |
               v                   v
  +-----------------------+  +--------------------+
  |    Kong Gateway       |  | Next.js Frontend   |
  | (Cloud Run - External)|  | (Cloud Run)        |
  | - JWT validation      |  +--------------------+
  | - Rate limiting       |
  | - CORS management     |
  +-----------+-----------+
              |
              | VPC Network (internal only)
              v
  +-------------------------------------------+
  |             Private Network                |
  |                                           |
  |  +-------------+ +-------------+ +------+ |
  |  |Auth Service | |Offers Svc  | |BFF   | |
  |  |(Cloud Run)  | |(Cloud Run) | |(CR)  | |
  |  +------+------+ +------+-----+ +--+---+ |
  |         |               |           |     |
  |  +------+---------------+-----------+---+ |
  |  |        Cloud SQL (PostgreSQL)        | |
  |  +--------------------------------------+ |
  |  |        Memorystore (Redis)           | |
  |  +--------------------------------------+ |
  |  |        Secret Manager                | |
  |  +--------------------------------------+ |
  +-------------------------------------------+
```

The Load Balancer uses host-based routing to direct `api.example.com` to Kong and `app.example.com` to Next.js. Both are behind Cloud Armor WAF.

## Compute: Cloud Run

All services run on Cloud Run — Kong, backends, workers, and frontends.

| Service | Ingress | Network Access |
|---------|---------|----------------|
| Kong Gateway | `internal-load-balancer` | Load Balancer only |
| Backend services | `internal` | VPC only (unreachable from internet) |
| Frontend (Next.js) | `internal-load-balancer` | Load Balancer only |
| Workers | `internal` | VPC only |

Kong and Next.js use `internal-load-balancer` ingress — their Cloud Run URLs are not publicly accessible. All traffic must flow through the Load Balancer and Cloud Armor WAF. Backend services with `ingress: internal` are only reachable within the VPC.

## Data: Cloud SQL + Memorystore

**Cloud SQL (PostgreSQL 16):**
- One instance with separate databases per service (auth-db, offers-db, kong-db)
- Private IP only (no public access)
- Automated daily backups with 7-day point-in-time recovery
- Tiers: `db-f1-micro` (dev) through `db-n1-standard-4` (high-traffic prod)

**Memorystore (Redis 7):**
- Rate limiting, session cache, BullMQ queues
- Private IP only
- Tiers: `BASIC` (dev) or `STANDARD_HA` (prod with automatic failover)

## Storage: Cloud Storage (GCS)

When storage buckets are configured in `config.json`, Terraform creates GCS buckets:

- One bucket per logical name: `{project}-{name}-{env}`
- Uniform bucket-level access (no per-object ACLs)
- Private access only — presigned URLs are the access mechanism
- CORS set to `*` (presigned URLs are the security boundary)

**IAM:**
- `roles/storage.objectUser` per bucket × Cloud Run service account (read/write access)
- `roles/iam.serviceAccountTokenCreator` per service account (required for presigned URL signing)

No storage access keys in containers — Cloud Run uses its service account identity automatically.

For setup and usage, see [Object Storage](/features/object-storage).

## Edge: Load Balancer + Cloud Armor

**Global HTTPS Load Balancer:**
- TLS termination at the edge
- Routes traffic to Kong and frontend services
- Static IP address for DNS A records

**Cloud Armor WAF:**
- OWASP Core Rule Set (SQLi, XSS, LFI, RFI, RCE, protocol attacks, session fixation, scanner detection, Node.js attacks)
- SSRF protection (blocks metadata endpoint 169.254.169.254)
- Rate limiting: 1000 requests per 60 seconds per IP (configurable via `infrastructure.json`)
- Multipart/form-data safe — CR/LF rules (921120, 921150) excluded to prevent false positives on file uploads
- Custom rules via CEL expressions in `infrastructure.json`
- See [Service Configuration — WAF Rules](/infrastructure/service-configuration#waf-rules) for configuration details

**Access Logging:**
- Backend service logs enabled on Load Balancer (`log_config` on backend services)
- Cloud Armor verbose logging enabled (WAF allow/block decisions)
- SPA backend buckets: no logging (not supported on `google_compute_backend_bucket`)

## Networking

```
VPC: {projectName}-vpc (10.0.0.0/16)
|
+-- Subnet: cloudrun-egress (10.0.100.0/26)
|   +-- Cloud Run Direct VPC Egress
|
+-- Private Service Access
    +-- Cloud SQL private IP
    +-- Memorystore private IP
```

Cloud Run services use Direct VPC Egress to reach private resources. A Cloud DNS zone for `run.app` overrides public DNS with private IPs (`199.36.153.8-11`), enabling internal Cloud Run-to-Cloud Run communication without public internet traversal.

**Cost:** ~$0.20/month for Cloud DNS zone. No VPC Connector needed with Direct VPC Egress.

## Secrets: Secret Manager

Secrets are mounted as environment variables on Cloud Run services.

```
projects/{project}/secrets/
+-- tsdevstack-shared-*           # Shared across services
+-- tsdevstack-auth-service-*     # Per-service secrets
+-- tsdevstack-kong-*             # Kong-specific
```

## Scale-to-Zero

Cloud Run handles scale-to-zero natively. Services with `minInstances: 0` scale down when idle and wake up on the next request with a 2-8 second cold start. No wake-up mechanisms are needed.

## Security

- Backend services use `ingress: internal` — physically unreachable from the internet
- Kong validates JWT tokens and adds trusted headers (`X-Userinfo`)
- Services verify the `X-Kong-Trust` header to ensure requests came through Kong
- Cloud Armor provides WAF protection at the edge
- All data services (SQL, Redis) are on private IPs only

## Cost Estimation

See [GCP Cost Estimation](/infrastructure/providers/gcp/cost-estimation) for a detailed breakdown across dev (scale-to-zero), production (always-on), and scaled scenarios, with links to official GCP pricing pages.

## Async Messaging

Async messaging uses Redis Streams on the same Memorystore instance used for caching and BullMQ. No additional GCP resources are created — messaging is a framework-level feature that runs on existing infrastructure. See [Async Messaging](/features/async-messaging) for details.

## Terraform Resources

GCP deployments create approximately 35 Terraform resources including VPC, subnets, Cloud SQL instance, Memorystore instance, load balancer components (IP, URL map, proxy, forwarding rule, SSL certificate), Cloud Armor policy, IAM service accounts, and Secret Manager secrets.
