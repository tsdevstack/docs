# Observability

tsdevstack includes a complete observability stack: structured logging, [Prometheus](https://prometheus.io/) metrics, distributed tracing, and health checks. All features are enabled by default when you import `ObservabilityModule`.

## Quick start

Import the module in your app:

```typescript
import { Module } from '@nestjs/common';
import { ObservabilityModule } from '@tsdevstack/nest-common';

@Module({
  imports: [ObservabilityModule],
})
export class AppModule {}
```

This enables:

- **Logging** - Structured JSON logs with [Pino](https://getpino.io/)
- **Metrics** - Prometheus-compatible metrics at `/metrics`
- **Tracing** - Distributed traces to [Jaeger](https://www.jaegertracing.io/) via [OpenTelemetry](https://opentelemetry.io/)
- **Health** - Health check endpoint at `/health`

## Local observability stack

When running `npm run dev`, the following services are available:

| Service | URL | Purpose |
|---------|-----|---------|
| [Prometheus](https://prometheus.io/) | http://localhost:9090 | Metrics storage and querying |
| [Grafana](https://grafana.com/) | http://localhost:4001 | Dashboards and visualization |
| [Jaeger](https://www.jaegertracing.io/) | http://localhost:16686 | Distributed tracing UI |

Default Grafana credentials: `admin` / `admin`

## Logging

The `LoggerService` provides structured JSON logging with automatic trace context injection.

### Basic usage

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '@tsdevstack/nest-common';

@Injectable()
export class UserService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('UserService');
  }

  async createUser(email: string) {
    this.logger.info('Creating user', { email });

    try {
      // ... create user
      this.logger.info('User created successfully', { email, userId: user.id });
    } catch (error) {
      this.logger.error('Failed to create user', error, { email });
      throw error;
    }
  }
}
```

### Log methods

```typescript
logger.debug('Debug message', { context: 'optional' });
logger.info('Info message', { context: 'optional' });
logger.warn('Warning message', { context: 'optional' });
logger.error('Error message', error, { context: 'optional' });
```

### Log output

In development, each entry is one line: time, level, `[context]`, message, then any extra fields. The service name comes from the dev runner's line prefix.

```
[10:30:45.120] INFO: [UserService] Creating user {"userId":"cm1x2y3z"}
```

In production, logs are JSON for log aggregation:

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:45.000Z",
  "service": "auth-service",
  "context": "UserService",
  "msg": "Creating user",
  "userId": "cm1x2y3z",
  "trace_id": "abc123...",
  "span_id": "def456..."
}
```

### Request logs

Each request logs one entry when it ends, in the `HTTP` context. The message summarizes the request. The request fields are grouped under `http`; the local one-line output hides them, since the message already shows them:

```
[10:30:45.124] INFO: [HTTP] POST /auth/v1/auth/signup 201 38ms {"correlationId":"b3f1c2d4-..."}
[10:30:46.002] WARN: [HTTP] GET /auth/v1/user/avatar 404 4ms {"correlationId":"c9a8b7c6-...","reason":"Avatar not found"}
```

```json
{
  "level": "info",
  "context": "HTTP",
  "msg": "POST /auth/v1/auth/signup 201 38ms",
  "http": { "method": "POST", "url": "/auth/v1/auth/signup", "statusCode": 201, "duration": 38 },
  "correlationId": "b3f1c2d4-..."
}
```

- Successful requests log at `info`.
- Client errors (4xx) log at `warn`, with the error message in `reason` and no stack trace.
- Server errors (5xx) log at `error`, with the stack trace.
- `/health` and `/metrics` log at `debug`. A failing probe logs at `warn`.
- `correlationId` is Kong's request id (`X-Request-ID`), also returned to the client as `X-Correlation-ID`. Requests with a partner API key add `apiKeyId` and `apiKeyConsumer`.

Nest's own messages (startup, routes, unhandled errors) use the same logger and the same `LOG_LEVEL`: JSON in the cloud, one line locally. An unhandled error is logged once.

### Configuration

Set `LOG_LEVEL` environment variable to control log verbosity:

- `debug` - All logs
- `info` - Info and above (default)
- `warn` - Warnings and errors
- `error` - Errors only

Locally, the generated `.env` sets `LOG_LEVEL=debug`. Cloud deployments do not set it, so deployed services log at `info`. Framework classes that log through Nest's `Logger` follow the same level.

### PII redaction

The logger automatically redacts sensitive data to prevent PII from appearing in logs. By default, common fields like `password`, `email`, `ssn`, `creditCard`, `token`, `secret`, and `apiKey` are redacted.

```typescript
// This log entry:
logger.info('User login', { email: 'user@example.com', password: 'secret123' });

// Outputs:
// { "msg": "User login", "email": "[REDACTED]", "password": "[REDACTED]" }
```

#### Custom redaction paths

Configure additional paths to redact:

```typescript
// In your app module
LoggerModule.forRoot({
  redactPaths: ['user.phoneNumber', 'order.paymentInfo.cardNumber'],
  redactCensor: '***',  // Custom censor string (default: '[REDACTED]')
})
```

Or via environment variable:

```bash
LOG_REDACT_PATHS=user.phoneNumber,order.cardNumber
```

#### Disabling default redaction

If you need full control over redaction paths:

```typescript
LoggerModule.forRoot({
  disableDefaultRedaction: true,
  redactPaths: ['onlyThisField'],  // Only these paths are redacted
})
```

#### Path syntax

Redaction paths support wildcards:

| Pattern | Matches |
|---------|---------|
| `email` | Top-level `email` field |
| `*.email` | `email` nested at any level |
| `user.email` | Specific nested path |
| `data[*].ssn` | Array elements |

## Metrics

The `MetricsService` provides Prometheus-compatible metrics using OpenTelemetry.

### Built-in metrics

These metrics are automatically collected for all HTTP requests:

| Metric | Type | Description |
|--------|------|-------------|
| `http_request_duration_seconds` | Histogram | Request duration |
| `http_requests_total` | Counter | Total request count |
| `http_active_connections` | Gauge | Active connections |

Metrics include labels: `method`, `route`, `status_code`

### Accessing metrics

Each service exposes metrics at `/metrics`:

```bash
curl http://localhost:3001/metrics
```

Prometheus scrapes these endpoints automatically.

### Custom metrics

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { MetricsService } from '@tsdevstack/nest-common';
import type { Counter } from '@opentelemetry/api';

@Injectable()
export class PaymentService implements OnModuleInit {
  private paymentsProcessed!: Counter;

  constructor(private readonly metrics: MetricsService) {}

  onModuleInit() {
    this.paymentsProcessed = this.metrics.createCounter(
      'payments_processed_total',
      { description: 'Total payments processed' }
    );
  }

  async processPayment(amount: number) {
    // ... process payment
    this.paymentsProcessed?.add(1, { status: 'success', currency: 'USD' });
  }
}
```

Available metric types:

```typescript
// Counter - monotonically increasing value
metrics.createCounter('name', { description: '...' });

// Histogram - distribution of values
metrics.createHistogram('name', { description: '...' });

// UpDownCounter - gauge-like metric
metrics.createUpDownCounter('name', { description: '...' });
```

## Tracing

Distributed tracing helps debug requests across services. Traces are sent to Jaeger via [OpenTelemetry](https://opentelemetry.io/) OTLP.

### Automatic tracing

HTTP requests are automatically traced. The `TracingInterceptor` creates spans for each request with:

- HTTP method and route
- Status code
- Duration
- Error details (if any)

### Viewing traces

1. Make a request to your API
2. Open Jaeger UI: http://localhost:16686
3. Select your service from the dropdown
4. Click "Find Traces"

### Manual spans

For custom operations within a request:

```typescript
import { Injectable } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

@Injectable()
export class PaymentService {
  private readonly tracer = trace.getTracer('payment-service');

  async processPayment(orderId: string) {
    return this.tracer.startActiveSpan('processPayment', async (span) => {
      try {
        span.setAttribute('order.id', orderId);

        // ... process payment

        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({ code: 2, message: error.message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

### Trace context in logs

When tracing is enabled, logs automatically include `trace_id` and `span_id`. This allows you to correlate logs with traces in your observability platform.

## Health checks

The health endpoint provides service status for load balancers and orchestrators.

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/health` | Full health check with component status |
| `/health/ping` | Simple liveness check |

### Health check response

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:45.000Z",
  "uptime": 3600.5,
  "checks": {
    "redis": { "status": "up" }
  },
  "memory": {
    "used": 45,
    "total": 128
  }
}
```

Status values: `ok`, `degraded`, `down`. `/health` always answers HTTP 200. It is the liveness check that Cloud Run, ECS and Container Apps act on, so a Redis outage shows as `degraded` in the body and the service keeps running. It does not check the database: a service starts listening only once its database answers (`waitForDatabase()` in `PrismaService`).

### Configuring health checks

Redis is checked automatically when the service imports `RedisModule`. `ObservabilityModule.forRoot({ health: false })` turns the health endpoints off.

## Configuration options

Customize observability features:

```typescript
ObservabilityModule.forRoot({
  serviceName: 'my-service',      // Override service name
  logging: true,                   // Enable/disable logging (default: true)
  metrics: true,                   // Enable/disable metrics (default: true)
  tracing: true,                   // Enable/disable tracing (default: true)
  tracingEndpoint: 'http://jaeger:4318',  // OTLP endpoint
  health: true,                    // Enable/disable health (default: true)
})
```

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_NAME` | Package name | Service identifier in logs/traces |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `LOG_REDACT_PATHS` | - | Additional paths to redact (comma-separated) |
| `NODE_ENV` | - | `production` enables JSON logs |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | Trace collector endpoint |

## Infrastructure endpoints

Health and metrics endpoints are marked `@Public()` and excluded from API documentation (`@ApiExcludeController()`). They bypass authentication so load balancers and monitoring systems can access them.

These routes also bypass Kong's trust header requirement since they're infrastructure endpoints, not user-facing APIs.

## Cloud environments

In production, logs are sent to your cloud provider's logging service. The JSON format produced by Pino integrates seamlessly with:

| Provider | Service | Features |
|----------|---------|----------|
| **GCP** | Cloud Logging | Structured log queries, log-based metrics, alerting |
| **AWS** | CloudWatch Logs | Log Insights queries, metric filters, alarms |
| **Azure** | Azure Monitor | Log Analytics, Kusto queries, workbooks |

No code changes required - the same JSON logs work everywhere. Cloud Run, ECS, and AKS automatically capture stdout and route it to their respective logging services.

For tracing in production, configure `OTEL_EXPORTER_OTLP_ENDPOINT` to point to your trace collector (Cloud Trace, X-Ray, or Application Insights).

