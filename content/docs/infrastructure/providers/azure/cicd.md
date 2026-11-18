# Azure CI/CD

Set up OIDC (OpenID Connect) federation for GitHub Actions to authenticate with Azure without storing client secrets.

For generating workflow files and general CI/CD setup, see [CI/CD Setup](/docs/infrastructure/cicd-setup).

## Overview

GitHub Actions mints a short-lived OIDC token for each workflow run. Azure verifies this token against the Federated Credential on the App Registration and grants access. No `clientSecret` is stored in GitHub.

The CI/CD setup reuses the same App Registration (Service Principal) created during [Account Setup](/docs/infrastructure/providers/azure/account-setup). The only difference is the authentication method.

| Context | Authentication Method |
|---------|----------------------|
| Local development | Client Secret (from `.credentials.azure.json`) |
| CI/CD (GitHub Actions) | OIDC Federated Credential (no secret) |
| Runtime (containers) | Managed Identity (no credentials) |

:::warning Prerequisite
You need an App Registration for each environment before continuing. If you haven't created one yet, complete [Account Setup](/docs/infrastructure/providers/azure/account-setup) Steps 1–5 first.
:::

## Step 1: Add Federated Credential

Do this for **each environment's App Registration** (dev, staging, prod).

### Navigate to the App Registration

1. Go to [Azure Portal](https://portal.azure.com) > search **"Microsoft Entra ID"**
2. Click **App registrations**, then select the **All applications** tab
3. Click on your App Registration for this environment

### Two forms of the GitHub subject

Azure checks the token's subject exactly, with no wildcards. GitHub writes it in one of two forms:

| Repository | Subject on `main` |
|---|---|
| Created before 15 July 2026 | `repo:YOUR_ORG/YOUR_REPO:ref:refs/heads/main` |
| Created, renamed or transferred after 15 July 2026 | `repo:YOUR_ORG@OWNER_ID/YOUR_REPO@REPO_ID:ref:refs/heads/main` |

An older repository switches to the second form only if someone opts in in its OIDC settings. Add a credential for each form and you don't need to know which one yours uses. Your `OWNER_ID` and `REPO_ID`:

```bash
gh api repos/YOUR_ORG/YOUR_REPO --jq '.owner.id, .id'
```

### Add the Credentials

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
6. Click **+ Add credential** again, for the form with IDs
7. **Scenario:** Select **"Other issuer"**
8. Fill in:
   - **Issuer:** `https://token.actions.githubusercontent.com`
   - **Subject identifier:** `repo:YOUR_ORG@OWNER_ID/YOUR_REPO@REPO_ID:ref:refs/heads/main`
   - **Name:** `github-actions-main-ids`
   - **Audience:** `api://AzureADTokenExchange`
9. Click **Add**

Repeat for each environment's App Registration. The deploy workflows start from **Run workflow**: pick `main`, the branch both credentials name.

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

::: info Environment names are your choice
The framework has no naming convention for environments. `dev`, `staging`, `prod` are common choices, but you can use any name. The suffix is always the UPPERCASE version of your environment name.
:::

### Private npm packages — `NPM_TOKEN` (optional, single global secret)

If your project depends on private npm packages, add a single `NPM_TOKEN` repository secret — **not** per-environment. Registry tokens identify your developer / org account, not a deployment target, so the same value works for every env.

| Secret Name | Value |
|-------------|-------|
| `NPM_TOKEN` | Token from your npm registry (e.g. `npm token create` or a GitHub Packages PAT) |

The token is auto-detected and wired through generated workflows when an `.npmrc` exists at your project root. See [CI/CD Setup — Private npm packages](/docs/infrastructure/cicd-setup#private-npm-packages) for the full setup.

## User Secrets (Required Before First Deployment)

The CI workflow pushes framework-generated secrets automatically (`cloud-secrets:push --skip-user-secrets`), but **user secrets must be created manually** in Azure Key Vault before the first CI deployment.

::: warning Required before running CI
Without these secrets, deployment will fail. The CI pipeline cannot prompt for interactive input.
:::

### Create the Key Vault (if it doesn't exist)

If you're setting up CI without running `cloud:init` locally, you need to create the Key Vault manually first.

1. Go to the [Azure Portal](https://portal.azure.com) > search **"Key vaults"** > **+ Create**
2. **Subscription:** Select the subscription for this environment
3. **Resource group:** Select the resource group you created during Account Setup
4. **Key vault name:** `{projectName}-{env}-kv-{suffix}` (e.g., `myapp-dev-kv-1a2b3c`). The suffix is the first 6 characters of the SHA-256 of the subscription ID: `node -e "console.log(require('crypto').createHash('sha256').update('YOUR_SUBSCRIPTION_ID').digest('hex').slice(0,6))"`. If the name is longer than 24 characters, the CLI shortens it, and `cloud:init` lists each environment with its vault name. A vault named `{projectName}-{env}-kv` also works: the environment then keeps the names of v0.12.0 and earlier ([names](/docs/infrastructure/providers/azure/architecture#names))
5. **Region:** Must match your resource group region
6. **Pricing tier:** Standard
7. Click **Review + create** > **Create**
8. Wait for the deployment to complete (a few minutes)
9. After creation, open the Key Vault > **Access control (IAM)** > **+ Add** > **Add role assignment**
10. Tab: **Job function roles** > search **Key Vault Secrets Officer**
11. Select members > select your own user account > assign
12. Wait a couple minutes for the role to take effect before creating secrets

### Creating Secrets in Azure Portal

1. Go to the [Azure Portal](https://portal.azure.com)
2. Search for **"Key vaults"** and select your project's Key Vault (`{projectName}-{env}-kv-{suffix}`)
3. Click **Secrets** in the left menu
4. Click **+ Generate/Import**
5. **Upload options:** Manual
6. **Name:** Enter the full secret name with hyphens (e.g., `myapp-shared-DOMAIN`)
7. **Secret value:** Enter the value (e.g., `example.com`)
8. Click **Create**

Repeat for each required secret in each environment.

### Secret Naming Format

Secrets in Azure Key Vault follow the format: `{project-name}-{scope}-{KEY}`

Where `{project-name}` is the `project.name` from your `.tsdevstack/config.json`.

For example, if your project name is `myapp`:

| Secret Key | Azure Key Vault Name |
|------------|---------------------|
| `DOMAIN` | `myapp-shared-DOMAIN` |
| `RESEND_API_KEY` | `myapp-shared-RESEND-API-KEY` |
| `EMAIL_FROM` | `myapp-shared-EMAIL-FROM` |

### Required User Secrets

| Secret | When | Description | Example |
|--------|------|-------------|---------|
| `DOMAIN` | Always | Your base domain | `example.com` |
| `RESEND-API-KEY` | With the auth template (the auth service doesn't start without it), or if your services send email | API key from [resend.com/api-keys](https://resend.com/api-keys) | `re_123abc...` |
| `EMAIL-FROM` | With `RESEND-API-KEY` | Sender email address | `noreply@example.com` |
| `ADMIN-EMAILS` | Optional, auth template | The first admins, comma-separated. In the auth service's own Key Vault, not the shared one: set it with `npx tsdevstack cloud-secrets:set ADMIN_EMAILS --service auth-service --env <env>`, which creates that vault if needed | `you@example.com` |

Azure Key Vault only allows alphanumeric characters and hyphens — no underscores. Use hyphens when creating secrets in the portal. The framework transforms them back to underscores (`RESEND-API-KEY` → `RESEND_API_KEY`) when injecting into your services.

::: warning Check your .secrets.user.json
Your project may have additional user secrets (e.g., `STRIPE_KEY`, `TWILIO_SID`). Any secret defined in `.secrets.user.json` that is not framework-generated must also be created manually in Azure Key Vault before deployment. Top-level ones go in the shared vault, named `{project-name}-shared-{KEY}` (with hyphens instead of underscores). One in a service's section goes in that service's own vault: set it with `cloud-secrets:set --service <service>`. See [Secret Naming in Cloud](/docs/secrets/cloud-secrets#secret-naming-in-cloud).
:::

### Alternative: Using the CLI

If you have local credentials configured (see [Account Setup](/docs/infrastructure/providers/azure/account-setup)), you can push all user secrets from your machine:

```bash
npx tsdevstack cloud-secrets:push --env dev
```

This will prompt for `DOMAIN`, `RESEND_API_KEY`, `EMAIL_FROM`, and any custom secrets interactively.

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

**No separate Docker auth step needed.** Container Apps and Container Apps Jobs use a **user-assigned managed identity** with `AcrPull` and `Key Vault Secrets User` roles (provisioned by Terraform) to pull images from ACR and access secrets in Key Vault. No tokens, passwords, or service principal credentials are involved — the identity is permanent and works reliably with scale-to-zero. Docker build/push in CI still uses `DefaultAzureCredential` (picks up the OIDC session).

## Troubleshooting

### "AADSTS700016: Application with identifier '...' was not found"

Wrong `AZURE_CLIENT_ID` in GitHub secrets, or App Registration was deleted. Verify the Application (client) ID matches.

### "AADSTS70021: No matching federated identity record found"

1. Federated credential not created on the App Registration
2. Branch name doesn't match (credential is for `main` but workflow ran from another branch)
3. Wrong repository in the federated credential
4. Only the name-only credential exists, and the repository was created after 15 July 2026: add the one with IDs ([Two forms of the GitHub subject](#two-forms-of-the-github-subject))

Check: App Registration > Certificates & secrets > Federated credentials tab.

### "azure/login failed" with no specific error

`id-token: write` permission missing from the workflow. Check the `permissions` block.

### Terraform fails with "Error building AzureRM Client"

`ARM_USE_OIDC=true` not set, or `ARM_CLIENT_ID`/`ARM_TENANT_ID` missing. Verify the "Set Azure environment variables" step is present.

### ACR push fails with "unauthorized: authentication required"

The `azure/login` OIDC session wasn't established before the CLI tried to push images. Ensure `azure/login@v2` runs before any deploy commands.

### "does not have authorization to perform action ... register/action"

Resource providers are not registered on the subscription. The CI service principal has resource-group-scoped roles, which are not sufficient for provider registration (a subscription-level operation).

Register all required providers in the Azure Portal before running CI. See [Register Resource Providers](/docs/infrastructure/providers/azure/account-setup#register-resource-providers) in the Account Setup guide.
