# Traces and Dashboards

Every request gets one trace, from the Next.js frontend through Kong to each service it calls, with the database queries, queued jobs and message handlers inside it. Traces go to each cloud's own trace service, and locally to Jaeger. Each environment also gets a dashboard in its cloud's console. Both work without setup: `infra:deploy` creates what they need.

## What a trace shows

| Part | Spans |
|------|-------|
| Next.js frontend | Next.js's own server spans, and the calls to Kong |
| Kong | The request and the call to the service |
| NestJS services and workers | One span per request (`GET /auth/v1/users/:id`), calls to other services through generated clients, BullMQ jobs (queued and processed), messages (published and handled) |
| Database | Each Prisma query: the operation, the SQL with `$1` placeholders (never the values), the connection |

A job runs in the trace of the request that queued it. A message handler runs in the trace of the request that published the message. A scheduled job run is a request to your service, so it starts a trace of its own.

Health checks and `/metrics` get no spans, in Kong and the Next.js apps too: the load balancer and Front Door probe them every few seconds. Calls you make with your own axios instance or `fetch` don't carry the trace to the next service. Add the interceptor from `@tsdevstack/telemetry` to carry it:

```typescript
import axios from 'axios';
import { injectTraceContext } from '@tsdevstack/telemetry';

const client = axios.create({ baseURL: process.env.PAYMENTS_URL });
client.interceptors.request.use(injectTraceContext);
```

## Where traces go

| | Trace service | Where to look | How services sign in |
|---|---|---|---|
| Local | [Jaeger](https://www.jaegertracing.io/) | http://localhost:16686 | None |
| GCP | Cloud Trace | **Trace explorer** | Each service account, with `roles/telemetry.tracesWriter` |
| AWS | X-Ray, through CloudWatch Transaction Search | **CloudWatch > Application Signals > Transaction Search** | Each task role, with the `xray:PutTraceSegments`, `PutSpans` and `PutSpansForIndexing` actions |
| Azure | Application Insights (`{project}-{env}-appinsights`) | The Application Insights resource, or the `OTelSpans` table in the environment's Log Analytics workspace | Each managed identity, with **Monitoring Metrics Publisher** on the traces data collection rule |

No keys or connection strings are involved. Each service signs in with its own cloud identity, and Terraform grants the roles. Kong sends its spans to a collector container that runs next to it and signs in with Kong's identity. The collector keeps its memory under 200 MiB: above that, it drops Kong's spans instead of growing.

:::warning AWS: Transaction Search is account-wide
`infra:deploy` turns on Transaction Search, which sends X-Ray spans to CloudWatch Logs. It applies to the whole AWS account, changes how X-Ray bills every app in it, and stays on after `infra:destroy`. See [AWS costs](/docs/infrastructure/providers/aws/cost-estimation#traces-and-dashboards).
:::

## Logs and traces together

Every line a NestJS service logs inside a request carries `trace_id` and `span_id`, the request line included. Find a request's lines from the terminal on every cloud:

```bash
npx tsdevstack infra:logs --all --env prod --grep <trace id>
```

The consoles link them too:

- **GCP:** lines carry the fields Cloud Logging reads (`logging.googleapis.com/trace`, `spanId`, `trace_sampled`), so the Logs Explorer opens a line's trace and the Trace explorer shows a span's logs.
- **AWS:** lines carry `xray_trace_id`, the trace ID in the form the X-Ray console shows.
- **Azure:** the portal links only logs that go to Application Insights. Ours go to the Container Apps and App Service tables, so use `infra:logs --grep`.

## Sampling

By default every trace is kept. Set `tracing.sampleRate` per environment to keep a share of them:

```json
{
  "prod": {
    "tracing": { "sampleRate": 0.1 }
  }
}
```

The rate is a number from 0 to 1. Kong decides for each request it receives, and the services follow its decision. Scheduled job runs and workers use the same rate. Redeploy after a change.

Kong 3.8 applies the rate again to requests from the Next.js frontend. Below 1, some frontend traces miss the Kong and service hops. At the default of 1 every trace is complete.

At high traffic, the rate sets the trace bill. See the cost page of your provider.

## Trace headers from outside

A client on the internet can't choose your trace IDs or force a trace to be kept:

- Kong drops `traceparent`, `tracestate` and `baggage` from outside clients and starts a new trace. It keeps them on calls from your Next.js frontend, which it recognizes by the frontend token.
- The frontend starts a new trace for every browser request (`continueIncomingTraces: false`).

## Late traces

Spans leave in batches. On Cloud Run, Kong and the Next.js apps get CPU only while they handle requests, and so does a NestJS service with `minInstances: 0`. Their spans can show up with the next request. Services at `minInstances` 1 or more, the default, send them on time. See [minInstances](/docs/infrastructure/service-configuration#mininstances).

## Next.js frontends

The Next.js template comes with tracing. Two pieces do it:

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

```typescript
// lib/externalApi/auth-service.api.ts
import { injectTraceContext } from '@tsdevstack/telemetry';

authClient.instance.interceptors.request.use(injectTraceContext);
```

A frontend made from an older template adds `@tsdevstack/telemetry` to its dependencies, the file and the interceptor. Without them the frontend has no spans, and each trace starts at Kong. The deploy sets the variables the package reads (`TELEMETRY_PROVIDER`, `TRACE_SAMPLE_RATE` and the cloud's endpoint or project).

## Your own spans

```typescript
import { Injectable } from '@nestjs/common';
import { SpanStatusCode, trace } from '@opentelemetry/api';

@Injectable()
export class PaymentService {
  private readonly tracer = trace.getTracer('payment-service');

  async processPayment(orderId: string): Promise<void> {
    return this.tracer.startActiveSpan('processPayment', async (span) => {
      try {
        span.setAttribute('order.id', orderId);
        // ... process the payment
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

The span joins the current request's trace and goes wherever the service's traces go.

## Dashboards

Each environment gets one dashboard in its cloud's console. `infra:deploy` creates it and prints its link at the end:

```
Dashboard: https://console.cloud.google.com/monitoring/dashboards/builder/<id>?project=<project>
```

| | GCP (Cloud Monitoring) | AWS (CloudWatch) | Azure (Azure Monitor workbook) |
|---|---|---|---|
| Services | Requests, 5xx, latency (p95), instances, CPU, memory | CPU, memory; requests, latency and errors from the logs | CPU, memory, replicas, restarts, requests, response time |
| Kong and Next.js | Same as services | Load balancer requests, 5xx, response time (p95) | Requests, 5xx, response time, memory, plan CPU and memory |
| Database | CPU, memory, connections | CPU, connections, free memory | CPU, memory, connections, storage, transactions, deadlocks |
| Redis | Memory | Memory | Memory, server load, clients, operations |
| Edge | Load balancer requests by response class, Cloud Armor blocks | WAF blocks | Front Door requests, 5xx, latency, WAF |
| Errors | Error lines from the logs | Error lines from the logs | Error lines from the logs |

On AWS, the load balancer sees only Kong and the Next.js apps, so the per-service traffic panels read the logs. Container Insights stays off; restarts and crashes show in `infra:logs` as platform lines.

### Slow queries

Each database records statistics per query:

- **GCP:** Cloud SQL Query Insights (**Cloud SQL > Query insights**).
- **AWS:** Database Insights, standard mode (**CloudWatch > Database Insights**), with 7 days of history.
- **Azure:** Query Store (the server's **Query Performance Insight**) on General Purpose and Memory Optimized tiers. Microsoft advises against Query Store on Burstable tiers, so it stays off there, and the workbook says so. The default tier is Burstable. The enhanced Postgres metrics are on for every tier.

## Permissions

The deploy account needs a few rights for traces and dashboards:

- **GCP:** the Monitoring Dashboard Editor role (`roles/monitoring.dashboardEditor`) and the `telemetry`, `cloudtrace`, `logging` and `monitoring` APIs. `infra:bootstrap` adds them. A project set up with an older CLI runs `npx tsdevstack infra:bootstrap --env <env>` once.
- **AWS:** the documented policy covers it (`xray:*`, `cloudwatch:*`, `logs:*`).
- **Azure:** the constrained User Access Administrator role must allow **Monitoring Metrics Publisher**. See [Azure account setup](/docs/infrastructure/providers/azure/account-setup#step-5-grant-permissions).

## Costs

Dashboards cost little or nothing. Traces are billed by volume:

| | Traces | Dashboard |
|---|---|---|
| GCP | $0.20 per million spans after 2.5 million free each month | Free |
| AWS | $0.35 per GB of spans; 1% of spans indexed for search is included | $3 a month after the first 3 in the account; log panels $0.005 per GB scanned when viewed |
| Azure | About $2.30 per GB after 5 GB free each month (shared with logs) | Free |

The cost pages estimate them per scenario: [GCP](/docs/infrastructure/providers/gcp/cost-estimation#traces-and-dashboards), [AWS](/docs/infrastructure/providers/aws/cost-estimation#traces-and-dashboards), [Azure](/docs/infrastructure/providers/azure/cost-estimation#traces-and-dashboards).

## Locally

`npm run dev` starts Jaeger 2, Prometheus and Grafana next to your services. Traces work the same way as in the cloud: one trace per request, Kong included.

| Tool | URL |
|------|-----|
| Jaeger | http://localhost:16686 |
| Grafana | http://localhost:4001 (dashboards in the `tsdevstack` folder, no login needed to view; `admin` / `admin` to edit) |
| Prometheus | http://localhost:9090 |
