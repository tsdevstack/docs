# Gateway Routing

[Kong Gateway](https://konghq.com/) routes requests to your backend services based on [OpenAPI](https://swagger.io/specification/) specs. Routes are generated from your code, so you rarely need to configure routing manually.

## How routing works

When you run `npx tsdevstack sync`, the framework:

1. Reads OpenAPI specs from each service (`apps/{service}/docs/openapi.json`)
2. Groups routes by security type (public, JWT, partner) based on decorators
3. Generates `kong.tsdevstack.yml` with framework routes
4. Merges with `kong.user.yml` (your customizations)
5. Writes the final `kong.yml` with resolved secrets

## Local architecture

Locally, all requests flow through Kong at `http://localhost:8000`:

```
Browser/Client
     |
     v
Kong Gateway (localhost:8000)
     |
     +---> /auth/v1/auth/login  --> auth-service:3001 (public)
     +---> /auth/v1/user/...    --> auth-service:3001 (JWT required)
     +---> /api/offers/v1/...   --> offers-service:3002 (API key)
```

Note: Route prefixes use the short service name (e.g., `/auth/`, `/offers/`) not the full package name.

In cloud deployments, Kong runs as a managed service (Cloud Run, etc.) with different networking.

## Route types

Routes are grouped into three types based on your OpenAPI decorators.

### Two-layer authentication

Authentication happens at two independent layers:

| Layer | Decorator | Effect |
|-------|-----------|--------|
| **Kong (gateway)** | `@ApiBearerAuth()` | If present, JWT is required at gateway |
| **AuthGuard (backend)** | `@Public()` | If present, AuthGuard skips validation |

**Important:** Kong routing is determined by `@ApiBearerAuth()` and `@PartnerApi()`. The `@Public()` decorator only affects the backend AuthGuard, not Kong routing. For fully public endpoints, you need both: omit `@ApiBearerAuth()` (for Kong) AND add `@Public()` (for AuthGuard).

### Public routes

No JWT required at Kong. Routes without `@ApiBearerAuth()`:

```typescript
@Controller('auth')
@ApiTags('auth')
export class AuthController {
  @Post('login')
  @Public()
  @Version('1')
  async login(@Body() dto: LoginDto) {}
}
```

Accessible at: `POST http://localhost:8000/auth/v1/auth/login`

### JWT-authenticated routes

Require valid JWT token. Routes with `@ApiBearerAuth()`:

```typescript
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('user')
@ApiTags('user')
@ApiBearerAuth()  // All routes require JWT
export class UserController {
  @Get('account')
  @Version('1')
  async getAccount(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
  }
}
```

Accessible at: `GET http://localhost:8000/auth/v1/user/account`

Kong validates the JWT using the OIDC plugin before forwarding to the service. Invalid tokens get a 401 response from Kong.

```bash
curl http://localhost:8000/auth/v1/user/account \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Partner API routes

Require API key. Routes with `@PartnerApi()`:

```typescript
import { PartnerApi } from '@tsdevstack/nest-common';

@Controller('offers')
export class OffersController {
  @Get('plans')
  @PartnerApi()
  @Version('1')
  async getPlans() {}
}
```

Partner routes are exposed at `/api/{service}/...` prefix:

```bash
curl http://localhost:8000/api/offers/v1/plans \
  -H "x-api-key: <partner-api-key>"
```

### Alternative: NestJS-level API key validation

The `@PartnerApi()` approach uses Kong for key validation — keys are static, defined in `kong.user.yml`. If you need dynamic key management (database-backed keys, self-service provisioning, per-key permissions), you can handle API key validation at the NestJS level instead:

1. Use `@Public()` so Kong passes the request through without auth
2. Create a custom NestJS guard that reads the `x-api-key` header
3. Validate against your database (e.g., an `api_keys` table)

```typescript
@Get('plans')
@Public()                    // Kong passes through, no key-auth plugin
@UseGuards(ApiKeyGuard)      // NestJS validates the key
@Version('1')
async getPlans() {}
```

**Trade-offs:**

| | Kong (`@PartnerApi()`) | NestJS (custom guard) |
|---|---|---|
| Key management | Static in `kong.user.yml` | Dynamic via database |
| Invalid key cost | Rejected at gateway | Hits backend first |
| Rate limiting | Built-in per consumer | Implement yourself |
| Key rotation | Edit config, rebuild Kong | Database update, instant |
| Best for | Small, fixed partner set | Self-service API portals |

### Dual-access routes

Routes can support both JWT and API key:

```typescript
@Get('data')
@ApiBearerAuth()
@PartnerApi()
@Version('1')
async getData() {}
```

Creates two Kong routes:
- `/service/v1/data` (JWT via Authorization header)
- `/api/service/v1/data` (API key via x-api-key header)

## Versioned routes

Use `@Version()` to version your endpoints:

```typescript
@Get('profile')
@Version('1')
async getProfileV1() {}

@Get('profile')
@Version('2')
async getProfileV2() {}
```

Access at `/service/v1/profile` and `/service/v2/profile`.

## Regenerating routes

After changing decorators, regenerate and restart:

```bash
npx tsdevstack sync
```

This regenerates kong.yml and restarts all containers automatically.

## Custom Kong configuration

Add custom routes or plugins in `kong.user.yml`. This file is merged with framework-generated routes:

```yaml
# kong.user.yml
services:
  - name: my-custom-service
    url: http://external-api.com
    routes:
      - name: my-custom-route
        paths:
          - /external
```

## Troubleshooting

### Route returns 404

If Kong returns 404 for a route that should exist:

1. Run `npx tsdevstack sync` to regenerate configs and restart containers
2. Check the route is in `kong.yml`
3. Check the OpenAPI spec was generated: `apps/{service}/docs/openapi.json`

### Route returns 502

Kong can reach the route but the service isn't responding:

1. Run `npx tsdevstack sync` to regenerate and restart
2. Verify the service is healthy: `curl http://localhost:<port>/health`

### JWT validation fails

If authenticated routes return 401 even with a valid token:

1. Check the JWKS endpoint is accessible: `curl http://localhost:8000/auth/v1/auth/.well-known/jwks.json`
2. Verify the token hasn't expired

### Routes not updating

After changing decorators:

```bash
# Regenerate OpenAPI spec and Kong config
npm run build -w <service-name>
npx tsdevstack sync
```

### Public route requires auth

If a route you expect to be public requires JWT:

1. Make sure you omitted `@ApiBearerAuth()` (for Kong)
2. Add `@Public()` (for AuthGuard)
3. Run `npx tsdevstack sync`

