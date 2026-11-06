# telemetry

`@tsdevstack/telemetry` sets up tracing for a process: one [OpenTelemetry](https://opentelemetry.io/) setup that sends traces to Cloud Trace, X-Ray or Azure Monitor in the cloud and to Jaeger locally. NestJS services and workers get it through `@tsdevstack/nest-common`, with nothing to call. Next.js frontends call it from `instrumentation.ts`.

```bash
npm install @tsdevstack/telemetry
```

## Next.js

```typescript
// instrumentation.ts
import packageJson from './package.json';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerTelemetry } = await import('@tsdevstack/telemetry');
    registerTelemetry({
      serviceName: packageJson.name,
      serviceVersion: packageJson.version,
      continueIncomingTraces: false,
    });
  }
}
```

`continueIncomingTraces: false` makes the frontend start a new trace for every request, so a browser can't choose the trace. The frontend's own calls still carry its trace to Kong.

Add the interceptor to the axios clients that call Kong:

```typescript
import { injectTraceContext } from '@tsdevstack/telemetry';

authClient.instance.interceptors.request.use(injectTraceContext);
```

## API

### `registerTelemetry(options?)`

Registers the tracer provider, the async context and the W3C `traceparent` propagator globally. Call it once, before the app handles requests. It returns `{ forceFlush(), shutdown() }`.

| Option | Default | Description |
|--------|---------|-------------|
| `serviceName` | `WORKER_NAME`, then `SERVICE_NAME` | `service.name` of every span |
| `serviceVersion` | `'1.0.0'` | `service.version` of every span |
| `provider` | `TELEMETRY_PROVIDER` | `gcp`, `aws`, `azure` or `local`. Unset means local |
| `endpoint` | `OTEL_EXPORTER_OTLP_ENDPOINT`, else `http://localhost:4318` | OTLP base endpoint for local runs |
| `continueIncomingTraces` | `true` | `false` for a process that takes requests straight from the internet |
| `onExportError` | `console.warn` | Called when sending traces starts failing; again only after a later success |

### `injectTraceContext(config)`

An axios request interceptor. It writes the current trace into the request's `traceparent` header, so the called service continues the trace. A call outside any trace gets no header.

### `resolveTelemetryProvider(value?)`

The cloud the process runs on, from the value or `TELEMETRY_PROVIDER`: `'gcp'`, `'aws'`, `'azure'`, or `'local'` for anything else.

### `toXrayTraceId(traceId)`

A W3C trace ID in X-Ray's form (`1-xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx`), as the X-Ray console shows it.

## Where traces go

| Provider | Destination | Sign-in |
|----------|-------------|---------|
| `local` | `OTEL_EXPORTER_OTLP_ENDPOINT` + `/v1/traces` | None |
| `gcp` | `https://telemetry.googleapis.com/v1/traces` | A Google token from the service account (`GCP_PROJECT_ID` names the project) |
| `aws` | `https://xray.<AWS_REGION>.amazonaws.com/v1/traces` | SigV4 with the task role |
| `azure` | `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` (the data collection rule's URL) | An Entra token from the managed identity (`AZURE_SECRETS_CLIENT_ID`, else the system-assigned one) |

The tsdevstack deploy sets every variable above. The sample rate comes from `TRACE_SAMPLE_RATE` (0 to 1, default 1): a request whose parent span was kept stays in the trace, and any other request is kept at that rate. Health probes and metrics scrapes (`/health`, `/health/...`, `/metrics`) are never traced. `OTEL_RESOURCE_ATTRIBUTES` adds resource attributes.

All exports use OTLP over HTTP with protobuf. Each cloud's sign-in code loads only on that cloud.

See [Traces and Dashboards](/docs/features/traces-and-dashboards) for what a trace contains and where to look at it.
