# Roles

Every user has one **system role** and any number of **custom roles**. Both travel in the access token, and any NestJS service can restrict an endpoint to them with `@Roles()`.

This page covers the full auth template (the `auth-service` that `init` creates). The `@Roles()` decorator itself lives in `@tsdevstack/nest-common` and works with any auth-service that puts the same claims in its tokens.

## System roles and custom roles

| | System role | Custom roles |
|---|---|---|
| Field on the user | `systemRole` | `roles` |
| JWT claim | `systemRole` | `roles` |
| Values | `USER` or `ADMIN` | Strings you declare, for example `EDITOR`, `BILLING` |
| How many per user | Exactly one | Zero or more |
| Owned by | The framework | Your product |
| Default | `USER` | Empty list |

The system role is what the framework itself relies on: admin endpoints check for `ADMIN`. Custom roles are yours. The framework never reads them; it only stores them, puts them in the token and lets `@Roles()` check them.

### Declaring custom roles

Custom roles are declared in one file in the auth-service:

```typescript
// apps/auth-service/src/roles/roles.constants.ts
export const CUSTOM_ROLES: readonly string[] = ['EDITOR', 'BILLING'];
```

The list is empty in a new project. The [admin role API](#admin-role-api) only accepts roles from this list, and rejects `USER` and `ADMIN` as custom roles (a custom `ADMIN` would pass `@Roles('ADMIN')`).

## Restricting endpoints with @Roles()

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '@tsdevstack/nest-common';

@Controller('reports')
@ApiBearerAuth()
@Roles('ADMIN')                 // every handler in this controller
export class ReportsController {
  @Get('revenue')
  revenue() {}

  @Get('drafts')
  @Roles('ADMIN', 'EDITOR')     // replaces the controller-level list here
  drafts() {}
}
```

How it behaves:

- The user needs **at least one** of the listed roles. System and custom roles are checked together, so `@Roles('ADMIN', 'EDITOR')` lets in admins and editors.
- A handler-level `@Roles()` replaces the controller-level one; the lists are not combined.
- A caller without a matching role gets **403** (`Insufficient role`).
- Only logged-in users can pass. Partner API key requests and internal service-to-service calls have no user, so they get 403 on a `@Roles()` endpoint.
- Nothing checks that the role names you pass exist. A typo such as `@Roles('EDITR')` just means nobody gets in.

`@Roles()` applies `RolesGuard` for you, so you don't add `@UseGuards()` for it. The guard reads the roles that the global `AuthGuard` put on `req.user`, which is why it needs `AuthGuard` registered globally (`APP_GUARD`), as every generated service does. Use it on endpoints that require a JWT (`@ApiBearerAuth()`); see [Protected Routes](/docs/authentication/protected-routes).

`nest-common` also exports `RolesGuard` and `ROLES_KEY` (the metadata key) if you want to build your own decorator on top.

### Older tokens

Earlier auth-service versions put a single `role` claim in the token instead of `systemRole`. When a token has no `systemRole` claim, `@Roles()` uses `role` instead, so an existing auth-service keeps working with the new guard. Code that reads `req.user.role` directly does not get this fallback: tokens from the current template no longer have that claim.

## The first admin: ADMIN_EMAILS

Nobody is an admin in a fresh project. The `ADMIN_EMAILS` secret fixes that: a comma-separated list of email addresses that the auth-service promotes to `ADMIN`.

- Promotion happens **at login**. The token issued by that login already carries `systemRole: ADMIN`.
- Only users who **confirmed their email** are promoted.
- Addresses are compared case-insensitively after trimming spaces, and only for addresses made of printable ASCII characters. Other addresses are never matched, because case folding of some Unicode characters can turn a different address into a listed one.
- It only promotes. Removing an address from the list does not demote anyone; use the [admin role API](#admin-role-api) for that.
- It runs at every login, so it is also the way back in if every admin was demoted by mistake.

Where to set it, locally and in the cloud, is covered in [Managing Users](/docs/authentication/managing-users#the-first-admin).

## Admin role API

The auth-service exposes three admin endpoints. Through the gateway they live under the auth-service prefix:

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/auth/v1/admin/users?email=<email>` | none | The user |
| `PUT` | `/auth/v1/admin/users/:id/system-role` | `{ "systemRole": "ADMIN" }` | The updated user |
| `PUT` | `/auth/v1/admin/users/:id/roles` | `{ "roles": ["EDITOR"] }` | The updated user |

All three need a JWT (`Authorization: Bearer <token>`) from a user who is an admin. They return the user object (`id`, `email`, `firstName`, `lastName`, `confirmed`, `status`, `createdAt`, `systemRole`, `roles`), never the password hash.

**Finding a user.** `GET /auth/v1/admin/users?email=` matches the email case-insensitively. If no user matches you get 404. If several accounts have the same address in different letter case (signup does not lowercase emails), you get **409**: the lookup refuses to pick one for you.

**Changing the system role.** `systemRole` must be `USER` or `ADMIN`, otherwise 400. Admins can promote and demote any user, including other admins and themselves. There is no "last admin" protection; `ADMIN_EMAILS` is the recovery path.

**Changing custom roles.** The `roles` list **replaces** the user's current list. Send `[]` to remove all custom roles. Duplicates are dropped. Any role not declared in `CUSTOM_ROLES`, and `USER` or `ADMIN`, gets 400.

**Other responses.** 401 without a valid token, 403 when the caller is not an active admin, 404 when the user id does not exist, 429 when the caller exceeds the rate limit (1,000 requests per hour per admin).

```bash
curl -X PUT http://localhost:8000/auth/v1/admin/users/<user-id>/roles \
  -H "Authorization: Bearer <admin-access-token>" \
  -H "Content-Type: application/json" \
  -d '{ "roles": ["EDITOR"] }'
```

The endpoints are also in the auth-service OpenAPI document, so the generated client has them (`adminFindUserByEmail`, `adminUpdateUserSystemRole`, `adminUpdateUserRoles` in `@shared/auth-service-client`).

## When role changes take effect

Roles live in the access token, and tokens are not rewritten when the database changes.

- **For the user whose roles changed:** the new roles reach their token at the next token refresh or login. Until then their current access token keeps the old roles, for at most `ACCESS_TOKEN_TTL`. A demoted user can keep using `@Roles()` endpoints in other services until then.
- **For admin endpoints:** the auth-service does not rely on the token alone. Its admin endpoints check `@Roles('ADMIN')` against the token first, then re-read the caller from the database and require `systemRole: ADMIN` and an active account. A demoted admin loses access to them immediately.

If an endpoint in your own service needs the same immediacy, re-check the database there too. `@Roles()` alone is only as fresh as the token.

## Reading roles in your code

The roles are on `req.user` like every other claim:

```typescript
import type { AuthenticatedRequest } from '@tsdevstack/nest-common';

@Get('me')
@ApiBearerAuth()
me(@Req() req: AuthenticatedRequest) {
  const systemRole = req.user?.systemRole; // 'USER' | 'ADMIN'
  const roles = req.user?.roles;           // string[]
}
```

Frontends get them from the user account endpoint (`GET /auth/v1/user/account`), which returns `systemRole` and `roles`, or by decoding the access token. Treat anything the frontend decides from roles as display logic only; the backend check is the one that counts.
