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

In development, logs are pretty-printed:

```
[2024-01-15 10:30:45] INFO (auth-service): Creating user
    context: "UserService"
    email: "user@example.com"
```

In production, logs are JSON for log aggregation:

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:45.000Z",
  "service": "auth-service",
  "context": "UserService",
  "msg": "Creating user",
  "email": "user@example.com",
  "trace_id": "abc123...",
  "span_id": "def456..."
}
```

### Configuration

Set `LOG_LEVEL` environment variable to control log verbosity:

- `debug` - All logs
- `info` - Info and above (default)
- `warn` - Warnings and errors
- `error` - Errors only

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
    "redis": { "status": "up" },
    "memory": { "status": "up", "details": { "heapUsed": 45, "heapTotal": 128 } }
  },
  "memory": {
    "used": 45,
    "total": 128
  }
}
```

Status values: `ok`, `degraded`, `down`

### Configuring health checks

```typescript
ObservabilityModule.forRoot({
  health: {
    redis: true,        // Enable Redis health check
    memory: {
      heapThreshold: 0.9  // Alert at 90% heap usage
    }
  }
})
```

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

