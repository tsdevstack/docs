# Resend (Email Notifications)

[Resend](https://resend.com) is the default email provider for production deployments. The framework uses it for transactional emails — verification, password resets, invitations, etc.

In local development, emails are logged to the console. No Resend account is needed until you deploy to the cloud.

## Prerequisites

- A [Resend account](https://resend.com) (free tier available)
- A domain you control (for DNS verification)
- Cloud environment deployed ([Infrastructure setup](/infrastructure/architecture))

## Local Development

No setup needed. The framework uses a `console` provider that logs emails to the terminal:

```
[Nest] LOG [Email] ----------------------------------------
[Nest] LOG [Email] Email would be sent:
[Nest] LOG [Email]   To: user@example.com
[Nest] LOG [Email]   Subject: Verify your email
[Nest] LOG [Email]   Body: <h1>Welcome!</h1>...
[Nest] LOG [Email] ----------------------------------------
```

To test with real emails locally, set `EMAIL_PROVIDER` to `resend` in `.secrets.user.json` (see [Local Secrets](/secrets/local-secrets)):

```json
{
  "shared": {
    "EMAIL_PROVIDER": "resend",
    "EMAIL_FROM": "noreply@yourdomain.com",
    "RESEND_API_KEY": "re_xxxx..."
  }
}
```

Then regenerate secrets:

```bash
npx tsdevstack generate-secrets
```

## Production Setup

### 1. Create a Resend Account

1. Sign up at [resend.com](https://resend.com)
2. Get your API key from the [API Keys page](https://resend.com/api-keys)

### 2. Verify Your Domain

In the [Resend dashboard](https://resend.com/domains), add your domain. Resend will show the exact DNS records you need to create (DKIM, SPF, MX, and optionally DMARC). Follow their instructions — the records and values may change over time, so always use what the dashboard shows.

These records are separate from the infrastructure DNS records covered in [Domain Setup](/infrastructure/domain-setup).

#### Where to add these records

Where you create the DNS records depends on your cloud provider:

- **GCP** — Add the records at your **domain registrar** (Namecheap, Cloudflare, GoDaddy, etc.). GCP does not manage your DNS zone, so all DNS records (infrastructure and Resend) go to the registrar.
- **AWS** — Add the records in **Route 53**. Since your nameservers point to Route 53, it is the authoritative DNS for your domain. Go to [Route 53](https://console.aws.amazon.com/route53/) > Hosted zones > your domain > Create record.
- **Azure** — Add the records in **Azure DNS**. Since your nameservers point to Azure DNS, it is the authoritative DNS for your domain. Go to [Azure Portal](https://portal.azure.com) > DNS zones > your domain > + Record set.

:::tip
Set up Resend domain verification alongside your [infrastructure DNS records](/infrastructure/domain-setup#dns-records). You'll be adding DNS records for both at the same time, so doing them together avoids waiting for propagation twice.
:::

DNS propagation can take up to 48 hours, but usually completes within minutes.

### 3. Push Secrets

`cloud-secrets:push` prompts for Resend credentials automatically:

```bash
npx tsdevstack cloud-secrets:push --env prod
```

It will ask for:

| Secret | Example | Description |
|--------|---------|-------------|
| `RESEND_API_KEY` | `re_xxx...` | Your Resend API key |
| `EMAIL_FROM` | `noreply@example.com` | Default sender address |

To set or update individually:

```bash
npx tsdevstack cloud-secrets:set RESEND_API_KEY --value "re_xxx" --env prod
npx tsdevstack cloud-secrets:set EMAIL_FROM --value "noreply@example.com" --env prod
```

:::info
`EMAIL_PROVIDER` is automatically set to `resend` in cloud environments. You don't need to set it manually.
:::

## Usage

Import `NotificationModule` and inject `NotificationService`:

```typescript
import { NotificationService } from '@tsdevstack/nest-common';

@Injectable()
export class AuthService {
  constructor(private notifications: NotificationService) {}

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    await this.notifications.sendEmail({
      to: email,
      subject: 'Verify your email',
      html: `
        <h1>Welcome!</h1>
        <p>Click below to verify your email:</p>
        <a href="https://yourapp.com/verify?token=${token}">Verify Email</a>
      `,
    });
  }
}
```

For the full API reference (email options, custom providers, testing), see [NotificationModule in nest-common](/packages/nest-common#notifications).

## Using a Different Email Provider

Resend is the default, but you can replace it with SendGrid, Mailgun, Postmark, or any other provider by implementing the `EmailProvider` interface and overriding the `EMAIL_PROVIDER` injection token.

See [Custom Email Provider](/customization/email-provider) for a full walkthrough with code examples, secrets setup, and testing patterns.

## Secrets Reference

| Secret | Required | Default | Description |
|--------|----------|---------|-------------|
| `EMAIL_PROVIDER` | No | `console` (local), `resend` (cloud) | Email provider selection |
| `RESEND_API_KEY` | For production | — | Your Resend API key |
| `EMAIL_FROM` | No | — | Default sender address (e.g., `noreply@example.com`) |

## Troubleshooting

### Emails Not Sending in Production

1. Verify `RESEND_API_KEY` is set: `npx tsdevstack cloud-secrets:list --env prod`
2. Check that your domain is verified in the [Resend dashboard](https://resend.com/domains)
3. Check service logs for error messages

### Domain Not Verified

1. Confirm DNS records match what Resend shows in its dashboard
2. Wait for DNS propagation (up to 48 hours)
3. Use Resend's "Verify" button to re-check

### Emails Going to Spam

1. Ensure DKIM, SPF, and DMARC records are all set
2. Use a sender address on your verified domain (not a free email provider)
3. Start with low volume to build sender reputation
