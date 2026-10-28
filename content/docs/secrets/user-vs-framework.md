# User vs Framework Secrets

tsdevstack manages two categories of secrets: those the framework generates automatically, and those you provide. Understanding the difference helps you know what to configure and what to leave alone.

## Framework-Managed Secrets

These secrets are generated automatically when you run `npx tsdevstack generate-secrets`. You should not edit them directly.

### Database Credentials

Each service with a database gets unique credentials:

- `DB_{SERVICE}_USERNAME` - Generated username for the local database (e.g., `auth_user`). In the cloud, database users are named after the service.
- `DB_{SERVICE}_PASSWORD` - Cryptographically secure random password
- `DATABASE_URL` - Full connection string with credentials

These are regenerated only on first run or if deleted. The framework preserves them across subsequent regenerations.

### JWT Keys

When using authentication templates, the framework generates RSA key pairs:

- `JWT_PRIVATE_KEY_CURRENT` - For signing tokens
- `JWT_PUBLIC_KEY_CURRENT` - For verifying tokens
- Previous key versions for rotation support

These are preserved across regenerations, so existing tokens stay valid. They live in the auth service's scope, with `REFRESH_TOKEN_SECRET`, `BCRYPT_ROUNDS` and `ADMIN_EMAILS`. Only the auth service can read them, so only it can sign tokens.

### Service API Keys

For service-to-service authentication:

- `AUTH_SERVICE_API_KEY`
- `BFF_SERVICE_API_KEY`
- `OFFERS_SERVICE_API_KEY`
- (One per backend service)

Each service also receives an `API_KEY` alias pointing to its own key: `secrets.get('API_KEY')` in auth-service reads `AUTH_SERVICE_API_KEY`, locally and on every cloud provider.

These are preserved across regenerations to maintain service-to-service authentication.

### Service URLs

For local development:

- `AUTH_SERVICE_URL` - `http://localhost:3001`
- `BFF_SERVICE_URL` - `http://localhost:3003`
- (Based on configured ports)

In production, these are automatically updated to actual cloud URLs after deployment.

### Infrastructure Secrets

- `REDIS_PASSWORD` - Redis authentication (hardcoded as `redis_pass` for local development)
- `KONG_TRUST_TOKEN` - API gateway trust token (preserved across regenerations)
- `KONG_FRONTEND_TOKEN` - Proves to the gateway that a visitor address comes from your Next.js frontend. Given to the gateway and every Next.js app; preserved across regenerations. See [Client addresses](/docs/customization/kong-customization#client-addresses)
- `REFRESH_TOKEN_SECRET` - Token encryption key, in the auth service's scope. Preserved across regenerations.

## User-Supplied Secrets

These are secrets you must provide. Add them to `.secrets.user.json`.

### Third-Party API Keys

Any external service you integrate with, in the section of the service that calls it:

```json
{
  "offers-service": {
    "STRIPE_API_KEY": "sk_test_xxx"
  },
  "auth-service": {
    "TWILIO_ACCOUNT_SID": "ACxxx"
  }
}
```

A key every service needs goes in the top-level `secrets` object instead. See [Adding Your Own Secrets](#adding-your-own-secrets).

### Configuration Overrides

Some configuration values have sensible defaults that the framework pushes automatically during `cloud-secrets:push`. You can override them locally in `.secrets.user.json` or in the cloud with `cloud-secrets:set`:

| Secret | Default | Purpose |
|--------|---------|---------|
| `ACCESS_TOKEN_TTL` | `900` (15 min) | JWT access token lifetime |
| `REFRESH_TOKEN_TTL` | `604800` (7 days) | Refresh token lifetime |
| `CONFIRMATION_TOKEN_TTL` | `86400` (24 hours) | Email confirmation link lifetime |
| `APP_URL` | Auto-derived from `DOMAIN` | Used in email links (confirmation, password reset) |

To override in the cloud:

```bash
npx tsdevstack cloud-secrets:set ACCESS_TOKEN_TTL --value 3600 --env prod
```

### External OIDC Provider

If you're NOT using the built-in auth template and instead use an external OIDC provider ([Auth0](https://auth0.com/), [Cognito](https://aws.amazon.com/cognito/), etc.):

```json
{
  "secrets": {
    "OIDC_DISCOVERY_URL": "https://your-tenant.auth0.com/.well-known/openid-configuration"
  }
}
```

This is only needed when you've disabled the auth template. See [Escape Hatches](/docs/customization/escape-hatches) for details.

## Adding Your Own Secrets

### Step 1: Define the Secret

Where you put the value decides which backend services can read it. A secret one service needs goes in that service's section. Only that service can read it:

```json
{
  "offers-service": {
    "STRIPE_API_KEY": "your-value-here"
  }
}
```

A secret every backend service needs goes in the top-level `secrets` object, the shared scope:

```json
{
  "secrets": {
    "SENTRY_DSN": "your-value-here"
  }
}
```

### Step 2: Regenerate

```bash
npx tsdevstack generate-secrets
```

### Step 3: Access in Code

```typescript
const stripeKey = await this.secrets.get('STRIPE_API_KEY');
```

A service looks a key up in its own scope and in shared, and its own value wins when the key is in both. See [How Secrets Work](/docs/secrets/how-secrets-work#each-service-reads-shared-secrets-and-its-own).

## Common Patterns

### Sharing a Secret Across All Backend Services

Put it in the top-level `secrets` object. Every backend service reads the shared scope, so no list is needed.

### Frontend-Only Secrets

Add to the frontend section:

```json
{
  "secrets": {
    "ANALYTICS_ID": "GA-xxx"
  },
  "frontend": {
    "secrets": ["ANALYTICS_ID"]
  }
}
```

### Different Values Per Environment

For local development, define values in `.secrets.user.json`. For cloud environments, use `cloud-secrets:set`:

```bash
# Staging
npx tsdevstack cloud-secrets:set STRIPE_API_KEY --service offers-service --env staging

# Production
npx tsdevstack cloud-secrets:set STRIPE_API_KEY --service offers-service --env prod
```

The command prompts for the value, masked, so it stays out of your shell history. `--service` puts it in that service's scope. Leave it out for a shared secret.

## What Not to Do

### Do Not Edit Framework Secrets

The `.secrets.tsdevstack.json` file is regenerated on every `generate-secrets` run. While critical values (JWT keys, API keys, database credentials) are automatically preserved, any manual edits to this file will be lost. Always use `.secrets.user.json` for customizations.

### Do Not Commit Secrets

All secrets files are gitignored. If you find yourself wanting to commit a secret, you are doing something wrong.

### Do Not Use process.env in Backend Services

Always use `SecretsService`:

```typescript
// Wrong
const key = process.env.MY_KEY;

// Right
const key = await this.secrets.get('MY_KEY');
```

### Do Not Hardcode Secrets

Even for testing, use the secrets system:

```json
{
  "secrets": {
    "TEST_API_KEY": "test-value"
  }
}
```

## Quick Reference

| Secret Type | Who Manages | Where Defined | Example |
|-------------|-------------|---------------|---------|
| Database credentials | Framework | Auto-generated | `DATABASE_URL` |
| JWT keys | Framework | Auto-generated | `JWT_PRIVATE_KEY_CURRENT` |
| Service API keys | Framework | Auto-generated | `AUTH_SERVICE_API_KEY` |
| Token TTLs | Framework (defaults) | Auto-pushed, overridable | `ACCESS_TOKEN_TTL` |
| Domain-derived | Framework | Auto-derived from `DOMAIN` | `API_URL`, `APP_URL`, `KONG_CORS_ORIGINS` |
| Service URLs | Framework | Auto-synced during deploy | `AUTH_SERVICE_URL` |
| Domain | You | `cloud-secrets:push` prompt | `DOMAIN` |
| Email config | You | `cloud-secrets:push` prompt | `RESEND_API_KEY`, `EMAIL_FROM` |
| First admins (auth template) | You | `.secrets.user.json` locally; auth-service scope in the cloud | `ADMIN_EMAILS` |
| Third-party APIs | You | `.secrets.user.json`, in the service's section (top level when every service needs it) | `STRIPE_API_KEY` |
| External OIDC | You | `.secrets.user.json` | `OIDC_DISCOVERY_URL` |

Partner API keys are not secrets of your project: they are created at runtime through the auth-service admin API and stored hashed in Postgres and Redis, never in secrets files or the cloud secret manager. See [API Keys](/docs/authentication/api-keys).
