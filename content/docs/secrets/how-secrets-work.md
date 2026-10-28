# How Secrets Work

tsdevstack uses a structured secrets system that eliminates manual `.env` file management. Instead of scattering environment variables across multiple files, secrets are centrally defined and automatically distributed to each service.

::: info Scope of this section
This section covers **runtime secrets** — values your backend services read at request time (DB credentials, JWT keys, API URLs, third-party API keys). They live in `.secrets.*.json` files locally and in your cloud secret manager in production.

**Build-time secrets** (auth tokens needed during `docker build` / host `npm ci` to install private packages — currently `NPM_TOKEN`) live outside this system. They're forwarded directly to BuildKit via env-source secret mounts and never land in image layers, never go through Secret Manager. See [CI/CD Setup — Private npm packages](/docs/infrastructure/cicd-setup#private-npm-packages).
:::

## The Problem with .env Files

Traditional approaches to secrets management often involve:

- Multiple `.env` files scattered across services
- Manual copying of secrets between environments
- Easy-to-miss inconsistencies between services
- Risk of committing secrets to version control
- No immediate updates when secrets change (requires service restarts)

tsdevstack solves these problems with a centralized, generated approach.

## How It Works

The secrets system uses a **three-file merge strategy**:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   .secrets.tsdevstack.json        .secrets.user.json            │
│   (framework-generated)           (your customizations)         │
│                                                                 │
│   ┌─────────────────────┐         ┌─────────────────────┐       │
│   │ DATABASE_PASSWORD   │         │ STRIPE_API_KEY      │       │
│   │ REDIS_PASSWORD      │         │ SENDGRID_API_KEY    │       │
│   │ JWT_PRIVATE_KEY     │         │ DATABASE_PASSWORD   │ ←override│
│   │ KONG_DB_PASSWORD    │         │ CUSTOM_CONFIG       │       │
│   └──────────┬──────────┘         └──────────┬──────────┘       │
│              │                               │                  │
│              └───────────┬───────────────────┘                  │
│                          │                                      │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │ npx tsdevstack        │                          │
│              │ generate-secrets      │                          │
│              └───────────┬───────────┘                          │
│                          │                                      │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │ .secrets.local.json   │                          │
│              │ (merged output)       │                          │
│              └───────────────────────┘                          │
│                          │                                      │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                     │
│   ┌───────────┐   ┌───────────┐   ┌───────────┐                 │
│   │ Backend   │   │ Frontend  │   │ Docker/   │                 │
│   │ Services  │   │ Apps      │   │ Kong      │                 │
│   │           │   │           │   │           │                 │
│   │ Secrets-  │   │ .env file │   │ .env file │                 │
│   │ Service   │   │ (build)   │   │ (infra)   │                 │
│   │ reads JSON│   │           │   │           │                 │
│   └───────────┘   └───────────┘   └───────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

The three files:

1. **Framework secrets** (`.secrets.tsdevstack.json`) - Automatically generated values like database passwords, API keys, and JWT tokens
2. **User secrets** (`.secrets.user.json`) - Your customizations like third-party API keys and configuration overrides
3. **Merged output** (`.secrets.local.json`) - The final result used by your services

### How Services Access Secrets

**Backend services (NestJS)** use `SecretsService` which reads directly from `.secrets.local.json`. This mimics cloud behavior where secrets come from a secret manager, not environment variables.

**Frontend apps** receive secrets via generated `.env` files at build time.

**Docker/Kong** receive infrastructure secrets via the root `.env` file.

When you run `npx tsdevstack generate-secrets`, the framework:

1. Regenerates `.secrets.tsdevstack.json`, preserving critical secrets (JWT keys, API keys, database credentials, KONG_TRUST_TOKEN, KONG_FRONTEND_TOKEN)
2. Reads your custom secrets from the user file
3. Merges them together with your values taking precedence
4. Generates `.env` files for frontends and infrastructure

## Key Principles

### Secrets Are Generated, Not Copied

Database passwords, API keys, and other sensitive values are generated fresh for each project. You never need to copy secrets from documentation or other projects.

### Each Service Reads Shared Secrets and Its Own

Every secret belongs to one scope: **shared**, which every service reads, or a **service scope**, which only that service reads. A backend service looks a key up in its own scope and in shared. When a key is in both, its own value wins.

- **In the cloud, this is enforced.** Each service runs with its own identity. That identity reads only the shared secrets and the service's own. GCP uses an IAM condition per service account, AWS a policy per task role, and Azure a Key Vault per service. A service can't read another service's secrets, even if its code asks for them.
- **Locally, it isn't.** `.secrets.local.json` holds every scope, and any process on your machine can read it. The scopes still decide what a lookup returns, so your code behaves as it will in the cloud.

A service scope holds that service's `DATABASE_URL`. With the auth template, the auth service's scope also holds the JWT signing keys, the refresh token secret, `BCRYPT_ROUNDS` and `ADMIN_EMAILS`. Only the auth service can sign tokens. A secret of your own that one service needs goes in that service's scope. See [Adding Your Own Secrets](/docs/secrets/local-secrets#adding-your-own-secrets).

Two kinds of secrets are shared on purpose: the gateway trust token (`KONG_TRUST_TOKEN`) and the service API keys (`{SERVICE}_API_KEY`). Every service checks them, and checking a token means knowing it. Both work only inside your project's network.

Frontends work differently. At deploy, they get the shared keys listed in their `secrets` array as environment variables, and nothing else.

### Local and Cloud Use the Same Interface

Your code uses the same `SecretsService` interface whether running locally or in the cloud. The only difference is where the secrets are stored.

### All Secrets Files Are Gitignored

Every secrets file is automatically added to `.gitignore`. There is no risk of accidentally committing secrets to version control.

## The Generate Command

The primary command for secrets management is:

```bash
npx tsdevstack generate-secrets
```

This command:

- Regenerates the framework secrets file (but preserves critical values like JWT keys, API keys, and database credentials)
- Merges your custom secrets with framework defaults
- Generates per-service configuration files
- Generates `.env` files for frontends and Docker/Kong

Run this command:

- After cloning a project for the first time
- After adding new secrets to your user configuration
- After updating the framework

## What Gets Generated

The command creates several files:

| File | Purpose |
|------|---------|
| `.secrets.tsdevstack.json` | Framework-generated secrets (auto-generated values) |
| `.secrets.local.json` | Merged secrets for all services |
| `.secrets.user.example.json` | Template showing available secrets (like `.env.example`, but auto-generated) |
| `.env` | Variables for Docker and Kong |
| `apps/*/.env` | Per-service environment files |

All of these files are gitignored (except `.secrets.user.example.json` which is safe to commit) and should never be committed.

## Troubleshooting

### Service can't find secrets

If a service fails with "missing environment variable" errors:

1. Run `npx tsdevstack sync` to regenerate configuration and restart containers
2. Check that the service is listed in `.tsdevstack/config.json`

### Secrets not updating

After editing `.secrets.user.json`, run regeneration to merge your changes:

```bash
npx tsdevstack sync
```

Your values in `.secrets.user.json` are always preserved - regeneration only merges them into `.secrets.local.json` and syncs the structure (adds new services if needed).

**Note:** Backend services using `SecretsService` automatically reload secrets from `.secrets.local.json` (1-minute cache). For frontend apps, you need to restart to pick up new `.env` values.

### Wrong secret values

If a secret has the wrong value:

1. Check `.secrets.user.json` for your override
2. Check `.secrets.local.json` to see the merged result
3. User secrets always override framework secrets

### JWT keys mismatch

If authentication fails after regenerating:

- JWT private keys are preserved across regenerations by default
- If you need fresh keys, delete `.secrets.tsdevstack.json` and regenerate
