# Scheduled Jobs

CRON-based scheduled jobs that invoke HTTP endpoints on your services. Configured in `infrastructure.json`, deployed via CLI, with provider-specific infrastructure generated automatically.

## How it works

Scheduled jobs are regular NestJS controller endpoints. In cloud, the provider's native scheduler calls them on a CRON schedule with authentication. Locally, you trigger them manually.

```
Cloud Scheduler / EventBridge / Container App Job
                    │
                    │  HTTP POST (authenticated)
                    ▼
            ┌──────────────┐
            │  Kong / ALB  │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │   Service    │
            │  /jobs/...   │
            │  (guarded)   │
            └──────────────┘
```

## Configuration

Add jobs to `.tsdevstack/infrastructure.json` under the target environment:

```json
{
  "staging": {
    "scheduledJobs": [
      {
        "name": "cleanup-tokens",
        "schedule": "0 */4 * * *",
        "targetService": "auth-service",
        "endpoint": "/auth/jobs/cleanup-tokens",
        "method": "POST",
        "httpTimeout": 300,
        "timezone": "UTC"
      }
    ]
  }
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | — | Job identifier (kebab-case) |
| `schedule` | Yes | — | CRON expression |
| `targetService` | Yes | — | Service name (must exist in `config.json`) |
| `endpoint` | Yes | — | HTTP path on the target service |
| `method` | No | `POST` | HTTP method |
| `httpTimeout` | No | `300` | Timeout in seconds |
| `timezone` | No | `UTC` | IANA timezone |

## Service-side implementation

Job endpoints use `SchedulerGuard` from `@tsdevstack/nest-common` and are excluded from the OpenAPI spec so Kong doesn't expose them publicly:

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public, SchedulerGuard } from '@tsdevstack/nest-common';

@Controller('jobs')
@UseGuards(SchedulerGuard)
@ApiExcludeController()
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('cleanup-tokens')
  @Public()
  async cleanupTokens() {
    return this.jobsService.cleanupTokens();
  }
}
```

**Two layers of protection:**

1. `@ApiExcludeController()` — keeps routes out of the OpenAPI spec, so Kong never creates a public route for them
2. `SchedulerGuard` — validates that the request comes from the cloud scheduler, not an external source

## Authentication

The guard validates requests differently per provider:

| Provider | Auth Method | How it works |
|----------|------------|--------------|
| GCP | `Authorization: Bearer {oidc-token}` | Cloud Scheduler sends a Google OIDC token. Guard verifies audience matches the service URL |
| AWS | `X-Job-Secret: {secret}` | EventBridge Lambda retrieves secret from Secrets Manager, sends as header |
| Azure | `X-Job-Secret: {secret}` | Container App Job reads secret from Key Vault, sends as header |
| Local | Skipped | No validation when `SECRETS_PROVIDER=local` |

## Local development

Scheduled jobs don't run on a schedule locally. Trigger them manually:

```bash
curl -X POST http://localhost:3001/auth/jobs/cleanup-tokens
```

The `SchedulerGuard` skips validation in local mode, so no authentication headers are needed.

## CLI commands

```bash
# Deploy all scheduled jobs
npx tsdevstack infra:deploy-schedulers --env staging

# Deploy a single job
npx tsdevstack infra:deploy-scheduler --env staging --job cleanup-tokens

# List deployed jobs and status
npx tsdevstack infra:list-schedulers --env staging

# Remove a job from cloud
npx tsdevstack infra:remove-scheduler --env staging --job cleanup-tokens --confirm
```

In CI, all flags must be explicit — no interactive prompts.

## Provider architecture

### GCP — Cloud Scheduler

Cloud Scheduler makes HTTP requests directly to the Cloud Run service URL with an OIDC token. Service URLs are computed from the project number (deterministic), so the Terraform has no dependency on existing deployments.

### AWS — EventBridge + Lambda

EventBridge Schedule triggers a Job Invoker Lambda. The Lambda retrieves the job secret from Secrets Manager, wakes the ECS service if needed (scale from zero), then calls the service endpoint via CloudMap DNS.

### Azure — Container App Jobs

Azure runs a lightweight curl container on the CRON schedule. The container reads the job secret from its environment (injected from Key Vault) and calls the target Container App.

## Deployment

Scheduler infrastructure is included in the main `infra:generate` output. A full `infra:deploy` creates everything automatically:

```bash
npx tsdevstack infra:deploy --env staging
```

To update a schedule without a full deploy:

```bash
npx tsdevstack infra:deploy-schedulers --env staging
```
