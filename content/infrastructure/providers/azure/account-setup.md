# Azure Account Setup

Setting up Azure for tsdevstack deployments. Each environment requires its own subscription for isolation.

:::warning
**App Service quota required before first deploy.** New subscriptions often have **zero quota** for Basic-tier VMs. You must request a quota increase before running `infra:deploy`, or it will fail with `Current Limit (Basic VMs): 0`. See [App Service Quota](#app-service-quota) below.
:::

## Prerequisites

- Azure account with portal access
- One Azure subscription per environment (dev, staging, prod)
- App Service plan quota in your target region (Basic/B-series)

## Register Resource Providers

Azure subscriptions do not have all resource providers enabled by default. You must register every provider the framework uses before running `cloud:init`. This is a one-time operation per subscription.

### How to Register

1. Go to the [Azure Portal](https://portal.azure.com)
2. Search for **"Subscriptions"** and click on your subscription
3. In the left sidebar under **Settings**, click **Resource providers**
4. For each provider listed below:
   - Type the provider name in the **search box**
   - Select it from the list
   - Click **Register** at the top
   - The status progress message may disappear from the list. Click the **bell icon** (notifications) in the top-right navbar to track progress and verify registration succeeded.
   - Wait until the status shows **Registered** (usually under a minute)

### Required Providers

Register all 12 providers:

| Provider | Used For |
|----------|----------|
| `Microsoft.App` | Container Apps (backend services) |
| `Microsoft.Cache` | Azure Cache for Redis |
| `Microsoft.Cdn` | Azure Front Door (CDN / load balancer) |
| `Microsoft.ContainerRegistry` | Container Registry (Docker images) |
| `Microsoft.DBforPostgreSQL` | PostgreSQL Flexible Server |
| `microsoft.insights` | Monitor Diagnostic Settings |
| `Microsoft.KeyVault` | Key Vault (secrets management) |
| `Microsoft.ManagedIdentity` | Managed Identities for containers |
| `Microsoft.Network` | Virtual Networks, subnets, NSGs |
| `Microsoft.OperationalInsights` | Log Analytics workspace |
| `Microsoft.Storage` | Storage Accounts (Terraform state, SPA hosting) |
| `Microsoft.Web` | App Service Plans (Kong, Next.js) |

:::warning
The `Microsoft.Web` provider must be registered before you can request App Service quota (next section). The quota page will be empty without it.
:::

## App Service Quota

The framework deploys Kong on a dedicated App Service Plan. If your project includes Next.js apps, they share a second App Service Plan. New subscriptions often have **zero quota** for these VM families, so you must request an increase before the first deployment.

The default SKU is `B1`. If you override it to an S-series SKU in `infrastructure.json`, you need quota for that family instead (or both, if you mix SKUs).

### Navigate to Quotas

1. Go to the [Azure Portal](https://portal.azure.com)
2. Search for **"Quotas"** > click **My quotas**

### Find and Request

1. Filter: **Service:** App Service, **Location:** your deployment region
2. Request quota for each VM family you need:

| SKU in infrastructure.json | Quota to Request |
|----------------------------|------------------|
| B1, B2, B3 (default)      | B1/B2/B3 VMs     |
| S1, S2, S3                | S1/S2/S3 VMs     |
| P1v3, P2v3, P3v3          | P1v3/P2v3/P3v3 VMs |

3. Select the row (e.g., **"B1 VMs"**, showing "0 of 0") > click **Request increase**
4. Set the new limit based on your needs — 1 for Kong, plus 1 if your project includes Next.js apps (all Next.js apps share one plan)
5. Submit and wait for approval (usually 1-4 hours, often minutes)

If the self-service option is not available, create a support request: **Help + support** > **+ Create a support request** > Issue type: "Service and subscription limits (quotas)" > Quota type: "App Service"

## Step 1: Create App Registration

1. Go to [Azure Portal](https://portal.azure.com) > search **"Microsoft Entra ID"**
2. Under **Manage**, click **App registrations** > **+ New registration**
3. **Name:** `{projectName}-{env}` (e.g., `myapp-dev`)
4. **Supported account types:** "Accounts in this organizational directory only"
5. **Redirect URI:** Leave blank
6. Click **Register**

From the **Overview** page, copy:
- **Application (client) ID** > this is `clientId`
- **Directory (tenant) ID** > this is `tenantId`

## Step 2: Create Client Secret

1. Click on your App Registration from the list to open it
2. In the left sidebar under **Manage**, click **Certificates & secrets**
3. Click **+ New client secret**
4. **Description:** `{projectName}-{env}-key` (e.g., `myapp-dev-key`)
5. **Expires:** 24 months
6. Click **Add**
7. Two fields appear side by side: **Secret ID** and **Value**. Copy the **Value** field (the long string) — this is your `clientSecret`. It is only shown once; if you navigate away, you cannot retrieve it.

## Step 3: Get Subscription ID

1. Search for **"Subscriptions"** in the portal
2. Click your subscription
3. Copy the **Subscription ID**

## Step 4: Create Resource Group

:::danger Naming is required
The resource group **must** be named exactly `{projectName}-{env}-rg`. The framework derives this name from your project name and environment — there is no way to override it. If the name doesn't match, all commands will fail.
:::

1. Search for **"Resource groups"** > **+ Create**
2. **Subscription:** Select from Step 3
3. **Resource group:** `{projectName}-{env}-rg` (e.g., `tsdevstack-dev-rg`)
4. **Region:** Choose your region (e.g., `East US 2`). Avoid `East US` — PostgreSQL Flexible Server is often restricted there.
5. Click **Review + create** > **Create**

## Step 5: Grant Permissions

The Service Principal needs three roles on the resource group.

Go to the Resource Group > **Access control (IAM)** > assign each role:

### Role 1: Contributor

- **+ Add** > **Add role assignment**
- Tab: **Privileged administrator roles** > select **Contributor**
- Select members > search for `tsdevstack-dev` > assign

### Role 2: Key Vault Secrets Officer

- **+ Add** > **Add role assignment**
- Tab: **Job function roles** > search **Key Vault Secrets Officer**
- Select members > search for `tsdevstack-dev` > assign

### Role 3: User Access Administrator (constrained)

- **+ Add** > **Add role assignment**
- Tab: **Privileged administrator roles** > select **User Access Administrator**
- Select members > search for `tsdevstack-dev`
- On the Conditions step: click **Select roles and principals**
- Select **Constrain roles** template
- Click **+ Select roles** > search and add each:
  - Key Vault Secrets Officer
  - Key Vault Secrets User
  - AcrPull
- Save and assign

| Role | Purpose |
|------|---------|
| Contributor | Create and manage resources (Key Vault, Container Apps, databases, etc.) |
| Key Vault Secrets Officer | Read, write, and delete secrets in Key Vault |
| User Access Administrator (constrained) | Assign only Key Vault + AcrPull roles to Container App Managed Identities |

All roles above are scoped to the resource group. Provider registration (done earlier) is a separate subscription-level operation.

## Step 6: Save Credentials

Create `.tsdevstack/.credentials.azure.json`:

```json
{
  "dev": {
    "clientId": "<Application (client) ID from Step 1>",
    "clientSecret": "<Secret Value from Step 2>",
    "tenantId": "<Directory (tenant) ID from Step 1>",
    "subscriptionId": "<Subscription ID from Step 3>",
    "location": "eastus2"
  }
}
```

Add more environments as needed. Each environment must use a **different `subscriptionId`** (enforced by framework).

## Step 7: Initialize

```bash
npx tsdevstack cloud:init --azure
```

This will:
1. Validate each environment has a unique subscription
2. Verify resource providers are registered (skips already-registered providers)
3. Create Key Vault with RBAC authorization enabled
4. Assign Key Vault Secrets Officer role to the SP
5. Test connection to Key Vault
6. Update `.tsdevstack/config.json` with `cloud.provider: "azure"`

Safe to run multiple times — all operations are idempotent.

## Secret Naming

Azure Key Vault only allows alphanumeric characters and hyphens. The framework auto-transforms underscores:
- `DATABASE_URL` > stored as `DATABASE-URL`
- `JWT_PRIVATE_KEY_CURRENT` > stored as `JWT-PRIVATE-KEY-CURRENT`

Your code always uses underscores — the transformation is transparent.

## Environment Isolation

Each environment must use a separate subscription (unique `subscriptionId`). The framework validates this during `cloud:init`.

## Troubleshooting

### "Forbidden" or "Access Denied"

1. Check the SP has all three roles on the resource group (Step 5)
2. Verify credentials match the App Registration
3. Verify `subscriptionId` matches the subscription containing the resource group

### "does not have authorization to perform action ... register/action"

Resource providers are not registered on the subscription. Go to **Subscriptions** > your subscription > **Resource providers** and register all providers listed in [Register Resource Providers](#register-resource-providers).

### "Key Vault not found"

Run `npx tsdevstack cloud:init --azure` to create it.

### "Credentials file not found"

Ensure the file exists at `.tsdevstack/.credentials.azure.json`.
