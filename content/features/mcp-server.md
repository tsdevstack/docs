# MCP Server

tsdevstack includes a built-in [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that exposes CLI commands and project context to AI agents. This gives tools like Claude Code, Claude Desktop, Cursor, and VS Code Copilot an understanding of your project structure, service configuration, and available workflows — so they can assist you accurately instead of guessing.

## Quick start

Add the MCP server to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "tsdevstack": {
      "command": "npx",
      "args": ["tsdevstack", "mcp:serve"]
    }
  }
}
```

Restart your AI client. The tools and resources will be available immediately.

## How it works

The MCP server is a **thin wrapper** around the existing CLI. Each tool spawns `npx tsdevstack <command>` as a child process and captures the output. There are no direct imports from other CLI packages — the MCP server is a standalone wrapper.

- **Transport:** stdio (the AI client spawns the server as a child process)
- **No background process:** The server starts when the client connects and exits when it disconnects
- **Same permissions:** The MCP server runs with your local credentials, same as running CLI commands manually

## Tools

The server exposes 48 tools organized into query tools (read-only) and action tools (mutating).

### Query tools (13)

Safe, read-only operations. No confirmation needed.

| Tool | Description |
|------|-------------|
| `list_services` | List all services with their types, ports, and dependencies |
| `list_environments` | List configured cloud environments and their providers |
| `get_project_config` | Full project configuration |
| `get_infrastructure_config` | Per-environment settings: DB tiers, domains, scaling |
| `get_service_status` | Cloud resource status for a specific service |
| `list_deployed_services` | All deployed services in a cloud environment |
| `list_secrets` | Secret names in a cloud environment (no values) |
| `diff_secrets` | Compare local vs cloud secrets |
| `get_secret` | Get a single secret value from cloud |
| `list_schedulers` | Scheduled jobs and their status |
| `plan_db_migrate` | Preview pending database migrations |
| `infra_plan` | Terraform plan — preview infrastructure changes |
| `infra_status` | Check if infrastructure config is in sync |

### Action tools — local (9)

Low-risk operations that modify local files only.

| Tool | Description |
|------|-------------|
| `sync` | Regenerate all local config (secrets, docker-compose, kong, migrations) |
| `generate_secrets` | Regenerate local secrets files |
| `generate_kong` | Regenerate Kong gateway config from OpenAPI specs |
| `generate_docker_compose` | Regenerate docker-compose.yml |
| `add_service` | Add a new service (nestjs, nextjs, or spa) |
| `remove_service` | Remove a service from the local project |
| `generate_client` | Generate TypeScript HTTP client from a service's OpenAPI spec |
| `register_detached_worker` | Register a detached worker in config |
| `unregister_detached_worker` | Remove a detached worker from config |

### Action tools — cloud (12)

Higher-risk operations that modify cloud infrastructure.

| Tool | Destructive | Description |
|------|-------------|-------------|
| `cloud_secrets_push` | No | Push secrets to cloud |
| `cloud_secrets_set` | No | Set a single secret in cloud |
| `cloud_secrets_remove` | Yes | Remove a secret from cloud |
| `infra_deploy` | No | Full deployment (Terraform + build + deploy all) |
| `deploy_services` | No | Deploy code changes to existing services |
| `deploy_kong` | No | Rebuild and deploy Kong gateway |
| `deploy_lb` | No | Deploy/update the load balancer |
| `run_db_migrate` | No | Apply pending database migrations |
| `deploy_schedulers` | No | Deploy all scheduled jobs |
| `remove_service_cloud` | Yes | Remove a service from cloud (permanent) |
| `remove_detached_worker` | Yes | Remove a worker from cloud (permanent) |
| `infra_destroy` | Yes | Destroy ALL cloud infrastructure for an environment |

### Action tools — setup and CI (14)

Infrastructure setup, Docker builds, and CI/CD operations.

| Tool | Description |
|------|-------------|
| `cloud_init` | Initialize cloud provider credentials |
| `infra_bootstrap` | Bootstrap cloud project (enable APIs, add roles) |
| `infra_init` | Initialize infrastructure (Terraform state bucket) |
| `infra_generate` | Generate Terraform files from config |
| `infra_generate_docker` | Generate Dockerfiles for services |
| `infra_build_docker` | Build Docker images |
| `infra_push_docker` | Push Docker images to registry |
| `infra_build_kong` | Build Kong Docker image |
| `infra_init_ci` | Initialize CI/CD workflows |
| `infra_generate_ci` | Regenerate CI workflows |
| `deploy_service` | Build, push, deploy a single service |
| `deploy_scheduler` | Deploy a single scheduled job |
| `remove_scheduler` | Remove a scheduled job from cloud |
| `validate_service` | Validate service naming conventions and structure |

## Resources

The server exposes 12 resources that provide project context to AI agents.

### Project state (dynamic)

These read files from your project and stay up-to-date:

| URI | Description |
|-----|-------------|
| `tsdevstack://config` | `.tsdevstack/config.json` — service definitions |
| `tsdevstack://infrastructure` | `.tsdevstack/infrastructure.json` — per-environment settings |
| `tsdevstack://infrastructure-schema` | `.tsdevstack/infrastructure.schema.json` — JSON schema |
| `tsdevstack://ci` | `.tsdevstack/ci.json` — CI/CD configuration |
| `tsdevstack://secrets/map` | `.tsdevstack/secret-map.json` — secret structure |
| `tsdevstack://secrets/names` | `.secrets.local.json` — local development secrets |
| `tsdevstack://secrets/user` | `.secrets.user.json` — user-defined secrets (keys only) |
| `tsdevstack://kong/routes` | `kong.tsdevstack.yml` — API gateway routes |

### Guides (static)

Hardcoded reference content for AI agents:

| URI | Description |
|-----|-------------|
| `tsdevstack://guide` | Core concepts and anti-patterns |
| `tsdevstack://guide/workflows` | Step-by-step workflow chains |
| `tsdevstack://guide/nest-common` | nest-common library reference |
| `tsdevstack://guide/config` | Config files reference |

## Safety model

The MCP server uses [tool annotations](https://modelcontextprotocol.io/docs/concepts/tools#annotations) to communicate risk to AI clients:

- **`readOnlyHint: true`** — Query tools. Safe to run without confirmation.
- **`destructiveHint: true`** — Tools that permanently delete data (`remove_service_cloud`, `infra_destroy`, etc.). AI clients should always confirm before running these.
- **`idempotentHint: true`** — Tools that can be safely re-run (most generate/deploy commands).

Long-running commands like `infra_deploy` (30+ minutes) include a note in their description advising the AI to suggest the user runs them in their terminal instead.

## Client configuration

### Claude Code / VS Code

Add `.mcp.json` to your project root (shown above in Quick start). Claude Code picks it up automatically.

### Claude Desktop

Add to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "tsdevstack": {
      "command": "npx",
      "args": ["tsdevstack", "mcp:serve"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Cursor

Cursor supports MCP servers via its settings. Add the same command configuration in Cursor's MCP server settings.
