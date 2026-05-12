# Adding Apps

Use `npx tsdevstack add-service` to add new applications to your monorepo.

## Adding services

Use the interactive mode (recommended):

```bash
npx tsdevstack add-service
```

This walks you through:
1. **App type** - SPA, Next.js, or NestJS
2. **Name** - Your service name (NestJS names must end with `-service`)
3. **Database** - Whether to include Prisma (for NestJS services)

Or pass flags directly:

```bash
npx tsdevstack add-service --name <name> --type <type>
```

### NestJS service

```bash
npx tsdevstack add-service --name payments-service --type nestjs
```

This creates a NestJS backend service at `apps/payments-service/` with:

- NestJS application scaffold
- OpenAPI decorators configured
- Database connection ready
- Health check endpoint

### Next.js frontend

```bash
npx tsdevstack add-service --name web-app --type nextjs
```

This creates a Next.js application at `apps/web-app/`.

### SPA frontend

```bash
npx tsdevstack add-service --name admin-dashboard --type spa
```

This creates a [Rsbuild](https://rsbuild.dev/)-based SPA at `apps/admin-dashboard/`.

## Workers

Workers live inside a service and handle background job processing. They share the service's codebase:

```
apps/
└── auth-service/
    └── src/
        ├── app.module.ts      # Main service module
        ├── main.ts            # Service entry point
        ├── worker.module.ts   # Worker module
        └── worker.ts          # Worker entry point
```

By default, workers run in the same container as the service. If you need to deploy them to a separate container for independent scaling, register them as detached workers:

```bash
# Register for separate container deployment
npx tsdevstack register-detached-worker --name email-worker --base-service auth-service

# Unregister
npx tsdevstack unregister-detached-worker --worker email-worker
```

## After adding an app

After adding a service:

```bash
# 1. Install new dependencies
npm install

# 2. Regenerate framework configs
npx tsdevstack sync

# 3. Start development
npm run dev
```

The new app will be available:

- **NestJS services**: APIs at `http://localhost:8000/<short-name>/...` (e.g., `payments-service` → `/payments/`), service runs on its own port (e.g., `:3004`)
- **Frontends**: `http://localhost:3000` (or configured port)

## Removing apps

Use the `remove-service` command to remove an app:

```bash
npx tsdevstack remove-service [service-name]
```

If no service name is provided, it will prompt you to select from available services.

The framework will remove the service directory, its database container, and update Docker Compose and Kong configuration.

