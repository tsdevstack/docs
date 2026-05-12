# Protected Routes

tsdevstack provides guards and decorators for protecting API endpoints. [Kong](https://konghq.com/) handles token validation at the gateway level, while AuthGuard provides additional protection and user context in your services.

## How it works

AuthGuard is applied **globally** in all services via `APP_GUARD`. You don't need to add it per endpoint.

```typescript
// In app.module.ts - AuthGuard is already global
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
```

## Two-layer authentication

Authentication happens at two independent layers, controlled by different decorators:

| Layer | Decorator | Effect |
|-------|-----------|--------|
| **Kong (gateway)** | `@ApiBearerAuth()` | If present, JWT is required at gateway |
| **AuthGuard (backend)** | `@Public()` | If present, AuthGuard skips validation |

**Important:** Without `@ApiBearerAuth()`, Kong treats the route as public (no JWT required). But AuthGuard still runs unless you also add `@Public()`.

For **fully public endpoints** (login, signup): use `@Public()` and omit `@ApiBearerAuth()`.

## Public endpoints

Mark endpoints that don't require authentication:

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { Public } from '@tsdevstack/nest-common';

@Controller('auth')
export class AuthController {
  @Post('login')
  @Public()  // No authentication required
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('signup')
  @Public()
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }
}
```

## Accessing user information

Use `@Req()` decorator with `AuthenticatedRequest` type:

```typescript
import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '@tsdevstack/nest-common';

@Controller('user')
export class UserController {
  @Get('profile')
  getProfile(@Req() req: AuthenticatedRequest) {
    // req.user contains JWT claims extracted by Kong
    return {
      id: req.user.id,
      email: req.user.email,
      confirmed: req.user.confirmed,
    };
  }
}
```

The `KongUser` type allows any JWT claim:

```typescript
interface KongUser {
  id: string;                    // Always present (from JWT sub)
  [key: string]: string | string[] | number | boolean | undefined;
}
```

## Controller-level public

Make all endpoints in a controller public:

```typescript
@Controller('health')
@Public()
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }

  @Get('ready')
  ready() {
    return { ready: true };
  }
}
```

## Partner API endpoints

For API key authentication (instead of JWT):

```typescript
import { Controller, Get, Req } from '@nestjs/common';
import { PartnerApi } from '@tsdevstack/nest-common';
import type { AuthenticatedRequest } from '@tsdevstack/nest-common';

@Controller('data')
export class DataController {
  @Get('export')
  @PartnerApi()
  exportData(@Req() req: AuthenticatedRequest) {
    // req.service is 'partner' for Partner API requests
    console.log(`Request type: ${req.service}`); // 'partner'
    return this.dataService.export();
  }
}
```

> **Note:** `req.service` identifies the request source - `'partner'` for Partner API requests, `'internal'` for service-to-service calls.

## Custom guards

Create custom guards for specific requirements:

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '@tsdevstack/nest-common';

@Injectable()
export class PremiumUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user?.subscription === 'premium';
  }
}
```

Use the custom guard alongside AuthGuard:

```typescript
import { UseGuards } from '@nestjs/common';

@Get('premium-content')
@UseGuards(PremiumUserGuard)
getPremiumContent() {
  return { message: 'Premium only' };
}
```

## OpenAPI documentation

Add Swagger decorators to document auth requirements:

```typescript
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@Controller('user')
@ApiBearerAuth()  // Documents JWT requirement in Swagger
export class UserController {
  @Get('profile')
  @ApiResponse({ status: 200, type: UserDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}
```

See [Two-layer authentication](#two-layer-authentication) above for details on how these decorators interact.

## How Kong and AuthGuard work together

1. **Kong validates the JWT** using OIDC plugin
2. **Kong passes user info** to backend services
3. **AuthGuard verifies request origin** (defense-in-depth)
4. **AuthGuard populates `req.user`** with JWT claims
5. **Your code accesses `req.user`** with full type safety

