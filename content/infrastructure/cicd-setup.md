# CI/CD Setup

Set up automated deployments using [GitHub Actions](https://github.com/features/actions).

## Overview

The CI/CD pipeline automates your deployment workflow:

1. **Quality checks** run on every pull request (build, lint, type-check, tests)
2. **Deployments** are triggered manually per environment

## Prerequisites

### Set Your Cloud Provider

Before generating workflows, your project needs a cloud provider configured in `.tsdevstack/config.json`. There are two ways to do this:

**Option 1: Via `cloud:init`** (if you have local credentials set up)

```bash
npx tsdevstack cloud:init --<provider>   # gcp, aws, or azure
```

This validates credentials, registers resource providers, and sets the provider in `config.json`.

**Option 2: Manually** (CI-only setup, no local credentials needed)

Edit `.tsdevstack/config.json` and set the `cloud.provider` field:

```json
{
  "cloud": {
    "provider": "<provider>"
  }
}
```

Valid values: `"gcp"`, `"aws"`, `"azure"`.

### Cloud Account Setup

Each provider requires a cloud account with the right permissions before CI can deploy. Follow your provider's account setup guide:

- [Azure Account Setup](/infrastructure/providers/azure/account-setup) — App Registration, Resource Group, Permissions
- [GCP Account Setup](/infrastructure/providers/gcp/account-setup) — Project, Service Account
- [AWS Account Setup](/infrastructure/providers/aws/account-setup) — Account, IAM User

## Generating Workflows

### Initialize CI/CD

```bash
npx tsdevstack infra:init-ci
```

The command reads your cloud provider from `config.json` and prompts for target environments. You can also pass environments directly:

```bash
npx tsdevstack infra:init-ci --envs dev,prod
```

::: info No cloud credentials required
`infra:init-ci` and `infra:generate-ci` only need the cloud provider set in `config.json`. No local cloud credentials (`.credentials.*.json`) are required. This means you can generate CI workflows without running `cloud:init`.
:::

This command:

- Creates `.tsdevstack/ci.json` configuration
- Generates workflow files in `.github/workflows/`
- Generates `infrastructure.schema.json` for your provider
- Prints setup instructions for your cloud provider

### Configuration

The generated `.tsdevstack/ci.json`:

```json
{
  "provider": "github",
  "environments": ["dev", "prod"]
}
```

### Regenerate After Changes

After modifying `ci.json` (e.g., adding environments):

```bash
npx tsdevstack infra:generate-ci
```

## Generated Workflows

| Workflow                     | Trigger      | Purpose                                                                                    |
| ---------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| `pr.yml`                     | Pull request | Build, lint, type-check, tests                                                             |
| `deploy.yml`                 | Manual       | Full deployment                                                                            |
| `deploy-services.yml`        | Manual       | Deploy services only (with per-service selection)                                          |
| `deploy-infra.yml`           | Manual       | Infrastructure (Terraform) only                                                            |
| `deploy-kong.yml`            | Manual       | Kong gateway only                                                                          |
| `deploy-lb.yml`              | Manual       | Load balancer only (GCP only — AWS and Azure manage load balancing through `infra:deploy`) |
| `deploy-scheduled-jobs.yml`  | Manual       | Deploy scheduled jobs                                                                      |
| `remove-service.yml`         | Manual       | Remove a service from cloud                                                                |
| `remove-detached-worker.yml` | Manual       | Remove a detached worker                                                                   |

## Running Deployments

1. Go to **Actions** in your GitHub repository
2. Select the workflow (e.g., **Deploy**)
3. Click **Run workflow**
4. Select the target environment
5. Fill in additional options (varies by workflow):
   - **Tag** - image tag (defaults to commit SHA)
   - **Service checkboxes** - select which services to deploy (deploy-services)
   - **Service name** - name of service/worker to remove (remove workflows)
   - **Dry run** - preview what would be deleted without deleting
6. Click **Run workflow**

## GitHub Secrets

Workflows need secrets to authenticate with your cloud provider. Add these as **repository secrets** in **Settings > Secrets and variables > Actions**.

Secrets are **environment-prefixed**: each secret name ends with the environment in uppercase (e.g., `_DEV`, `_STAGING`, `_PROD`). Workflows dynamically look up the right secret based on the selected environment.

| Provider | Secrets per environment                             | Example (dev)                                                                                   |
| -------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GCP      | Workload Identity Provider, Service Account, Region | `GCP_WIF_DEV`, `GCP_SA_DEV`, `GCP_REGION_DEV`                                                   |
| AWS      | IAM Role ARN, Region                                | `AWS_ROLE_ARN_DEV`, `AWS_REGION_DEV`                                                            |
| Azure    | Client ID, Tenant ID, Subscription ID, Location     | `AZURE_CLIENT_ID_DEV`, `AZURE_TENANT_ID_DEV`, `AZURE_SUBSCRIPTION_ID_DEV`, `AZURE_LOCATION_DEV` |

For each environment, add the same set of secrets with the corresponding suffix (`_STAGING`, `_PROD`, etc.).

See the provider-specific setup guides for where to find these values:

- [GCP CI/CD](/infrastructure/providers/gcp/cicd) - Workload Identity Federation setup
- [AWS CI/CD](/infrastructure/providers/aws/cicd) - IAM role setup
- [Azure CI/CD](/infrastructure/providers/azure/cicd) - Federated credentials setup

## Private npm packages

If your project depends on private npm packages (private GitHub Packages, private scoped packages on `registry.npmjs.org`, internal company registries), tsdevstack auto-wires `NPM_TOKEN` through both local docker builds and CI workflows.

**Trigger:** presence of an `.npmrc` file at the project root with `${NPM_TOKEN}`-style env-var interpolation:

```
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

::: info Commit `.npmrc` — it has no secrets
The file contains **no actual secret** — `${NPM_TOKEN}` is an env-var reference; npm interpolates from the environment at install time. Committing the template is the standard npm-ecosystem pattern, and **required for CI** (CI runners only see committed files).

If your `.gitignore` blanket-excludes `**/.npmrc`, add an exception so the project-root template is tracked:

```
**/.npmrc
!/.npmrc
```

The blanket-ignore is a defensive default that catches `npm login`-generated files containing *real* tokens. A hand-written template with `${NPM_TOKEN}` interpolation is safe to commit.
:::

### Setup

1. **Create `.npmrc`** at the project root and commit it. Add lines for any additional private registries you use.

2. **Locally** — export `NPM_TOKEN` in your shell:

   ```bash
   export NPM_TOKEN=<your-token>
   ```

   Or persist it in `~/.zshrc` / `~/.bashrc`. `npx tsdevstack infra:build-docker` and `infra:deploy` automatically forward it as a BuildKit env-source secret.

3. **In CI** — add `NPM_TOKEN` as a single GitHub repository secret (Settings → Secrets and variables → Actions). **Single value, not per-environment** — registry tokens identify your developer / org account, not a deployment target.

4. **Regenerate** workflows so the `NPM_TOKEN` env block lands in the generated YAML:

   ```bash
   npx tsdevstack infra:generate-ci
   npx tsdevstack infra:generate-docker
   ```

### How it threads through

| Layer                     | Mechanism                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| **Generated Dockerfiles** | `COPY .npmrc ./` in deps stage + `--mount=type=secret,id=npm_token,env=NPM_TOKEN` on the `npm ci` line |
| **`infra:build-docker`**  | Adds `--secret id=npm_token,env=NPM_TOKEN` to the `docker build` argv (BuildKit reads from process env) |
| **CI workflows**          | Job-level `env: { NPM_TOKEN: ${{ secrets.NPM_TOKEN }} }` cascades to every step                    |

### Security properties

- `NPM_TOKEN` is mounted only during the `npm ci` `RUN` step — **never** persisted in image layers, never visible in `docker history`.
- The `.npmrc` lives only in the `deps` and `build` intermediate stages; the `production` stage starts fresh and does not COPY it across, so the final shipped image is clean.
- The `.npmrc` content itself is just `${NPM_TOKEN}` template (no real secret), so even cache layers pushed to a registry leak nothing sensitive.
- If `.npmrc` is present but `NPM_TOKEN` is unset, BuildKit fails fast with a clear error — misconfiguration is loud.
- If `.npmrc` is absent, generated workflows and Dockerfiles emit no `NPM_TOKEN` wiring at all (behavior identical to public-only projects).

### Verification

After regeneration, inspect any generated `.github/workflows/*.yml` — you should see the `env:` block at the job level (sibling of `permissions:` and `steps:`):

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    env:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
    steps:
      …
```

And in `infrastructure/docker/<service>.Dockerfile`:

```dockerfile
COPY package.json package-lock.json .npmrc ./
…
RUN --mount=type=cache,target=/root/.npm --mount=type=secret,id=npm_token,env=NPM_TOKEN npm ci
```

## User Secrets

Before the first deployment, you need to create user secrets in your cloud provider's secret manager. Each provider's CI/CD guide covers which secrets are required and how to create them:

- [AWS CI/CD — User Secrets](/infrastructure/providers/aws/cicd#user-secrets-required-before-first-deployment)
- [GCP CI/CD — User Secrets](/infrastructure/providers/gcp/cicd#user-secrets-required-before-first-deployment)
- [Azure CI/CD — User Secrets](/infrastructure/providers/azure/cicd#user-secrets-required-before-first-deployment)

## Adding a New Environment

1. Create the cloud project/account for the new environment
2. Add credentials with `npx tsdevstack cloud:init`
3. Update `.tsdevstack/ci.json`:
   ```json
   {
     "environments": ["dev", "staging", "prod"]
   }
   ```
4. Regenerate workflows: `npx tsdevstack infra:generate-ci`
5. Add GitHub secrets for the new environment (provider-specific)
6. Push secrets: `npx tsdevstack cloud-secrets:push --env staging`
7. Deploy: `npx tsdevstack infra:deploy --env staging`

## Command Reference

```bash
# Full deployment
npx tsdevstack infra:deploy --env prod

# Infrastructure only (Terraform, no services)
npx tsdevstack infra:deploy --env prod --infra-only

# Services only
npx tsdevstack infra:deploy-services --env prod

# Kong gateway
npx tsdevstack infra:deploy-kong --env prod

# Load balancer
npx tsdevstack infra:deploy-lb --env prod

# Destroy environment
npx tsdevstack infra:destroy --env prod
```
