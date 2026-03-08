# AWS CI/CD

Set up OIDC (OpenID Connect) federation for GitHub Actions to authenticate with AWS without storing long-lived access keys.

For generating workflow files and general CI/CD setup, see [CI/CD Setup](/infrastructure/cicd-setup).

## Overview

GitHub Actions mints a short-lived OIDC token for each workflow run. AWS verifies this token against the IAM Identity Provider and issues temporary credentials for the specified IAM Role. No access keys are stored in GitHub.

## Step 1: Create IAM OIDC Identity Provider

Do this **once per AWS account** (repeat in each member account that CI will deploy to).

1. Switch to the member account (e.g., `tsdevstack-dev`)
2. Go to [IAM](https://console.aws.amazon.com/iam/) > **Identity Providers** > **Add provider**
3. Enter:
   - **Provider type:** OpenID Connect
   - **Provider URL:** `https://token.actions.githubusercontent.com` (thumbprint is fetched automatically)
   - **Audience:** `sts.amazonaws.com`
4. Click **Add provider**

## Step 2: Create IAM Role for GitHub Actions

Do this **once per AWS account**.

1. Go to [IAM](https://console.aws.amazon.com/iam/) > **Roles** > **Create role**
2. Select **Web identity**:
   - **Identity provider:** `token.actions.githubusercontent.com`
   - **Audience:** `sts.amazonaws.com`
3. Fill in the GitHub repository restriction:
   - **GitHub organization:** Your GitHub username or org
   - **GitHub repository:** Your repo name (e.g., `my-project`)
   - **GitHub branch:** `main` to restrict deploys to main only, or leave empty for all branches
4. **Skip** attaching managed policies (you'll add an inline policy next)
5. **Role name:** `github-actions-deploy`
6. **Verify the trust policy** — AWS shows it before creation. Confirm the `StringLike` condition matches your intent:

   **Repository only** (any branch can deploy — use `*` wildcard):
   ```json
   "StringLike": {
     "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:*"
   }
   ```

   **Repository + branch** (only `main` can deploy):
   ```json
   "StringLike": {
     "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:ref:refs/heads/main"
   }
   ```

   Replace `YOUR_ORG/YOUR_REPO` with your values. Edit the policy JSON directly if needed.

   | | Repository only | Repository + branch |
   |---|---|---|
   | Deploy from feature branches | Yes | No |
   | PR workflows (build/lint/test) | Not affected (no AWS auth) | Not affected (no AWS auth) |
   | Security | Any branch in your repo can trigger deploys | Only `main` can trigger deploys |
   | Recommended for | Teams that test deploys from branches | Most projects |

7. Click **Create role**

## Step 3: Add Inline Policy

AWS limits roles to 10 managed policies. Use a single inline policy to cover all services needed for deployment.

1. Go to [IAM](https://console.aws.amazon.com/iam/) > **Roles** > click the **github-actions-deploy** role you just created
2. Go to **Permissions** tab > **Add permissions** > **Create inline policy**
3. Click **JSON** and paste this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3TerraformStateAndSPA",
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": "*"
    },
    {
      "Sid": "DynamoDBTerraformLocking",
      "Effect": "Allow",
      "Action": "dynamodb:*",
      "Resource": "*"
    },
    {
      "Sid": "SecretsManager",
      "Effect": "Allow",
      "Action": "secretsmanager:*",
      "Resource": "*"
    },
    {
      "Sid": "ECRContainerRegistry",
      "Effect": "Allow",
      "Action": "ecr:*",
      "Resource": "*"
    },
    {
      "Sid": "ECSFargate",
      "Effect": "Allow",
      "Action": "ecs:*",
      "Resource": "*"
    },
    {
      "Sid": "RDSPostgreSQL",
      "Effect": "Allow",
      "Action": "rds:*",
      "Resource": "*"
    },
    {
      "Sid": "ElastiCacheRedis",
      "Effect": "Allow",
      "Action": "elasticache:*",
      "Resource": "*"
    },
    {
      "Sid": "VPCAndNetworking",
      "Effect": "Allow",
      "Action": ["ec2:*", "elasticloadbalancing:*"],
      "Resource": "*"
    },
    {
      "Sid": "CloudFrontCDN",
      "Effect": "Allow",
      "Action": "cloudfront:*",
      "Resource": "*"
    },
    {
      "Sid": "ACMCertificates",
      "Effect": "Allow",
      "Action": "acm:*",
      "Resource": "*"
    },
    {
      "Sid": "LambdaFunctions",
      "Effect": "Allow",
      "Action": "lambda:*",
      "Resource": "*"
    },
    {
      "Sid": "EventBridgeScheduler",
      "Effect": "Allow",
      "Action": ["events:*", "scheduler:*"],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogsAndMetrics",
      "Effect": "Allow",
      "Action": ["logs:*", "cloudwatch:*"],
      "Resource": "*"
    },
    {
      "Sid": "IAMServiceRoles",
      "Effect": "Allow",
      "Action": "iam:*",
      "Resource": "*"
    },
    {
      "Sid": "Route53DNS",
      "Effect": "Allow",
      "Action": "route53:*",
      "Resource": "*"
    },
    {
      "Sid": "WAFFirewall",
      "Effect": "Allow",
      "Action": "wafv2:*",
      "Resource": "*"
    },
    {
      "Sid": "KMSEncryption",
      "Effect": "Allow",
      "Action": "kms:*",
      "Resource": "*"
    },
    {
      "Sid": "AppRunnerFrontend",
      "Effect": "Allow",
      "Action": "apprunner:*",
      "Resource": "*"
    },
    {
      "Sid": "ServiceDiscovery",
      "Effect": "Allow",
      "Action": "servicediscovery:*",
      "Resource": "*"
    },
    {
      "Sid": "ApplicationAutoScaling",
      "Effect": "Allow",
      "Action": "application-autoscaling:*",
      "Resource": "*"
    },
    {
      "Sid": "CloudTrailAudit",
      "Effect": "Allow",
      "Action": "cloudtrail:*",
      "Resource": "*"
    },
    {
      "Sid": "STSIdentity",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    }
  ]
}
```

4. **Policy name:** `tsdevstack-deploy`

:::info
Why an inline policy? AWS limits roles to 10 managed policies by default. A single inline policy covers all 15+ services needed for deployment without hitting that limit.
:::

## Step 4: Copy the Role ARN

Copy the **ARN** from the role page. Format: `arn:aws:iam::123456789012:role/github-actions-deploy`

## Step 5: Repeat for Each Environment

Switch to each member account (staging, prod) and repeat Steps 1-4.

## GitHub Secrets

Go to your GitHub repository > **Settings** > **Secrets and variables** > **Actions**.

For each environment, set 2 secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `AWS_ROLE_ARN_DEV` | Role ARN from dev account | `arn:aws:iam::123456789012:role/github-actions-deploy` |
| `AWS_REGION_DEV` | AWS region | `us-east-1` |
| `AWS_ROLE_ARN_PROD` | Role ARN from prod account | `arn:aws:iam::345678901234:role/github-actions-deploy` |
| `AWS_REGION_PROD` | AWS region | `us-east-1` |

::: info Environment names are your choice
The framework has no naming convention for environments. `dev`, `staging`, `prod` are common choices, but you can use any name. The suffix is always the UPPERCASE version of your environment name.
:::

## User Secrets (Required Before First Deployment)

The CI workflow pushes framework-generated secrets automatically (`cloud-secrets:push --skip-user-secrets`), but **user secrets must be created manually** in AWS Secrets Manager before the first CI deployment.

::: warning Required before running CI
Without these secrets, deployment will fail. The CI pipeline cannot prompt for interactive input.
:::

### Creating Secrets in AWS Console

1. Switch to the member account for the target environment (e.g., dev)
2. Go to [Secrets Manager](https://console.aws.amazon.com/secretsmanager/) and select your region
3. Click **Store a new secret**
4. **Secret type:** Select **Other type of secret**
5. **Key/value:** Switch to **Plaintext** tab, enter only the value (e.g., `example.com`)
6. Click **Next**
7. **Secret name:** Enter the full name (e.g., `myapp-shared-DOMAIN`)
8. Click **Next** > **Next** > **Store**

Repeat for each required secret in each environment.

### Secret Naming Format

Secrets in AWS Secrets Manager follow the format: `{project-name}-{scope}-{KEY}`

Where `{project-name}` is the `project.name` from your `.tsdevstack/config.json`.

For example, if your project name is `myapp`:

| Secret Key | AWS Secrets Manager Name |
|------------|------------------------|
| `DOMAIN` | `myapp-shared-DOMAIN` |
| `RESEND_API_KEY` | `myapp-shared-RESEND_API_KEY` |
| `EMAIL_FROM` | `myapp-shared-EMAIL_FROM` |

### Required User Secrets

These are the minimum secrets required by the framework:

| Secret | Description | Example |
|--------|-------------|---------|
| `DOMAIN` | Your base domain | `example.com` |
| `RESEND_API_KEY` | API key from [resend.com/api-keys](https://resend.com/api-keys) | `re_123abc...` |
| `EMAIL_FROM` | Sender email address | `noreply@example.com` |

::: warning Check your .secrets.user.json
Your project may have additional user secrets (e.g., `STRIPE_KEY`, `TWILIO_SID`). Any secret defined in `.secrets.user.json` that is not framework-generated must also be created manually in AWS Secrets Manager before deployment. Use the same naming format: `{project-name}-shared-{KEY}`.
:::

### Alternative: Using the CLI

If you have local credentials configured (see [Account Setup](/infrastructure/providers/aws/account-setup)), you can push all user secrets from your machine:

```bash
npx tsdevstack cloud-secrets:push --env dev
```

This will prompt for `DOMAIN`, `RESEND_API_KEY`, `EMAIL_FROM`, and any custom secrets interactively.

## Workflow Authentication Pattern

The generated workflows authenticate using `aws-actions/configure-aws-credentials`:

```yaml
permissions:
  contents: read
  id-token: write  # Required for OIDC token

steps:
  - name: Set environment variables
    run: |
      ENV_UPPER=$(echo '${{ inputs.environment }}' | tr '[:lower:]' '[:upper:]')
      echo "AWS_ROLE_ARN_NAME=AWS_ROLE_ARN_${ENV_UPPER}" >> $GITHUB_ENV
      echo "AWS_REGION_NAME=AWS_REGION_${ENV_UPPER}" >> $GITHUB_ENV

  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: ${{ secrets[env.AWS_ROLE_ARN_NAME] }}
      aws-region: ${{ secrets[env.AWS_REGION_NAME] }}
```

The `id-token: write` permission is **required** — without it, GitHub won't issue the OIDC token and authentication will fail silently.

## Troubleshooting

### "Not authorized to perform sts:AssumeRoleWithWebIdentity"

1. Trust policy missing or wrong repository condition
2. `id-token: write` permission not set in workflow
3. OIDC Identity Provider not created in the target account

Check the trust policy matches your repository exactly. The `sub` claim format is `repo:ORG/REPO:ref:refs/heads/BRANCH`.

### "Could not assume role with OIDC"

1. Wrong Role ARN in GitHub secret
2. Role doesn't exist in the target account
3. Audience mismatch (must be `sts.amazonaws.com`)

### ECR login fails

Role doesn't have `ecr:GetAuthorizationToken` permission. Ensure the inline policy includes ECR actions.
