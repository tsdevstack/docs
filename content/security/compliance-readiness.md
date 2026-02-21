# Compliance Readiness

tsdevstack implements a security-first architecture across all three cloud providers. The framework enforces encryption, network isolation, zero-credential runtimes, and environment separation as non-optional defaults — not configurable afterthoughts.

This page maps the framework's built-in security controls against major compliance frameworks to help teams understand what's covered out of the box and what remains their responsibility.

**Bottom line:** tsdevstack provides all the technical infrastructure controls required by SOC 2, GDPR, and ISO 27001. Every technical requirement — encryption, network isolation, access control, audit logging, secrets management — is handled by the framework across all three providers. What remains is purely organizational: writing policies, conducting audits, and establishing review processes. The infrastructure is ready; the paperwork is yours.

## Security Controls

### Encryption

| Control | GCP | AWS | Azure |
|---------|-----|-----|-------|
| TLS at edge | Cloud CDN managed SSL | CloudFront + ACM auto-renew | Front Door managed TLS |
| TLS between edge and compute | HTTPS to Cloud Run | HTTPS to ALB | HTTPS to Container Apps |
| Database encryption at rest | Cloud SQL default | RDS `storage_encrypted = true` | PostgreSQL Flexible Server default |
| Database encryption in transit | Cloud SQL SSL | SSL enabled (VPC-internal) | PostgreSQL `sslmode=require` |
| Redis encryption at rest | Memorystore default | ElastiCache enabled | Azure Redis default |
| Redis encryption in transit | Memorystore TLS | ElastiCache TLS | TLS-only on port 6380 |
| Object storage encryption | GCS AES-256 | S3 SSE AES256 | Blob Storage default |
| Secrets at rest | Secret Manager | Secrets Manager | Key Vault |

All encryption is enforced by default. There are no flags to disable it.

### Network Isolation

| Control | GCP | AWS | Azure |
|---------|-----|-----|-------|
| Virtual network | VPC | VPC | VNet |
| Subnet segmentation | Private subnets | Three-tier (public, private, database) | Three subnets (apps, database, container env) |
| Database access | Private IP only | Database subnet + security group | Private DNS zone + VNet integration |
| Redis access | Private IP only | Private subnet + security group | Private Endpoint |
| WAF | Cloud Armor | AWS WAF on CloudFront | Front Door WAF |
| Origin verification | Cloud Armor rules | X-Origin-Verify header | X-Azure-FDID header |
| Environment isolation | Separate GCP Project | Separate AWS Account | Separate Azure Subscription |
| VPC Flow Logs | Enabled | Enabled (KMS-encrypted) | Planned |

Services never run in public subnets. Databases and caches have no public endpoints. Environment isolation is enforced by the framework — you cannot reuse credentials across environments.

### Identity & Access Management

| Control | GCP | AWS | Azure |
|---------|-----|-----|-------|
| Runtime auth | Service Account binding | IAM Task Role | Managed Identity + RBAC |
| CI/CD auth | Workload Identity Federation | OIDC to IAM Role | Federated Identity Credentials |
| API auth | Kong JWT validation | Kong JWT validation | Kong JWT validation |
| Per-service DB credentials | Unique `DATABASE_URL` per service | Unique `DATABASE_URL` per service | Unique `DATABASE_URL` per service |
| Secret scope separation | Service-scoped + shared fallback | Service-scoped + shared fallback | Service-scoped + shared fallback |
| Least privilege (runtime) | Read-only secret access | Task role scoped to service secrets | Key Vault Secrets User (read-only) |

Zero credentials are stored in containers. Runtime authentication uses cloud-native identity (Service Accounts, IAM Roles, Managed Identities). CI/CD uses OIDC federation — no long-lived secrets in GitHub.

### Container Security

| Control | Status |
|---------|--------|
| Non-root execution | `USER node` in all Dockerfiles |
| File ownership | `--chown=node:node` for all copied files |
| Image scanning | ECR scan on push (AWS), Artifact Registry (GCP), ACR (Azure) |
| Multi-stage builds | Builder and production stages separated |
| No secrets in images | Runtime injection via cloud secret managers |

### Secrets Management

| Control | Status |
|---------|--------|
| Cloud-native storage | GCP Secret Manager, AWS Secrets Manager, Azure Key Vault |
| Runtime caching | 5-minute TTL with automatic refresh |
| Metadata tagging | `managed-by`, `scope`, `secret-type`, `project-name` |
| Soft-delete recovery | GCP: versioned, AWS: 7-day, Azure: 90-day |
| Naming isolation | `{project}-{scope}-{KEY}` convention |
| Credential files gitignored | Framework enforces `.gitignore` rules |

## Compliance Framework Mapping

### SOC 2 Type II

| Trust Service Criteria | Framework Status |
|----------------------|-----------------|
| **CC6.1** Logical access controls | RBAC, Managed Identity, JWT, per-service isolation |
| **CC6.2** Credentials and authentication | Zero-credential runtime, OIDC CI/CD |
| **CC6.3** Access authorization | IAM roles scoped per service, environment isolation |
| **CC6.6** Security boundaries | VPC/VNet, WAF, private subnets, origin verification |
| **CC6.7** Restrict data movement | Private subnets for DB/Redis, no public endpoints |
| **CC6.8** Unauthorized software | Non-root containers, image scanning, multi-stage builds |
| **CC7.1** Detect anomalies | VPC Flow Logs, WAF metrics, structured audit logs |
| **CC8.1** Change management | Git-based IaC, CI/CD with OIDC, Terraform plan/apply |

Every SOC 2 technical control listed above is enforced by default. The remaining requirements — formal change approval workflows, access review cadence, incident response playbooks — are organizational processes that vary by company and don't require infrastructure changes.

### GDPR (Articles 25 & 32)

| GDPR Article | Framework Status |
|-------------|-----------------|
| **Art. 25** Privacy by design | Encryption, isolation, least privilege as defaults |
| **Art. 32(1)(a)** Encryption | Encryption at rest and in transit across all providers |
| **Art. 32(1)(b)** Confidentiality | VPC isolation, WAF, per-service secrets, RBAC |
| **Art. 32(1)(c)** Availability | Auto-scaling, health checks, multi-AZ support |
| **Art. 32(1)(d)** Testing | Terraform plan, CI/CD pipeline, image scanning |

GDPR technical measures (Articles 25 and 32) are fully covered. Data subject rights (erasure, portability, consent) are application-level concerns that the framework leaves to the developer.

### ISO 27001 (Annex A)

| Annex A Control | Framework Status |
|----------------|-----------------|
| **A.8.5** Secure authentication | JWT, OIDC, Managed Identity, zero-credential runtime |
| **A.8.9** Configuration management | Terraform IaC, git-based, reproducible |
| **A.8.15** Logging | VPC Flow Logs, CloudWatch/Log Analytics, WAF metrics |
| **A.8.20** Network security | VPC/VNet, subnets, WAF, private endpoints |
| **A.8.21** Web service security | TLS, WAF OWASP rules, rate limiting, CORS |
| **A.8.24** Cryptography | Encryption at rest + transit, KMS key rotation |
| **A.8.25** Secure development | CI/CD, image scanning, non-root containers |

Every Annex A technical control listed above is enforced by default. ISO 27001 certification additionally requires the Information Security Management System (ISMS) — risk assessments, internal audits, management reviews — which is organizational, not technical. The infrastructure is already compliant.

## What's Covered vs Your Responsibility

### What tsdevstack provides

- Encryption at rest and in transit enforced by default across all three providers
- Zero-credential container runtimes (Managed Identity, IAM roles, Service Account binding)
- OIDC-based CI/CD with no long-lived secrets
- Network isolation with WAF, private subnets, and origin verification
- Environment isolation enforced at the account/subscription/project level
- Per-service secret and database credential isolation
- Non-root containers with vulnerability scanning
- Infrastructure as Code with full audit trail

### What remains (organizational, not technical)

None of the items below require infrastructure changes — the framework has already handled the technical side. These are business processes your team defines:

- **SOC 2:** Organizational policies, access review processes, incident response plan, vendor management
- **GDPR:** Data processing agreements, privacy policy, consent management, data subject rights implementation (application-level)
- **ISO 27001:** ISMS documentation, risk assessments, internal audits, management reviews

## Cross-Provider Comparison

All three providers achieve equivalent security outcomes through provider-native services:

| Feature | GCP | AWS | Azure |
|---------|-----|-----|-------|
| Runtime auth | Service Account | IAM Task Role | Managed Identity + RBAC |
| CI/CD auth | Workload Identity Federation | OIDC to IAM Role | Federated Identity Credentials |
| Secret store | Secret Manager | Secrets Manager | Key Vault (RBAC) |
| WAF | Cloud Armor | AWS WAF | Front Door WAF |
| Edge + CDN | Cloud CDN + LB | CloudFront + ALB | Front Door (unified) |
| Container scanning | Artifact Registry | ECR scan on push | ACR scanning |
| Environment isolation | Separate Projects | Separate Accounts | Separate Subscriptions |
