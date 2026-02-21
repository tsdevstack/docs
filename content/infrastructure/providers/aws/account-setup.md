# AWS Account Setup

Setting up AWS for tsdevstack deployments. AWS requires **separate accounts per environment** for proper isolation.

```
AWS Organization (Management Account)
+-- tsdevstack-dev (Member Account)
+-- tsdevstack-staging (Member Account)
+-- tsdevstack-prod (Member Account)
```

**Why separate accounts?** Secrets Manager isolation, billing separation, resource name isolation, and impossible cross-environment access.

## Step 1: Create AWS Organization

1. Go to [AWS Organizations](https://console.aws.amazon.com/organizations/)
2. Click **Create an organization**
3. Your current account becomes the **Management Account**

## Step 2: Create IAM Admin User

The root user cannot switch roles to member accounts. You need an IAM user.

1. Go to [IAM](https://console.aws.amazon.com/iam/) > **Users** > **Create user**
2. **User name:** `admin`
3. Check: **Provide user access to the AWS Management Console**
4. Select: **I want to create an IAM user**
5. Attach: **AdministratorAccess** policy
6. **Copy the password** — you won't see it again
7. Sign out and sign back in as the IAM user

## Step 3: Create Member Account

Repeat for each environment (dev, staging, prod):

### 3.1 Create the Account

1. Go to [Organizations](https://console.aws.amazon.com/organizations/)
2. Click **Add an AWS account** > **Create an AWS account**
3. **Account name:** e.g. `myproject-dev` (use your own project naming)
4. **Email:** any email you own (e.g. `you+awsdev@gmail.com` using the + trick for unique addresses)
5. **IAM role name:** Leave as `OrganizationAccountAccessRole`
6. Wait 1-5 minutes until status shows **Active**

### 3.2 Get the Account ID

Click on the account in the Organizations page and **copy the 12-digit Account ID**.

### 3.3 Switch to the Member Account

1. Click your account name (top right)
2. Go to [Switch Role](https://signin.aws.amazon.com/switchrole)
3. Enter the **Account ID** and role name `OrganizationAccountAccessRole`

### 3.4 Create IAM User for tsdevstack

1. Go to [IAM](https://console.aws.amazon.com/iam/) > **Users** > **Create user**
2. **User name:** `tsdevstack-dev`
3. **DO NOT** check "Provide user access to the AWS Management Console"

### 3.5 Attach Policies

**For secrets + infrastructure (recommended):**

Attach `AdministratorAccess` for simplicity.

**For least-privilege (production):**

Attach these 17 managed policies:

| Policy | Services |
|--------|----------|
| `AmazonS3FullAccess` | Terraform state bucket, SPA hosting |
| `AmazonDynamoDBFullAccess` | Terraform state locking |
| `AmazonECS_FullAccess` | ECS Fargate services, task definitions |
| `AmazonEC2ContainerRegistryFullAccess` | ECR image registry |
| `AmazonRDSFullAccess` | PostgreSQL database |
| `AmazonElastiCacheFullAccess` | Redis |
| `AmazonVPCFullAccess` | VPC, subnets, security groups, NAT |
| `ElasticLoadBalancingFullAccess` | Application Load Balancer |
| `CloudFrontFullAccess` | CDN + distributions |
| `AWSLambda_FullAccess` | Wake-up Lambda, Job Invoker Lambda |
| `AmazonEventBridgeFullAccess` | Scheduled jobs |
| `SecretsManagerReadWrite` | Secret storage |
| `IAMFullAccess` | Create roles/policies for services |
| `AWSCertificateManagerFullAccess` | SSL certificates |
| `AmazonRoute53FullAccess` | DNS |
| `CloudWatchFullAccess` | Logs, alarms |
| `AWSWAFFullAccess` | Web application firewall |

### 3.6 Create Access Key

1. Click on the user > **Security credentials** tab
2. **Access keys** > **Create access key**
3. Select **Command Line Interface (CLI)**
4. **Copy both values** (Access key ID + Secret access key)

### 3.7 Repeat for Other Environments

Switch back to the Management Account and repeat Steps 3.1-3.6 for each environment.

## Step 4: Configure Credentials File

Create `.tsdevstack/.credentials.aws.json`:

```json
{
  "dev": {
    "accountId": "123456789012",
    "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "region": "us-east-1"
  },
  "prod": {
    "accountId": "345678901234",
    "accessKeyId": "AKIAIMRX7TNNEXAMPLE",
    "secretAccessKey": "vf4tBg2sjkdfh3KdnEXAMPLEKEYsldf98234sdkf",
    "region": "us-east-1"
  }
}
```

**Requirements:**
- Each environment must use a **different AWS account** (different `accountId`)
- Framework validates unique account IDs and verifies credentials belong to the specified account

## Step 5: Initialize Cloud Provider

```bash
npx tsdevstack cloud:init --aws
```

This will:
1. Read environments from `.credentials.aws.json`
2. Validate each environment has a unique `accountId`
3. Verify credentials belong to the specified account (via STS API)
4. Test connection to Secrets Manager
5. Update `.tsdevstack/config.json` with `cloud.provider: "aws"`

## Environment Isolation

Each environment must use a separate AWS account. The framework validates this during `cloud:init` and rejects duplicate account IDs.

## Troubleshooting

### "Cannot switch role" error

**Cause:** You're signed in as root user.
**Solution:** Create an IAM user with AdministratorAccess and sign in as that user.

### "Access Denied" when creating secrets

1. IAM user missing `SecretsManagerReadWrite` policy
2. Wrong credentials in file
3. Wrong region

### "Account ID mismatch"

The credentials belong to a different AWS account than specified in `accountId`. Check your Account ID in the AWS Console (top-right corner).

### "Duplicate AWS accountId detected"

You're using the same AWS account for multiple environments. Each environment must have its own separate AWS account.
