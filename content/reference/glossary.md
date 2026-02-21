# Glossary

Key terms used throughout the tsdevstack documentation.

## Applications

| Term | Description |
|------|-------------|
| **Service** | A [NestJS](https://nestjs.com/) backend application. Names end with `-service` (e.g., `auth-service`, `payments-service`). Each service is a separate deployable unit. |
| **Worker** | Background job processor that runs alongside a service. Workers share the service's codebase but have a separate entry point (`worker.ts`). |
| **Detached worker** | A worker deployed to its own container for independent scaling. Registered via `register-detached-worker` command. |
| **Frontend** | A user-facing web application. Supports [Next.js](https://nextjs.org/) (SSR) and SPA ([Rsbuild](https://rsbuild.dev/)) types. |
| **Short name** | Service name without the `-service` suffix. Used in URLs (e.g., `auth-service` → `/auth/`). |

## Infrastructure

| Term | Description |
|------|-------------|
| **Kong** | [Kong](https://konghq.com/) API gateway that handles routing, authentication, and rate limiting. All requests flow through Kong before reaching services. |
| **Gateway** | Synonym for Kong in this context. The entry point for all API traffic. |
| **Route prefix** | The URL path prefix for a service, derived from its short name (e.g., `/auth/`, `/payments/`). |

## Configuration

| Term | Description |
|------|-------------|
| **Framework config** | `.tsdevstack/config.json` - Central configuration for the framework. Contains project settings and service registry. |
| **Secrets files** | `.secrets.*.json` files containing environment-specific secrets. See [How Secrets Work](/secrets/how-secrets-work). |
| **Generated files** | Files created by `tsdevstack sync` - Docker Compose, Kong config, etc. Marked with `# GENERATED FILE` header. |

## CI/CD & Deployment

| Term | Description |
|------|-------------|
| **Environment** | Deployment target: `dev`, `staging`, or `prod`. Each has isolated infrastructure and secrets. |
| **Infra config** | Terraform and CI/CD configuration for cloud deployments. Provider-specific (GCP, AWS, Azure). |
| **CI workflows** | GitHub Actions workflows generated for build, test, and deploy pipelines. |

## Authentication

| Term | Description |
|------|-------------|
| **JWT** | [JSON Web Token](https://jwt.io/) used for stateless authentication. Validated at the gateway level. |
| **Access token** | Short-lived JWT for API requests. |
| **Refresh token** | Longer-lived token for obtaining new access tokens. |
| **Public endpoint** | Route that doesn't require authentication. Marked with `@Public()` decorator. |
| **Partner API** | API endpoints accessible via API key instead of JWT. Exposed under `/api/` prefix. |

## Observability

| Term | Description |
|------|-------------|
| **Structured logging** | JSON-formatted logs with consistent fields for querying. Powered by [Pino](https://getpino.io/). |
| **Metrics** | [Prometheus](https://prometheus.io/)-compatible measurements exposed at `/metrics`. |
| **Tracing** | Distributed request tracing via [OpenTelemetry](https://opentelemetry.io/). Visualized in [Jaeger](https://www.jaegertracing.io/). |
| **Health check** | Endpoint at `/health` reporting service status. |

## Development

| Term | Description |
|------|-------------|
| **Monorepo** | Single repository containing all apps and packages. Managed with [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) and [Lerna](https://lerna.js.org/) for task orchestration. |
| **Package** | Shared code library in `packages/` directory. Used by multiple services. |
| **Hot reload** | Automatic restart when source files change during development. |
| **OpenAPI spec** | API documentation generated from NestJS decorators. Powers [Swagger UI](https://swagger.io/tools/swagger-ui/) and client generation. |

