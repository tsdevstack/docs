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
      "minInstances": 0,
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
| `minInstances` | `0` | Minimum running instances (0 = scale to zero) |
| `maxInstances` | `10` | Maximum instances for auto-scaling |
| `cpu` | `"1"` | CPU allocation: `"0.5"`, `"1"`, `"2"`, `"4"`, `"8"` |
| `memory` | `"512Mi"` | Memory: `"256Mi"`, `"512Mi"`, `"1Gi"`, `"2Gi"`, `"4Gi"`, `"8Gi"` |
| `timeout` | `"300s"` | Request timeout (30s-3600s) |
| `concurrency` | `80` | Max concurrent requests per instance |

## Scaling Configuration

### minInstances

Controls the minimum number of instances always running.

| Value | Behavior | Cost | Startup |
|-------|----------|------|---------|
| `0` | Scale to zero when idle | Pay only when used | Cold start (~2-5s) |
| `1+` | Always-on instances | Continuous cost | No cold start |

**Recommendations:**
- **Dev**: `0` - Save costs, cold starts are acceptable
- **Prod critical paths**: `1+` - Avoid cold starts for user-facing APIs
- **Background workers**: `0` - Scale to zero when no work

### maxInstances

Limits how many instances can run during high traffic.

- Higher values handle more concurrent users
- Each instance costs money while running
- The container runtime auto-scales based on CPU utilization and request queue

**Example:** If each instance handles 80 concurrent requests and you expect 800 peak concurrent users, set `maxInstances: 10` minimum.

## Resource Configuration

### CPU

More CPU means faster processing but higher cost.

| Value | Use Case | Cost Multiplier |
|-------|----------|-----------------|
| `"0.5"` | Light workloads | 0.5x |
| `"1"` | Standard services (default) | 1x |
| `"2"` | CPU-intensive operations | 2x |
| `"4"` | Heavy computation | 4x |
| `"8"` | Extreme workloads | 8x |

### Memory

More memory for larger datasets or caching.

| Value | Use Case |
|-------|----------|
| `"256Mi"` | Minimal services |
| `"512Mi"` | Standard services (default) |
| `"1Gi"` | Services with caching |
| `"2Gi"` | Large in-memory datasets |
| `"4Gi"` / `"8Gi"` | Memory-intensive workloads |

**Note:** Memory and CPU are linked - higher CPU tiers require more memory.

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
- `minInstances`: `0`
- `maxInstances`: `10`
- `cpu`: `"1"`
- `memory`: `"1Gi"`

For production, consider `minInstances: 1` to avoid cold starts on the API gateway.

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
Azure Managed Redis uses `EnterpriseCluster` policy. BullMQ requires a `{bull}` prefix to avoid `CROSSSLOT` errors — see [Azure Architecture](/infrastructure/providers/azure/architecture) for details.
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

Password-protect non-production environments:

```json
{
  "version": "1.0.0",
  "dev": {
    "accessControl": {
      "protected": true,
      "noIndex": true
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `protected` | - | Must be `true` to enable protection |
| `cookieTtlHours` | `24` | How long the auth cookie is valid (1-168 hours) |
| `noIndex` | `false` | Add `X-Robots-Tag: noindex, nofollow` header |

When enabled, users must enter a password (set via `ENV_ACCESS_PASSWORD` secret) before accessing any page. This prevents accidental exposure of dev/staging environments.

:::info
The `infra:deploy-env-auth` and `infra:remove-env-auth` commands are planned. Access control configuration is currently applied through `infra:deploy`.
:::

```bash
npx tsdevstack infra:deploy-env-auth --env dev
npx tsdevstack infra:remove-env-auth --env dev
```

## Scheduled Jobs

Configure cron-based scheduled jobs that call your service endpoints:

```json
{
  "version": "1.0.0",
  "prod": {
    "scheduledJobs": [
      {
        "name": "cleanup-tokens",
        "schedule": "0 */4 * * *",
        "targetService": "auth-service",
        "endpoint": "/auth/jobs/cleanup-tokens",
        "method": "POST",
        "httpTimeout": 300
      },
      {
        "name": "send-daily-digest",
        "schedule": "0 8 * * *",
        "targetService": "notifications-service",
        "endpoint": "/notifications/jobs/daily-digest",
        "timezone": "America/New_York"
      }
    ]
  }
}
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `name` | Yes | - | Unique job identifier |
| `schedule` | Yes | - | Cron expression (e.g., `"0 */4 * * *"` for every 4 hours) |
| `targetService` | Yes | - | Service to call (e.g., `"auth-service"`) |
| `endpoint` | Yes | - | HTTP path to call (e.g., `"/auth/jobs/cleanup-tokens"`) |
| `method` | No | `"POST"` | HTTP method: `"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, `"PATCH"` |
| `httpTimeout` | No | `300` | Request timeout in seconds (1-1800) |
| `timezone` | No | `"UTC"` | Timezone for the cron schedule |

### Cron schedule examples

| Schedule | Description |
|----------|-------------|
| `"0 * * * *"` | Every hour |
| `"0 */4 * * *"` | Every 4 hours |
| `"0 0 * * *"` | Daily at midnight |
| `"0 8 * * 1"` | Every Monday at 8am |
| `"0 0 1 * *"` | First day of each month |

### Protecting job endpoints

Use the `@UseGuards(SchedulerGuard)` decorator from `@tsdevstack/nest-common` to ensure endpoints are only called by the scheduler:

```typescript
import { SchedulerGuard } from '@tsdevstack/nest-common';

@Post('jobs/cleanup-tokens')
@UseGuards(SchedulerGuard)
async cleanupTokens() {
  // This endpoint can only be called by the scheduler
}
```

## WAF Rules

Add custom Web Application Firewall rules:

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

### Rule options

| Option | Required | Description |
|--------|----------|-------------|
| `name` | Yes | Unique identifier for the rule |
| `priority` | Yes | Evaluation order (lower = first). Use 800-899 for custom rules |
| `action` | Yes | `"allow"`, `"deny(403)"`, `"deny(404)"`, `"deny(429)"`, or `"throttle"` |
| `expression` | Yes | CEL expression to match requests |
| `description` | No | Human-readable description |
| `rateLimit` | For throttle | Required when action is `"throttle"` |

### Rate limit options

| Option | Description |
|--------|-------------|
| `count` | Requests allowed per interval |
| `intervalSec` | Interval in seconds (1-3600) |

The framework includes default WAF rules for common attacks (SQL injection, XSS, etc.). Custom rules are added alongside these defaults.

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
