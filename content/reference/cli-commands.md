# CLI Commands

The `tsdevstack` CLI handles project management, code generation, and deployment workflows.

## Installation

The CLI is installed as a project devDependency (`@tsdevstack/cli`). Run commands with `npx tsdevstack` (or `npx tsds`) from your project root.

```bash
npx tsdevstack --version
npx tsdevstack --help
```

## Local Development Commands

### `sync`

Regenerate all framework-managed configuration files. This is the most frequently used command.

```bash
npx tsdevstack sync
```

**What it generates:**

- `kong.tsdevstack.yml` - Gateway routes from OpenAPI specs
- `docker-compose.yml` - Container orchestration with injected secrets
- `.secrets.tsdevstack.json` - Framework secrets
- `.secrets.local.json` - Merged secrets for local development

**When to run:**

- After adding or removing services
- After changing OpenAPI decorators
- After modifying `.tsdevstack/config.json`
- After pulling changes that modify service structure

### `add-service`

Add a new application to the monorepo.

```bash
npx tsdevstack add-service --name <name> --type <type>
```

**Types:**

| Type | Description |
|------|-------------|
| `nestjs` | NestJS backend API |
| `nextjs` | Next.js frontend |
| `spa` | Single-page application (Rsbuild) |

**Example:**

```bash
npx tsdevstack add-service --name payments-service --type nestjs
npx tsdevstack add-service --name web-app --type nextjs
npx tsdevstack add-service --name dashboard --type spa
```

### `remove-service`

Remove a service from the local project.

```bash
npx tsdevstack remove-service [service-name]
```

Removes the service directory and updates `.tsdevstack/config.json`. If no service name is provided, prompts for selection.

### `generate-kong`

Generate Kong gateway configuration from OpenAPI specs.

```bash
npx tsdevstack generate-kong
```

Generates `kong.tsdevstack.yml` with routes derived from your service OpenAPI specifications.

### `generate-secrets`

Generate secrets for local development.

```bash
npx tsdevstack generate-secrets
```

Creates:
- `.secrets.tsdevstack.json` - Framework-generated secrets (JWT keys, database passwords, etc.)
- `.secrets.user.json` - Your custom secrets (preserved across regeneration)
- `.secrets.local.json` - Merged result used by docker-compose

### `generate-docker-compose`

Generate docker-compose.yml with injected secrets.

```bash
npx tsdevstack generate-docker-compose
```

### `generate-client`

Generate TypeScript API client from OpenAPI spec.

```bash
npx tsdevstack generate-client [service-name]
```

Creates a typed API client package in `packages/` that frontends can import.

### `validate-service`

Validate a service follows naming conventions and structure.

```bash
npx tsdevstack validate-service [service-name]
```

## Worker Commands

### `register-detached-worker`

Register a worker for separate container deployment.

```bash
npx tsdevstack register-detached-worker --name <worker-name> --base-service <service-name>
```

### `unregister-detached-worker`

Remove a detached worker registration.

```bash
npx tsdevstack unregister-detached-worker --worker <worker-name>
```

## Cloud Secrets Commands

### `cloud:init`

Initialize cloud secrets provider integration.

```bash
npx tsdevstack cloud:init --gcp    # or --aws, --azure
```

### `cloud-secrets:push`

Push local secrets to cloud environment.

```bash
npx tsdevstack cloud-secrets:push --env <environment>
```

### `cloud-secrets:diff`

Compare local and cloud secrets.

```bash
npx tsdevstack cloud-secrets:diff --env <environment>
```

### `cloud-secrets:set`

Set or update a secret in cloud.

```bash
npx tsdevstack cloud-secrets:set <key> [value] --env <environment>
```

### `cloud-secrets:get`

Get a secret value from cloud.

```bash
npx tsdevstack cloud-secrets:get <key> --env <environment>
```

### `cloud-secrets:list`

List all secrets in cloud environment.

```bash
npx tsdevstack cloud-secrets:list --env <environment>
```

### `cloud-secrets:remove`

Remove a secret from cloud.

```bash
npx tsdevstack cloud-secrets:remove <key> --env <environment>
```

## Infrastructure Commands

All infrastructure commands use the `infra:` prefix and require cloud credentials (except CI commands — see below).

**Note:** Environment names (e.g., `dev`, `staging`, `prod`) are user-defined based on your cloud credentials configuration. The framework does not enforce specific environment names.

### `infra:bootstrap`

Bootstrap GCP project (enable APIs, add roles to service account).

```bash
npx tsdevstack infra:bootstrap --env <environment>
```

### `infra:init`

Initialize infrastructure (creates Terraform state bucket).

```bash
npx tsdevstack infra:init --env <environment>
```

### `infra:generate`

Generate Terraform files.

```bash
npx tsdevstack infra:generate --env <environment>
```

### `infra:plan`

Show planned infrastructure changes.

```bash
npx tsdevstack infra:plan --env <environment>
```

### `infra:deploy`

Deploy full infrastructure: base + services + Kong + load balancer.

```bash
npx tsdevstack infra:deploy --env <environment>
```

### `infra:destroy`

Destroy infrastructure.

```bash
npx tsdevstack infra:destroy --env <environment>
```

### `infra:deploy-service`

Build, push, and deploy a single service.

```bash
npx tsdevstack infra:deploy-service [service-name] --env <environment>
```

### `infra:deploy-services`

Build, push, and deploy all services in parallel.

```bash
npx tsdevstack infra:deploy-services --env <environment>
```

### `infra:remove-service`

Remove a service from cloud (deletes Cloud Run, secrets, database, etc.).

```bash
npx tsdevstack infra:remove-service [service-name] --env <environment>
```

### `infra:deploy-kong`

Deploy Kong Gateway to Cloud Run.

```bash
npx tsdevstack infra:deploy-kong --env <environment>
```

### `infra:deploy-lb`

Deploy External HTTP(S) Load Balancer for Kong Gateway.

```bash
npx tsdevstack infra:deploy-lb --env <environment>
```

### `infra:deploy-env-auth`

Deploy environment access control (password protection for non-production environments).

```bash
npx tsdevstack infra:deploy-env-auth --env <environment>
```

### `infra:remove-env-auth`

Remove environment access control.

```bash
npx tsdevstack infra:remove-env-auth --env <environment>
```

### `infra:init-ci`

Initialize CI/CD (generates GitHub Actions workflows). No cloud credentials required.

```bash
npx tsdevstack infra:init-ci
npx tsdevstack infra:init-ci --envs dev,prod
```

**Options:**

| Option | Description |
|--------|-------------|
| `--github` | Use GitHub Actions (auto-selected if omitted) |
| `--envs <envs>` | Environments, comma-separated (prompted if omitted) |

### `infra:generate-ci`

Regenerate CI workflows from ci.json. No cloud credentials required.

```bash
npx tsdevstack infra:generate-ci
```

### `infra:status`

Check infrastructure configuration status.

```bash
npx tsdevstack infra:status --env <environment>
```

### `infra:list-deployed`

List all deployed services in an environment.

```bash
npx tsdevstack infra:list-deployed --env <environment>
```

### `infra:service-status`

Check cloud resource status for a specific service.

```bash
npx tsdevstack infra:service-status [service-name] --env <environment>
```

## Database Migration Commands

### `infra:plan-db-migrate`

Show pending database migrations for a service.

```bash
npx tsdevstack infra:plan-db-migrate --service <service-name> --env <environment>
```

The `--service` flag is required. It specifies which service's database to check.

### `infra:run-db-migrate`

Apply pending database migrations.

```bash
npx tsdevstack infra:run-db-migrate --service <service-name> --env <environment>
```

The `--service` flag is required. It specifies which service's database to migrate.

## Scheduled Jobs Commands

The scheduler commands work across all providers, but each provider uses a different underlying service:

| Provider | Scheduler Service |
|----------|-------------------|
| GCP | Cloud Scheduler |
| AWS | EventBridge Scheduler |
| Azure | Container Apps Jobs |

### `infra:deploy-scheduler`

Deploy a single scheduled job.

```bash
npx tsdevstack infra:deploy-scheduler --job <job-name> --env <environment>
```

### `infra:deploy-schedulers`

Deploy all scheduled jobs.

```bash
npx tsdevstack infra:deploy-schedulers --env <environment>
```

### `infra:list-schedulers`

List scheduled jobs and their deployment status.

```bash
npx tsdevstack infra:list-schedulers --env <environment>
```

### `infra:remove-scheduler`

Remove a scheduled job.

```bash
npx tsdevstack infra:remove-scheduler --job <job-name> --env <environment>
```

## Advanced Infrastructure Commands

These commands are typically called internally by higher-level commands but can be used directly for debugging or custom workflows.

### `infra:generate-docker`

Generate Dockerfiles for services.

```bash
npx tsdevstack infra:generate-docker --env <environment>
```

### `infra:build-docker`

Build Docker images with BuildKit.

```bash
npx tsdevstack infra:build-docker [service-name] --env <environment>
```

### `infra:push-docker`

Push Docker images to container registry.

```bash
npx tsdevstack infra:push-docker [service-name] --env <environment>
```

### `infra:generate-kong`

Generate Kong configuration for cloud deployment.

```bash
npx tsdevstack infra:generate-kong --env <environment>
```

### `infra:build-kong`

Build Kong Docker image.

```bash
npx tsdevstack infra:build-kong --env <environment>
```

### `infra:remove-detached-worker`

Remove orphaned detached workers from cloud.

```bash
npx tsdevstack infra:remove-detached-worker --worker <worker-name> --env <environment>
```

## Development npm Scripts

These npm scripts are available in your project root:

```bash
npm run dev          # Start all services with hot reload
npm run build        # Build all services
npm run test         # Run tests
npm run lint         # Run linting
npm run tsc          # Run TypeScript type checking
```

To stop services, press `Ctrl+C` in the terminal running `npm run dev`, or use `docker compose down` to stop containers.

