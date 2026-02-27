# GCP CI/CD

Set up Workload Identity Federation (WIF) for GitHub Actions to authenticate with GCP without storing service account keys.

## Overview

WIF allows GitHub Actions to authenticate using short-lived OIDC tokens instead of exported key files. The GitHub Actions runner gets a token from GitHub, exchanges it for GCP credentials, and authenticates as the service account.

**Benefits:**
- No secret keys stored in GitHub
- Short-lived tokens (valid only during the workflow run)
- Full auditability under the service account identity

## Prerequisites

Complete [Account Setup](/infrastructure/providers/gcp/account-setup) first. You need a service account with roles already configured before setting up CI/CD.

## Setup

### 1. Enable Required APIs

1. Go to [APIs & Services](https://console.cloud.google.com/apis/library)
2. Search and enable:
   - **IAM Service Account Credentials API**
   - **Security Token Service API**

### 2. Create Workload Identity Pool

1. Go to [IAM & Admin > Workload Identity Federation](https://console.cloud.google.com/iam-admin/workload-identity-pools)
2. Click **Create Pool**
3. Name: `github-pool`
4. Click **Continue**

### 3. Add GitHub Provider

1. Provider: **OpenID Connect (OIDC)**
2. Provider name: `github-provider`
3. Issuer URL: `https://token.actions.githubusercontent.com`
4. Audiences: **Default audience**
5. Attribute mapping:
   - `google.subject` = `assertion.sub`
   - `attribute.repository` = `assertion.repository`
6. Attribute condition (CEL) — choose one:

   **Repository only** (any branch can deploy):
   ```
   assertion.repository == 'YOUR_ORG/YOUR_REPO'
   ```

   **Repository + branch** (only `main` can deploy):
   ```
   assertion.repository == 'YOUR_ORG/YOUR_REPO' && assertion.ref == 'refs/heads/main'
   ```

   Replace `YOUR_ORG/YOUR_REPO` with your GitHub repository (e.g., `myorg/myapp`).

   | | Repository only | Repository + branch |
   |---|---|---|
   | Deploy from feature branches | Yes | No |
   | PR workflows (build/lint/test) | Not affected (no GCP auth) | Not affected (no GCP auth) |
   | Security | Any branch in your repo can trigger deploys | Only `main` can trigger deploys |
   | Recommended for | Teams that test deploys from branches | Most projects |

7. Click **Save**

### 4. Grant Service Account Access

1. Go to [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click on your deploy service account (don't see one? Complete [Account Setup](/infrastructure/providers/gcp/account-setup) first)
3. Go to **Permissions** tab > **Principals with access** tab
4. Click **Grant Access**
5. New principal: `principalSet://iam.googleapis.com/projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/{GITHUB_ORG}/{GITHUB_REPO}`
6. Role: **Workload Identity User**
7. Click **Save**

Find your project number in [Project Settings](https://console.cloud.google.com/iam-admin/settings).

## GitHub Secrets

Add these secrets in your GitHub repository under **Settings > Secrets and variables > Actions**.

Secret names use the pattern `GCP_{TYPE}_{ENV}` where `{ENV}` is the UPPERCASE environment name from your `.tsdevstack/config.json`.

::: info Environment names are your choice
The framework has no naming convention for environments. `dev`, `staging`, `prod` are common choices, but you can use any name. The examples below use `dev` and `prod`.
:::

### Example: dev environment

| Secret | Value | Where to Find |
|--------|-------|---------------|
| `GCP_WIF_DEV` | `projects/{NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | Workload Identity Federation > Pool > Provider details |
| `GCP_SA_DEV` | `{name}@{project}.iam.gserviceaccount.com` | Service Accounts > Email column |
| `GCP_REGION_DEV` | `us-central1` | Your preferred region |

### Example: prod environment

| Secret | Value | Where to Find |
|--------|-------|---------------|
| `GCP_WIF_PROD` | `projects/{NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | Workload Identity Federation > Pool > Provider details |
| `GCP_SA_PROD` | `{name}@{project}.iam.gserviceaccount.com` | Service Accounts > Email column |
| `GCP_REGION_PROD` | `us-central1` | Your preferred region |

Repeat for each environment you have configured.

## User Secrets (Required Before First Deployment)

The CI workflow pushes framework-generated secrets automatically (`cloud-secrets:push --skip-user-secrets`), but **user secrets must be created manually** in GCP Secret Manager before the first CI deployment.

::: warning Required before running CI
Without these secrets, deployment will fail. The CI pipeline cannot prompt for interactive input.
:::

### Required User Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `DOMAIN` | Your base domain | `example.com` |
| `RESEND_API_KEY` | API key from [resend.com/api-keys](https://resend.com/api-keys) | `re_123abc...` |
| `EMAIL_FROM` | Sender email address | `noreply@example.com` |

### Secret Naming Format

Secrets in GCP Secret Manager follow the format: `{project-name}-{scope}-{KEY}`

Where `{project-name}` is the `project.name` from your `.tsdevstack/config.json`.

For example, if your project name is `myapp`:

| Secret Key | GCP Secret Manager Name |
|------------|------------------------|
| `DOMAIN` | `myapp-shared-DOMAIN` |
| `RESEND_API_KEY` | `myapp-shared-RESEND_API_KEY` |
| `EMAIL_FROM` | `myapp-shared-EMAIL_FROM` |

### Creating Secrets in GCP Console

1. Go to [Secret Manager](https://console.cloud.google.com/security/secret-manager) and select your project
2. If Secret Manager is not enabled, click **Enable** when prompted
3. Click **Create Secret**
4. **Name:** Enter the full secret name (e.g., `myapp-shared-DOMAIN`)
5. **Secret value:** Enter the value (e.g., `example.com`)
6. Leave all other settings as default
7. Click **Create Secret**

Repeat for each required secret. You can also add any custom secrets your application needs (e.g., third-party API keys) using the same `{project-name}-shared-{KEY}` naming pattern.

### Alternative: Using the CLI

If you have local credentials configured (see [Account Setup](/infrastructure/providers/gcp/account-setup)), you can push user secrets from your machine:

```bash
npx tsdevstack cloud-secrets:push --env dev
```

This will prompt for `DOMAIN`, `RESEND_API_KEY`, and `EMAIL_FROM` interactively.

## Workflow Authentication Pattern

The generated workflows authenticate using the `google-github-actions/auth` action:

```yaml
permissions:
  contents: read
  id-token: write  # Required for OIDC token

steps:
  - name: Set environment variables
    run: |
      ENV_UPPER=$(echo '${{ inputs.environment }}' | tr '[:lower:]' '[:upper:]')
      echo "GCP_WIF_NAME=GCP_WIF_${ENV_UPPER}" >> $GITHUB_ENV
      echo "GCP_SA_NAME=GCP_SA_${ENV_UPPER}" >> $GITHUB_ENV
      echo "GCP_REGION_NAME=GCP_REGION_${ENV_UPPER}" >> $GITHUB_ENV

  - uses: google-github-actions/auth@v2
    with:
      workload_identity_provider: ${{ secrets[env.GCP_WIF_NAME] }}
      service_account: ${{ secrets[env.GCP_SA_NAME] }}
```

The `id-token: write` permission is **required** — without it, GitHub won't issue the OIDC token and authentication will fail silently.

## Security Best Practices

- Use separate service accounts per environment (separate GCP projects)
- Restrict repository access via attribute conditions on the WIF provider
- Grant only the required roles to the deploy service account (see [Account Setup](/infrastructure/providers/gcp/account-setup))

## Troubleshooting

### WIF Authentication Fails

1. Verify the provider path includes your **project number** (not project ID)
2. Check the repository attribute mapping matches `{org}/{repo}` exactly
3. Ensure the service account has the **Workload Identity User** role granted to the correct principal

### Token Exchange Failed

Ensure the workflow has the `id-token: write` permission:

```yaml
permissions:
  contents: read
  id-token: write
```

### Service Account Does Not Exist

Verify the service account email format: `<name>@<project-id>.iam.gserviceaccount.com`

1. Go to [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Check that the service account exists and the email matches what you set in `GCP_SA_{ENV}`
