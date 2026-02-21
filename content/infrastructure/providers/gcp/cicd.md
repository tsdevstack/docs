# GCP CI/CD

Set up Workload Identity Federation (WIF) for GitHub Actions to authenticate with GCP without storing service account keys.

## Overview

WIF allows GitHub Actions to authenticate using short-lived OIDC tokens instead of exported key files. The GitHub Actions runner gets a token from GitHub, exchanges it for GCP credentials, and authenticates as the service account.

**Benefits:**
- No secret keys stored in GitHub
- Short-lived tokens (valid only during the workflow run)
- Full auditability under the service account identity

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
6. Click **Save**

### 4. Grant Service Account Access

1. Go to [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click on your deploy service account
3. Go to **Permissions** tab
4. Click **Grant Access**
5. New principal: `principalSet://iam.googleapis.com/projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/{GITHUB_ORG}/{GITHUB_REPO}`
6. Role: **Workload Identity User**
7. Click **Save**

Find your project number in [Project Settings](https://console.cloud.google.com/iam-admin/settings).

## GitHub Secrets

Add these secrets in your GitHub repository under **Settings > Secrets and variables > Actions**.

Secret names use UPPERCASE environment suffixes.

### For dev environment

| Secret | Value | Where to Find |
|--------|-------|---------------|
| `GCP_WIF_DEV` | `projects/{NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | Workload Identity Federation > Pool > Provider details |
| `GCP_SA_DEV` | `{name}@{project}.iam.gserviceaccount.com` | Service Accounts > Email column |
| `GCP_REGION_DEV` | `us-central1` | Your preferred region |

### For prod environment

| Secret | Value | Where to Find |
|--------|-------|---------------|
| `GCP_WIF_PROD` | `projects/{NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | Workload Identity Federation > Pool > Provider details |
| `GCP_SA_PROD` | `{name}@{project}.iam.gserviceaccount.com` | Service Accounts > Email column |
| `GCP_REGION_PROD` | `us-central1` | Your preferred region |

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

```bash
gcloud iam service-accounts describe "deploy@${PROJECT_ID}.iam.gserviceaccount.com"
```
