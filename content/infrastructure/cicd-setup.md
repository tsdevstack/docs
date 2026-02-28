# CI/CD Setup

Set up automated deployments using [GitHub Actions](https://github.com/features/actions).

## Overview

The CI/CD pipeline automates your deployment workflow:

1. **Quality checks** run on every pull request (build, lint, type-check, tests)
2. **Deployments** are triggered manually per environment

## Generating Workflows

### Initialize CI/CD

```bash
npx tsdevstack infra:init-ci
```

The command prompts for your cloud provider (if not already set in `config.json`) and target environments. You can also pass environments directly:

```bash
npx tsdevstack infra:init-ci --envs dev,prod
```

::: info No cloud credentials required
`infra:init-ci` and `infra:generate-ci` read your cloud provider from `.tsdevstack/config.json` and do not require local cloud credentials. This means you can set up CI/CD workflows without running `cloud:init` first.
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

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr.yml` | Pull request | Build, lint, type-check, tests |
| `deploy.yml` | Manual | Full deployment |
| `deploy-services.yml` | Manual | Deploy services only (with per-service selection) |
| `deploy-infra.yml` | Manual | Infrastructure (Terraform) only |
| `deploy-kong.yml` | Manual | Kong gateway only |
| `deploy-lb.yml` | Manual | Load balancer only (GCP only — AWS and Azure manage load balancing through `infra:deploy`) |
| `deploy-scheduled-jobs.yml` | Manual | Deploy scheduled jobs |
| `remove-service.yml` | Manual | Remove a service from cloud |
| `remove-detached-worker.yml` | Manual | Remove a detached worker |

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

| Provider | Secrets per environment | Example (dev) |
|----------|------------------------|---------------|
| GCP | Workload Identity Provider, Service Account, Region | `GCP_WIF_DEV`, `GCP_SA_DEV`, `GCP_REGION_DEV` |
| AWS | IAM Role ARN, Region | `AWS_ROLE_ARN_DEV`, `AWS_REGION_DEV` |
| Azure | Client ID, Tenant ID, Subscription ID, Location | `AZURE_CLIENT_ID_DEV`, `AZURE_TENANT_ID_DEV`, `AZURE_SUBSCRIPTION_ID_DEV`, `AZURE_LOCATION_DEV` |

For each environment, add the same set of secrets with the corresponding suffix (`_STAGING`, `_PROD`, etc.).

See the provider-specific setup guides for where to find these values:
- [GCP CI/CD](/infrastructure/providers/gcp/cicd) - Workload Identity Federation setup
- [AWS CI/CD](/infrastructure/providers/aws/cicd) - IAM role setup
- [Azure CI/CD](/infrastructure/providers/azure/cicd) - Federated credentials setup

## Secret Handling

### What You Need to Set

`cloud-secrets:push` handles most secrets automatically. You only need to provide **3 values** per environment:

| Secret | Example | Purpose |
|--------|---------|---------|
| `DOMAIN` | `example.com` | Base domain — API URL, CORS origins, and app URLs are derived from this |
| `RESEND_API_KEY` | `re_xxx` | Email delivery — see [Resend setup](/integrations/resend) |
| `EMAIL_FROM` | `noreply@example.com` | Sender address for transactional emails |

Everything else is either auto-generated (JWT keys, API keys, database passwords) or auto-derived from your domain (`API_URL`, `APP_URL`, `KONG_CORS_ORIGINS`). Infrastructure secrets (`DATABASE_URL`, `REDIS_*`) are synced from Terraform outputs during deployment.

### Pushing Secrets

```bash
npx tsdevstack cloud-secrets:push --env prod
```

The command generates framework secrets, prompts for the 3 values above, and pushes everything to your cloud provider's secret manager.

To set or override individual secrets:

```bash
npx tsdevstack cloud-secrets:set RESEND_API_KEY --value "re_xxx" --env prod
```

See [Cloud Secrets](/secrets/cloud-secrets) for the full reference.

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

