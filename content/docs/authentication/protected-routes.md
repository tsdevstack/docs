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
| **AuthGuard (backend)** | `@Public()` | If present, anonymous callers are allowed |

**Important:** Without `@ApiBearerAuth()`, Kong treats the route as public (no JWT required). But AuthGuard still rejects anonymous callers unless you also add `@Public()`. On a `@Public()` handler AuthGuard still identifies callers that present valid credentials; it just doesn't require them.

For **fully public endpoints** (login, signup): use `@Public()` and omit `@ApiBearerAuth()`.

## Trust first

Kong adds a secret trust token (`X-Kong-Trust`) to every request it forwards. AuthGuard checks it before it looks at anything else:

- **Valid trust token:** the request came through Kong, and AuthGuard reads the identity Kong set. `X-Userinfo` (from the JWT, validated by Kong's OIDC plugin) makes the caller a logged-in user. A partner API key validated by Kong's `tsdevstack-api-key` plugin, which sends `X-Api-Key-Id` and `X-Api-Key-Consumer`, makes it a partner.
- **No trust token:** identity headers are ignored, whatever they say. The request is either an internal service-to-service call that authenticates with the service `API_KEY` (`x-api-key` header), an anonymous call to a `@Public()` handler, or it gets **401**.
- **Wrong trust token:** 401. The exceptions are `/health`, `/metrics` and `/.well-known/` paths, which load balancers and Kong call without the token; there the token and all identity headers are ignored.

Two consequences worth knowing:

- **Calling a service directly** (for example `http://localhost:3001` instead of the gateway at `http://localhost:8000`) with a bearer token gets 401 on protected handlers. Kong validates JWTs, not the services, so a JWT that never went through Kong proves nothing. The same applies to Swagger UI's "Try it out", end-to-end tests that call service ports, and sidecars. Go through the gateway, or use the service `API_KEY` for internal calls.
- **Forged identity headers never reach your code.** Kong removes client-sent identity headers (`X-Userinfo`, `X-Consumer-*`, `X-Credential-Identifier`, `X-Kong-Trust` and similar) before authentication, with the framework plugin `tsdevstack-strip-identity`. Behind that, AuthGuard only trusts identity headers on requests with a valid trust token, and treats a request that claims to be both a user and a partner key as forged (401).

## What AuthGuard puts on the request

| Field | Set when | Value |
|-------|----------|-------|
| `req.authType` | The caller was identified | `'user'`, `'apiKey'` or `'service'`; undefined for anonymous calls to `@Public()` handlers |
| `req.user` | `authType === 'user'` | JWT claims (`id` from `sub`, plus every other claim) |
| `req.apiKey` | `authType === 'apiKey'` | `{ id, consumer }` of the partner key, from the gateway's `X-Api-Key-Id` and `X-Api-Key-Consumer` headers; never the raw key |
| `req.service` | `authType === 'service'` or `'apiKey'` | The calling service's `X-Service-Name` (or `'internal'`), or `'partner'` for partner keys |
| `req.viaGateway` | The trust token was valid | `true`; gateway-set headers such as `X-Real-IP` are trustworthy only then |

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

For API key authentication (instead of JWT). Keys are created and managed at runtime through the auth-service admin API and checked by the gateway; see [API Keys](/docs/authentication/api-keys).

```typescript
import { Controller, Get, Req } from '@nestjs/common';
import { PartnerApi, Partner, ApiKey } from '@tsdevstack/nest-common';
import type {
  AuthenticatedApiKey,
  AuthenticatedRequest,
} from '@tsdevstack/nest-common';

@Controller('data')
export class DataController {
  @Get('export')
  @PartnerApi()
  exportData(
    @Req() req: AuthenticatedRequest,
    @Partner() partner?: string,          // consumer name, e.g. 'acme-corp'
    @ApiKey() key?: AuthenticatedApiKey,  // { id, consumer }
  ) {
    // req.authType === 'apiKey', req.service === 'partner'
    return this.dataService.export();
  }
}
```

Rules AuthGuard applies to partner keys:

- A partner key works **only on `@PartnerApi()` handlers**. On any other handler, `@Public()` ones included, it gets 403. Kong already exposes only `@PartnerApi()` paths under `/api/...` (see [Gateway Routing](/docs/building-apis/gateway-routing)); this is the second line of defence.
- `req.user` is never set for partner requests. Use `@Partner()` or `@ApiKey()` to know who is calling.
- The gateway checks the key, its expiry and its limits before the request reaches you, and never forwards the key itself. Your service receives `X-Api-Key-Id` and `X-Api-Key-Consumer` instead, and `AuthGuard` only reads them on requests with a valid trust token.
- A `@PartnerApi()` handler also accepts logged-in users and internal service calls, which is how dual-access endpoints work. Check `req.authType` when the handler needs to tell them apart.

> **Note:** `req.service` identifies the request source: `'partner'` for partner API key requests, the caller's service name (or `'internal'`) for service-to-service calls.

## Role-based access

Restrict handlers to system or custom roles with `@Roles()`:

```typescript
import { Roles } from '@tsdevstack/nest-common';

@Get('admin/stats')
@ApiBearerAuth()
@Roles('ADMIN')
getStats() {}
```

Callers without one of the listed roles get 403. See [Roles](/docs/authentication/roles).

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

1. **Kong strips client-sent identity headers** (`tsdevstack-strip-identity`)
2. **Kong validates the JWT** using the OIDC plugin (or the partner key on `/api/...` routes)
3. **Kong passes the identity** to the service (`X-Userinfo` with the JWT claims) and adds the trust token
4. **AuthGuard verifies the trust token**, then classifies the caller as user, partner key or internal service
5. **AuthGuard populates `req.user`** (or `req.apiKey`) and enforces `@Public()` and `@PartnerApi()`
6. **Your code accesses `req.user`** with full type safety

