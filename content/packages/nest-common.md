# nest-common

`@tsdevstack/nest-common` is the shared [NestJS](https://nestjs.com/) library for tsdevstack projects. It provides authentication, secrets management, Redis, observability, rate limiting, notifications, background jobs, service-to-service communication, and database utilities — all configured to work across GCP, AWS, and Azure.

```bash
npm install @tsdevstack/nest-common
```

## Quick start

A typical `AppModule` imports the modules you need:

```typescript
import { Module } from '@nestjs/common';
import {
  ObservabilityModule,
  SecretsModule,
  AuthModule,
  RedisModule,
  BullConfigModule,
  NotificationModule,
} from '@tsdevstack/nest-common';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ObservabilityModule,                        // Logging, metrics, tracing, health
    SecretsModule,                               // Multi-provider secret access
    AuthModule,                                  // JWT + API key auth
    RedisModule,                                 // Redis client
    BullConfigModule.forRoot(),                  // BullMQ with Redis
    BullModule.registerQueue({ name: 'emails' }),
    NotificationModule,                          // Email notifications
  ],
})
export class AppModule {}
```

All modules are global — import once in `AppModule` and they're available everywhere.

## Modules overview

| Module | What it does |
|--------|-------------|
| `ObservabilityModule` | Structured logging, Prometheus metrics, distributed tracing, health checks |
| `SecretsModule` | Secret access across local, GCP, AWS, Azure |
| `AuthModule` | JWT and API key authentication via Kong gateway |
| `RedisModule` | Redis client with TLS support |
| `BullConfigModule` | BullMQ configuration with Redis from secrets |
| `NotificationModule` | Email notifications (console in dev, Resend in prod) |
| `RateLimitModule` | Redis-backed rate limiting |
| `EmailRateLimitModule` | Per-email rate limiting |

## Bootstrap

### `startApp()`

Standard app entry point. Handles environment loading, global prefix, URL versioning, Helmet, compression, validation, and Swagger.

```typescript
// apps/my-service/src/main.ts
import { startApp } from '@tsdevstack/nest-common';
import { AppModule } from './app.module';

startApp(AppModule);
```

`startApp` reads service metadata from `package.json`, loads framework config, and starts the app on `0.0.0.0:{port}`. Swagger docs are served at `/api` in non-production environments.

### `startWorker()`

Worker entry point for background job processors. Creates a NestJS application context without an HTTP server.

```typescript
// apps/auth-service/src/worker.ts
import { startWorker } from '@tsdevstack/nest-common';
import { WorkerModule } from './worker.module';

startWorker(WorkerModule);
```

Features:
- Health endpoint at `GET /health` on port 8080 (configurable)
- Graceful shutdown with 9-second timeout
- SIGTERM/SIGINT signal handlers

## Authentication

`AuthModule` provides gateway-integrated authentication. Kong validates tokens at the gateway level, and `AuthGuard` extracts user identity from Kong headers.

```typescript
import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  AuthGuard,
  Public,
  PartnerApi,
  Partner,
} from '@tsdevstack/nest-common';
import type { AuthenticatedRequest } from '@tsdevstack/nest-common';

@Controller('offers')
export class OffersController {
  // JWT-protected endpoint
  @Get('mine')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async getMyOffers(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id; // from JWT sub claim
  }

  // Dual access: JWT for users, API key for partners
  @Get('export')
  @ApiBearerAuth()
  @PartnerApi()
  async exportOffers(
    @Req() req: AuthenticatedRequest,
    @Partner() partner?: string,
  ) {
    if (partner) {
      // API key call — partner is the consumer username
    } else {
      // JWT call — use req.user
    }
  }

  // Public endpoint (no auth required)
  @Post('login')
  @Public()
  async login() {}
}
```

### Decorators

| Decorator | Effect |
|-----------|--------|
| `@Public()` | Skip authentication for this endpoint |
| `@PartnerApi()` | Enable API key access under `/api/` prefix. Can combine with `@ApiBearerAuth()` for dual access |
| `@Partner()` | Parameter decorator — extracts partner name from API key auth |

### Types

```typescript
import type { KongUser, AuthenticatedRequest } from '@tsdevstack/nest-common';

// KongUser — user identity from JWT
interface KongUser {
  id: string;
  [key: string]: string | string[] | number | boolean | undefined;
}

// AuthenticatedRequest — Express request with auth data
interface AuthenticatedRequest extends Request {
  user?: KongUser;    // JWT authentication
  service?: string;   // API key authentication
}
```

For deeper coverage, see [Authentication Overview](/authentication/overview).

## Secrets

`SecretsModule` provides unified secret access across all cloud providers. It auto-detects the provider from the `SECRETS_PROVIDER` environment variable.

```typescript
import { Injectable } from '@nestjs/common';
import { SecretsService } from '@tsdevstack/nest-common';

@Injectable()
export class PaymentService {
  constructor(private secrets: SecretsService) {}

  async charge(amount: number): Promise<void> {
    const stripeKey = await this.secrets.get('STRIPE_SECRET_KEY');
    // ...
  }
}
```

:::info
Always use `SecretsService` — never `process.env`. The secrets system handles provider detection, caching, and service-scoped access automatically.
:::

### Providers

| Provider | When | Cache TTL |
|----------|------|-----------|
| `local` | Local development | 1 minute |
| `gcp` | Google Cloud Secret Manager | 5 minutes |
| `aws` | AWS Secrets Manager | 5 minutes |
| `azure` | Azure Key Vault | 5 minutes |

### Methods

```typescript
await secrets.get('KEY');        // Get secret value (cached)
await secrets.set('KEY', 'val'); // Set secret
await secrets.delete('KEY');     // Delete secret
secrets.clearCache();            // Clear cache
```

For deeper coverage, see [How Secrets Work](/secrets/how-secrets-work).

## Redis

`RedisModule` provides a global Redis client with automatic configuration from secrets.

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from '@tsdevstack/nest-common';

@Injectable()
export class CacheService {
  constructor(private redis: RedisService) {}

  async cacheResult(key: string, value: string): Promise<void> {
    await this.redis.set(key, value, 300); // 300s TTL
  }

  async getCached(key: string): Promise<string | null> {
    return this.redis.get(key);
  }
}
```

### Methods

| Method | Return | Description |
|--------|--------|-------------|
| `get(key)` | `Promise<string \| null>` | Get value |
| `set(key, value, ttl?)` | `Promise<boolean>` | Set value with optional TTL in seconds |
| `del(key)` | `Promise<boolean>` | Delete key |
| `incr(key)` | `Promise<number \| null>` | Increment counter |
| `expire(key, seconds)` | `Promise<boolean>` | Set key expiration |
| `getClient()` | `Redis` | Get underlying [ioredis](https://github.com/redis/ioredis) client |

### Configuration

Reads from secrets automatically:

| Secret | Default | Description |
|--------|---------|-------------|
| `REDIS_HOST` | — | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password |
| `REDIS_TLS` | — | Enable TLS (for AWS ElastiCache) |

Connection: 3 retries with exponential backoff, 10s connect timeout, 30s keep-alive.

## Background jobs

### BullConfigModule

Configures [BullMQ](https://docs.bullmq.io/) with Redis from SecretsService. Portable across all providers.

```typescript
import { Module } from '@nestjs/common';
import { BullConfigModule } from '@tsdevstack/nest-common';
import { BullModule } from '@nestjs/bullmq';
import { EmailProcessor } from './processors/email.processor';

@Module({
  imports: [
    BullConfigModule.forRoot(),
    BullModule.registerQueue({ name: 'emails' }),
  ],
  providers: [EmailProcessor],
})
export class WorkerModule {}
```

Default job options: 3 retries with exponential backoff, keep 100 completed / 500 failed jobs.

### SchedulerGuard

Validates that requests to scheduled job endpoints come from the cloud scheduler (not arbitrary HTTP clients).

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { SchedulerGuard } from '@tsdevstack/nest-common';

@Controller('jobs')
export class JobsController {
  @Post('cleanup-tokens')
  @UseGuards(SchedulerGuard)
  async cleanupTokens() {
    // Only runs when called by cloud scheduler
  }
}
```

Validation is provider-aware:

| Provider | Validation method |
|----------|------------------|
| Local | Skipped (all requests allowed) |
| GCP | OIDC token verification |
| AWS | `X-Job-Secret` header (EventBridge shared secret) |
| Azure | `X-Job-Secret` header (Container App Jobs) |

## Service-to-service communication

### BaseServiceClient

Abstract base class for typed HTTP clients. Use with generated clients from `generate-client`.

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { BaseServiceClient, SecretsService } from '@tsdevstack/nest-common';
import { Api } from '@tsdevstack/auth-client';

@Injectable()
export class AuthClient extends BaseServiceClient<Api<unknown>> implements OnModuleInit {
  constructor(private secrets: SecretsService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const baseURL = await this.secrets.get('AUTH_SERVICE_URL');
    const apiKey = await this.secrets.get('AUTH_SERVICE_API_KEY');

    this.initialize({
      baseURL,
      apiKey,
      createClient: (url, key) =>
        new Api({ baseURL: url, headers: { 'x-api-key': key } }),
    });
  }
}

// Usage in another service:
// this.authClient.client.v1.getUserProfile()
```

### filterForwardHeaders()

Filters request headers for safe forwarding in service-to-service calls. Removes hop-by-hop headers (`connection`, `keep-alive`, `transfer-encoding`, `host`, `content-length`, `content-encoding`).

```typescript
import { filterForwardHeaders } from '@tsdevstack/nest-common';

const safeHeaders = filterForwardHeaders(req.headers);
await this.authClient.client.v1.someEndpoint({ headers: safeHeaders });
```

## Rate limiting

### General rate limiting

Redis-backed sliding window rate limiting with configurable key generators.

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { RateLimitGuard, RateLimit } from '@tsdevstack/nest-common';

@Controller('api')
export class ApiController {
  @Get('search')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    windowMs: 60_000,       // 1 minute window
    maxRequests: 30,         // 30 requests per window
    keyGenerator: 'ip',      // Rate limit by IP address
  })
  async search() {}
}
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `windowMs` | `number` | `900000` (15 min) | Window size in milliseconds |
| `maxRequests` | `number` | `100` | Max requests per window |
| `keyGenerator` | `'ip' \| 'apiKey' \| 'userId' \| 'custom'` | `'ip'` | How to identify clients |
| `customKeyGenerator` | `(context) => string` | — | Custom key function |
| `skipIf` | `(context) => boolean` | — | Skip rate limiting conditionally |
| `message` | `string` | — | Custom error message |

Fail-open: if Redis is unavailable, requests are allowed through.

### Email rate limiting

Per-email address rate limiting for auth flows (signup, password reset, verification).

```typescript
import { Controller, Post, UseGuards, Body } from '@nestjs/common';
import { EmailRateLimitGuard, EmailRateLimit } from '@tsdevstack/nest-common';

@Controller('auth')
export class AuthController {
  @Post('forgot-password')
  @UseGuards(EmailRateLimitGuard)
  @EmailRateLimit({
    windowMs: 900_000,     // 15 minutes
    maxRequests: 3,         // 3 attempts per email
    emailField: 'email',   // field name in request body
  })
  async forgotPassword(@Body() body: { email: string }) {}
}
```

## Notifications

`NotificationModule` provides email sending with automatic provider selection.

```typescript
import { Injectable } from '@nestjs/common';
import { NotificationService } from '@tsdevstack/nest-common';

@Injectable()
export class AuthService {
  constructor(private notifications: NotificationService) {}

  async sendVerification(email: string, link: string): Promise<void> {
    await this.notifications.sendEmail({
      to: email,
      subject: 'Verify your email',
      html: `<a href="${link}">Verify your email address</a>`,
    });
  }
}
```

### Email providers

| Provider | When | Behavior |
|----------|------|----------|
| `console` | Local development (default) | Logs to terminal with sender, recipient, subject, body |
| `resend` | Production | Sends via [Resend](https://resend.com) API |

Provider is selected by the `EMAIL_PROVIDER` secret. For production setup (account creation, domain verification, DNS records), see [Resend setup](/integrations/resend).

### Custom email provider

To add a provider (SendGrid, Mailgun, etc.):

1. Create a class implementing `EmailProvider`:

```typescript
interface EmailProvider {
  send(options: EmailOptions): Promise<void>;
  getName(): string;
}
```

2. Override the email provider token in your service's `AppModule` using a custom factory
3. Read provider-specific API keys via `SecretsService`

## Observability

`ObservabilityModule` bundles structured logging, Prometheus metrics, distributed tracing, and health checks into a single import.

```typescript
import { Module } from '@nestjs/common';
import { ObservabilityModule } from '@tsdevstack/nest-common';

@Module({
  imports: [ObservabilityModule],
})
export class AppModule {}
```

This enables:

- **Logging** — Structured JSON via [Pino](https://getpino.io/) with PII redaction and trace context
- **Metrics** — Prometheus at `/metrics` with automatic HTTP request tracking
- **Tracing** — Distributed traces to [Jaeger](https://www.jaegertracing.io/) via [OpenTelemetry](https://opentelemetry.io/)
- **Health** — `/health` endpoint with Redis and memory checks

For configuration, custom metrics, manual spans, and cloud setup, see [Observability](/features/observability).

## Database

### createPrismaConnection()

Creates a [Prisma](https://www.prisma.io/) client with connection pooling optimized for containers.

```typescript
import { createPrismaConnection } from '@tsdevstack/nest-common';
import { PrismaClient } from '@prisma/client';

const { config, pool } = createPrismaConnection();
const prisma = new PrismaClient(config);

// On shutdown:
await prisma.$disconnect();
pool.end();
```

Uses Prisma 7 with the `pg` adapter.

### Pool sizing

In **local development**, the pool defaults to 5 connections.

In **cloud environments**, the framework automatically calculates `DB_POOL_MAX` at deploy time based on:

1. The database tier's connection limit (e.g., `db-f1-micro` = 25 connections on GCP)
2. 10% reserved for admin/migrations
3. Remaining connections split evenly across all service + worker instances (using `maxInstances` from `infrastructure.json`)

```
totalUsable = floor(dbConnections × 0.90)
poolMax     = floor(totalUsable / totalInstances)
```

You never set `DB_POOL_MAX` manually — it's injected as an environment variable during deployment.

### Connection options

- SSL for AWS RDS (`rejectUnauthorized: false`)
- 30-second idle timeout
- 10-second connection timeout

## Health checks

The health system is included in `ObservabilityModule`. It exposes two endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/health` | Full health check with component status |
| `/health/ping` | Simple liveness probe |

### Response format

```json
{
  "status": "ok",
  "timestamp": "2026-01-15T10:30:45.000Z",
  "uptime": 3600.5,
  "checks": {
    "redis": { "status": "up" },
    "memory": { "status": "up", "details": { "heapUsed": 45, "heapTotal": 128 } }
  },
  "memory": {
    "used": 45,
    "total": 128
  }
}
```

Status values: `ok`, `degraded`, `down`.

### Health indicators

| Indicator | What it checks |
|-----------|---------------|
| Redis | Can the service reach Redis? |
| Memory | Is heap usage below the threshold? (default: 90%) |

Health and metrics endpoints are `@Public()` and excluded from API docs. They bypass Kong's trust header so load balancers and monitoring systems can access them directly.
