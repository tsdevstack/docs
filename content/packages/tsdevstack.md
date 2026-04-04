# tsdevstack (CLI)

`tsdevstack` is the command-line interface for the framework. It handles project scaffolding, local development config generation, cloud secret management, infrastructure deployment, database migrations, scheduled jobs, and CI/CD — across GCP, AWS, and Azure.

```bash
npm install tsdevstack
```

Shorthand alias: `npx tsds <command>` works anywhere `npx tsdevstack <command>` does.

## What it does

The CLI is the single entry point for all framework operations. You never write Terraform, configure Docker Compose, or manage gateway routes manually — the CLI generates and deploys everything from your service definitions.

| Area | What the CLI handles |
|------|---------------------|
| Local dev | Docker Compose, Kong gateway config, secrets, Dockerfiles |
| Services | Add/remove NestJS backends, Next.js frontends, Rsbuild SPAs |
| Storage | Add/remove object storage buckets (MinIO locally, cloud-native in production) |
| Secrets | Local generation, cloud push/pull/diff with environment isolation |
| Infrastructure | Terraform generation, planning, and deployment |
| Deployment | Build Docker images, push to registry, deploy services, Kong, load balancer |
| Database | Preview and apply Prisma migrations in cloud |
| Scheduled jobs | Deploy, list, and remove cron-based jobs |
| Workers | Register and deploy detached background workers |
| CI/CD | Generate GitHub Actions workflows |
| Client generation | Type-safe HTTP clients from OpenAPI specs |

## Commands

For the full command reference with syntax, options, and examples, see [CLI Commands](/reference/cli-commands).

### Local development

| Command | Description |
|---------|-------------|
| `sync` | Regenerate all config (Kong, docker-compose, secrets) |
| `add-service` | Add a NestJS, Next.js, or SPA service |
| `remove-service` | Remove a service from the project |
| `generate-kong` | Regenerate Kong gateway config from OpenAPI specs |
| `generate-secrets` | Regenerate local secrets |
| `generate-docker-compose` | Regenerate docker-compose.yml |
| `generate-client` | Generate TypeScript API client from OpenAPI spec |
| `add-bucket-storage` | Add an object storage bucket |
| `remove-bucket-storage` | Remove an object storage bucket |

### Cloud secrets

| Command | Description |
|---------|-------------|
| `cloud:init` | Initialize cloud provider (GCP, AWS, or Azure) |
| `cloud-secrets:push` | Push local secrets to cloud environment |
| `cloud-secrets:diff` | Compare local vs cloud secrets |
| `cloud-secrets:set` | Set or update a cloud secret |
| `cloud-secrets:list` | List all secrets in cloud environment |
| `cloud-secrets:remove` | Remove a cloud secret |

### Infrastructure & deployment

| Command | Description |
|---------|-------------|
| `infra:bootstrap` | Bootstrap cloud project (enable APIs, add roles) |
| `infra:init` | Initialize infrastructure (Terraform state bucket) |
| `infra:generate` | Generate Terraform files from config |
| `infra:plan` | Preview infrastructure changes |
| `infra:deploy` | Full deploy: Terraform + services + Kong + load balancer |
| `infra:deploy-service` | Build, push, and deploy a single service |
| `infra:deploy-services` | Build, push, and deploy all services |
| `infra:deploy-kong` | Deploy Kong gateway |
| `infra:deploy-lb` | Deploy load balancer |
| `infra:status` | Check infrastructure status |
| `infra:destroy` | Destroy all infrastructure for an environment |

### Database & scheduling

| Command | Description |
|---------|-------------|
| `infra:plan-db-migrate` | Show pending migrations for a service |
| `infra:run-db-migrate` | Apply pending migrations |
| `infra:deploy-schedulers` | Deploy all scheduled jobs |
| `infra:remove-scheduler` | Remove a scheduled job |

### CI/CD

| Command | Description |
|---------|-------------|
| `infra:init-ci` | Initialize CI/CD (GitHub Actions) |
| `infra:generate-ci` | Regenerate CI workflows |

## Multi-cloud support

The same commands work across all three providers:

```bash
# These work identically regardless of provider
npx tsdevstack infra:deploy --env prod
npx tsdevstack cloud-secrets:push --env prod
npx tsdevstack infra:deploy-service auth-service --env prod
```

The provider is determined by your `cloud:init` configuration. No command-line flags needed.
