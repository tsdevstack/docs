# Your First App

Let's add a NestJS service and see it running.

## Add a service

Run the command and follow the interactive prompts:

```bash
npx tsdevstack add-service
```

The CLI walks you through each choice:
1. **App type** - SPA, Next.js, or NestJS
2. **Name** - Your service name (NestJS names must end with `-service`)
3. **Database** - Whether to include Prisma (for NestJS services)

You can also pass flags directly to skip the prompts:

```bash
npx tsdevstack add-service --name hello-service --type nestjs
```

The service is created at `apps/hello-service/` with:

- NestJS application scaffold
- OpenAPI decorators configured
- Database connection ready
- Health check endpoint

## Sync and run

After adding a service, sync the configuration:

```bash
npx tsdevstack sync
```

This regenerates:
- Kong gateway routes for your new service
- Docker Compose configuration
- Secrets (if needed)

Now start everything:

```bash
npm run dev
```

## Test it

Your service is now available through the Kong gateway. Routes use the short name (without `-service`):

```bash
curl http://localhost:8000/hello/health
```

## Add an endpoint

Open `apps/hello-service/src/app.controller.ts` and add:

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
export class AppController {
  @Get('greet')
  @ApiOperation({ summary: 'Get a greeting' })
  @ApiResponse({ status: 200, description: 'Returns a greeting' })
  greet() {
    return { message: 'Hello from tsdevstack!' };
  }
}
```

With hot reload, your endpoint is immediately available:

```bash
curl http://localhost:8000/hello/greet
# {"message":"Hello from tsdevstack!"}
```

## View API docs

OpenAPI documentation is auto-generated. Each service serves Swagger UI on its own port:

```
http://localhost:3002/api
```

The port depends on your service. Check the console output when running `npm run dev` to see which port each service uses.

