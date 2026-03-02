# Azure Account Setup

Setting up Azure for tsdevstack deployments. Each environment requires its own subscription for isolation.

:::warning
**App Service quota required before first deploy.** New subscriptions often have **zero quota** for Basic-tier VMs. You must request a quota increase before running `infra:deploy`, or it will fail with `Current Limit (Basic VMs): 0`. See [App Service Quota](#app-service-quota) below.
:::

## Prerequisites

- Azure account with portal access
- One Azure subscription per environment (dev, staging, prod)
- App Service plan quota in your target region (Basic/B-series)

## App Service Quota

The framework deploys Kong and Next.js on App Service Plans (default SKU: `B1`). Request a quota increase before the first deployment.

### Register the Resource Provider

New Azure subscriptions do not have the `Microsoft.Web` resource provider registered. The quota list will be **empty** until you register it.

1. Go to the [Azure Portal](https://portal.azure.com) > **Subscriptions** > select your subscription
2. In the left sidebar under **Settings**, click **Resource providers**
3. Search for **`Microsoft.Web`**
4. Select it and click **Register**
5. Wait until the status changes to **Registered** (usually under a minute)

This must be done manually — you need the provider registered to request the quota, and you need the quota before the first deploy.

### Navigate to Quotas

1. Go to the [Azure Portal](https://portal.azure.com)
2. Search for **"Quotas"** > click **My quotas**

### Find and Request

1. Filter: **Service:** App Service, **Location:** your deployment region
2. Find **"B1 VMs"** (shows "0 of 0")
3. Select the row > click **Request increase**
4. Set new limit to **10**
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

All roles are scoped to the resource group only — not the subscription.

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
2. Register required Azure resource providers
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

### "Key Vault not found"

Run `npx tsdevstack cloud:init --azure` to create it.

### "Credentials file not found"

Ensure the file exists at `.tsdevstack/.credentials.azure.json`.
