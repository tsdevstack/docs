# Managing Users

How to get from "I just deployed" to "I'm logged in as an admin", and how to handle users after that, locally and in the cloud.

:::info Auth template only
This page applies to projects created with an auth template (`fullstack-auth` or `auth`), which generate the `auth-service`. If you use an external identity provider or wrote your own auth service, user management is up to that system. The [`@Roles()` decorator](/docs/authentication/roles#restricting-endpoints-with-roles) still works as long as your tokens carry `systemRole` and `roles` claims.
:::

There is no admin panel. Users, roles and passwords are managed through the auth-service API, with `curl`, a REST client, or your own admin UI built on the generated client.

## Local and cloud at a glance

| | Local | Cloud |
|---|---|---|
| Email | Printed to the auth-service logs (console provider) | Sent through [Resend](/docs/integrations/resend) |
| Database access | pgAdmin, Prisma Studio, `psql` | None. Databases are private on every provider, by design |
| First admin | `ADMIN_EMAILS` in `.secrets.user.json` | `ADMIN_EMAILS` cloud secret in the auth-service scope |
| Role changes | Admin role API (or the database) | Admin role API only |
| Gateway URL | `http://localhost:8000` | Your API domain |

## Calling the API

Every call on this page goes **through the gateway**: `http://localhost:8000` locally, your API domain in the cloud. Protected endpoints only accept requests that came through Kong, so calling a service port directly (for example `http://localhost:3001`) with a bearer token gets 401. That includes Swagger UI's "Try it out", which calls the service directly; use it to read the API, and `curl` through the gateway to call protected endpoints. See [Protected Routes](/docs/authentication/protected-routes#trust-first) for why.

## Local walkthrough

### 1. Sign up and confirm

Sign up through your frontend, or directly:

```bash
curl -X POST http://localhost:8000/auth/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{ "firstName": "Ada", "lastName": "Lovelace", "email": "ada@example.com", "password": "SecurePass123" }'
```

No email is sent locally. The confirmation email, with its link (`{APP_URL}/confirm?token=...`), is printed in the auth-service logs:

```bash
docker compose logs auth-service
```

Open the link to confirm through your frontend, or post the token yourself:

```bash
curl -X POST http://localhost:8000/auth/v1/auth/confirm-email \
  -H "Content-Type: application/json" \
  -d '{ "token": "<token-from-the-link>" }'
```

### 2. Make yourself admin

`generate-secrets` adds an empty `ADMIN_EMAILS` entry to `.secrets.user.json` in auth template projects. Fill it in (comma-separated for several people):

```json
{
  "secrets": {
    "ADMIN_EMAILS": "ada@example.com"
  }
}
```

Then regenerate the merged secrets:

```bash
npx tsdevstack generate-secrets
```

The running auth-service reads the new value within about a minute (secrets are cached for one minute locally). Restart the auth-service if you don't want to wait.

### 3. Log in and check the role

Promotion happens at login, for confirmed users only:

```bash
curl -X POST http://localhost:8000/auth/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "ada@example.com", "password": "SecurePass123" }'
```

The response holds `accessToken` and `refreshToken`. Check the role:

```bash
curl http://localhost:8000/auth/v1/user/account \
  -H "Authorization: Bearer <accessToken>"
```

`systemRole` should be `ADMIN`. If it still says `USER`: check that the email is confirmed (`confirmed: true`), that the address in `ADMIN_EMAILS` matches, and that you logged in again after setting it. A token refresh does not promote; only a login does.

### Direct database access

Locally you can also look at and edit users in pgAdmin (`http://localhost:5050`) or Prisma Studio; see [Debugging](/docs/local-development/debugging#database-access). That is convenient for poking around, but get used to the API: it is the only way in the cloud.

## Cloud walkthrough

### Email first

Signup confirmation and password reset emails go through Resend in the cloud. Without a working `RESEND_API_KEY` and a verified sending domain, new users cannot confirm their email, and an unconfirmed user can never become admin. Set this up first: [Resend](/docs/integrations/resend).

### The first admin

`ADMIN_EMAILS` is a secret in the **auth-service scope** of each environment. There are two ways to set it:

- **With `cloud-secrets:push`.** If `ADMIN_EMAILS` has a value in your local `.secrets.user.json`, the push asks for the cloud value (you can leave it empty to skip). The local value is not copied: each environment gets its own list.
- **Directly:**

  ```bash
  npx tsdevstack cloud-secrets:set ADMIN_EMAILS --service auth-service --env prod
  ```

  You are prompted for the value. This is also the way for CI-only setups, and the command `cloud-secrets:push` prints when it does not prompt.

Then sign up in that environment, confirm the email from the message Resend delivers, and log in. The login that promotes you returns a token with `systemRole: ADMIN`; check it with `GET /v1/user/account` as in the local walkthrough, against your API domain.

If you set the secret after the auth-service already looked for it, give it a minute: a missing `ADMIN_EMAILS` is remembered for 60 seconds. When you change a value that already existed, running instances can keep the old value for up to 5 minutes (the cloud secrets cache).

### No database access, by design

Cloud databases are only reachable from inside the private network. tsdevstack does not open them up for convenience, and there is no pgAdmin in the cloud. Everything you do to users there goes through the auth-service API: lookups and role changes through the [admin role API](/docs/authentication/roles#admin-role-api), passwords through the endpoints below.

## Roles

Once you are admin, you manage everyone else's roles with the admin role API: find the user by email, then set their system role or custom roles.

```bash
# Find the user
curl "https://api.example.com/auth/v1/admin/users?email=grace@example.com" \
  -H "Authorization: Bearer <admin-access-token>"

# Make them admin
curl -X PUT https://api.example.com/auth/v1/admin/users/<user-id>/system-role \
  -H "Authorization: Bearer <admin-access-token>" \
  -H "Content-Type: application/json" \
  -d '{ "systemRole": "ADMIN" }'
```

Changes reach the user's token at their next refresh or login. Details, custom roles and every response code: [Roles](/docs/authentication/roles).

## Passwords

Admins never set or see passwords. Users change their own, or reset them by email.

### Changing a password (logged in)

```bash
curl -X PUT http://localhost:8000/auth/v1/user/password \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{ "currentPassword": "SecurePass123", "newPassword": "EvenBetterPass456" }'
```

- The user's email must be confirmed; otherwise 401 (`Email not confirmed`).
- A wrong current password gets **400**, not 401, so a client does not log the user out over a typo.
- The new password follows the signup rules: at least 8 characters, with an uppercase letter, a lowercase letter and a number.
- Limited to 5 attempts per user per 15 minutes (429 after that).

On success the response is a **new token pair** (`accessToken`, `refreshToken`). Every refresh token the user had is revoked, so all other sessions end at their next refresh. Access tokens already issued stay valid until they expire (`ACCESS_TOKEN_TTL`). The calling client must store the returned tokens; if it keeps its old refresh token, its own session ends at the next refresh too.

### Forgotten passwords

Users who cannot log in use the email flow: `POST /auth/v1/auth/forgot-password` sends a reset link, and `POST /auth/v1/auth/reset-password` sets the new password. Locally the reset email appears in the auth-service logs; in the cloud it needs Resend, like confirmation.
