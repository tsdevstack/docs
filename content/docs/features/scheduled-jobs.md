# Scheduled Jobs

Scheduled jobs run work on a schedule in the cloud. There are two kinds:

- A **cron job** runs code from one of your NestJS services as its own task. The task starts, runs one handler, and exits.
- A **trigger** calls an endpoint of a running service.

Both kinds are entries in the `scheduledJobs` list of `infrastructure.json`. Each cloud's own scheduler starts them: Cloud Scheduler on GCP, EventBridge Scheduler on AWS, and Container App Jobs on Azure.

## Which kind to use

| | Cron job | Trigger |
|---|---|---|
| What runs | A handler in your service's code, in its own task | An endpoint of the running service |
| How long a run can take | Up to a day (almost 7 days on GCP) | 4 to 30 minutes, by cloud |
| Resources | Its own CPU and memory | The service's |
| You write | A class with a `run()` method | A guarded controller endpoint |

A cron job fits reports, cleanups, imports and anything that runs for more than a few minutes. A trigger fits short work that belongs in the service's running process.

## Cron jobs

### Add a cron job

```bash
npx tsdevstack register-cron --service auth-service --name usage-report
```

The command creates these files in `apps/auth-service`:

- `src/cron/usage-report.cron.ts`: the handler. You write its `run()` method.
- `src/cron.ts`, `src/cron.module.ts` and `tsconfig.cron.json`: the entrypoint, made with the first cron job of the service.
- The `cron` script in `package.json`.

It never overwrites a file. For a second cron job in the same service, it prints two lines to add to `src/cron.module.ts`: the handler's import and its place in the `handlers` list.

It also prints the entry for `infrastructure.json`. Add it to each environment that should run the job:

```json
{
  "name": "usage-report",
  "type": "cron",
  "schedule": "0 3 * * *",
  "targetService": "auth-service",
  "timeout": 600
}
```

### Write the handler

A handler is a NestJS provider. Inject what the job needs through the constructor.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import type { CronJobHandler } from '@tsdevstack/nest-common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsageReportCron implements CronJobHandler {
  readonly name = 'usage-report';
  private readonly logger = new Logger(UsageReportCron.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(signal: AbortSignal): Promise<void> {
    const users = await this.prisma.user.count();
    if (signal.aborted) {
      return;
    }
    this.logger.log(`Users: ${users}`);
  }
}
```

- Returning ends the run as a success. Throwing ends it as a failure.
- The signal fires at the job's `timeout`, and when the platform stops the run. Pass it to `fetch`, and check `signal.aborted` between long steps.
- The run gets the service's secrets, database and Redis, with the service's own access.

### How a run works

- **One run at a time.** A run holds a lock in Redis for its job. A start while another run is active logs a warning and exits as skipped.
- **Timeout.** At `timeout` the signal fires. A handler that doesn't return within 8 seconds is stopped.
- **Exit codes.** `0` for success or a skipped run, `1` for a failure or a stopped run, `2` for a job name the service has no handler for.
- **Logs.** Every line carries the job's name. The last line is `cron job finished`, with the outcome, the exit code and the duration.
- **Traces.** A run is one trace, `cron usage-report`, with the job's queries inside it.
- **No retries.** A failed run, or a start that fails, waits for the next scheduled time.

### Cron job fields

| Field | Required | Default | Description |
|---|---|---|---|
| `name` | Yes | | Kebab-case, at most 40 characters. The handler's `name` |
| `type` | Yes | | `"cron"` |
| `schedule` | Yes | | Cron expression |
| `targetService` | Yes | | The NestJS service whose code runs |
| `timeout` | No | `600` | Seconds a run may take: 1 to 86400 on AWS and Azure, 1 to 604740 on GCP |
| `cpu` | No | Migration job's | CPU of the run, the values a migration job takes |
| `memory` | No | Migration job's | Memory of the run, the values a migration job takes |
| `timezone` | No | `UTC` | IANA time zone the schedule runs in. Azure runs schedules in UTC only |

Each cloud's names for the job include the project, so a project leaves less room for `name`:

| Cloud | Name | Longest |
|---|---|---|
| GCP | The Cloud Run Job, `{project}-cron-{name}` | 49 characters |
| AWS | The schedule, `{project}-{service}-{name}` | 64 characters |
| Azure | The Container App Job, `{project}-cron-{name}` | 32 characters |

`infra:generate` stops on a name that doesn't fit, with its length and the limit.

The defaults for `cpu` and `memory` are 1 vCPU and 2 GiB on every cloud. On AWS, write them as ECS units and MiB: `"cpu": "1024"`, `"memory": "2048"`.

## Triggers

A trigger is an entry with an `endpoint`:

```json
{
  "name": "cleanup-tokens",
  "schedule": "0 */4 * * *",
  "targetService": "auth-service",
  "endpoint": "/auth/jobs/cleanup-tokens",
  "method": "POST",
  "httpTimeout": 120,
  "timezone": "UTC"
}
```

| Field | Required | Default | Description |
|---|---|---|---|
| `name` | Yes | | Job identifier (kebab-case) |
| `schedule` | Yes | | Cron expression |
| `targetService` | Yes | | Service name (must exist in `config.json`) |
| `endpoint` | Yes | | HTTP path on the target service |
| `method` | No | `POST` | `GET`, `POST`, `PUT`, `DELETE` or `PATCH` |
| `httpTimeout` | No | `300` (Azure `240`) | Seconds to wait for the response |
| `timezone` | No | `UTC` | IANA time zone. Azure runs schedules in UTC only |

How long a call can wait depends on the cloud. `infra:generate` stops with a message when `httpTimeout` is outside it:

| Cloud | `httpTimeout` | Why |
|---|---|---|
| GCP | 15 to 1800 s | Cloud Scheduler waits at most 30 minutes |
| AWS | 15 to 890 s | The job function stops at 900 s and logs the run's end in the last 10 s |
| Azure | 15 to 240 s | Container Apps ingress ends every HTTP request at 240 s |

For longer work, use a cron job.

### The endpoint

Trigger endpoints use `SchedulerGuard` from `@tsdevstack/nest-common`, and stay out of the OpenAPI spec, so Kong never routes to them:

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

The guard checks that the call comes from the environment's scheduler:

| Cloud | The call carries | Checked against |
|---|---|---|
| GCP | `Authorization: Bearer {oidc-token}` | Google's token check, the service URL as audience |
| AWS | `X-Job-Secret: {secret}` | The job secret in Secrets Manager |
| Azure | `X-Job-Secret: {secret}` | The job secret in Key Vault |
| Local | Nothing | Not checked when `SECRETS_PROVIDER=local` |

### Auth template: the API key usage job

Projects on the auth template need one trigger in every cloud environment: `sync-api-key-usage`. It saves API key usage totals to Postgres and rebuilds the key index when Redis lost it.

```json
{
  "name": "sync-api-key-usage",
  "schedule": "*/5 * * * *",
  "targetService": "auth-service",
  "endpoint": "/auth/jobs/sync-api-key-usage",
  "method": "POST"
}
```

It is not added for you. `infra:generate` warns for each environment that lacks it and prints the entry to add, with your auth-service prefix. See [API Keys](/docs/authentication/api-keys#the-usage-job) for what it does.

## Run a job now

Schedules don't run locally. Start a job by hand against the running local stack:

```bash
# A cron job: runs its handler once, then exits with the run's exit code
npx tsdevstack run-cron usage-report --service auth-service

# A trigger: calls its endpoint on the service's local port
npx tsdevstack run-cron cleanup-tokens
```

Inside the service's folder, `npm run cron -- usage-report` does the same as the first command.

In the cloud, `infra:run-cron` starts a job now:

```bash
npx tsdevstack infra:run-cron --job usage-report --env staging
```

- **Cron job:** one run starts, and the command waits for it to end. It prints the outcome. When the run failed, it also prints the run's last log lines, as `infra:logs` shows them (times in UTC). On Azure the lines arrive 1 to 10 minutes after the run, so there the command points you to `infra:logs`.
- **Trigger:** on AWS and Azure, the command waits for the call's answer. On GCP, it returns once Cloud Scheduler started the call. The result is in `infra:list-schedulers` and in the logs.

The command exits with 1 when the run failed.

## CLI commands

```bash
# Add a cron job to a service
npx tsdevstack register-cron --service auth-service --name usage-report

# Run a job once, locally or in the cloud
npx tsdevstack run-cron usage-report --service auth-service
npx tsdevstack infra:run-cron --job usage-report --env staging

# Deploy all scheduled jobs, or one
npx tsdevstack infra:deploy-schedulers --env staging
npx tsdevstack infra:deploy-scheduler --env staging --job usage-report

# Both kinds, each schedule's state and the last run
npx tsdevstack infra:list-schedulers --env staging

# Remove a job from the cloud
npx tsdevstack infra:remove-scheduler --env staging --job usage-report --confirm

# A job's logs
npx tsdevstack infra:logs usage-report --env staging
```

In CI, pass every flag: commands don't ask questions there.

`infra:remove-scheduler` removes the job from the cloud only. While its entry is still in `infrastructure.json`, the command says so: take the entry out too, or the next deploy creates the job again.

## Deployment

After adding a job to `infrastructure.json`, deploy the environment:

```bash
npx tsdevstack infra:generate --env staging
npx tsdevstack infra:deploy --env staging
```

`infra:deploy` creates the schedules, then deploys the services. A cron job ships with its service: every `infra:deploy-services` deploys the service's cron jobs with the same image.

To change only a schedule, or a cron job's `timeout`, `cpu` or `memory`:

```bash
npx tsdevstack infra:generate --env staging
npx tsdevstack infra:deploy-schedulers --env staging
```

A cron job's run uses the image its service runs. When the service was never deployed, `infra:deploy-schedulers` stops and asks you to deploy it first.

## Provider architecture

### GCP: Cloud Scheduler and Cloud Run Jobs

- **Cron job:** a Cloud Run Job, `{project}-cron-{name}`, with the service's image, account and secrets. Cloud Scheduler starts it on the schedule.
- **Trigger:** Cloud Scheduler calls the service's Cloud Run URL with an OIDC token.

### AWS: EventBridge Scheduler

- **Cron job:** an ECS task definition, `{project}-cron-{name}`, with the service's image and task role, and its own log group. EventBridge Scheduler starts one Fargate task in the private subnets.
- **Trigger:** EventBridge Scheduler starts the job function, a Lambda in the VPC. It reads the job secret from Secrets Manager and calls the service through Cloud Map.

### Azure: Container App Jobs

- **Cron job:** a Container App Job, `{project}-cron-{name}`, with the service's image and identity. Its schedule is part of the job.
- **Trigger:** a small Container App Job on the schedule. It reads the job secret from Key Vault and calls the service.
- **State:** `infra:list-schedulers` shows the job's state, `Ready` or `Suspended`.
- **A run shown as failed:** Azure can count a run as failed before its container starts, then run it anyway. When a run shows as failed, `infra:logs <job>` shows whether it ran: a cron job's run that ran ends with its `cron job finished` line.
