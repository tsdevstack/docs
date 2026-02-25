# OpenAPI Decorators

[NestJS](https://nestjs.com/) decorators document your API endpoints. tsdevstack uses these [OpenAPI](https://swagger.io/specification/) specs to generate [Kong](https://konghq.com/) gateway routes automatically.

## Why decorators matter

When you add decorators to your controllers:

1. **Swagger UI** - Interactive API documentation at `/api`
2. **Kong routes** - Gateway configuration generated automatically
3. **Client generation** - TypeScript clients can be generated from specs

## Two-layer authentication

Authentication is enforced at two independent layers. They look related but serve different purposes and are controlled by different decorators:

- **Kong (gateway layer)** — decides whether a valid JWT must be present *before the request reaches your service*. Controlled by `@ApiBearerAuth()`. This is about network-level access.
- **AuthGuard (backend layer)** — runs inside NestJS on every request and extracts the authenticated user. Controlled by `@Public()` (which opts out). This is about application-level identity.

These two layers exist because Kong handles routing for all services, while AuthGuard runs per-service. They must be configured independently:

| Layer | Decorator | Default behavior | Decorator changes it to |
|-------|-----------|-----------------|------------------------|
| **Kong** | `@ApiBearerAuth()` | Route is public (no JWT required) | JWT required at gateway |
| **AuthGuard** | `@Public()` | Validates JWT and extracts user | Skips validation entirely |

### Endpoint type reference

| Endpoint type | `@ApiBearerAuth()` | `@Public()` | Result |
|---------------|-------------------|-------------|--------|
| Fully public (login, signup) | No | Yes | No auth at either layer |
| Protected (user profile) | Yes | No | JWT required at gateway, user extracted in backend |
| **Misconfigured** | No | No | Kong lets requests through without JWT, but AuthGuard rejects them because no token is present. **This is a bug** — add either `@ApiBearerAuth()` or `@Public()`. |

## Standard NestJS/Swagger Decorators

These are from `@nestjs/swagger`.

### @ApiTags

Groups endpoints in Swagger UI:

```typescript
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {}
```

### @ApiOperation

Describes an endpoint:

```typescript
import { ApiOperation } from '@nestjs/swagger';

@Post('signup')
@ApiOperation({
  operationId: 'signup',
  summary: 'Register a new user',
  description: 'Creates account and sends verification email'
})
async signup(@Body() dto: SignupDto) {}
```

The `operationId` is used for generated client method names.

### @ApiResponse

Documents response types:

```typescript
import { ApiResponse } from '@nestjs/swagger';

@Post('login')
@ApiResponse({ status: 200, description: 'Login successful', type: TokenDto })
@ApiResponse({ status: 401, description: 'Invalid credentials' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
async login(@Body() dto: LoginDto): Promise<TokenDto> {}
```

### @ApiBody

Documents request body:

```typescript
import { ApiBody } from '@nestjs/swagger';

@Post('login')
@ApiBody({ type: LoginDto, description: 'User credentials' })
async login(@Body() dto: LoginDto) {}
```

### @ApiProperty

Documents DTO properties for the OpenAPI schema:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address'
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'securePassword123',
    minLength: 8
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    example: 'John Doe'
  })
  @IsString()
  name?: string;
}
```

DTOs are classes with decorators for both validation (`class-validator`) and documentation (`@nestjs/swagger`).

### @ApiBearerAuth

Marks endpoints as requiring JWT authentication at the Kong gateway. Routes with this decorator will require a valid JWT token.

```typescript
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('user')
@ApiTags('user')
@ApiBearerAuth()  // All endpoints require JWT
export class UserController {
  @Get('account')
  async getAccount(@Req() req: AuthenticatedRequest) {
    // req.user contains JWT claims extracted by Kong
  }
}
```

## tsdevstack Decorators

Custom decorators from `@tsdevstack/nest-common`.

### @Public

Marks an endpoint so the backend AuthGuard skips user validation. Use together with no `@ApiBearerAuth()` for fully public endpoints.

```typescript
import { Public } from '@tsdevstack/nest-common';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  @Post('login')
  @Public()  // No @ApiBearerAuth = public at Kong, @Public = public at backend
  async login(@Body() dto: LoginDto) {}

  @Post('signup')
  @Public()
  async signup(@Body() dto: SignupDto) {}
}
```

### @PartnerApi

Marks endpoints for Partner API access. These routes are exposed under `/api/` prefix and require an API key instead of JWT.

```typescript
import { PartnerApi } from '@tsdevstack/nest-common';

@Controller('offers')
export class OffersController {
  @Get('plans')
  @PartnerApi()  // Accessible via /api/offers/plans with API key
  async getPlans() {}
}
```

You can combine `@ApiBearerAuth()` and `@PartnerApi()` for dual-access endpoints:

```typescript
@Get('data')
@ApiBearerAuth()
@PartnerApi()
async getData() {
  // Accessible via:
  // - /service/data with JWT token (for users)
  // - /api/service/data with API key (for partners)
}
```

## Example: Auth controller (public endpoints)

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Public } from '@tsdevstack/nest-common';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Post('signup')
  @Public()  // Public at both Kong and backend
  @ApiOperation({ operationId: 'signup', summary: 'Register new user' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, type: MessageDto })
  async signup(@Body() dto: SignupDto): Promise<MessageDto> {}

  @Post('login')
  @Public()
  @ApiOperation({ operationId: 'login', summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, type: TokenDto })
  async login(@Body() dto: LoginDto): Promise<TokenDto> {}
}
```

## Example: User controller (protected endpoints)

```typescript
import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '@tsdevstack/nest-common';

@ApiTags('user')
@Controller('user')
@ApiBearerAuth()  // All endpoints require JWT
export class UserController {
  @Get('account')
  @ApiOperation({ operationId: 'getAccount', summary: 'Get user account' })
  @ApiResponse({ status: 200, type: UserDto })
  async getAccount(@Req() req: AuthenticatedRequest): Promise<UserDto> {
    const userId = req.user.id;
    // ...
  }
}
```

## Viewing your API docs

After starting the dev server, access Swagger UI directly on each service:

```
http://localhost:<port>/api
```

For example, if auth-service runs on port 3001: `http://localhost:3001/api`

Swagger is served directly by each service, not through Kong. See [Swagger Docs](/building-apis/swagger-docs) for details.

