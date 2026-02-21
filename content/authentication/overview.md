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

Token lifetimes are configurable via environment variables. See [JWT Tokens](/authentication/jwt-tokens) for details.

### Two-layer authentication

Authentication works at two independent layers, controlled by different decorators:

| Layer | Decorator | Effect |
|-------|-----------|--------|
| **Kong (gateway)** | `@ApiBearerAuth()` | If present, JWT is required at gateway |
| **AuthGuard (backend)** | `@Public()` | If present, AuthGuard skips validation |

**Important:** Without `@ApiBearerAuth()`, Kong treats the route as public (no JWT required). But AuthGuard still runs unless you also add `@Public()`.

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

See [Protected Routes](/authentication/protected-routes) for more patterns.

## Quick start

1. Authentication is enabled by default (AuthGuard is global)
2. Kong validates tokens for routes with `@ApiBearerAuth()`
3. Use `@Public()` to skip authentication for specific endpoints
4. Access user info via `@Req() req: AuthenticatedRequest` and `req.user`

