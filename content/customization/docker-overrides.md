# Docker Overrides

For local development, [Docker Compose](https://docs.docker.com/compose/) runs **infrastructure services** ([Kong](https://konghq.com/) gateway, [PostgreSQL](https://www.postgresql.org/), [Redis](https://redis.io/), monitoring tools). Your backend services (auth-service, bff-service, etc.) run natively via npm for faster iteration.

Use `docker-compose.user.yml` to add extra infrastructure or override Docker settings without modifying framework-managed files.

:::tip Prerequisite
If your `docker-compose.user.yml` references `${VARIABLE_NAME}` placeholders, run `npx tsdevstack generate-secrets` first to populate the `.env` file that Docker Compose reads from.
:::

## How it works

The framework's `docker-compose.yml` includes your user file automatically:

```yaml
# In docker-compose.yml
include:
  - path: docker-compose.user.yml
    required: false
```

This means `docker compose up` automatically merges your customizations. Services you define are added; settings you specify for existing services override the defaults.

## Adding extra services

Create `docker-compose.user.yml` in your project root to add services the framework does not provide.

### Email testing with [Mailhog](https://github.com/mailhog/MailHog)

Capture outgoing emails during development:

```yaml
# docker-compose.user.yml
services:
  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"   # SMTP server
      - "8025:8025"   # Web UI
    networks:
      - tsdevstack-network
```

Access the web UI at `http://localhost:8025` to view captured emails.

Configure your services to use it:

```json
// .secrets.user.json
{
  "secrets": {
    "SMTP_HOST": "mailhog",
    "SMTP_PORT": "1025"
  }
}
```

### Search with [Elasticsearch](https://www.elastic.co/elasticsearch)

Add a local Elasticsearch instance:

```yaml
# docker-compose.user.yml
services:
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    networks:
      - tsdevstack-network

volumes:
  elasticsearch-data:
```

### Message queue with [RabbitMQ](https://www.rabbitmq.com/)

Add a message broker:

```yaml
# docker-compose.user.yml
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"    # AMQP
      - "15672:15672"  # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASS}
    networks:
      - tsdevstack-network
```

## Mounting volumes

### Persistent data volumes

Keep data across container restarts:

```yaml
# docker-compose.user.yml
services:
  my-database:
    image: postgres:15
    volumes:
      - my-database-data:/var/lib/postgresql/data
    networks:
      - tsdevstack-network

volumes:
  my-database-data:
```

## Overriding defaults

Override settings for infrastructure services defined in docker-compose.yml:

### Increase resource limits

Give a service more memory:

```yaml
# docker-compose.user.yml
services:
  gateway:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

### Change port mappings

Expose a service on a different port:

```yaml
# docker-compose.user.yml
services:
  redis:
    ports:
      - "6380:6379"  # Map container port 6379 to host port 6380
```

### Add environment variables

Inject additional environment variables into Docker services:

```yaml
# docker-compose.user.yml
services:
  gateway:
    environment:
      - KONG_LOG_LEVEL=debug
```

**Note:** Backend services (auth-service, bff-service, etc.) run natively via npm, not in Docker. To configure environment variables for backend services, use `.secrets.user.json` instead.

## Referencing secrets

Use `${VARIABLE_NAME}` syntax to reference values from your `.env` file:

```yaml
# docker-compose.user.yml
services:
  external-api-mock:
    image: mockserver/mockserver
    environment:
      - MOCKSERVER_INITIALIZATION_JSON_PATH=/config/expectations.json
      - API_KEY=${EXTERNAL_API_KEY}
    networks:
      - tsdevstack-network
```

Add the secret to your secrets file:

```json
// .secrets.user.json
{
  "secrets": {
    "EXTERNAL_API_KEY": "test-key-for-development"
  }
}
```

The framework generates `.env` from your secrets, making variables available to Docker Compose.

## Networking

### Connecting to framework services

Use the `tsdevstack-network` to communicate with framework-managed services:

```yaml
# docker-compose.user.yml
services:
  my-custom-service:
    image: my-image
    networks:
      - tsdevstack-network
```

Services on this network can reach each other by service name:
- `auth-db`, `offers-db` - PostgreSQL databases
- `redis` - Redis cache
- `gateway` - Kong gateway

**Note:** Backend services run on the host, not in Docker. To reach them from Docker containers, use `host.docker.internal` (e.g., `host.docker.internal:3001` for auth-service).

### Adding a separate network

For services that should not access the main network:

```yaml
# docker-compose.user.yml
services:
  isolated-service:
    image: some-image
    networks:
      - isolated-network

networks:
  isolated-network:
    driver: bridge
```

## Complete example

A realistic `docker-compose.user.yml` combining several patterns:

```yaml
# docker-compose.user.yml
services:
  # Email testing
  mailhog:
    image: mailhog/mailhog
    ports:
      - "8025:8025"
    networks:
      - tsdevstack-network

  # Search service
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    networks:
      - tsdevstack-network

  # Give Kong more memory
  gateway:
    deploy:
      resources:
        limits:
          memory: 1G

volumes:
  elasticsearch-data:
```

To configure backend services to use these infrastructure services, add to `.secrets.user.json`:

```json
{
  "secrets": {
    "ELASTICSEARCH_URL": "http://localhost:9200",
    "SMTP_HOST": "localhost",
    "SMTP_PORT": "8025"
  },
  "bff-service": {
    "secrets": ["ELASTICSEARCH_URL", "SMTP_HOST", "SMTP_PORT"]
  }
}
```

## Cloud deployment considerations

`docker-compose.user.yml` is for local development only. For cloud environments, you need to:

1. **Provision managed services** - Use cloud-native equivalents (Elastic Cloud, Amazon SES, Cloud Pub/Sub)

2. **Configure connection strings** - Add URLs via cloud secrets:

```bash
npx tsdevstack cloud-secrets:set ELASTICSEARCH_URL https://my-cluster.es.cloud:9243 --env prod
npx tsdevstack cloud-secrets:set SMTP_HOST smtp.sendgrid.net --env prod
```

3. **Update service code** - Ensure your code uses the same environment variable names locally and in production

The framework does not deploy custom Docker services to the cloud. You are responsible for provisioning and connecting to managed alternatives.

## Troubleshooting

**Service cannot connect to framework services**

Ensure your service is on `tsdevstack-network`:

```yaml
services:
  my-service:
    networks:
      - tsdevstack-network  # Required for connectivity
```

**Environment variable not available**

Check that:
1. The variable exists in `.secrets.user.json`
2. You ran `npx tsdevstack generate-secrets` to update `.env`
3. You restarted the containers

**Volume mount not updating**

On macOS, try adding `:delegated` to the volume mount. On all platforms, ensure the path is correct and the file exists.

**Port conflict**

Another service is using the port. Either stop the conflicting service or change the port mapping in your override:

```yaml
services:
  my-service:
    ports:
      - "3006:3001"  # Use a different host port
```

