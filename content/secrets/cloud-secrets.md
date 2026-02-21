# Cloud Secrets

In production, tsdevstack integrates with cloud secret managers instead of using local files. Your code uses the same `SecretsService` interface, but secrets are fetched from your cloud provider.

## Supported Providers

tsdevstack supports three cloud secret managers:

- **Google Cloud Platform** - [Google Cloud Secret Manager](https://cloud.google.com/secret-manager)
- **AWS** - [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- **Azure** - [Azure Key Vault](https://azure.microsoft.com/en-us/products/key-vault)

## How Cloud Secrets Work

When your services run in the cloud:

1. The `SECRETS_PROVIDER` environment variable is set to `gcp`, `aws`, or `azure`
2. `SecretsService` detects this and fetches secrets from the cloud provider
3. Secrets are cached for performance (5-minute cache)
4. Your code works exactly as it does locally

```typescript
// This works the same locally and in production
const apiKey = await this.secrets.get('API_KEY');
```

## Setting Up Cloud Secrets

### 1. Initialize Your Cloud Provider

```bash
# For GCP
npx tsdevstack cloud:init --gcp

# For AWS
npx tsdevstack cloud:init --aws

# For Azure
npx tsdevstack cloud:init --azure
```

This command verifies your credentials, enables necessary APIs, and creates required resources.

### 2. Push Secrets to Cloud

```bash
npx tsdevstack cloud-secrets:push --env staging
```

This command:

- Generates and pushes framework secrets automatically (JWT keys, API keys, token TTLs, email provider)
- Prompts you for **3 values**: `DOMAIN`, `RESEND_API_KEY`, and `EMAIL_FROM`. [Resend](https://resend.com) is an email delivery service used for transactional emails (account confirmation, password reset)
- **Includes your custom secrets** from `.secrets.user.json` — prompts you for each one interactively (you can skip any by leaving the value empty)
- Auto-derives the rest from your domain: `API_URL`, `APP_URL`, `KONG_CORS_ORIGINS`
- Skips infrastructure secrets (`DATABASE_URL`, `REDIS_*`) — these are synced from Terraform outputs during deployment

Custom secrets are pushed to the **shared scope** (available to all services). If a secret already exists in cloud, you won't be prompted again.

**Important**: Cloud secrets are generated fresh and never copied from local development. This ensures production uses unique, secure values.

> You can also set secrets directly in your cloud provider's console (GCP Secret Manager, AWS Secrets Manager, Azure Key Vault). The CLI provides convenience — it's not the only way.

### 3. Deploy Your Services

```bash
npx tsdevstack infra:deploy --env staging
```

This deploys infrastructure (databases, VPCs, etc.) and all services. Service URLs are automatically synced to the secret manager after deployment.

## Environment Isolation

Each environment (dev, staging, prod) must use separate cloud resources:

| Provider | Isolation Method |
|----------|-----------------|
| GCP | Separate Project per environment |
| AWS | Separate Account per environment |
| Azure | Separate Subscription per environment |

The framework validates this and will fail if you try to reuse credentials across environments.

## Managing Cloud Secrets

### List All Secrets

```bash
npx tsdevstack cloud-secrets:list --env staging
```

### Set a Single Secret

```bash
npx tsdevstack cloud-secrets:set STRIPE_KEY --env staging --value sk_live_xxx
```

### Compare Local vs Cloud

```bash
npx tsdevstack cloud-secrets:diff --env staging
```

### Remove a Secret

```bash
npx tsdevstack cloud-secrets:remove OLD_KEY --env staging
```

## Secret Naming in Cloud

Secrets are stored with a naming convention:

```
{projectName}-{scope}-{KEY}
```

Examples:
- `myapp-shared-STRIPE_KEY` - Shared across all services
- `myapp-auth-service-DATABASE_URL` - Specific to auth-service

### Scopes

- **shared** - Available to all services (most secrets)
- **{service-name}** - Service-specific secrets (primarily DATABASE_URL)

When a service requests a secret, tsdevstack checks the service scope first, then falls back to shared.

### Azure Key Vault Naming

Azure Key Vault only allows alphanumeric characters and hyphens. tsdevstack automatically transforms secret names:

- `DATABASE_URL` becomes `DATABASE-URL`
- `JWT_PRIVATE_KEY` becomes `JWT-PRIVATE-KEY`

This happens transparently. Your code still uses underscores.

Full secret names in Azure Key Vault:
- `myapp-shared-STRIPE-KEY` (not `STRIPE_KEY`)
- `myapp-auth-service-DATABASE-URL` (not `DATABASE_URL`)

## Service URLs

Service URLs are automatically managed using deterministic internal URLs:

| Provider | URL Format | Example |
|----------|-----------|---------|
| GCP | `https://{service}-{projectNumber}.{region}.run.app` | `https://auth-service-123456.us-central1.run.app` |
| AWS | `http://{service}.{project}.local:8080` | `http://auth-service.myapp.local:8080` |
| Azure | `http://{project}-{service}` | `http://myapp-auth-service` |

During `infra:deploy`, service URLs are synced to the secret store **before** any containers start. This means all services can discover each other on the first deploy — no ordering, no restarts, no placeholders.

You never need to set `*_URL` secrets manually.

## Runtime Configuration

For services running in the cloud, these environment variables are required:

| Variable | Description |
|----------|-------------|
| `SECRETS_PROVIDER` | Set to `gcp`, `aws`, or `azure` |
| `PROJECT_NAME` | Your tsdevstack project name |
| `GCP_PROJECT_ID` | (GCP only) The GCP project ID |

These are automatically configured during deployment.

## Best Practices

1. **Never copy local secrets to production** - Always use `cloud-secrets:push` to generate fresh values
2. **Use separate environments** - Keep dev, staging, and prod completely isolated
3. **Rotate credentials regularly** - Use `cloud-secrets:set --overwrite` to update secrets
4. **Monitor access** - Use your cloud provider's audit logs to track secret access
5. **Verify before deployment** - Run `cloud-secrets:diff` to check secrets are in sync
