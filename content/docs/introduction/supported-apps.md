# Supported Apps

tsdevstack supports multiple application types within a single monorepo.

## App types

### NestJS Services

Backend API services built with [NestJS](https://nestjs.com/). These are the core of most tsdevstack projects.

```bash
npx tsdevstack add-service --name payments-service --type nestjs
```

Services get:
- Auto-generated Kong gateway routes
- OpenAPI documentation from decorators
- Generated HTTP client libraries with DTOs
- Database connections (Postgres, Redis)
- Framework authentication

### Workers

Workers process background jobs using [BullMQ](https://docs.bullmq.io/) and [Redis](https://redis.io/). They live inside a service's codebase and share its database access and dependencies, but run as their own process, which always runs.

A worker has three parts: a **processor** that handles jobs, a **producer** (any service code) that enqueues them, and a **module** that wires everything together.

Queue processors run only in workers, never inside a service. A service on GCP or Azure can scale to zero, and on GCP a service that does gets CPU only while it handles a request. A processor inside it would stop until the next request. A worker never stops.

A worker needs these files in its service:

```
apps/auth-service/
├── tsconfig.worker.json   # Local build of the worker (see below)
└── src/
    ├── main.ts            # HTTP service entry point
    ├── app.module.ts      # Service module
    ├── worker.ts          # Worker entry point
    └── worker.module.ts   # Worker module (no HTTP, just processors)
```

And two scripts in the service's `package.json`:

```json
"start-worker:dev": "nest start --entryFile worker --watch --path tsconfig.worker.json",
"start-worker": "node dist/worker.js"
```

`worker.ts` calls `startWorker()` from nest-common, which bootstraps a NestJS application context (no HTTP server) with a health endpoint for container orchestration:

```typescript
// worker.ts
import { startWorker } from '@tsdevstack/nest-common';
import { WorkerModule } from './worker.module';

void startWorker(WorkerModule);
```

```typescript
// worker.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SecretsModule,
    ObservabilityModule.forRoot(),
    NotificationModule,
    BullConfigModule.forRoot(),
    BullModule.registerQueue({ name: 'notifications' }),
  ],
  providers: [NotificationProcessor],
})
export class WorkerModule {}
```

`npm run dev` starts every service and every worker. Locally the worker compiles into its own folder, so the worker and its service don't delete and rewrite each other's `dist`:

```json
// tsconfig.worker.json
{
  "extends": "./tsconfig.build.json",
  "compilerOptions": {
    "outDir": "./node_modules/.cache/worker-dev"
  }
}
```

In the cloud, a worker runs once you register it as a detached worker. The framework then deploys a separate container from the same Docker image, with `node dist/worker.js` as the entrypoint:

```bash
npx tsdevstack register-detached-worker --name auth-worker --base-service auth-service
```

Detached workers get their own Cloud Run / ECS / Container Apps instance with CPU always allocated. Like services, workers are configurable in `infrastructure.json`: you can set `minInstances`, `maxInstances`, `cpu`, and `memory`. Workers run at least 1 instance (they must always be running to poll Redis queues).

The auth template comes with a worker, `auth-worker`, which sends the auth service's emails.

#### Enqueueing jobs

Any service code can dispatch jobs by injecting a queue:

```typescript
@InjectQueue('notifications') private notificationQueue: Queue

// Later:
await this.notificationQueue.add('send-email', { to, subject, html });
```

The queue name must be registered in both the producer's module and the worker's module.

### Next.js Frontend

Server-rendered React applications built with [Next.js](https://nextjs.org/).

```bash
npx tsdevstack add-service --name web-app --type nextjs
```

### SPA Applications

Single-page applications built with any framework that uses [Rsbuild](https://rsbuild.dev/).

```bash
npx tsdevstack add-service --name admin-dashboard --type spa
```

The framework executes the Rsbuild build after registering the app, so any Rsbuild-compatible setup works.

## Monorepo structure

All apps live in a single monorepo:

```
my-project/
├── apps/
│   ├── auth-service/
│   │   └── src/
│   │       ├── app.module.ts
│   │       ├── main.ts
│   │       ├── worker.module.ts
│   │       └── worker.ts
│   ├── offers-service/
│   └── web-app/
├── packages/
│   ├── auth-service-client/   # Generated HTTP client + DTOs
│   └── offers-service-client/ # Generated HTTP client + DTOs
└── infrastructure/
```

## Generated HTTP clients

When you build a NestJS service, tsdevstack generates a typed HTTP client package:

```
packages/
├── auth-service-client/       # Generated from auth-service
└── offers-service-client/     # Generated from offers-service
```

These clients have separate exports for different use cases:

**In frontend apps** - import as an HTTP client:

```typescript
import { AuthServiceClient } from '@shared/auth-service-client';

const client = new AuthServiceClient();
const user = await client.users.getById(userId);
```

**In NestJS services** - import the HTTP client and/or the DTOs directly:

```typescript
// Use as HTTP client for service-to-service calls
import { AuthServiceClient } from '@shared/auth-service-client';

// Or import DTOs for type-safe request/response handling
import { CreateUserDto, UserResponseDto } from '@shared/auth-service-client/dto';
```

This eliminates the need for separate shared type packages - all types flow from the OpenAPI spec.

