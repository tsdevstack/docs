# Authentication Overview

tsdevstack provides a complete authentication system out of the box, handling [JWT](https://jwt.io/) tokens, session management, and protected routes.

## How authentication works

The diagram below shows the authentication flow (not the full infrastructure - production deployments include load balancers, WAF, etc.):

```
                        Browser
                           |
                           v
+--------------------------------------------------+
|                   Kong Gateway                    |
|  - Validates JWT tokens                          |
|  - Extracts user info for backend services       |
+--------------------------------------------------+
                           |
              +------------+------------+
              |                         |
              v                         v
      +---------------+         +---------------+
      |  Auth Service |         | Other Service |
      |  (issues JWT) |         | (trusts Kong) |
      +---------------+         +---------------+
```

Kong validates tokens at the gateway level before requests reach your services.

## Key concepts

### JWT tokens

tsdevstack uses JSON Web Tokens for stateless authentication:

- **Access tokens** - Short-lived tokens for API requests
- **Refresh tokens** - Longer-lived tokens for obtaining new access tokens

Token lifetimes are configurable via environment variables. See [JWT Tokens](/docs/authentication/jwt-tokens) for details.

### Two-layer authentication

Authentication works at two independent layers, controlled by different decorators:

| Layer | Decorator | Effect |
|-------|-----------|--------|
| **Kong (gateway)** | `@ApiBearerAuth()` | If present, JWT is required at gateway |
| **AuthGuard (backend)** | `@Public()` | If present, anonymous callers are allowed |

**Important:** Without `@ApiBearerAuth()`, Kong treats the route as public (no JWT required). But AuthGuard still rejects anonymous callers unless you also add `@Public()`.

For fully public endpoints (login, signup): use `@Public()` and omit `@ApiBearerAuth()`.

### Protected routes

By default, all endpoints require authentication (AuthGuard is global). Mark public endpoints explicitly:

```typescript
import { Controller, Get, Req } from '@nestjs/common';
import { Public } from '@tsdevstack/nest-common';
import type { AuthenticatedRequest } from '@tsdevstack/nest-common';

@Controller('users')
export class UsersController {
  @Get('profile')
  getProfile(@Req() req: AuthenticatedRequest) {
    // req.user contains JWT claims
    return { id: req.user.id, email: req.user.email };
  }

  @Get('public-data')
  @Public()
  getPublicData() {
    // No authentication required
    return { message: 'public' };
  }
}
```

See [Protected Routes](/docs/authentication/protected-routes) for more patterns.

### Roles

Every user has a system role (`USER` or `ADMIN`) and optional custom roles, carried in the token. Restrict endpoints with `@Roles()`; see [Roles](/docs/authentication/roles). How to create the first admin and manage users locally and in the cloud: [Managing Users](/docs/authentication/managing-users).

### API keys

For machine access without a user login, mark endpoints `@PartnerApi()` and issue API keys to named consumers through the auth-service admin API. The gateway checks keys, expiry and per-key limits on every request. See [API Keys](/docs/authentication/api-keys).

## Security standards

The auth service template follows [OWASP](https://owasp.org/) security guidelines for authentication, session management, and cryptographic storage. See [JWT Tokens](/docs/authentication/jwt-tokens#owasp-alignment) for the full mapping, and [Compliance Readiness](/docs/security/compliance-readiness) for infrastructure-level controls.

## Quick start

1. Authentication is enabled by default (AuthGuard is global)
2. Kong validates tokens for routes with `@ApiBearerAuth()`
3. Use `@Public()` to skip authentication for specific endpoints
4. Access user info via `@Req() req: AuthenticatedRequest` and `req.user`

