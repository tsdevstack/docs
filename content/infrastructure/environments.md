# Environments

tsdevstack supports multiple deployment environments. Each environment is completely isolated with its own cloud project/account.

## Specifying the Environment

### CLI Commands

All cloud commands accept the `--env` flag:

```bash
npx tsdevstack infra:deploy --env dev
npx tsdevstack cloud-secrets:push --env prod
npx tsdevstack cloud-secrets:list --env staging
```

### CI/CD Workflows

All workflows accept an environment input.

Environments are configured in `.tsdevstack/ci.json`:

```json
{
  "provider": "github",
  "environments": ["dev", "prod"]
}
```

## Environment Isolation

Each environment must use a separate cloud project/account:

| Provider | Isolation |
|----------|-----------|
| GCP | Separate Project |
| AWS | Separate Account |
| Azure | Separate Subscription |

The framework validates credentials and rejects deployments if the same project/account is used for multiple environments.

### Why Separate?

- **Security** - Production credentials cannot affect dev
- **Billing** - Clear cost attribution
- **IAM** - Separate permission boundaries
- **Quotas** - Environments don't compete for limits
- **Certificates** - SSL certificates are environment-specific

## Adding a New Environment

1. **Create the cloud project/account** for the new environment

2. **Add credentials**:
```bash
npx tsdevstack cloud:init --gcp
# Follow prompts to configure credentials for the new environment
```

3. **Update CI configuration**:
```json
{
  "provider": "github",
  "environments": ["dev", "staging", "prod"]
}
```

4. **Regenerate workflows**:
```bash
npx tsdevstack infra:generate-ci
```

5. **Add GitHub secrets** for CI (environment name in uppercase):
   - `GCP_WIF_STAGING`
   - `GCP_SA_STAGING`
   - `GCP_REGION_STAGING`

6. **Push secrets**:
```bash
npx tsdevstack cloud-secrets:push --env staging
```

7. **Deploy**:
```bash
npx tsdevstack infra:deploy --env staging
```

## Local Development

Local development does not use environments. It uses:

- `.secrets.local.json` for secrets
- `docker-compose.yml` for infrastructure
- Services run natively via npm

```bash
npx tsdevstack sync
npm run dev
```

