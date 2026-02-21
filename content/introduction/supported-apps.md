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

Workers handle background job processing within a service. They live inside the service folder and share its codebase:

```
apps/
└── auth-service/
    └── src/
        ├── app.module.ts      # Main service module
        ├── main.ts            # Service entry point
        ├── worker.module.ts   # Worker module
        └── worker.ts          # Worker entry point
```

By default, workers run in the same container as the service. If you need to scale workers independently, you can register them as detached workers for separate container deployment:

```bash
# Register for separate container deployment
npx tsdevstack register-detached-worker --name email-worker --base-service auth-service

# Unregister
npx tsdevstack unregister-detached-worker --worker email-worker
```

Workers can:
- Process queued jobs
- Handle scheduled tasks
- Run long-running operations

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

