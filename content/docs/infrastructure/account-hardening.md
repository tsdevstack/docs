# Account Hardening

tsdevstack sets up each environment it deploys with a WAF at the edge, private networks, encrypted storage, private buckets, access logs and an audit trail. [Compliance Readiness](/docs/security/compliance-readiness) lists all of it.

The services on this page work on your cloud account as a whole, often across all your projects. The framework doesn't turn them on. They cost money per account, and if you work in a company, your team may already run them. This page says what each one does, what it costs, and how to turn it on.

Prices were checked on 2026-11-09: AWS for US East (N. Virginia), Google's list prices, and Azure's retail prices (Sweden Central, an hourly rate times 730 hours for a month). Prices change, so check the linked pages before you decide.

## At a glance

| | GCP | AWS | Azure |
|---|---|---|---|
| **Threat detection** | Security Command Center Premium | GuardDuty | Defender for Cloud plans |
| **Findings in one place** | Security Command Center | Security Hub | Defender for Cloud |
| **Secret rotation** | Secret Manager rotation schedule | Secrets Manager rotation | Key Vault near-expiry events |
| **DNSSEC** | At your DNS provider | Route 53 signing | Azure DNS signing |

## Threat detection

These services watch your account's activity and network traffic, and report unusual behaviour as findings. They don't block anything on their own.

| | GCP | AWS | Azure |
|---|---|---|---|
| **Service** | [Security Command Center](https://cloud.google.com/security-command-center/pricing) Premium (Event Threat Detection) | [GuardDuty](https://aws.amazon.com/guardduty/pricing/) | [Microsoft Defender for Cloud](https://azure.microsoft.com/pricing/details/defender-for-cloud/) plans |
| **Price** | 30-day trial, then pay-as-you-go by the vCPU-hours of the compute it watches | $4.00 per million CloudTrail management events; $1.00 per GB of VPC flow and DNS logs (first 500 GB); 30-day free trial | Per plan, per month: App Service $14.60 per instance, PostgreSQL $15 per server, Storage $9.78 per storage account, Key Vault $0.25 per vault, Resource Manager $5.04 per subscription; 30-day trial |
| **Turn it on** | Console: Security Command Center, activate Premium for the project | Console: GuardDuty, Get started, Enable. Do it in your environment's region | Portal: Defender for Cloud, Environment settings, your subscription, turn on the plans you want |

- **GCP:** Security Command Center only works for a project that belongs to an organization. A project made with a personal Google account has none. If the trial ends and you don't go back to the Standard tier first, Premium keeps billing.
- **AWS:** GuardDuty reads CloudTrail, VPC flow logs and DNS logs on its own. It doesn't need the trail or flow logs tsdevstack creates. During the trial, GuardDuty's Usage page estimates your monthly cost.
- **Azure:** each plan covers one kind of resource. For a tsdevstack environment the useful ones are App Service (Kong and the Next.js apps), PostgreSQL, Key Vault, Storage and Resource Manager.

## Findings in one place

These services check your setup against each cloud's recommended settings and gather the findings, their own and the threat detection service's, in one list.

| | GCP | AWS | Azure |
|---|---|---|---|
| **Service** | Security Command Center Standard, or Premium for every check | [Security Hub](https://aws.amazon.com/security-hub/pricing/), Essentials plan | Defender for Cloud: Foundational CSPM, or Defender CSPM |
| **Price** | Standard: no charge. Premium: see Threat detection | $3.75 per resource unit per month. One EC2 instance is one unit; so are 18 ECR images, 12 Lambda functions, or 125 IAM users and roles. 30-day free trial | Foundational CSPM: free. Defender CSPM: $5.11 per billable resource per month (servers, databases, storage accounts, serverless containers) |
| **Turn it on** | Console: Security Command Center, activate for the project (needs an organization) | Console: Security Hub, enable it in your environment's region | Portal: open Defender for Cloud to see the free recommendations. Defender CSPM: Environment settings, plans |

- **AWS:** a tsdevstack environment runs on Fargate, so it has no EC2 instances. What counts is its container images in ECR, its Lambda functions and its IAM roles. The Essentials plan includes the AWS Config recorder it needs.

## Secret rotation

Rotating a secret means replacing it with a new value, on a schedule or whenever you choose.

**In tsdevstack:**

- **Secrets you add yourself** (a payment provider's API key, for example): create a new key at the provider, then store it:

  ```bash
  npx tsdevstack cloud-secrets:set STRIPE_KEY --env prod
  ```

  Code that reads it with `SecretsService` gets the new value within 5 minutes. A value your code reads from `process.env` changes on the next deploy. Then remove the old key at the provider.
- **JWT signing keys:** see [Key rotation](/docs/authentication/jwt-tokens#key-rotation).
- **Database passwords:** see [Changing a service's database password](#changing-a-services-database-password) below.

Don't attach the cloud's automatic rotation to the secrets the framework manages (database URLs, JWT keys, service URLs). The framework writes them and expects their format.

**What each cloud can automate,** for the secrets you add yourself:

| | GCP | AWS | Azure |
|---|---|---|---|
| **What it does** | [Secret Manager](https://docs.cloud.google.com/secret-manager/docs/secret-rotation) sends a Pub/Sub message on your schedule (at least an hour apart). It doesn't change the value: you build what does | [Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html) runs your Lambda function on a schedule, which makes the new value and updates the secret. Some AWS services have managed rotation without a function | [Key Vault](https://learn.microsoft.com/azure/key-vault/secrets/tutorial-rotation) sends a "near expiry" event to Event Grid 30 days before the secret's expiry date. A function you build makes the new value |
| **Price** | Pub/Sub and your function | Your Lambda function | Event Grid and your function |

### Changing a service's database password

Each service connects to its database with its own user, through its `DATABASE_URL`. To give that user a new password, run three steps. The example uses `auth-service` in `prod`:

1. Replace the service's `DATABASE_URL` with a placeholder:

   ```bash
   npx tsdevstack cloud-secrets:set DATABASE_URL replace-me --service auth-service --env prod --overwrite
   ```

2. Deploy the infrastructure. Its database step finds no password in the URL, sets a new one and writes the new `DATABASE_URL`:

   ```bash
   npx tsdevstack infra:deploy --env prod
   ```

3. Deploy the service, so it and its workers start with the new URL:

   ```bash
   npx tsdevstack infra:deploy-service auth-service --env prod
   ```

Run the steps one after another, at a quiet time. Until step 3 is done, the service may briefly lose its database connection.

This changes the password the service runs with. The migrations use a separate one, which stays as it is.

## Mutual TLS between services

Mutual TLS (mTLS) makes each service prove who it is on every call to another service. Your services already reach each other without going over the public internet. Adding mTLS isn't an account setting on any of the three clouds:

- **AWS:** ECS offers it through Service Connect, with a certificate authority in [AWS Private CA](https://aws.amazon.com/private-ca/pricing/): $50 a month for a short-lived certificate authority plus $0.058 per certificate. tsdevstack uses Cloud Map for service discovery instead.
- **Azure:** the Container Apps environment has an mTLS setting, in public preview. tsdevstack's Terraform keeps it off, so a change made by hand is undone by the next `infra:deploy`.
- **GCP:** Cloud Run checks the caller when a service requires IAM and every call carries a Google ID token. tsdevstack doesn't set that up.

## DNSSEC

DNSSEC signs your domain's DNS answers, so resolvers can check that they're genuine. It takes two parts: your DNS host signs the zone, and your registrar publishes a DS record for it.

| | GCP | AWS | Azure |
|---|---|---|---|
| **Your DNS host** | Your registrar or DNS provider (tsdevstack adds no public DNS zone on GCP) | Your Route 53 hosted zone | The Azure DNS zone tsdevstack creates |
| **Price** | Your DNS provider's. Cloud DNS lists no separate charge for it | [Route 53](https://aws.amazon.com/route53/pricing/) doesn't charge for signing. You pay for the KMS key it signs with, about $1 a month | Azure DNS lists no separate charge for it |
| **Turn it on** | At your DNS provider. In Cloud DNS: open the zone, Edit, DNSSEC On. Then add the DS record at your registrar | Route 53: the hosted zone, DNSSEC signing, enable signing (it uses a KMS key in us-east-1). Then add the DS record at your registrar | Portal: the DNS zone, [DNSSEC](https://learn.microsoft.com/azure/dns/dnssec), sign the zone. Then add the DS record at your registrar |

- **Check before you add the DS record:** once it's published, resolvers that check signatures stop answering for your domain if the signing breaks. On Route 53, set a CloudWatch alarm on `DNSSECInternalFailure` and `DNSSECKeySigningKeysNeedingAction`, as AWS recommends.
- **Turning it off:** in reverse. Remove the DS record at the registrar first, wait for its TTL, then stop signing.

:::warning Azure: infra:destroy deletes the DNS zone
The zone goes with the environment, and so do its signing keys. Before you destroy, remove the DS record at your registrar and wait for its TTL. Otherwise resolvers that check signatures stop answering for your domain. A later deploy creates a new zone with new keys: sign it again and add its new DS record.
:::
