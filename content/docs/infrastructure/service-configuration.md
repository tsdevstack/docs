# Service Configuration

Customize how your services run in the cloud using `infrastructure.json`.

## Overview

The `.tsdevstack/infrastructure.json` file lets you override default settings per environment:

```json
{
  "$schema": "./infrastructure.schema.json",
  "version": "1.0.0",
  "dev": {
    "auth-service": {
      "minInstances": 1,
      "maxInstances": 5
    }
  },
  "prod": {
    "auth-service": {
      "minInstances": 1,
      "maxInstances": 20,
      "cpu": "2",
      "memory": "1Gi"
    }
  }
}
```

## Creating infrastructure.json

If you don't have an `infrastructure.json` file yet, create it in your `.tsdevstack` directory:

```bash
touch .tsdevstack/infrastructure.json
```

Then add the minimum required content:

```json
{
  "$schema": "./infrastructure.schema.json",
  "version": "1.0.0"
}
```

## IDE Autocomplete

The `$schema` property enables intelligent autocomplete and validation in VS Code and other editors that support JSON Schema.

**What you get:**
- Autocomplete for all configuration options (CPU, memory, database tiers, etc.)
- Inline validation for invalid values
- Hover documentation for each property

**How it works:**
1. Add `"$schema": "./infrastructure.schema.json"` as the first property in your `infrastructure.json`
2. The framework includes `infrastructure.schema.json` in the `.tsdevstack` directory
3. Your IDE automatically provides suggestions and validation

:::tip
If autocomplete isn't working, ensure the `infrastructure.schema.json` file exists in your `.tsdevstack` directory. Run `npx tsdevstack infra:init --env <environment>` to generate it.
:::

## Service Options

| Option | Default | Description |
|--------|---------|-------------|
| `minInstances` | `1` (GCP, AWS), `0` (Azure) | Minimum running instances (`0` = scale to zero, GCP and Azure only) |
| `maxInstances` | `10` (GCP, AWS), `5` (Azure) | Maximum instances for auto-scaling |
| `cpu` | `"1"` (GCP), `"0.5"` (AWS, Azure) | CPU allocation (valid values vary by provider, see below) |
| `memory` | `"512Mi"` (GCP), `"1Gi"` (AWS, Azure) | Memory allocation (valid values vary by provider, see below) |
| `timeout` | `"300s"` | Request timeout (30s-3600s) |
| `concurrency` | `80` | Max concurrent requests per instance |

The JSON schema is provider-aware — IDE autocomplete will only show values valid for your cloud provider.

## Scaling Configuration

### minInstances

Controls the minimum number of instances always running.

| Value | Behavior | Cost | Startup |
|-------|----------|------|---------|
| `0` | Scale to zero when idle (GCP and Azure only) | Pay only when used | Cold start (see below) |
| `1+` | Always-on instances | Continuous cost | No cold start |

Scale-to-zero is a platform feature of Cloud Run and Container Apps, and cold start times vary:

| Provider | Typical Cold Start |
|----------|--------------------|
| GCP (Cloud Run) | ~2-5s |
| Azure (Container Apps) | ~5-15s |

:::warning AWS has no scale-to-zero
On AWS every ECS service (NestJS services, Next.js frontends, workers and Kong) runs at least one task. `minInstances: 0` fails validation in `infra:generate`, `infra:plan`, `infra:deploy` and `infra:status`, with a hint to set 1 or more. Backend services on AWS are reachable only inside the VPC, so there is no public entry point that could wake a stopped service. See [AWS Cost Estimation](/docs/infrastructure/providers/aws/cost-estimation) for what always-on costs.
:::

**Recommendations:**
- **Dev on GCP or Azure**: `0` - Save costs, cold starts are acceptable
- **Prod critical paths**: `1+` - Avoid cold starts for user-facing APIs
- **Detached workers**: `1+` - Workers must always be running to poll Redis queues. On GCP and Azure the framework raises `0` to 1 for workers; on AWS it fails validation like any other service

### maxInstances

Limits how many instances can run during high traffic.

- Higher values handle more concurrent users
- Each instance costs money while running
- The container runtime auto-scales based on CPU utilization and request queue. On AWS, NestJS services, Next.js frontends, workers and Kong scale on CPU (target tracking at 70%) between `minInstances` and `maxInstances`

**Example:** If each instance handles 80 concurrent requests and you expect 800 peak concurrent users, set `maxInstances: 10` minimum.

## Resource Configuration

### CPU

| Value | GCP | AWS | Azure |
|-------|-----|-----|-------|
| `"0.25"` | Yes | Yes | Yes |
| `"0.5"` | Yes | Yes (default) | Yes (default) |
| `"1"` | Yes (default) | Yes | Yes |
| `"2"` | Yes | Yes | Yes |
| `"4"` | Yes | Yes | Yes |
| `"8"` | Yes | — | — |

### Memory

| Value | GCP | AWS | Azure |
|-------|-----|-----|-------|
| `"256Mi"` | Yes | — | — |
| `"512Mi"` | Yes (default) | Yes | — |
| `"0.5Gi"` | Yes | — | Yes |
| `"1Gi"` | Yes | Yes (default) | Yes (default) |
| `"2Gi"` | Yes | Yes | Yes |
| `"4Gi"` | Yes | Yes | Yes |
| `"8Gi"` | Yes | Yes | — |
| `"16Gi"` | — | Yes | — |

GCP has the widest range (256Mi–8Gi). AWS supports larger instances (up to 16Gi). Azure is the most constrained (0.5Gi–4Gi, no sub-Gi values).

## Kong Gateway

Configure the API gateway separately:

```json
{
  "version": "1.0.0",
  "prod": {
    "kong": {
      "minInstances": 1,
      "maxInstances": 10,
      "cpu": "2",
      "memory": "1Gi"
    }
  }
}
```

Kong defaults:

| Option | GCP | AWS | Azure |
|--------|-----|-----|-------|
| `minInstances` | `1` | `1` | `1` |
| `maxInstances` | `10` | `10` | `5` |
| `cpu` | `"1"` | `"1"` | `"0.5"` |
| `memory` | `"1Gi"` | `"2Gi"` | `"1Gi"` |

Keep Kong at `minInstances: 1` or more: every API request goes through it. On AWS, `0` fails validation.

## Detached Workers

Configure BullMQ worker scaling and resources:

```json
{
  "version": "1.0.0",
  "dev": {
    "auth-worker": {
      "minInstances": 1,
      "maxInstances": 3,
      "cpu": "0.25",
      "memory": "512Mi"
    }
  },
  "prod": {
    "auth-worker": {
      "minInstances": 2,
      "maxInstances": 10,
      "cpu": "1",
      "memory": "1Gi"
    }
  }
}
```

Workers support the same options as services (`minInstances`, `maxInstances`, `cpu`, `memory`). The framework enforces `minInstances >= 1` because workers must always be running to poll Redis queues: on GCP and Azure `0` is overridden to `1`, on AWS it fails validation.

On AWS, workers get auto-scaling resources (CPU-based target tracking at 70%), like services and Kong. On GCP and Azure, the container runtime handles scaling natively.

:::note
Changing a worker's `maxInstances` affects the database connection pool calculation. After changing scaling config, redeploy all services and workers to rebalance pool sizes.
:::

## Database

Configure managed PostgreSQL:

```json
{
  "version": "1.0.0",
  "prod": {
    "database": {
      "tier": "db-n1-standard-1",
      "diskSize": 50,
      "ha": true,
      "backup": true
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `tier` | `"db-f1-micro"` | Instance size |
| `diskSize` | `10` | Storage in GB (10-1000) |
| `ha` | `false` | High availability (regional failover) |
| `backup` | `true` | Automated backups |
| `serverName` | `{project}-{env}-postgres` | Azure only. PostgreSQL server name, see [Custom server name (Azure)](#custom-server-name-azure) |

**Database tiers by provider:**

**GCP (Cloud SQL):**
- `db-f1-micro` - Development (shared CPU)
- `db-g1-small` - Small production
- `db-n1-standard-1` - Standard production (1 vCPU)
- `db-n1-standard-2` - Larger production (2 vCPU)
- `db-n1-standard-4` - High-traffic production (4 vCPU)

**AWS (RDS PostgreSQL):**
- `db.t3.micro` - Development (~$15/mo)
- `db.t3.small` - Small production
- `db.r6g.large` - Standard production
- `db.r6g.xlarge` - High-traffic production

**Azure (PostgreSQL Flexible Server):**
- `B_Standard_B1ms` - Development (burstable, ~$14/mo)
- `B_Standard_B2s` - Small production (burstable)
- `GP_Standard_D2s_v3` - Standard production (general purpose)
- `GP_Standard_D4s_v3` - High-traffic production (general purpose)

### Custom server name (Azure)

On Azure the PostgreSQL Flexible Server name is a global DNS name (`<name>.postgres.database.azure.com`), so it has to be unique across all of Azure, not only in your subscription. tsdevstack names it `{project}-{env}-postgres`. If someone else already holds that name, the deploy fails with `ServerNameAlreadyExists`. Typical causes: another project uses the same project name, or a server with that name still exists in a subscription you deleted.

Pick a different name for that environment with `serverName`:

```json
{
  "version": "1.0.0",
  "dev": {
    "database": {
      "serverName": "myapp-dev-postgres-2"
    }
  }
}
```

Rules: 3 to 63 characters, lowercase letters, digits and hyphens, no hyphen at the start or the end. Set it per environment; environments without it keep the default name. Your services' connection strings follow on their own, since the deploy builds them from the server address Terraform reports.

The field is Azure only. On GCP and AWS the schema flags it in your editor and `infra:status` reports it as an error.

:::warning
Set `serverName` before the first deploy of an environment. Changing it on an environment that is already running makes Terraform replace the server: the old server and every database on it are destroyed and a new, empty one is created. If you really need to rename a live server, back up first (`pg_dump`) and check `npx tsdevstack infra:plan` before you deploy.
:::

## Redis

Configure managed Redis:

```json
{
  "version": "1.0.0",
  "prod": {
    "redis": {
      "tier": "STANDARD_HA",
      "memoryGb": 2
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `tier` | `"BASIC"` | `"BASIC"` or `"STANDARD_HA"` |
| `memoryGb` | `1` | Memory in GB (1-300) |

**GCP (Memorystore):**
- `BASIC` - Single instance, no failover
- `STANDARD_HA` - High availability with automatic failover

**AWS (ElastiCache):**
- `cache.t3.micro` - Development (~$12/mo)
- `cache.t3.small` - Small production
- `cache.r6g.large` - Standard production

**Azure (Managed Redis):**
- `Balanced_B0` - Development (~$13/mo, clustered)
- `Balanced_B1` - Small production
- `Balanced_B3` - Standard production

:::info
Azure Managed Redis uses `EnterpriseCluster` policy. BullMQ requires a `{bull}` prefix to avoid `CROSSSLOT` errors — see [Azure Architecture](/docs/infrastructure/providers/azure/architecture) for details.
:::

## Frontend Domains

Configure domains for frontend services:

```json
{
  "version": "1.0.0",
  "prod": {
    "frontend": {
      "domain": "example.com"
    },
    "admin-app": {
      "domain": "admin.example.com"
    }
  }
}
```

| Option | Description |
|--------|-------------|
| `domain` | Full domain for the frontend |

## Load Balancer

Configure domain redirects and API domain:

```json
{
  "version": "1.0.0",
  "prod": {
    "loadBalancer": {
      "redirectDomains": ["example.app", "example.io"]
    }
  }
}
```

| Option | Description |
|--------|-------------|
| `redirectDomains` | Domains to 301 redirect to canonical domain (apex and subdomains) |
| `apiDomain` | Override API domain (defaults to `api.{DOMAIN}`) |

When you own multiple domains (e.g., `.com`, `.io`, `.app`), add alternates to `redirectDomains`. All traffic to those domains redirects to your canonical domain set in the `DOMAIN` secret.

## Access Control

Keep non-production environments out of search engines:

```json
{
  "version": "1.0.0",
  "dev": {
    "accessControl": {
      "noIndex": true
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `noIndex` | `false` | Add `X-Robots-Tag: noindex, nofollow` header |

:::warning
Environment password protection was removed. The `accessControl.protected` and `accessControl.cookieTtlHours` fields are no longer accepted, and a config that still sets them fails validation. Remove them from `infrastructure.json`.
:::

## Scheduled Jobs

Configure cron-based scheduled jobs in the `scheduledJobs` array. See the [Scheduled Jobs](/docs/features/scheduled-jobs) guide for full configuration, service-side implementation, authentication, and provider architecture.

With the auth template, every environment needs the `sync-api-key-usage` job; `infra:generate` warns and prints the entry when it is missing. See [API Keys](/docs/authentication/api-keys#the-usage-job).

## WAF Rules

The framework includes default WAF rules for common attacks (SQL injection, XSS, path traversal, command injection, SSRF, scanner fingerprints, and more). You can customize the global rate limit and add custom rules per provider.

### Global rate limit

Override the default rate limit (1000 requests per 60 seconds per IP) across all providers:

```json
{
  "version": "1.0.0",
  "prod": {
    "security": {
      "waf": {
        "rateLimit": {
          "count": 500,
          "intervalSec": 60
        }
      }
    }
  }
}
```

| Option | Required | Description |
|--------|----------|-------------|
| `count` | Yes | Requests allowed per interval |
| `intervalSec` | Yes | Interval in seconds (1-3600) |

The framework translates this to each provider's native format:
- **GCP:** Direct pass-through to Cloud Armor throttle rule
- **AWS:** Scaled to 5-minute window (AWS minimum). 1000/60s becomes 5000 per 5 minutes
- **Azure:** Scaled to per-minute buckets. 500/30s becomes 1000 per 1 minute

### Custom rules (GCP)

GCP uses [CEL expressions](https://cloud.google.com/armor/docs/rules-language-reference) for custom rules:

```json
{
  "version": "1.0.0",
  "prod": {
    "security": {
      "waf": {
        "customRules": [
          {
            "name": "block-bad-ips",
            "priority": 800,
            "action": "deny(403)",
            "expression": "inIpRange(origin.ip, '192.0.2.0/24')",
            "description": "Block known bad IP range"
          },
          {
            "name": "rate-limit-api",
            "priority": 850,
            "action": "throttle",
            "expression": "request.path.matches('/api/.*')",
            "description": "Rate limit API calls",
            "rateLimit": {
              "count": 100,
              "intervalSec": 60
            }
          }
        ]
      }
    }
  }
}
```

| Option | Required | Description |
|--------|----------|-------------|
| `name` | Yes | Unique identifier for the rule |
| `priority` | Yes | Evaluation order (lower = first). Use 800-899 for custom rules |
| `action` | Yes | `"allow"`, `"deny(403)"`, `"deny(404)"`, `"deny(429)"`, or `"throttle"` |
| `expression` | Yes | CEL expression to match requests |
| `description` | No | Human-readable description |
| `rateLimit` | For throttle | Required when action is `"throttle"` |

### Custom rules (AWS)

AWS uses statement-based rules with byte match, rate-based, and geo match types:

```json
{
  "version": "1.0.0",
  "prod": {
    "security": {
      "waf": {
        "awsCustomRules": [
          {
            "name": "block-country",
            "priority": 100,
            "action": "block",
            "matchType": "geo_match",
            "geoMatch": {
              "countryCodes": ["CN", "RU"]
            },
            "description": "Block traffic from specific countries"
          },
          {
            "name": "block-bad-path",
            "priority": 200,
            "action": "block",
            "matchType": "byte_match",
            "byteMatch": {
              "searchString": "/internal",
              "fieldToMatch": "uri_path",
              "positionalConstraint": "STARTS_WITH"
            }
          }
        ]
      }
    }
  }
}
```

| Option | Required | Description |
|--------|----------|-------------|
| `name` | Yes | Unique identifier |
| `priority` | Yes | 100-899 (managed rules use 1-99) |
| `action` | Yes | `"block"`, `"allow"`, or `"count"` |
| `matchType` | Yes | `"byte_match"`, `"rate_based"`, or `"geo_match"` |
| `byteMatch` | For byte_match | Search string, field, and positional constraint |
| `geoMatch` | For geo_match | ISO 3166-1 alpha-2 country codes |
| `rateLimit` | For rate_based | Requests per 5-minute window (minimum 100) |

### Custom rules (Azure)

Azure uses match conditions with operators and transforms:

```json
{
  "version": "1.0.0",
  "prod": {
    "security": {
      "waf": {
        "azureCustomRules": [
          {
            "name": "BlockBadBot",
            "type": "MatchRule",
            "priority": 1000,
            "action": "Block",
            "matchConditions": [
              {
                "matchVariable": "RequestHeader",
                "operator": "Contains",
                "matchValues": ["bad-bot", "scraper"],
                "selector": "User-Agent",
                "transforms": ["Lowercase"]
              }
            ],
            "description": "Block known bad bots"
          },
          {
            "name": "RateLimitExpensiveAPI",
            "type": "RateLimitRule",
            "priority": 1001,
            "action": "Block",
            "rateLimitDurationInMinutes": 5,
            "rateLimitThreshold": 100,
            "matchConditions": [
              {
                "matchVariable": "RequestUri",
                "operator": "Contains",
                "matchValues": ["/api/expensive"]
              }
            ]
          }
        ]
      }
    }
  }
}
```

| Option | Required | Description |
|--------|----------|-------------|
| `name` | Yes | Unique name (alphanumeric only) |
| `type` | Yes | `"MatchRule"` or `"RateLimitRule"` |
| `priority` | Yes | Use 1000+ to avoid conflicts with framework rules |
| `action` | Yes | `"Block"`, `"Allow"`, or `"Log"` |
| `matchConditions` | Yes | Array of match conditions (all must match) |
| `rateLimitDurationInMinutes` | For RateLimitRule | Window in minutes |
| `rateLimitThreshold` | For RateLimitRule | Request threshold |

**Match condition options:**

| Option | Required | Description |
|--------|----------|-------------|
| `matchVariable` | Yes | `"RequestUri"`, `"RequestMethod"`, `"RequestHeader"`, `"RequestBody"`, `"SocketAddr"`, `"QueryString"` |
| `operator` | Yes | `"Contains"`, `"Equal"`, `"IPMatch"`, `"GreaterThan"` |
| `matchValues` | Yes | Values to match against |
| `selector` | For headers | Header name (e.g., `"User-Agent"`) |
| `transforms` | No | `["Lowercase"]`, `["UrlDecode"]`, or `["Lowercase", "UrlDecode"]` |

### Schema validation

The `infrastructure.schema.json` is provider-aware — it only shows the custom rule format relevant to your cloud provider. IDE autocomplete will guide you to the correct syntax.

## Upload Size Limits

Configure the maximum traditional upload size through Kong:

```json
{
  "version": "1.0.0",
  "prod": {
    "kong": {
      "maxUploadSize": "10m"
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `maxUploadSize` | `"10m"` | Maximum request body size. Uses nginx-style values: `"10m"`, `"50m"`, `"1g"`, `"0"` for unlimited |

This sets Kong's `client_max_body_size`. Requests exceeding this limit receive a `413 Content Too Large` response.

**Hard ceilings per provider** (cannot be exceeded even with higher configuration):

| Provider | Ceiling | Reason |
|----------|---------|--------|
| GCP | 32MB | Cloud Run request size limit |
| AWS | No documented limit | — |
| Azure | 100MB (Standard Front Door) | Front Door tier limit |

For files larger than these limits, use presigned URL uploads which bypass the WAF/LB/Kong chain entirely. See [Object Storage](/docs/features/object-storage) for details.

## Cost Optimization

### Development environments

```json
{
  "dev": {
    "auth-service": { "minInstances": 0 },
    "offers-service": { "minInstances": 0 },
    "kong": { "minInstances": 0 },
    "database": { "tier": "db-f1-micro", "ha": false },
    "redis": { "tier": "BASIC", "memoryGb": 1 }
  }
}
```

### Production environments

```json
{
  "prod": {
    "auth-service": { "minInstances": 1, "maxInstances": 20 },
    "offers-service": { "minInstances": 1, "maxInstances": 10 },
    "kong": { "minInstances": 1, "maxInstances": 10 },
    "database": { "tier": "db-n1-standard-1", "ha": true },
    "redis": { "tier": "STANDARD_HA", "memoryGb": 2 }
  }
}
```

## Applying Changes

After modifying `infrastructure.json`:

```bash
npx tsdevstack infra:deploy --env <environment>
```

Changes are applied on the next deployment. Some changes (like database tier) may cause brief downtime.
