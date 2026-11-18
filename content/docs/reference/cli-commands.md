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

Removes the service directory and updates `.tsdevstack/config.json`. If no service name is provided, prompts for selection. To remove it from the cloud too, run `infra:remove-service`, then `infra:deploy`, in each environment it ran in.

### `generate-kong`

Generate Kong gateway configuration from OpenAPI specs.

```bash
npx tsdevstack generate-kong
```

Generates `kong.tsdevstack.yml` with exact routes derived from your service OpenAPI specifications, merges it with `kong.user.yml` into `kong.yml`, and writes the gateway image build context in `infrastructure/kong/` (generated `Dockerfile`, `.dockerignore`, and a staged copy of the framework plugins and your `kong-plugins/`). Rebuild the gateway afterwards with `docker compose up -d --build gateway`, or use `sync`, which does both. See [Kong Plugins](/docs/customization/kong-plugins).

Partner services get the API key check and the per-IP ceiling (`framework.apiKeys.ipLimitPerMinute` in `.tsdevstack/config.json`); the default key limits are copied from the global `rate-limiting` in `kong.user.yml`. It warns about `consumers` with `keyauth_credentials` in `kong.user.yml`, which no longer work. See [API Keys](/docs/authentication/api-keys).

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

It adds the worker to `config.json` and creates whichever of the base service's `src/worker.ts`, `src/worker.module.ts` and `tsconfig.worker.json` are missing, plus the `start-worker` and `start-worker:dev` scripts. It never overwrites a file or a script, and lists what it created and what it left alone.

### `unregister-detached-worker`

Remove a detached worker registration.

```bash
npx tsdevstack unregister-detached-worker --worker <worker-name>
```

It only changes `config.json`. The worker's files and scripts stay; delete them yourself if you no longer need them.

## Storage Commands

### `add-bucket-storage`

Add an object storage bucket to the project.

```bash
npx tsdevstack add-bucket-storage --name <name>
```

**What it does:**

- Adds bucket to `storage.buckets` in `config.json`
- Regenerates `docker-compose.yml` with RustFS (the first bucket adds the `rustfs` and `rustfs-init` services)
- Regenerates secrets with `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET_{NAME}`

**Options:**

| Option | Description |
|--------|-------------|
| `--name <name>` | Bucket logical name (kebab-case, 2-30 chars). Prompted if omitted. |

**Example:**

```bash
npx tsdevstack add-bucket-storage --name uploads
npx tsdevstack add-bucket-storage --name media-assets
```

After adding, run `docker compose up -d` to start RustFS. Console at http://localhost:9001 (rustfsadmin/rustfsadmin).

### `remove-bucket-storage`

Remove a storage bucket from the project.

```bash
npx tsdevstack remove-bucket-storage [--name <name>]
```

Removes the bucket from `config.json` and regenerates docker-compose and secrets. If no name is provided, prompts for selection. Does **not** delete local RustFS data or cloud resources.

**Options:**

| Option | Description |
|--------|-------------|
| `--name <name>` | Bucket name to remove. Prompted if omitted. |
| `--force` | Skip confirmation prompt. |

## Messaging Commands

### `add-messaging-topic`

Add an async messaging topic to the project.

```bash
npx tsdevstack add-messaging-topic --name <name> --publishers <services> --subscribers <services>
```

**What it does:**

- Adds topic to `messaging.topics` in `config.json`
- Validates name (kebab-case, no duplicates)
- Validates publisher/subscriber service names exist and are NestJS type
- Runs `sync`

**Options:**

| Option | Description |
|--------|-------------|
| `--name <name>` | Topic name (kebab-case). Prompted if omitted. |
| `--publishers <services>` | Comma-separated publishing services. Prompted if omitted. |
| `--subscribers <services>` | Comma-separated subscribing services. Prompted if omitted. |

**Example:**

```bash
npx tsdevstack add-messaging-topic --name user-created --publishers auth-service --subscribers offers-service,notifications-service
```

### `remove-messaging-topic`

Remove a messaging topic from the project.

```bash
npx tsdevstack remove-messaging-topic [--name <name>]
```

Removes the topic from `config.json` and runs `sync`. Does not delete stream data in Redis.

**Options:**

| Option | Description |
|--------|-------------|
| `--name <name>` | Topic name to remove. Prompted if omitted. |

### `update-messaging-topic`

Update publishers and subscribers for an existing topic.

```bash
npx tsdevstack update-messaging-topic --name <name> --publishers <services> --subscribers <services>
```

**Options:**

| Option | Description |
|--------|-------------|
| `--name <name>` | Existing topic name. Prompted if omitted. |
| `--publishers <services>` | Comma-separated list (**replaces** current list entirely). Prompted if omitted. |
| `--subscribers <services>` | Comma-separated list (**replaces** current list entirely). Prompted if omitted. |

:::warning
`--publishers` and `--subscribers` use **replace semantics** — always pass the complete desired list, not just additions.
:::

## Cloud Secrets Commands

### `cloud:init`

Initialize cloud secrets provider integration.

```bash
npx tsdevstack cloud:init --gcp    # or --aws, --azure
```

### `cloud-secrets:push`

Generate fresh framework secrets and push them, with your user secrets, to a cloud environment.

```bash
npx tsdevstack cloud-secrets:push --env <environment> [--skip-user-secrets]
```

`--skip-user-secrets` runs without prompts (CI, AI agents): it pushes the framework secrets and lists the user secrets still missing in the cloud.

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

Without a value, it prompts, masked for credentials. In scripts, pipe the value in with `--stdin`. It stays out of the process list and your shell history:

```bash
printf '%s' "$STRIPE_KEY" | npx tsdevstack cloud-secrets:set STRIPE_KEY --stdin --env prod
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

### `cloud-secrets:migrate`

Copy secrets from where earlier versions kept them to where services read them now. The auth secrets move from shared to the auth service's scope. On Azure, each service's secrets move from the shared vault to its own. It never deletes or overwrites, so you can run it again. Run it before `infra:deploy` when you upgrade an existing environment.

```bash
npx tsdevstack cloud-secrets:migrate --env <environment>
```

### `cloud-secrets:cleanup`

Delete the old copies after `infra:deploy`. Copies whose new copy has the same value are deleted after one question, which `--force` skips. A copy whose new copy has a different value is deleted only after a second question, never with `--force`. On Azure, it runs once every service is on the new deploy.

```bash
npx tsdevstack cloud-secrets:cleanup --env <environment> [--force]
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

With the auth template, it warns when the environment's `scheduledJobs` lack the `sync-api-key-usage` job and prints the entry to add. See [API Keys](/docs/authentication/api-keys#the-usage-job).

On GCP it reads the environment's Terraform state from the state bucket first, so an environment keeps the names it was deployed with ([names](/docs/infrastructure/providers/gcp/architecture#compute-cloud-run)). The credentials need read access to that bucket, as for every other infra command.

### `infra:plan`

Show planned infrastructure changes.

```bash
npx tsdevstack infra:plan --env <environment>
```

A new CLI version can pin newer Terraform providers than the ones in an environment's lock file (`.terraform.lock.hcl`). Every command that runs Terraform then stops and asks for this step:

```bash
npx tsdevstack infra:plan --env <environment> --upgrade
```

It upgrades the providers and shows the plan. Nothing is applied. If the plan looks right, commit the updated lock file and run `infra:deploy`. CI uses the committed lock file.

### `infra:deploy`

Deploy full infrastructure: base + services + Kong + load balancer.

```bash
npx tsdevstack infra:deploy --env <environment>
```

If the provider has no capacity for a size you asked for (a database or Redis size in your region), the deploy waits 5 minutes and tries again, up to 3 times. This is a shortage on the provider's side, not a quota or configuration error. If it still fails, run the command again later; it continues where it stopped. Or pick another `database.tier` or `redis.tier` in `infrastructure.json`.

Images are tagged with the current commit, so commit before you deploy a change. Then the tag tells you which code runs. Every deploy starts new instances of each service, even with the same tag, so they read the current secrets. With uncommitted changes outside `infrastructure/` and `.tsdevstack/`, the deploy warns you. `--tag <tag>` uses a tag of your choice instead. The other build and deploy commands take it too.

At the end, it prints the link to the environment's dashboard in the cloud's console. See [Traces and Dashboards](/docs/features/traces-and-dashboards#dashboards).

### `infra:destroy`

Destroy infrastructure.

```bash
npx tsdevstack infra:destroy --env <environment>
```

On GCP, Google frees the network of the deleted services and database only after a while (up to 2 hours). If destroy stops with "Google has not released the network yet", run it again later. It removes what is left, and nothing left behind is billed.

On Azure, the DNS zone is deleted with the environment, with every record in it. Before it asks to go ahead, destroy lists the records the framework didn't make (Resend's email records, for example) and the command that saves a copy of the zone. A later deploy creates a new zone, maybe on other name servers, so check them at your registrar.

### `infra:deploy-service`

Build, push, and deploy a single service.

```bash
npx tsdevstack infra:deploy-service [service-name] --env <environment>
```

For an SPA, files from earlier builds stay in the bucket for a day after their last upload. A visitor who still has the old version open can keep loading its pages. A later deploy deletes them.

### `infra:deploy-services`

Build, push, and deploy all services in parallel.

```bash
npx tsdevstack infra:deploy-services --env <environment>
```

### `infra:remove-service`

Remove a service from one environment in the cloud: its containers, workers, database, migration job, SPA bucket, secrets and logs. On AWS it also deletes the service's own CloudFront distribution (SPA or Next.js), which CloudFront takes several minutes to disable before it can be deleted.

If the service subscribes to messaging topics, remove its subscriptions, deploy it and let it run for 15 minutes first: it then deletes its consumer groups in Redis. A group left behind stops the deleting of read messages on its topic. See [How long messages stay in Redis](/docs/features/async-messaging#how-long-messages-stay-in-redis).

```bash
npx tsdevstack infra:remove-service [service-name] --env <environment>
```

Then take the service out of the project with `remove-service`, and run `infra:deploy` for the environment. The deploy removes the service's Kong routes, its load balancer routes and the scheduled jobs that call it. Until then, its routes and its domain stop working, and those jobs fail. The deploy also gives the other services the removed service's share of database connections: pool sizes are worked out at deploy (see [Pool sizing](/docs/packages/nest-common#pool-sizing)), so until then they keep their smaller pools.

Before it drops the database, the command saves it to the environment's bucket of saved databases, where the file stays 7 days. `infra:restore-database` brings it back. If the save fails twice, a terminal asks whether to stop (the default), try again or remove the service without saving. CI and `--confirm` stop. See [Data of a removed service](/docs/infrastructure/service-configuration#data-of-a-removed-service).

**Options:**

| Option | Description |
|--------|-------------|
| `--env <environment>` | Target environment |
| `--confirm` | Skip the prompts (required in CI) |
| `--dry-run` | Show what would be deleted, delete nothing |
| `--skip-export` | Drop the database without saving it first |

### `infra:restore-database`

Replace a service's database with a file `infra:remove-service` saved. Run it once the service is deployed again: `cloud-secrets:push`, then `infra:deploy`.

```bash
npx tsdevstack infra:restore-database [service-name] --env <environment>
```

Without a service name, a terminal lists the services that have saved files. CI needs the name.

It saves the database's current contents first, so a restore can be undone by restoring that file. By default it takes the newest file from a removal. In a terminal it lists the service's files to pick from. The service gets database errors while it runs. If the service's migrations are newer than the file, run `infra:run-db-migrate` afterwards.

**Options:**

| Option | Description |
|--------|-------------|
| `--env <environment>` | Target environment |
| `--file <name>` | The saved file, for example `auth-service/2026-11-14T12-30-00Z-removed.dump` |
| `--confirm` | Skip the confirmation (required in CI) |

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

::: info Auto-detected `NPM_TOKEN`
If your project root has an `.npmrc`, generated workflows automatically include a job-level `env: NPM_TOKEN: ${{ secrets.NPM_TOKEN }}` block (single global secret, not per-env) so private npm packages can be installed in CI. See [CI/CD Setup — Private npm packages](/docs/infrastructure/cicd-setup#private-npm-packages).
:::

### `infra:generate-ci`

Regenerate CI workflows from ci.json. No cloud credentials required.

```bash
npx tsdevstack infra:generate-ci
```

::: info Auto-detected `NPM_TOKEN`
Like `init-ci`, this re-emits the `NPM_TOKEN` env block into every workflow if `.npmrc` exists at the project root. Re-run after creating an `.npmrc` to wire private-registry auth through the workflows.
:::

### `infra:status`

Check that `infrastructure.json` is valid for your cloud provider, and list the environments it overrides.

```bash
npx tsdevstack infra:status
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

### `infra:logs`

Read the logs of a deployed environment: services, workers, frontends, Kong, migration runs, scheduled jobs and the edge (load balancer and WAF). Without a source, it lists the sources and when each one last logged.

```bash
npx tsdevstack infra:logs --env <environment>
npx tsdevstack infra:logs [source] --env <environment>
npx tsdevstack infra:logs --all --env <environment> --since 2h --level error
npx tsdevstack infra:logs [source] --env <environment> --follow
```

**Options:**

| Option | Description |
|--------|-------------|
| `--all` | Read every source in one timeline |
| `--since <time>` | Start of the window: `30m`, `1h` (default), `2d` or a UTC time |
| `--until <time>` | End of the window (default: now) |
| `--level <level>` | This level and above: `debug`, `info`, `warn`, `error`, `fatal`. Leaves out lines without a level |
| `--kind <kind>` | Only `app`, `platform` or `edge` lines |
| `--grep <text>` | Lines that contain this text, in any case |
| `--json` | One JSON object per line |
| `--follow` | Print new lines as they are written, until Ctrl+C. Stops after 1 hour. Not with `--since` or `--until` |
| `--no-time-limit` | With `--follow`: keep going until Ctrl+C |

It prints every line of the window, oldest first, in UTC. See [Cloud Logs](/docs/features/cloud-logs).

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

::: info Auto-detected private-registry auth
If `.npmrc` exists at the project root, generated Dockerfiles include `.npmrc` in the deps-stage `COPY` and emit a BuildKit env-source secret mount on `npm ci` (`--mount=type=secret,id=npm_token,env=NPM_TOKEN`). See [CI/CD Setup — Private npm packages](/docs/infrastructure/cicd-setup#private-npm-packages).
:::

### `infra:build-docker`

Build Docker images with BuildKit.

```bash
npx tsdevstack infra:build-docker [service-name] --env <environment>
```

::: info Auto-detected `NPM_TOKEN`
If `.npmrc` exists at the project root, the docker build invocation appends `--secret id=npm_token,env=NPM_TOKEN` automatically. Make sure `NPM_TOKEN` is exported in your shell (`export NPM_TOKEN=…` or `~/.zshrc`) before running.
:::

### `infra:push-docker`

Push Docker images to container registry.

```bash
npx tsdevstack infra:push-docker [service-name] --env <environment>
```

### `infra:generate-kong`

Generate Kong configuration for cloud deployment (`infrastructure/kong/{env}/kong.yml`, with secret placeholders; commit it).

```bash
npx tsdevstack infra:generate-kong --env <environment>
```

### `infra:build-kong`

Build and push the Kong Docker image for an environment. It uses the same image definition as locally, with the framework plugins, your `kong-plugins/` and the resolved config baked in. The Redis password, the trust token and the frontend token are not in it. The config refers to them, and Kong reads them from its environment when it starts. Deploy it with `infra:deploy-kong`.

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

