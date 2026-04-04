# Custom Email Provider

The framework uses [Resend](https://resend.com) for production emails and a console logger for local development. You can replace either with any email service — SendGrid, Mailgun, Postmark, Amazon SES, etc.

The `NotificationService` API stays the same. Only the underlying delivery mechanism changes.

## How it works

`NotificationModule` registers an `EMAIL_PROVIDER` injection token that resolves to an `EmailProvider` implementation. By default, the framework selects the provider based on the `EMAIL_PROVIDER` secret:

| Secret Value | Provider | Environment |
|-------------|----------|-------------|
| `console` (default) | `ConsoleEmailProvider` | Local development |
| `resend` | `ResendEmailProvider` | Cloud (auto-set) |

To use a different provider, override the token in your AppModule.

## Step 1: Implement the `EmailProvider` interface

```typescript
import type { EmailProvider, EmailOptions } from '@tsdevstack/nest-common';
import { SecretsService } from '@tsdevstack/nest-common';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class SendGridEmailProvider implements EmailProvider, OnModuleInit {
  private apiKey: string;
  private from: string;

  constructor(private readonly secrets: SecretsService) {}

  async onModuleInit(): Promise<void> {
    this.apiKey = await this.secrets.get('SENDGRID_API_KEY');
    this.from = await this.secrets.get('EMAIL_FROM');
  }

  async send(options: EmailOptions): Promise<void> {
    // Call SendGrid API using this.apiKey
    // options has: to, subject, html, from? (optional override)
  }

  getName(): string {
    return 'sendgrid';
  }
}
```

The interface has two methods:

| Method | Purpose |
|--------|---------|
| `send(options)` | Send the email. `options` contains `to`, `subject`, `html`, and optional `from`. |
| `getName()` | Return a string identifier for logging and debugging. |

## Step 2: Override the token in AppModule

```typescript
import { Module } from '@nestjs/common';
import { NotificationModule, EMAIL_PROVIDER } from '@tsdevstack/nest-common';
import { SendGridEmailProvider } from './providers/sendgrid-email.provider';

@Module({
  imports: [NotificationModule],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useClass: SendGridEmailProvider,
    },
  ],
})
export class AppModule {}
```

`EMAIL_PROVIDER` is exported from `@tsdevstack/nest-common`. Your provider takes precedence over the built-in factory. All `NotificationService.sendEmail()` calls will use your provider.

:::info
You can also use `useFactory` instead of `useClass` if you need more control over initialization — for example, to conditionally select between providers based on environment.
:::

## Step 3: Add your secrets

Add your provider's API key to `.secrets.user.json` and assign it to the service that sends emails:

```json
{
  "secrets": {
    "SENDGRID_API_KEY": "SG.xxx..."
  },
  "auth-service": {
    "secrets": ["SENDGRID_API_KEY"]
  }
}
```

Then regenerate secrets:

```bash
npx tsdevstack generate-secrets
```

For cloud environments, push the secret:

```bash
npx tsdevstack cloud-secrets:set SENDGRID_API_KEY --value "SG.xxx..." --env prod
```

## What stays the same

After switching providers, everything else works as before:

- `NotificationService.sendEmail()` API is unchanged
- Local development still logs to console (unless you override that too)
- Email rate limiting (`EmailRateLimitGuard`) still works
- No changes needed in any service code that sends emails

## Testing locally

To test your custom provider in local development, set `EMAIL_PROVIDER` to a value that triggers your factory logic. Or use `useFactory` to check the environment:

```typescript
{
  provide: EMAIL_PROVIDER,
  useFactory: async (secrets: SecretsService, logger: LoggerService) => {
    const provider = await secrets.get('EMAIL_PROVIDER').catch(() => 'console');

    if (provider === 'sendgrid') {
      const sgProvider = new SendGridEmailProvider(secrets);
      await sgProvider.onModuleInit();
      return sgProvider;
    }

    // Fall back to console for local dev
    return new ConsoleEmailProvider(logger);
  },
  inject: [SecretsService, LoggerService],
}
```

For Resend-specific setup (account creation, domain verification, DNS records), see [Resend Integration](/integrations/resend).
