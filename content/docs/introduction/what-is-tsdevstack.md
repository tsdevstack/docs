# What is tsdevstack?

tsdevstack is the first **Infrastructure as Framework** — a full-stack, cloud-native, AI-native TypeScript framework where infrastructure isn't something you build alongside your app, it's a built-in feature of the framework itself.

You don't write Terraform. You don't configure gateways. You don't set up CI/CD pipelines. The framework generates, manages, and deploys all of it. You write application code — tsdevstack handles everything else.

## The problem

Building production-ready microservices involves a lot of repetitive work:

- Setting up API gateways and routing
- Managing secrets across environments
- Configuring CI/CD pipelines
- Setting up observability and monitoring
- Writing and maintaining infrastructure as code
- Handling authentication flows

Most teams spend months on this infrastructure before writing any business logic. Even with Infrastructure as Code, you're still writing and maintaining Terraform, Helm charts, and deployment scripts by hand.

## The solution

tsdevstack introduces a new paradigm: **Infrastructure as Framework (IaF)**. Instead of treating infrastructure as a separate discipline you code alongside your app, the framework absorbs it entirely. Two commands to run locally, one command to deploy:

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

### Infrastructure as Framework

The evolution from manual infrastructure to IaC was transformative. **Infrastructure as Framework** is the next step: infrastructure becomes a framework concern, not a developer concern. You add a service, the framework generates its Terraform, Docker config, gateway routes, secrets, and CI/CD pipeline. You deploy with one command. No YAML to maintain, no drift to debug.

### Cloud-native by default

tsdevstack isn't "deploy to cloud later". Infrastructure is a first-class citizen. The same patterns work locally and in production on GCP, AWS, or Azure.

### AI-native by design

A built-in MCP server gives AI agents — Claude Code, Cursor, VS Code Copilot — direct access to your entire stack. Deploy services, query infrastructure, manage secrets, and debug production issues through natural language.

### You own everything

Bring your own cloud credentials. The code is yours, the infrastructure is yours. No vendor lock-in, no platform dependency — just your code running on your cloud accounts.

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
