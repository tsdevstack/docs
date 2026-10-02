# Kong Customization

The framework generates Kong Gateway configuration automatically, but you can customize it for your specific needs. This guide explains the configuration file system and how to add your own settings.

## Configuration files

Kong configuration uses a layered file system:

| File | Purpose | Editable |
|------|---------|----------|
| `kong.tsdevstack.yml` | Framework-generated routes, service-level plugins (OIDC, API key check, per-IP ceiling) and framework global plugins | No (regenerated) |
| `kong.user.yml` | Your customizations (global plugins, custom services) | Yes |
| `kong.custom.yml` | Complete override (optional) | Yes |
| `kong.yml` | Final merged config | No (generated) |

The framework merges `kong.tsdevstack.yml` and `kong.user.yml` to create the final `kong.yml`. The merge is structured per key:

- **Services** — combined from both files (framework routes first, then your custom services)
- **Consumers**: taken from `kong.user.yml` as written. The framework generates none, and no generated route authenticates with them (see [Partner API keys](#partner-api-keys))
- **Plugins**: framework global plugins first (today one: `tsdevstack-strip-identity`), then yours from `kong.user.yml`. Service-level plugins (oidc on JWT routes; the API key check, the per-IP ceiling and `tsdevstack-api-prefix` on partner routes) are attached inside the individual service definitions. Kong allows one global instance per plugin name, so a `kong.user.yml` that declares a framework global plugin fails generation with a hint

## Customizing with kong.user.yml

Edit `kong.user.yml` to add global plugins or custom services. This file is created once and preserved across regenerations.

### The trust header (request-transformer)

The generated `kong.user.yml` starts with a `request-transformer` that proves to your backends that a request came through Kong:

```yaml
plugins:
  - name: request-transformer
    config:
      remove:
        headers:
          - X-Kong-Request-Id
          - X-Kong-Trust
      add:
        headers:
          - X-Kong-Trust:${KONG_TRUST_TOKEN}
```

It removes any client-sent `X-Kong-Trust` and adds the real token. Keep it: backends reject identity headers on requests without a valid trust token (see [Protected Routes](/docs/authentication/protected-routes#trust-first)).

Only `X-Kong-Request-Id` and `X-Kong-Trust` belong in its remove list. Client-sent identity headers (`X-Userinfo`, `X-Consumer-*`, `X-Credential-Identifier` and so on) are removed by the framework plugin `tsdevstack-strip-identity`, which runs before authentication. The `request-transformer` runs after authentication, so removing identity headers there deletes the values Kong itself just set; for example removing `X-Api-Key-Consumer` leaves `@Partner()` without a consumer name.

:::warning Upgrading an older kong.user.yml
Files created by earlier versions list `X-Consumer-Id`, `X-Consumer-Username` and sometimes `X-JWT-Claim-*` headers in that remove list. Delete those entries and keep only `X-Kong-Request-Id` and `X-Kong-Trust`. `generate-kong` and `infra:generate-kong` print a warning while identity headers are still listed.
:::

### Global plugins

Add plugins that apply to all routes:

```yaml
plugins:
  - name: rate-limiting
    config:
      minute: 100
      policy: local

  - name: cors
    config:
      origins:
        - ${KONG_CORS_ORIGINS}
      methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
      headers: [Accept, Authorization, Content-Type, X-Request-ID, x-api-key]
      credentials: true

  - name: correlation-id
    config:
      header_name: X-Request-ID
      generator: uuid
      echo_downstream: true
```

### The global rate limiter and API keys

The global `rate-limiting` plugin limits every caller per IP. On partner routes (`/api/...`) it works differently: its `minute`, `hour`, `day` and `month` values become the default limits of every API key, counted per key, and a key's own limits replace them. On those routes a per-IP ceiling (`framework.apiKeys.ipLimitPerMinute` in `.tsdevstack/config.json`, 600 by default) takes its place. Details in [API Keys](/docs/authentication/api-keys#limits).

### Partner API keys

Partner keys are not configured here. Admins create, limit, rotate and revoke them at runtime through the auth-service admin API, and the gateway checks them against Redis. See [API Keys](/docs/authentication/api-keys).

Earlier versions defined partners as `consumers` with `keyauth_credentials` in this file. Those keys no longer work on partner routes; `generate-kong` and `infra:generate-kong` warn while such consumers are still listed. Move the partners to API keys ([Migrating from static partner keys](/docs/authentication/api-keys#migrating-from-static-partner-keys)), then delete the consumers and their key secrets.

### Custom services

Add services not managed by the framework:

```yaml
services:
  - name: legacy-api
    url: http://legacy-backend:3005
    routes:
      - name: legacy-route
        paths: [/legacy]
    plugins:
      - name: rate-limiting
        config:
          minute: 50
```

## CORS configuration

Configure allowed origins in your secrets file:

```json
{
  "KONG_CORS_ORIGINS": "https://app.example.com,https://admin.example.com"
}
```

The framework automatically converts this comma-separated string to an array in the final configuration.

## Escape hatch with kong.custom.yml

For complete control, create `kong.custom.yml`. When this file exists, the framework skips automatic route generation and only resolves secret placeholders.

```yaml
_format_version: '3.0'
_transform: true

services:
  - name: my-service
    url: ${KONG_SERVICE_HOST}:3001
    routes:
      - name: my-routes
        paths: [/api]

plugins:
  - name: tsdevstack-strip-identity
  - name: cors
    config:
      origins: ${KONG_CORS_ORIGINS}
```

In custom mode you own everything the framework would otherwise generate, including the security pieces:

- **`tsdevstack-strip-identity` as a global plugin.** Without it, clients can send forged identity headers (`X-Userinfo`, `X-Consumer-*`) to your backends. `generate-kong` warns when it is missing.
- **The trust header `request-transformer`** from [above](#the-trust-header-request-transformer), or backends reject identity headers.
- **`tsdevstack-api-prefix` on partner services** (`config.prefix: /api`) if you publish partner routes at `/api/...` and your services serve the path without `/api`.
- **`tsdevstack-api-key` on partner services**, with the Redis connection and `default_limits`, plus a service-scoped `rate-limiting` counted per IP as the ceiling. Without the key plugin, partner routes check no key at all. Copy both from a generated `kong.tsdevstack.yml`.

The same `request-transformer` check applies: identity headers in its remove list produce a warning. See [Kong Plugins](/docs/customization/kong-plugins#framework-plugins) for what the framework plugins do.

To return to automatic generation, rename or delete the file:

```bash
mv kong.custom.yml kong.custom.yml.backup
```

## Custom Lua plugins

Your own Lua plugins go in the `kong-plugins/` folder at the project root and are baked into the gateway image, locally and in the cloud. See [Kong Plugins](/docs/customization/kong-plugins).

## Applying changes

After editing configuration files:

```bash
npx tsdevstack sync
```

This regenerates Kong configuration and restarts the gateway.

## Secret placeholders

Use `${SECRET_NAME}` syntax in configuration files. The framework resolves these from your secrets files during generation:

```yaml
plugins:
  - name: request-transformer
    config:
      add:
        headers: ['X-Custom-Header:${MY_SECRET_VALUE}']
```

## Common customizations

### Increase rate limits for a partner

Raise the limits of the partner's API key through the admin API (`PATCH /auth/v1/admin/api-keys/:id`). It applies on the next request, with no gateway redeploy. See [API Keys](/docs/authentication/api-keys#update-limits-and-expiry).

### Configure upload size limits

The default maximum request body size is 10MB, configurable via `infrastructure.json`:

```json
{
  "prod": {
    "kong": {
      "maxUploadSize": "25m"
    }
  }
}
```

This sets Kong's nginx `client_max_body_size`. Values use nginx-style format: `"10m"`, `"50m"`, `"1g"`, `"0"` for unlimited. Requests exceeding this limit receive `413 Content Too Large`.

For files larger than the configured limit, use presigned URL uploads which bypass Kong entirely. See [Object Storage — File Uploads](/docs/features/object-storage#file-uploads).

### Add request size limits (per-route via plugin)

For more granular control, use the Kong request-size-limiting plugin in `kong.user.yml`:

```yaml
plugins:
  - name: request-size-limiting
    config:
      allowed_payload_size: 10
      size_unit: megabytes
```

### Enable response caching

```yaml
plugins:
  - name: proxy-cache
    config:
      response_code: [200]
      request_method: [GET]
      content_type: [application/json]
      cache_ttl: 300
```

## Troubleshooting

**Changes not taking effect**
- Run `npx tsdevstack sync` to regenerate and restart

**API key rejected**
- Check the `error` code in the response body against the table in [API Keys](/docs/authentication/api-keys#gateway-responses)
- Keys from `consumers` in `kong.user.yml` no longer work; create the key through the admin API

**Customizations lost after sync**
- Edit `kong.user.yml`, not `kong.tsdevstack.yml`
- The framework file is regenerated; the user file is preserved

