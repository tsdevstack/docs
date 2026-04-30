import { Prompt } from "@rspress/core/theme";

export function HomeHero() {
  return (
    <div
      className="home-hero"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "4rem 1.5rem 3rem",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: "0.25rem 0.75rem",
          borderRadius: "999px",
          fontSize: "0.8rem",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--rp-c-brand)",
          background: "color-mix(in srgb, var(--rp-c-brand) 10%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--rp-c-brand) 25%, transparent)",
          marginBottom: "1.5rem",
        }}
      >
        Currently in Beta
      </span>
      <h1
        style={{
          fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
          fontWeight: 700,
          lineHeight: 1.1,
          margin: "0 0 1rem",
          background:
            "linear-gradient(315deg, var(--rp-c-brand) 30%, var(--rp-c-brand-light, var(--rp-c-brand)))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        tsdevstack
      </h1>
      <p
        style={{
          fontSize: "clamp(1.5rem, 4vw, 3rem)",
          fontWeight: 700,
          lineHeight: 1.2,
          margin: "0 0 0.75rem",
          color: "var(--rp-c-text-1)",
        }}
      >
        Infrastructure as Framework
      </p>
      <p
        style={{
          fontSize: "clamp(1rem, 2vw, 1.35rem)",
          fontWeight: 500,
          color: "var(--rp-c-text-2)",
          margin: "0 0 0.5rem",
          lineHeight: 1.5,
        }}
      >
        Full-stack, cloud-native, AI-native TypeScript microservices.
      </p>
      <p
        style={{
          fontSize: "clamp(1rem, 2vw, 1.35rem)",
          fontWeight: 500,
          color: "var(--rp-c-text-2)",
          margin: "0 0 0.75rem",
          lineHeight: 1.5,
        }}
      >
        From zero to production in an hour, not months.
      </p>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.6rem 1.25rem",
          borderRadius: "8px",
          background: "var(--rp-c-bg-soft)",
          border: "1px solid var(--rp-c-divider)",
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          fontSize: "0.95rem",
          color: "var(--rp-c-text-1)",
          marginBottom: "2rem",
          userSelect: "all",
        }}
      >
        <span style={{ color: "var(--rp-c-text-2)" }}>$</span>
        <span>npx @tsdevstack/cli init</span>
      </div>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <a
          href="/getting-started/quick-start"
          style={{
            display: "inline-block",
            padding: "0.75rem 2rem",
            borderRadius: "24px",
            fontSize: "1rem",
            fontWeight: 600,
            color: "#fff",
            background: "var(--rp-c-brand)",
            textDecoration: "none",
            transition: "opacity 0.2s",
          }}
        >
          Get Started
        </a>
        <a
          href="/introduction/what-is-tsdevstack"
          style={{
            display: "inline-block",
            padding: "0.75rem 2rem",
            borderRadius: "24px",
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--rp-c-text-1)",
            background: "var(--rp-c-bg-soft)",
            border: "1px solid var(--rp-c-divider)",
            textDecoration: "none",
            transition: "opacity 0.2s",
          }}
        >
          Why tsdevstack?
        </a>
      </div>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginTop: "1.5rem",
        }}
      >
        <a
          href="https://discord.gg/2EMFkqc8QR"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 1.5rem",
            borderRadius: "24px",
            fontSize: "0.9rem",
            fontWeight: 500,
            color: "var(--rp-c-text-2)",
            background: "var(--rp-c-bg-soft)",
            border: "1px solid var(--rp-c-divider)",
            textDecoration: "none",
            transition: "opacity 0.2s",
          }}
        >
          Discord
        </a>
        <a
          href="mailto:hello@tsdevstack.dev"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.5rem 1.5rem",
            borderRadius: "24px",
            fontSize: "0.9rem",
            fontWeight: 500,
            color: "var(--rp-c-text-2)",
            background: "var(--rp-c-bg-soft)",
            border: "1px solid var(--rp-c-divider)",
            textDecoration: "none",
            transition: "opacity 0.2s",
          }}
        >
          Contact
        </a>
      </div>
      <div
        style={{
          width: "100%",
          marginTop: "2.5rem",
          textAlign: "left",
        }}
      >
        <Prompt
          title="Scaffold a tsdevstack project in one shot"
          description="Paste this into Claude Code, Cursor, or your AI agent of choice. It scaffolds a fullstack-auth project locally and brings up Kong, Postgres, and Redis."
          prompt={`Scaffold a new tsdevstack fullstack-auth project end-to-end, fully non-interactively:

1. Ask me for a project name in lowercase kebab-case (e.g. \`my-app\`). I'll refer to it below as <PROJECT_NAME>.
2. Make sure Docker Desktop is running (the init step starts local infrastructure).
3. Run \`npx --yes @tsdevstack/cli init --name <PROJECT_NAME> --template fullstack-auth --frontend-name frontend\`. The \`--yes\` skips npx's "Ok to proceed?" prompt; the three flags skip the interactive name/template/frontend prompts. This scaffolds the project (NestJS auth-service + Next.js frontend + Kong + Postgres + Redis), installs dependencies, builds shared libs, generates Kong/docker-compose configs, brings up local infra, and creates the initial database migration.
4. \`cd <PROJECT_NAME>\` and run \`npm run dev\` to start all services with hot reload.
5. Verify the Kong gateway responds at http://localhost:8000 and the auth-service Swagger UI renders at http://localhost:3001/api.
6. Wire up the built-in tsdevstack MCP server so I can use you for everything that follows (adding services, deploying, secrets management, etc.). Create or update \`.mcp.json\` in the project root with:

\`\`\`json
{
  "mcpServers": {
    "tsdevstack": {
      "command": "npx",
      "args": ["tsdevstack", "mcp:serve"]
    }
  }
}
\`\`\`

Then tell me to restart my AI client so it picks up the new MCP server.`}
        />
      </div>
    </div>
  );
}
