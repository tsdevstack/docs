# GCP Account Setup

Setting up GCP for tsdevstack deployments. Each environment uses a separate GCP project — repeat these steps for each project.

## Service Account Setup

### 1. Create Service Account

1. Go to [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Select your project
3. Click **Create Service Account**
4. Name: `tsdevstack-deploy` (or similar)
5. Click **Create and Continue**

### 2. Grant Initial Roles

Grant these 2 roles to the service account:

| Role | Purpose |
|------|---------|
| Security Admin | Allows bootstrap to add additional roles |
| Service Usage Admin | Allows bootstrap to enable APIs |

In the "Grant this service account access to project" step:
1. Click **Add Another Role**
2. Search and add: `Security Admin`
3. Click **Add Another Role**
4. Search and add: `Service Usage Admin`
5. Click **Continue** then **Done**

### 3. Create JSON Key

1. Click on the service account you created
2. Go to **Keys** tab
3. Click **Add Key > Create new key**
4. Select **JSON**
5. Save the downloaded file

### 4. Configure Credentials

Create `.tsdevstack/.credentials.gcp.json` with your key:

```json
{
  "dev": {
    "type": "service_account",
    "project_id": "your-dev-project",
    "private_key_id": "...",
    "private_key": "-----BEGIN PRIVATE KEY-----\n...",
    "client_email": "tsdevstack-deploy@your-dev-project.iam.gserviceaccount.com",
    ...
  },
  "prod": {
    "type": "service_account",
    "project_id": "your-prod-project",
    ...
  }
}
```

Each environment must have a different `project_id`.

### 5. Initialize

```bash
npx tsdevstack cloud:init --gcp
```

This automatically:
- Enables all required APIs (14 APIs including Secret Manager, Cloud Run, Cloud SQL, etc.)
- Adds all required roles to the service account (16 additional roles)
- Tests the connection

## What Gets Added Automatically

The `cloud:init` command calls `infra:bootstrap`, which enables APIs and adds roles.

**APIs enabled:** Secret Manager, Cloud Run, Artifact Registry, Cloud SQL Admin, Memorystore Redis, Compute Engine, Serverless VPC Access, Service Networking, Cloud Resource Manager, Certificate Manager, Cloud DNS, Cloud Functions, Cloud Build, Cloud Scheduler

**Roles added to the service account:**
- Secret Manager Admin
- Cloud Run Admin
- Artifact Registry Admin
- Cloud SQL Admin
- Cloud Memorystore Redis Admin
- Compute Admin (VPCs, NEGs, load balancers)
- Serverless VPC Access Admin
- Service Networking Admin
- Storage Admin
- Service Account Admin + User
- Certificate Manager Owner
- DNS Admin
- Cloud Functions Admin + Cloud Build Builder
- Cloud Scheduler Admin

## Environment Isolation

Each environment must use a separate GCP project (unique `project_id`). The framework validates this during `cloud:init` and rejects duplicate project IDs.

## User Secrets via Console

To set user secrets directly in GCP:

1. Go to [Secret Manager](https://console.cloud.google.com/security/secret-manager)
2. Click **Create Secret**
3. Name format: `{project-name}-shared-{KEY}`

Or use the CLI:

```bash
npx tsdevstack cloud-secrets:push --env prod
```

See [Cloud Secrets](/secrets/cloud-secrets) for details on secret naming and management.

## Troubleshooting

### Service Deployment Fails

1. Go to [Cloud Run](https://console.cloud.google.com/run) and check service logs
2. Go to [Artifact Registry](https://console.cloud.google.com/artifacts) and verify the image exists
3. Go to [Secret Manager](https://console.cloud.google.com/security/secret-manager) and verify all required secrets exist

### Missing User Secrets

```bash
# Check what secrets exist
npx tsdevstack cloud-secrets:list --env prod

# Set missing secrets
npx tsdevstack cloud-secrets:set API_URL --value "https://api.example.com" --env prod
```
