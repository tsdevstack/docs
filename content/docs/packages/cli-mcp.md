# cli-mcp

`@tsdevstack/cli-mcp` is the [Model Context Protocol](https://modelcontextprotocol.io/) server plugin for the tsdevstack CLI. It exposes 61 tools and 12 resources so AI agents like Claude Code, Cursor, and VS Code Copilot can understand and assist with your project: deployments, debugging, querying state, and following framework patterns.

Installed automatically by `@tsdevstack/cli init`. No separate setup needed.

## How it works

The MCP server is a thin wrapper around the CLI. Each tool spawns `npx tsdevstack <command>` as a child process and captures the output. Resources read project files or provide hardcoded framework guides.

- **Transport:** stdio (the AI client spawns the server)
- **Validation:** All tool inputs validated with Zod schemas
- **Annotations:** Tools include `readOnlyHint`, `destructiveHint`, and `idempotentHint` metadata so AI clients can make informed decisions about confirmation
- **Sensitive reads:** the server's instructions and the descriptions of `get_logs` and `get_secret` tell the agent to ask you before every call. MCP can't enforce it; the client decides

## Tools (61)

| Category | Count | Examples |
|----------|-------|---------|
| Query (read-only) | 14 | `list_services`, `get_project_config`, `diff_secrets`, `infra_plan`, `get_logs` |
| Action: local | 16 | `sync`, `generate_kong`, `add_service`, `add_bucket_storage`, `register_cron` |
| Action: cloud | 18 | `deploy_services`, `cloud_secrets_push`, `infra_deploy`, `infra_run_cron` |
| Action: setup & CI | 13 | `cloud_init`, `infra_bootstrap`, `infra_generate`, `infra_generate_kong`, `infra_init_ci` |

## Resources (12)

| Category | Count | Examples |
|----------|-------|---------|
| Project state (dynamic) | 8 | Config, infrastructure settings, secret map, Kong routes |
| Guides (static) | 4 | Framework guide, workflows, nest-common reference, config reference |

Dynamic resources read your project files and stay current. Static guides provide framework knowledge so AI agents follow correct patterns instead of guessing.

## Setup

Add to `.mcp.json` in your project root:

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

For detailed tool listings, resource URIs, safety model, and client configuration, see [MCP Server](/docs/features/mcp-server).
