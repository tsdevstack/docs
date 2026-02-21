# tsdevstack docs

Documentation site for [tsdevstack](https://github.com/tsdevstack/docs) — a full-stack TypeScript microservices framework for production workloads.

Built with [Rspress](https://rspress.dev/).

## Sections

- **Introduction** — what tsdevstack is, supported app types, architecture overview
- **Getting Started** — quick start, prerequisites, installation, first app, project structure
- **Local Development** — running locally, adding apps, tech stack, debugging
- **Building APIs** — OpenAPI decorators, gateway routing, DTO generation, Swagger
- **Authentication** — JWT tokens, protected routes, session management
- **Secrets** — local and cloud secrets, user vs framework secrets
- **Infrastructure** — environments, service config, CI/CD, GCP / AWS / Azure providers
- **Customization** — framework files, escape hatches, Docker and Kong overrides
- **Security** — compliance readiness
- **Packages** — nest-common
- **Reference** — CLI commands, glossary

## Development

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

## Build

```bash
npm run build
```

Output goes to `doc_build/`.

## License

MIT