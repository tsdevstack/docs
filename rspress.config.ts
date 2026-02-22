import path from "node:path";
import { defineConfig } from "rspress/config";

export default defineConfig({
  root: "content",
  globalStyles: path.join(__dirname, "global-styles.css"),
  title: "tsdevstack",
  description:
    "Full-stack, cloud-native TypeScript framework for production microservices",
  icon: "/favicon.svg",
  themeConfig: {
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/tsdevstack/docs",
      },
    ],
    footer: {
      message: "© 2026 tsdevstack. Built with Rspress.",
    },
    sidebar: {
      "/": [
        {
          text: "Introduction",
          items: [
            {
              text: "What is tsdevstack?",
              link: "/introduction/what-is-tsdevstack",
            },
            { text: "Supported Apps", link: "/introduction/supported-apps" },
            {
              text: "Architecture Overview",
              link: "/introduction/architecture-overview",
            },
          ],
        },
        {
          text: "Getting Started",
          items: [
            { text: "Quick Start", link: "/getting-started/quick-start" },
            { text: "Prerequisites", link: "/getting-started/prerequisites" },
            { text: "Installation", link: "/getting-started/installation" },
            { text: "Your First App", link: "/getting-started/your-first-app" },
            {
              text: "Project Structure",
              link: "/getting-started/project-structure",
            },
          ],
        },
        {
          text: "Local Development",
          items: [
            {
              text: "Running Locally",
              link: "/local-development/running-locally",
            },
            { text: "Adding Apps", link: "/local-development/adding-apps" },
            { text: "Tech Stack", link: "/local-development/tech-stack" },
            { text: "Debugging", link: "/local-development/debugging" },
          ],
        },
        {
          text: "Building APIs",
          items: [
            {
              text: "OpenAPI Decorators",
              link: "/building-apis/openapi-decorators",
            },
            { text: "Gateway Routing", link: "/building-apis/gateway-routing" },
            { text: "DTO Generation", link: "/building-apis/dto-generation" },
            { text: "Swagger Docs", link: "/building-apis/swagger-docs" },
          ],
        },
        {
          text: "Features",
          items: [
            { text: "Observability", link: "/features/observability" },
            { text: "MCP Server", link: "/features/mcp-server" },
          ],
        },
        {
          text: "Authentication",
          items: [
            { text: "Overview", link: "/authentication/overview" },
            { text: "JWT Tokens", link: "/authentication/jwt-tokens" },
            {
              text: "Protected Routes",
              link: "/authentication/protected-routes",
            },
            {
              text: "Session Management",
              link: "/authentication/session-management",
            },
          ],
        },
        {
          text: "Secrets",
          items: [
            { text: "How Secrets Work", link: "/secrets/how-secrets-work" },
            { text: "Local Secrets", link: "/secrets/local-secrets" },
            { text: "Cloud Secrets", link: "/secrets/cloud-secrets" },
            { text: "User vs Framework", link: "/secrets/user-vs-framework" },
          ],
        },
        {
          text: "Customization",
          items: [
            { text: "Framework Files", link: "/customization/framework-files" },
            { text: "Escape Hatches", link: "/customization/escape-hatches" },
            {
              text: "Docker Overrides",
              link: "/customization/docker-overrides",
            },
            {
              text: "Kong Customization",
              link: "/customization/kong-customization",
            },
          ],
        },
        {
          text: "Security",
          items: [
            {
              text: "Compliance Readiness",
              link: "/security/compliance-readiness",
            },
          ],
        },
        {
          text: "Infrastructure",
          items: [
            { text: "Architecture", link: "/infrastructure/architecture" },
            { text: "Environments", link: "/infrastructure/environments" },
            {
              text: "Service Configuration",
              link: "/infrastructure/service-configuration",
            },
            { text: "CI/CD Setup", link: "/infrastructure/cicd-setup" },
            { text: "Domain Setup", link: "/infrastructure/domain-setup" },
            {
              text: "GCP",
              items: [
                { text: "Overview", link: "/infrastructure/providers/gcp/" },
                {
                  text: "Account Setup",
                  link: "/infrastructure/providers/gcp/account-setup",
                },
                {
                  text: "Architecture",
                  link: "/infrastructure/providers/gcp/architecture",
                },
                {
                  text: "DNS & Domains",
                  link: "/infrastructure/providers/gcp/dns-and-domains",
                },
                { text: "CI/CD", link: "/infrastructure/providers/gcp/cicd" },
              ],
            },
            {
              text: "AWS",
              items: [
                { text: "Overview", link: "/infrastructure/providers/aws/" },
                {
                  text: "Account Setup",
                  link: "/infrastructure/providers/aws/account-setup",
                },
                {
                  text: "Architecture",
                  link: "/infrastructure/providers/aws/architecture",
                },
                {
                  text: "DNS & Domains",
                  link: "/infrastructure/providers/aws/dns-and-domains",
                },
                { text: "CI/CD", link: "/infrastructure/providers/aws/cicd" },
              ],
            },
            {
              text: "Azure",
              items: [
                { text: "Overview", link: "/infrastructure/providers/azure/" },
                {
                  text: "Account Setup",
                  link: "/infrastructure/providers/azure/account-setup",
                },
                {
                  text: "Architecture",
                  link: "/infrastructure/providers/azure/architecture",
                },
                {
                  text: "DNS & Domains",
                  link: "/infrastructure/providers/azure/dns-and-domains",
                },
                { text: "CI/CD", link: "/infrastructure/providers/azure/cicd" },
              ],
            },
          ],
        },
        {
          text: "Packages",
          items: [{ text: "nest-common", link: "/packages/nest-common" }],
        },
        {
          text: "Reference",
          items: [
            { text: "CLI Commands", link: "/reference/cli-commands" },
            { text: "Glossary", link: "/reference/glossary" },
          ],
        },
      ],
    },
  },
  markdown: {
    showLineNumbers: true,
  },
});
