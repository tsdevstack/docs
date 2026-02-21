# What is tsdevstack?

tsdevstack is a full-stack, cloud-native TypeScript framework for building production microservices. It handles infrastructure, gateway, secrets, CI/CD, and observability so you can focus on your application code.

## The problem

Building production-ready microservices involves a lot of repetitive work:

- Setting up API gateways and routing
- Managing secrets across environments
- Configuring CI/CD pipelines
- Setting up observability and monitoring
- Managing infrastructure as code
- Handling authentication flows

Most teams spend months on this infrastructure before writing any business logic.

## The solution

tsdevstack handles all of this. Two commands to run locally, one command to deploy:

**Local development:**

```bash
npx tsdevstack sync && npm run dev
```

You get a running service with [Kong](https://konghq.com/) API gateway, [PostgreSQL](https://www.postgresql.org/), [Redis](https://redis.io/), auto-generated routing, secrets, [OpenAPI](https://swagger.io/specification/) spec, type-safe HTTP clients, and hot reload.

**Deploy to any cloud:**

```bash
npx tsdevstack infra:deploy --env dev
```

One command creates all infrastructure on GCP, AWS, or Azure — VPC, database, Redis, load balancer, WAF, secrets, container registry, CI/CD — and deploys your services to it.

## Core principles

### Cloud-native by default

tsdevstack isn't "deploy to cloud later". Infrastructure is a first-class citizen. The same patterns work locally and in production on GCP, AWS, or Azure.

### You own everything

Bring your own cloud credentials. The code is yours, the infrastructure is yours. No vendor lock-in, no platform dependency - just your code running on your cloud accounts.

### Fully automated with overrides

Every config file, secret, and route is generated. The framework manages the complexity so you can focus on your application code. And when you need custom behavior, override files let you customize without losing framework updates.

### Three cloud providers

Same framework, same commands, same patterns. Choose GCP, AWS, or Azure. Switch later if you need to.

### Escape hatches everywhere

Opinionated doesn't mean locked in. Every generated file has an override mechanism:

- `kong.tsdevstack.yml` → override with `kong.user.yml`
- Docker Compose → extend with `docker-compose.user.yml`
- Secrets → add your own in `.secrets.user.json`

## Who is tsdevstack for?

- **Teams** building multi-service backends who want to skip the infrastructure setup
- **Developers** who want production-ready patterns without the boilerplate
- **Startups** that need to move fast without accumulating tech debt

