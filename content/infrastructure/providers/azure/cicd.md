# Azure CI/CD

Set up OIDC (OpenID Connect) federation for GitHub Actions to authenticate with Azure without storing client secrets.

## Overview

GitHub Actions mints a short-lived OIDC token for each workflow run. Azure verifies this token against the Federated Credential on the App Registration and grants access. No `clientSecret` is stored in GitHub.

The CI/CD setup reuses the same App Registration (Service Principal) created during [Account Setup](/infrastructure/providers/azure/account-setup). The only difference is the authentication method.

| Context | Authentication Method |
|---------|----------------------|
| Local development | Client Secret (from `.credentials.azure.json`) |
| CI/CD (GitHub Actions) | OIDC Federated Credential (no secret) |
| Runtime (containers) | Managed Identity (no credentials) |

## Step 1: Add Federated Credential

Do this for **each environment's App Registration** (dev, staging, prod).

### Navigate to the App Registration

1. Go to [Azure Portal](https://portal.azure.com) > search **"Microsoft Entra ID"**
2. Click **App registrations** > **All applications**
3. Click on the App Registration for this environment (e.g., `tsdevstack-dev`)

### Add the Credential

1. Click **Certificates & secrets** > **Federated credentials** tab
2. Click **+ Add credential**
3. **Scenario:** Select **"GitHub Actions deploying Azure resources"**
4. Fill in:
   - **Organization:** Your GitHub username or org
   - **Repository:** Your repo name (e.g., `my-project`)
   - **Entity type:** Branch
   - **GitHub branch name:** `main`
   - **Name:** `github-actions-main`
5. Click **Add**

Repeat for each environment's App Registration.

:::info
Running from other branches? Add additional federated credentials with those branch names. You can have up to 20 federated credentials per App Registration.
:::

## Step 2: GitHub Repository Secrets

Go to your GitHub repository > **Settings** > **Secrets and variables** > **Actions**.

For each environment, set 4 secrets:

| Secret Name | Value | Where to Find |
|-------------|-------|---------------|
| `AZURE_CLIENT_ID_DEV` | Application (client) ID | Entra ID > App registrations > Overview |
| `AZURE_TENANT_ID_DEV` | Directory (tenant) ID | Same Overview page |
| `AZURE_SUBSCRIPTION_ID_DEV` | Subscription ID | Portal > Subscriptions |
| `AZURE_LOCATION_DEV` | Azure region (e.g., `eastus`) | Must match resource group region |

Repeat for staging and prod with `_STAGING` and `_PROD` suffixes.

**No `AZURE_CLIENT_SECRET` needed** — OIDC handles authentication.

**Naming convention:** Workflows dynamically look up secrets by converting the environment name to uppercase. `dev` > `AZURE_CLIENT_ID_DEV`, `AZURE_TENANT_ID_DEV`, etc.

## Workflow Authentication Pattern

The generated workflows authenticate using `azure/login@v2`:

```yaml
permissions:
  contents: read
  id-token: write  # Required for OIDC token

steps:
  # 1. Build secret names from environment input
  - name: Set environment variables
    run: |
      ENV_UPPER=$(echo '${{ inputs.environment }}' | tr '[:lower:]' '[:upper:]')
      echo "AZURE_CLIENT_ID_NAME=AZURE_CLIENT_ID_${ENV_UPPER}" >> $GITHUB_ENV
      echo "AZURE_TENANT_ID_NAME=AZURE_TENANT_ID_${ENV_UPPER}" >> $GITHUB_ENV
      echo "AZURE_SUBSCRIPTION_ID_NAME=AZURE_SUBSCRIPTION_ID_${ENV_UPPER}" >> $GITHUB_ENV
      echo "AZURE_LOCATION_NAME=AZURE_LOCATION_${ENV_UPPER}" >> $GITHUB_ENV

  # 2. Authenticate via OIDC
  - uses: azure/login@v2
    with:
      client-id: ${{ secrets[env.AZURE_CLIENT_ID_NAME] }}
      tenant-id: ${{ secrets[env.AZURE_TENANT_ID_NAME] }}
      subscription-id: ${{ secrets[env.AZURE_SUBSCRIPTION_ID_NAME] }}

  # 3. Set env vars for CLI and Terraform
  - name: Set Azure environment variables
    run: |
      echo "ARM_CLIENT_ID=${{ secrets[env.AZURE_CLIENT_ID_NAME] }}" >> $GITHUB_ENV
      echo "ARM_TENANT_ID=${{ secrets[env.AZURE_TENANT_ID_NAME] }}" >> $GITHUB_ENV
      echo "ARM_SUBSCRIPTION_ID=${{ secrets[env.AZURE_SUBSCRIPTION_ID_NAME] }}" >> $GITHUB_ENV
      echo "ARM_USE_OIDC=true" >> $GITHUB_ENV
```

The `id-token: write` permission is **required** — without it, GitHub won't issue the OIDC token and `azure/login` will fail.

**No separate Docker auth step needed.** Unlike GCP or AWS, Azure Container Registry auth is handled by the CLI via `DefaultAzureCredential`, which picks up the OIDC session.

## Troubleshooting

### "AADSTS700016: Application with identifier '...' was not found"

Wrong `AZURE_CLIENT_ID` in GitHub secrets, or App Registration was deleted. Verify the Application (client) ID matches.

### "AADSTS70021: No matching federated identity record found"

1. Federated credential not created on the App Registration
2. Branch name doesn't match (credential is for `main` but workflow ran from another branch)
3. Wrong repository in the federated credential

Check: App Registration > Certificates & secrets > Federated credentials tab.

### "azure/login failed" with no specific error

`id-token: write` permission missing from the workflow. Check the `permissions` block.

### Terraform fails with "Error building AzureRM Client"

`ARM_USE_OIDC=true` not set, or `ARM_CLIENT_ID`/`ARM_TENANT_ID` missing. Verify the "Set Azure environment variables" step is present.

### ACR push fails with "unauthorized: authentication required"

The `azure/login` OIDC session wasn't established before the CLI tried to push images. Ensure `azure/login@v2` runs before any deploy commands.
