# User vs Framework Secrets

tsdevstack manages two categories of secrets: those the framework generates automatically, and those you provide. Understanding the difference helps you know what to configure and what to leave alone.

## Framework-Managed Secrets

These secrets are generated automatically when you run `npx tsdevstack generate-secrets`. You should not edit them directly.

### Database Credentials

Each service with a database gets unique credentials:

- `DB_{SERVICE}_USERNAME` - Generated username (e.g., `auth_user`)
- `DB_{SERVICE}_PASSWORD` - Cryptographically secure random password
- `DATABASE_URL` - Full connection string with credentials

These are regenerated only on first run or if deleted. The framework preserves them across subsequent regenerations.

### JWT Keys

When using authentication templates, the framework generates RSA key pairs:

- `JWT_PRIVATE_KEY_CURRENT` - For signing tokens
- `JWT_PUBLIC_KEY_CURRENT` - For verifying tokens
- Previous key versions for rotation support

These are preserved across regenerations to avoid invalidating existing tokens.

### Service API Keys

For service-to-service authentication:

- `AUTH_SERVICE_API_KEY`
- `BFF_SERVICE_API_KEY`
- `OFFERS_SERVICE_API_KEY`
- (One per backend service)

Each service also receives an `API_KEY` alias pointing to its own key.

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
- `REFRESH_TOKEN_SECRET` - Token encryption key (preserved across regenerations)

## User-Supplied Secrets

These are secrets you must provide. Add them to `.secrets.user.json`.

### Third-Party API Keys

Any external service you integrate with:

```json
{
  "secrets": {
    "STRIPE_API_KEY": "sk_test_xxx",
    "SENDGRID_API_KEY": "SG.xxx",
    "TWILIO_ACCOUNT_SID": "ACxxx"
  }
}
```

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

This is only needed when you've disabled the auth template. See [Escape Hatches](/customization/escape-hatches) for details.

## Adding Your Own Secrets

### Step 1: Define the Secret

Add your secret to the top-level `secrets` object:

```json
{
  "secrets": {
    "MY_API_KEY": "your-value-here"
  }
}
```

### Step 2: Assign to Services

Specify which services need the secret:

```json
{
  "secrets": {
    "MY_API_KEY": "your-value-here"
  },
  "auth-service": {
    "secrets": ["MY_API_KEY"]
  },
  "bff-service": {
    "secrets": ["MY_API_KEY"]
  }
}
```

### Step 3: Regenerate

```bash
npx tsdevstack generate-secrets
```

### Step 4: Access in Code

```typescript
const myApiKey = await this.secrets.get('MY_API_KEY');
```

## Common Patterns

### Sharing a Secret Across All Backend Services

Add it to each service's `secrets` array:

```json
{
  "secrets": {
    "SHARED_KEY": "value"
  },
  "auth-service": {
    "secrets": ["SHARED_KEY"]
  },
  "bff-service": {
    "secrets": ["SHARED_KEY"]
  },
  "offers-service": {
    "secrets": ["SHARED_KEY"]
  }
}
```

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
npx tsdevstack cloud-secrets:set STRIPE_API_KEY --env staging --value sk_test_xxx

# Production
npx tsdevstack cloud-secrets:set STRIPE_API_KEY --env prod --value sk_live_xxx
```

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
| Third-party APIs | You | `.secrets.user.json` | `STRIPE_API_KEY` |
| External OIDC | You | `.secrets.user.json` | `OIDC_DISCOVERY_URL` |
