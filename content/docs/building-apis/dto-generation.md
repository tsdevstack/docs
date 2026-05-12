# DTO Generation

Generate type-safe TypeScript clients and [NestJS](https://nestjs.com/) DTOs from your [OpenAPI](https://swagger.io/specification/) specifications. This enables shared contracts between services with full validation and documentation support.

## What Gets Generated

From a single OpenAPI spec, the generator produces two outputs:

| Output | Location | Purpose |
|--------|----------|---------|
| **HTTP Client + Interfaces** | `packages/{name}-client/src/` | Type-safe API calls for frontend and services |
| **DTO Classes** | `packages/{name}-client/dto/` | Runtime validation and Swagger docs for NestJS |

## Quick Start

### Generate a Client

From your service directory:

```bash
npm run client:generate
```

Or using the CLI directly:

```bash
# Auto-detect service from current directory
npx tsdevstack generate-client

# Specify service name
npx tsdevstack generate-client auth-service

# Custom OpenAPI path
npx tsdevstack generate-client auth-service --input ./custom/path.json
```

The command auto-derives everything from the service:
- **Output** → `packages/{service-name}-client/`
- **Package name** → `@shared/{service-name}-client`
- **Author** → from service's `package.json`

It then:
1. Generates the HTTP client and TypeScript interfaces
2. Generates DTO classes with validation decorators
3. Builds the package automatically

### Use the Generated Client

**In a frontend application:**

```typescript
import { Api } from '@shared/auth-service-client';
import type { UserDto, PlanDto } from '@shared/auth-service-client';

// Create client with base URL
const client = new Api({ baseURL: process.env.NEXT_PUBLIC_API_URL });

// Public endpoints (no auth)
const plans = await client.v1.getPlans();

// Authenticated endpoints (pass JWT token)
const user: UserDto = await client.v1.getUserAccount({
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

**In a NestJS service (BFF or backend):**

```typescript
import { UserDto } from '@shared/auth-service-client/dto';

@Controller('v1/users')
export class UsersController {
  @Get()
  @ApiResponse({ status: 200, type: UserDto })
  async get(): Promise<UserDto> {
    return { /* ... */ };
  }
}
```

## Writing DTOs That Generate Well

Follow these patterns in your source DTOs to ensure clean client generation.

### Always Specify Explicit Types

Every `@ApiProperty` decorator must include an explicit `type` specification:

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({
    description: 'User ID',
    example: 'usr_123',
    type: String,  // Required
  })
  id: string;

  @ApiProperty({
    description: 'User age',
    example: 25,
    type: Number,
  })
  age: number;

  @ApiProperty({
    description: 'Created at',
    example: '2024-01-15T10:30:00Z',
    type: Date,
  })
  createdAt: Date;
}
```

### Use Lazy Resolvers for Nested Objects

Prevent circular dependencies by using arrow functions:

```typescript
import { PlanDto } from './plan.dto';

export class UserPlanDto {
  @ApiProperty({
    description: 'Plan details',
    type: () => PlanDto,  // Arrow function prevents circular deps
  })
  plan: PlanDto;
}
```

### Arrays

```typescript
@ApiProperty({
  description: 'List of tags',
  type: [String],
  example: ['tag1', 'tag2'],
})
tags: string[];

@ApiProperty({
  description: 'List of plans',
  type: () => [PlanDto],  // Lazy resolver for object arrays
})
plans: PlanDto[];
```

### Enums and Nullable Properties

```typescript
@ApiProperty({
  description: 'User role',
  enum: ['USER', 'ADMIN'],
  example: 'USER',
  type: String,
})
role: 'USER' | 'ADMIN';

@ApiProperty({
  description: 'Optional notes',
  example: 'VIP customer',
  nullable: true,
  type: String,
})
notes: string | null;
```

## Generated Output

The generated DTO classes include validation decorators automatically:

```typescript
// Generated from your OpenAPI spec
export class UserDto {
  @IsDefined()
  @IsString()
  @ApiProperty({ required: true })
  id: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  notes?: string | null;
}
```

### Date Handling

Dates in source DTOs become strings in generated clients. This is correct because JSON serializes dates as ISO 8601 strings:

```typescript
// Source DTO
@ApiProperty({ type: Date })
createdAt: Date;

// Generated client DTO
createdAt: string;  // Reflects actual HTTP contract
```

## Common Issues and Solutions

### Circular Dependency Errors

**Error:**
```
Error: A circular dependency has been detected (property key: "someProperty")
```

**Solution:** Add explicit `type` specifications to all `@ApiProperty` decorators, and use lazy resolvers for nested objects:

```typescript
// Add type: String, type: Number, etc. to all properties
@ApiProperty({ type: String })
id: string;

// Use arrow functions for nested objects
@ApiProperty({ type: () => OtherDto })
other: OtherDto;
```

### ConfigService Undefined During Generation

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'get')
```

**Solution:** Use defensive coding in service constructors:

```typescript
constructor(private config: ConfigService) {
  // Use optional chaining for doc generation compatibility
  this.value = this.config?.get<string>('KEY', 'default') ?? 'default';
}
```

### Import Errors for Generated DTOs

**Error:**
```
Cannot find module '@shared/my-client/dto'
```

**Checklist:**
1. Verify the package is built: `ls packages/auth-service-client/dist/dto/`
2. Check `package.json` has the `/dto` export configured
3. Run `npm install` in your consuming project

### Generated DTOs Are Interfaces Instead of Classes

This indicates a template configuration issue. The generator should produce classes with decorators. Contact the platform team if you encounter this.

## Package Structure

After generation, your client package will have this structure:

```
packages/auth-service-client/
  src/
    Api.ts          # HTTP client with typed methods
    index.ts        # Barrel export
  dto/
    data-contracts.ts  # DTO classes with decorators
  dist/             # Built output
  package.json
  tsconfig.json
```

## Dependencies

Generated clients have minimal dependencies:

```json
{
  "dependencies": {
    "axios": "^1.7.9"
  },
  "peerDependencies": {
    "@nestjs/swagger": "^7.4.2",
    "class-validator": "^0.14.1"
  }
}
```

Peer dependencies mean:
- Frontend apps do not need to install NestJS packages
- Backend services use their existing NestJS installation
- No duplicate dependencies in your bundle
