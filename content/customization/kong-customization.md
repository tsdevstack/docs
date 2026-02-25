# Kong Customization

The framework generates Kong Gateway configuration automatically, but you can customize it for your specific needs. This guide explains the configuration file system and how to add your own settings.

## Configuration files

Kong configuration uses a layered file system:

| File | Purpose | Editable |
|------|---------|----------|
| `kong.tsdevstack.yml` | Framework-generated routes, consumers, and service-level auth plugins | No (regenerated) |
| `kong.user.yml` | Your customizations (global plugins, custom services, consumers) | Yes |
| `kong.custom.yml` | Complete override (optional) | Yes |
| `kong.yml` | Final merged config | No (generated) |

The framework merges `kong.tsdevstack.yml` and `kong.user.yml` to create the final `kong.yml`. The merge is structured per key:

- **Services** — combined from both files (framework routes first, then your custom services)
- **Consumers** — combined from both files (framework-generated partner consumers first, then yours)
- **Plugins** — come only from `kong.user.yml` (the framework doesn't generate root-level plugins; auth plugins like oidc and key-auth are attached inside individual service definitions)

## Customizing with kong.user.yml

Edit `kong.user.yml` to add global plugins, consumers, or custom services. This file is created once and preserved across regenerations.

### Template-aware defaults

The generated `kong.user.yml` differs based on your framework template:

**Auth templates** (`fullstack-auth` or `auth`): The request-transformer plugin includes JWT claim headers (`X-JWT-Claim-Sub`, `X-JWT-Claim-Email`, etc.) in the remove list to prevent header spoofing.

**No auth template** (`template: null` — external OIDC): JWT claim headers are omitted from the remove list but included as commented-out examples:

```yaml
plugins:
  - name: request-transformer
    config:
      remove:
        headers:
          - X-Consumer-Id
          - X-Consumer-Username
          # Add your OIDC provider's JWT claims to prevent header spoofing:
          # - X-JWT-Claim-Sub
          # - X-JWT-Claim-Email
          # - X-JWT-Claim-Role
          # - X-JWT-Claim-Confirmed
          - X-Kong-Request-Id
          - X-Kong-Trust
```

Uncomment the claims your OIDC provider uses or add your own. This prevents external clients from spoofing user identity via headers that [Kong](https://konghq.com/) would normally set from the JWT.

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

### Partner API consumers

Add API key authentication for external partners:

```yaml
consumers:
  - username: acme-corp
    keyauth_credentials:
      - key: ${ACME_API_KEY}
    plugins:
      - name: rate-limiting
        config:
          minute: 500
          hour: 10000
```

The `${ACME_API_KEY}` placeholder references a secret. Add the actual key to `.secrets.user.json`:

```json
{
  "secrets": {
    "ACME_API_KEY": "sk_live_acme_key_here"
  }
}
```

### Key rotation

Support multiple keys during rotation by adding multiple credentials:

```yaml
consumers:
  - username: acme-corp
    keyauth_credentials:
      - key: ${ACME_API_KEY_NEW}
      - key: ${ACME_API_KEY_OLD}
```

Both keys work during the transition period. Remove the old key after the partner migrates.

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
  - name: cors
    config:
      origins: ${KONG_CORS_ORIGINS}
```

To return to automatic generation, rename or delete the file:

```bash
mv kong.custom.yml kong.custom.yml.backup
```

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

```yaml
consumers:
  - username: premium-partner
    keyauth_credentials:
      - key: ${PREMIUM_API_KEY}
    plugins:
      - name: rate-limiting
        config:
          minute: 1000
          hour: 50000
```

### Add request size limits

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

**Consumer not working**
- Verify the consumer exists in `kong.user.yml`
- Check that the API key secret exists in `.secrets.user.json`
- Confirm the final `kong.yml` contains the resolved key

**Customizations lost after sync**
- Edit `kong.user.yml`, not `kong.tsdevstack.yml`
- The framework file is regenerated; the user file is preserved

