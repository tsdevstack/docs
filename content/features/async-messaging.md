# Async Messaging

Inter-service event broadcasting via Redis Streams. Publish events from one service, and all subscribing services receive every message independently — no new infrastructure required.

## When to use what

| Pattern | Use case | Example |
|---------|----------|---------|
| **Messaging** | Inter-service events | auth-service publishes `user-created` → offers-service AND notifications-service both react |
| **BullMQ** | Intra-service job queues | auth-service enqueues "send welcome email" → auth-worker processes it |
| **HTTP** (direct) | Synchronous request/response | aggregation-service calls offers-service and auth-service to build a combined dashboard response |

Messaging and BullMQ are complementary. A service might publish a `user-created` event via Messaging, and a subscriber might enqueue a BullMQ job to handle the heavy work.

## How it works

Messaging uses [Redis Streams](https://redis.io/docs/data-types/streams/) — the same Redis instance already used for caching and BullMQ. No additional cloud resources, no new secrets, no new environment variables.

Each topic is a Redis Stream. Each subscribing service creates a **consumer group** on that stream. Consumer groups ensure every subscribing service gets every message independently, while multiple instances of the same service share the load within their group.

### Message flow (publish → consume → ack)

```
auth-service                    Redis                         offers-service
     │                            │                                │
     │  XADD user-created         │                                │
     │  {userId, email}           │                                │
     │ ─────────────────────────► │                                │
     │                            │  XREADGROUP offers-service     │
     │                            │ ◄───────────────────────────── │
     │                            │                                │
     │                            │  message: {userId, email}      │
     │                            │ ──────────────────────────────►│
     │                            │                                │
     │                            │                 @OnMessage     │
     │                            │                 handler runs   │
     │                            │                                │
     │                            │  XACK                          │
     │                            │ ◄───────────────────────────── │
     │                            │                                │
```

### Broadcasting (one event, multiple subscribers)

```
                              Redis Stream
                              user-created
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
              consumer group  consumer group  consumer group
              offers-service  notif-service   analytics-svc
                    │             │             │
                    ▼             ▼             ▼
              each group gets every message independently
              each group acks independently
```

## Topic configuration

Topics are managed via CLI commands and stored in `.tsdevstack/config.json`:

```json
{
  "messaging": {
    "topics": [
      {
        "name": "user-created",
        "publishers": ["auth-service"],
        "subscribers": ["offers-service", "notifications-service"]
      }
    ]
  }
}
```

Publishers and subscribers are informational — they document intent and enable validation/tooling.

## CLI commands

### `add-messaging-topic`

```bash
# Fully interactive
npx tsdevstack add-messaging-topic

# Fully flagged (non-interactive)
npx tsdevstack add-messaging-topic --name user-created \
  --publishers auth-service \
  --subscribers offers-service,notifications-service
```

| Option | Required | Description |
|--------|----------|-------------|
| `--name` | yes | Topic name (kebab-case) |
| `--publishers` | no | Comma-separated publishing services |
| `--subscribers` | no | Comma-separated subscribing services |

Service selection lists NestJS services only — no frontends, SPAs, or workers.

### `remove-messaging-topic`

```bash
npx tsdevstack remove-messaging-topic --name user-created
```

Removes the topic from config. Existing stream data in Redis is unaffected.

### `update-messaging-topic`

```bash
npx tsdevstack update-messaging-topic --name user-created \
  --subscribers offers-service,notifications-service,analytics-service
```

| Option | Required | Description |
|--------|----------|-------------|
| `--name` | yes | Existing topic name |
| `--publishers` | no | Comma-separated list (**replaces** current list entirely) |
| `--subscribers` | no | Comma-separated list (**replaces** current list entirely) |

:::warning
`--publishers` and `--subscribers` use **replace semantics** — always pass the complete desired list, not just additions.
:::

## Naming conventions

| What | Format | Example |
|------|--------|---------|
| Stream key | `{project}:messaging:{topicName}` | `tsdevstack:messaging:user-created` |
| Consumer group | `{project}:messaging:{topicName}:{serviceName}` | `tsdevstack:messaging:user-created:offers-service` |
| DLQ stream | `{project}:messaging:{topicName}:dlq` | `tsdevstack:messaging:user-created:dlq` |

Colon-separated (Redis convention). The project prefix prevents collisions if multiple projects share a Redis instance.

## NestJS integration

For full API reference (`MessagingModule`, `@OnMessage`, `MessagingService`, `IncomingMessage`), see the [nest-common package reference](/packages/nest-common#messaging).

### Publishing service

```typescript
import { MessagingModule, MessagingService } from '@tsdevstack/nest-common';

// app.module.ts — publish-only (no subscriptions)
@Module({
  imports: [
    MessagingModule.forRoot({ consumerGroup: 'auth-service' }),
  ],
})
export class AppModule {}

// auth.service.ts
@Injectable()
export class AuthService {
  constructor(private messaging: MessagingService) {}

  async register(dto: RegisterDto): Promise<User> {
    const user = await this.usersRepo.save(dto);
    await this.messaging.publish('user-created', {
      userId: user.id,
      email: user.email,
    });
    return user;
  }
}
```

### Subscribing service

```typescript
import { MessagingModule, OnMessage } from '@tsdevstack/nest-common';
import type { IncomingMessage } from '@tsdevstack/nest-common';

// app.module.ts
@Module({
  imports: [
    MessagingModule.forRoot({
      consumerGroup: 'offers-service',
      topics: ['user-created'],
    }),
  ],
  providers: [UserEventsHandler],
})
export class AppModule {}

// user-events.handler.ts
@Injectable()
export class UserEventsHandler {
  @OnMessage('user-created')
  async handleUserCreated(message: IncomingMessage): Promise<void> {
    const { userId } = message.data as { userId: string };
    await this.offersRepo.createDefaultProfile(userId);
    // Returning without error → auto-XACK
  }
}
```

## Retry + DLQ

```
message delivered
       │
       ▼
  handler runs ──── success ──── XACK ──── done
       │
     throws
       │
       ▼
  stays pending
  (no XACK)
       │
       ▼
  idle > 60s?
  ├── no ──── wait
  └── yes ─── XCLAIM
               │
               ▼
          retryCount < 3?
          ├── yes ── redeliver to handler
          └── no ─── XADD to {topic}:dlq
```

- Handler returns (resolves) → message is **XACK**'d (acknowledged)
- Handler throws → message stays pending, will be retried
- After 3 failed deliveries → message moves to the DLQ stream

### Inspecting the DLQ

Use Redis Commander (available locally at http://localhost:8081) to inspect DLQ streams. Each DLQ entry contains the original message data plus failure metadata.

Recovery is manual — read messages from the DLQ stream and republish to the original topic after fixing the root cause.

## Infrastructure

No new infrastructure. Messaging uses the existing Redis instance on every provider:

| Provider | Redis Service |
|----------|--------------|
| Local | Docker Redis container |
| GCP | Memorystore |
| AWS | ElastiCache |
| Azure | Azure Cache for Redis |

No Terraform generators, no new secrets, no new env vars, no docker-compose changes, no deploy pipeline changes.

## Troubleshooting

### Messages not being consumed

1. Check the service subscribes to the topic in `config.json`
2. Verify `MessagingModule.forRoot({ topics: ['topic-name'] })` includes the topic
3. Verify a handler with `@OnMessage('topic-name')` exists and is registered as a provider
4. Check Redis connectivity in service logs

### Messages stuck in pending

Messages stay pending if the handler throws. Check handler error logs and use `XPENDING` in Redis Commander. Messages idle > 60s are auto-reclaimed via `XCLAIM`. After 3 failures, messages move to the DLQ.

### Consumer group already exists

Normal behavior. `XGROUP CREATE` on startup is idempotent — the `BUSYGROUP` error is caught and ignored.
