# Tech Stack

tsdevstack is built on battle-tested technologies chosen for reliability, developer experience, and production readiness.

## Overview

| Layer | Technology | Purpose |
|-------|------------|---------|
| Language | [TypeScript](https://www.typescriptlang.org/) | Type safety across the entire stack |
| Backend | [NestJS](https://nestjs.com/) | Structured, scalable API services |
| Frontend | [Next.js](https://nextjs.org/) | Server-rendered React applications |
| Gateway | [Kong](https://konghq.com/) | API routing, auth, rate limiting |
| Database | [PostgreSQL](https://www.postgresql.org/) | Primary data storage |
| Cache | [Redis](https://redis.io/) | Caching and rate limiting |
| ORM | [Prisma](https://www.prisma.io/) | Database interactions |
| Logging | [Pino](https://getpino.io/) | Structured JSON logging |
| Metrics | [Prometheus](https://prometheus.io/) | Metrics collection and storage |
| Tracing | [Jaeger](https://www.jaegertracing.io/) | Distributed tracing |
| Package Manager | [npm](https://www.npmjs.com/) | Native workspaces with [Lerna](https://lerna.js.org/) orchestration |
| Containerization | [Docker](https://www.docker.com/) | Consistent local and cloud environments |
| IaC | [Terraform](https://www.terraform.io/) | Infrastructure as code |

## Core technologies

### [TypeScript](https://www.typescriptlang.org/)

TypeScript is the foundation of tsdevstack. Every part of the stack uses TypeScript for:

- **Type safety** - Catch errors at compile time, not runtime
- **Better tooling** - IDE autocomplete, refactoring, navigation
- **Self-documenting code** - Types serve as documentation
- **Shared types** - Use the same types in frontend, backend, and generated clients

```typescript
// DTOs are classes with decorators for validation and OpenAPI
export class UserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  createdAt: Date;
}

// Types flow from backend to frontend via generated clients
const user = await api.users.getById('123'); // Returns UserDto
```

### [NestJS](https://nestjs.com/)

NestJS provides the structure for backend services. It uses decorators and dependency injection for clean, testable code.

**Why NestJS:**

- Decorator-based routing maps directly to OpenAPI specs
- Dependency injection makes testing straightforward
- Modular architecture scales with your application
- Large ecosystem of plugins and integrations

```typescript
@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, type: UserDto })
  async getUser(@Param('id') id: string): Promise<UserDto> {
    return this.usersService.findById(id);
  }
}
```

Decorators like `@ApiOperation` generate OpenAPI specs, which tsdevstack uses to configure Kong routes automatically.

### [Kong](https://konghq.com/)

Kong is an open-source API gateway that handles cross-cutting concerns:

- **Routing** - Maps URL paths to backend services
- **Authentication** - Validates JWT tokens before requests reach services
- **Rate limiting** - Protects services from abuse
- **CORS** - Manages cross-origin requests

tsdevstack generates Kong configuration automatically from your OpenAPI specs. When you add an endpoint, Kong routing updates to match.

```yaml
# Generated kong.yml
services:
  - name: auth-service-public
    url: http://auth-service:3001
    routes:
      - name: auth-service-public-route
        paths:
          - /auth/v1/auth/login
          - /auth/v1/auth/signup
```

### [PostgreSQL](https://www.postgresql.org/)

PostgreSQL is the primary database for tsdevstack projects:

- **Reliability** - ACID compliance, proven at scale
- **Features** - JSON columns, full-text search, extensions
- **TypeScript support** - Excellent integration with Prisma
- **Cloud native** - Managed options on all major clouds

Each service that needs persistence gets its own database, keeping data isolated.

### [Redis](https://redis.io/)

Redis provides fast caching and ephemeral storage:

- **Rate limiting** - Store request counters with TTL
- **Session data** - Fast session lookups
- **Caching** - Cache expensive queries
- **Pub/sub** - Real-time messaging between services

```typescript
import { RedisService } from '@tsdevstack/nest-common';

@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }
}
```

### [Prisma](https://www.prisma.io/)

Prisma handles database interactions with a schema-first approach:

```prisma
// prisma/schema.prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  orders    Order[]
}

model Order {
  id     String @id @default(uuid())
  userId String
  user   User   @relation(fields: [userId], references: [id])
}
```

Prisma provides:

- Declarative schema definition
- Auto-generated TypeScript client with full type safety
- Migrations for schema changes
- Intuitive query API

### [Next.js](https://nextjs.org/)

For frontends, tsdevstack uses Next.js:

- **Server-side rendering** - SEO and fast initial loads
- **API routes** - Secure cookie-based auth proxying
- **App Router** - Modern React patterns with Server Components
- **TypeScript** - Full type safety with generated DTOs

```typescript
// app/users/[id]/page.tsx
export default async function UserPage({ params }: { params: { id: string } }) {
  const user = await api.users.getById(params.id);
  return <UserProfile user={user} />;
}
```

### [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces)

npm workspaces manage the monorepo with [Lerna](https://lerna.js.org/) for task orchestration:

- **Native** - Built into npm, no additional package manager
- **Workspaces** - Apps and packages linked automatically
- **Lerna** - Parallel builds, caching, dependency graph awareness

```json
// package.json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

```json
// lerna.json
{
  "version": "0.0.1",
  "packages": ["apps/*", "packages/*"]
}
```

### [Docker](https://www.docker.com/)

Docker provides consistent environments:

- **Local development** - Same containers as production
- **Isolation** - Each service runs independently
- **Reproducibility** - Works the same on every machine

```yaml
# Generated docker-compose.yml
services:
  auth-service:
    build: ./apps/auth-service
    volumes:
      - ./apps/auth-service/src:/app/src
    environment:
      - DATABASE_URL=${DATABASE_URL}
```

### [Terraform](https://www.terraform.io/)

Terraform manages cloud infrastructure:

- **Declarative** - Define what you want, not how to build it
- **Multi-cloud** - Same workflow for GCP, AWS, Azure
- **Version controlled** - Infrastructure changes are tracked

```hcl
resource "google_cloud_run_service" "auth_service" {
  name     = "auth-service"
  location = var.region

  template {
    spec {
      containers {
        image = var.image
      }
    }
  }
}
```

## How they work together

```
                  Browser/App
                       |
                       v
+--------------------------------------------------+
|                   Kong Gateway                    |
|  - Validates JWT tokens                          |
|  - Routes requests to services                   |
|  - Applies rate limits                           |
+--------------------------------------------------+
         |                    |
         v                    v
+----------------+   +----------------+
|   NestJS API   |   |   NestJS API   |
|   (Prisma)     |   |   (Prisma)     |
+----------------+   +----------------+
         |                    |
         +--------+  +--------+
                  |  |
                  v  v
         +----------------+
         |   PostgreSQL   |
         +----------------+

         +----------------+
         |     Redis      |
         +----------------+
```

Locally, each service with a database gets its own PostgreSQL container (e.g., `auth-db`, `offers-db`), keeping data isolated. Redis is shared across services. In production, you can use managed database services (Cloud SQL, RDS, etc.).

