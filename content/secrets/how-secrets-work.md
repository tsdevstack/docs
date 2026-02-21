# How Secrets Work

tsdevstack uses a structured secrets system that eliminates manual `.env` file management. Instead of scattering environment variables across multiple files, secrets are centrally defined and automatically distributed to each service.

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

1. Regenerates `.secrets.tsdevstack.json`, preserving critical secrets (JWT keys, API keys, database credentials, KONG_TRUST_TOKEN)
2. Reads your custom secrets from the user file
3. Merges them together with your values taking precedence
4. Generates `.env` files for frontends and infrastructure

## Key Principles

### Secrets Are Generated, Not Copied

Database passwords, API keys, and other sensitive values are generated fresh for each project. You never need to copy secrets from documentation or other projects.

### Each Service Gets Only What It Needs

Services receive only the secrets they require. The auth service gets database credentials, the frontend gets API URLs, and so on. This follows the principle of least privilege.

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
