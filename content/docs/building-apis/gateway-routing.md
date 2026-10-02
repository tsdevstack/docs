# Gateway Routing

[Kong Gateway](https://konghq.com/) routes requests to your backend services based on [OpenAPI](https://swagger.io/specification/) specs. Routes are generated from your code, so you rarely need to configure routing manually. The OpenAPI document is the single source of truth: an operation that is not in it is not reachable through the gateway.

## How routing works

When you run `npx tsdevstack sync`, the framework:

1. Reads OpenAPI specs from each service (`apps/{service}/docs/openapi.json`)
2. Groups operations by security type (public, JWT, partner) based on decorators
3. Generates `kong.tsdevstack.yml` with one exact route per path (see [Exact routes](#exact-routes))
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
| **AuthGuard (backend)** | `@Public()` | If present, anonymous callers are allowed |

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

Each `@PartnerApi()` path is exposed with an `/api` prefix in front of its OpenAPI path:

```bash
curl http://localhost:8000/api/offers/v1/plans \
  -H "x-api-key: <api-key>"
```

Only the paths and methods marked `@PartnerApi()` get a partner route. An endpoint without it is not reachable with an API key at all: `/api/...` for it returns 404 from Kong. Kong removes the `/api` prefix before forwarding (framework plugin `tsdevstack-api-prefix`), so the service receives `/offers/v1/plans`, the path it serves.

If a service's OpenAPI paths do not start with its route prefix, `generate-kong` prints a warning; the partner URL is still `/api` plus the OpenAPI path.

### Where the keys come from

Partner keys are runtime data, not config: admins create, limit, rotate and revoke them through the auth-service admin API, and the gateway checks each key against Redis on every request. Changes apply on the next request, without regenerating or redeploying the gateway. Requests with a missing, unknown, revoked or expired key get 401 from Kong, over-limit requests 429, and none of them reach your service. See [API Keys](/docs/authentication/api-keys).

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

## Exact routes

Every generated route (public, JWT and partner) matches exactly what your OpenAPI document declares, and nothing else:

- **Path:** an anchored regex. `/offers/v1/plans` matches only `/offers/v1/plans`, not `/offers/v1/plans/anything/extra`.
- **Path parameters:** `{id}` in the OpenAPI path matches exactly one non-empty segment.
- **Literal beats parameter:** when `/plans/featured` and `/plans/{id}` both exist, a request to `/plans/featured` goes to the literal route. Routes with more literal segments win.
- **Methods:** only the methods the OpenAPI document lists for that path, plus `OPTIONS` so the gateway's CORS plugin can answer browser preflights. `HEAD` is not added to `GET` routes.
- **One route per path:** all methods of a path share one route, named `{service}-{public|jwt|partner}-{path}` (for example `offers-service-jwt-offers-v1-user-assign-plan`).

Anything else gets **404 from Kong** (`no Route matched with those values`) before it reaches your service:

| Request | Result |
|---------|--------|
| A path that is not in the OpenAPI document | 404 |
| Extra segments (`/offers/v1/plans/1/extra`) | 404 |
| A trailing slash (`/offers/v1/plans/`) | 404 |
| A method the path does not declare (`DELETE /offers/v1/plans`) | 404 |
| An endpoint hidden from OpenAPI (`@ApiExcludeEndpoint()`, `@ApiExcludeController()`) | 404 |
| Raw Express routes and static files served by a service | 404 |

Hiding endpoints from OpenAPI is fine for things that must not be public anyway (scheduled job endpoints, health checks, metrics). Anything that should be callable through the gateway must be in the OpenAPI document.

:::warning Wildcard and optional routes
NestJS wildcard routes (`@Get('files/*splat')`) and optional segments (`@Get('items{/:id}')`) appear in the OpenAPI document as a single-segment parameter or as one of the variants. Kong then routes only that: one segment for the wildcard, one variant for the optional route. Declare the variants you need as separate routes.
:::

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

If Kong returns 404 (`no Route matched with those values`) for a route that should exist:

1. Check the request against the [exact route rules](#exact-routes): no trailing slash, no extra segments, and a method the endpoint declares
2. Check the operation is in the OpenAPI spec: `apps/{service}/docs/openapi.json` (not hidden with `@ApiExcludeEndpoint()`)
3. For partner requests (`/api/...`), check the handler has `@PartnerApi()`
4. Run `npx tsdevstack sync` to regenerate configs and restart containers, then check the route is in `kong.yml`

### Route returns 502

Kong can reach the route but the service isn't responding:

1. Run `npx tsdevstack sync` to regenerate and restart
2. Verify the service is healthy: `curl http://localhost:<port>/health`

### JWT validation fails

If authenticated routes return 401 even with a valid token:

1. Check the JWKS endpoint is accessible: `curl http://localhost:8000/auth/.well-known/jwks.json`
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

