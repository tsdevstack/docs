import path from "node:path";
import { defineConfig } from "@rspress/core";

const SITE_URL = "https://tsdevstack.dev";
const OG_IMAGE = `${SITE_URL}/favicon-180.png`;

export default defineConfig({
  root: "content",
  globalStyles: path.join(__dirname, "global-styles.css"),
  title: "tsdevstack",
  description:
    "Full-stack, cloud-native TypeScript framework for production microservices",
  icon: "/favicon.svg",
  head: [
    ["meta", { property: "og:site_name", content: "tsdevstack" }],
    ["meta", { property: "og:image", content: OG_IMAGE }],
    ["meta", { property: "og:image:width", content: "180" }],
    ["meta", { property: "og:image:height", content: "180" }],
    ["meta", { property: "og:image:alt", content: "tsdevstack logo" }],
    ["meta", { name: "twitter:card", content: "summary" }],
    ["meta", { name: "twitter:image", content: OG_IMAGE }],
    ["meta", { name: "twitter:site", content: "@tsdevstack" }],
    (route) => [
      "meta",
      { property: "og:url", content: `${SITE_URL}${route.routePath}` },
    ],
  ],
  themeConfig: {
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/tsdevstack",
      },
      {
        icon: "x",
        mode: "link",
        content: "https://x.com/tsdevstack",
      },
      {
        icon: "discord",
        mode: "link",
        content: "https://discord.gg/2EMFkqc8QR",
      },
      {
        icon: "npm",
        mode: "link",
        content: "https://www.npmjs.com/org/tsdevstack",
      },
      {
        icon: {
          svg: `<svg width="100%" height="100%" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Medium"><title>Medium</title><path fill="currentColor" d="M4.21 0A4.201 4.201 0 0 0 0 4.21v15.58A4.201 4.201 0 0 0 4.21 24h15.58A4.201 4.201 0 0 0 24 19.79v-1.093c-.137.013-.278.02-.422.02-2.577 0-4.027-2.146-4.09-4.832a7.592 7.592 0 0 1 .022-.708c.093-1.186.475-2.241 1.105-3.022a3.885 3.885 0 0 1 1.395-1.1c.468-.237 1.127-.367 1.664-.367h.023c.101 0 .202.004.303.01V4.211A4.201 4.201 0 0 0 19.79 0Zm.198 5.583h4.165l3.588 8.435 3.59-8.435h3.864v.146l-.019.004c-.705.16-1.063.397-1.063 1.254h-.003l.003 10.274c.06.676.424.885 1.063 1.03l.02.004v.145h-4.923v-.145l.019-.005c.639-.144.994-.353 1.054-1.03V7.267l-4.745 11.15h-.261L6.15 7.569v9.445c0 .857.358 1.094 1.063 1.253l.02.004v.147H4.405v-.147l.019-.004c.705-.16 1.065-.397 1.065-1.253V6.987c0-.857-.358-1.094-1.064-1.254l-.018-.004zm19.25 3.668c-1.086.023-1.733 1.323-1.813 3.124H24V9.298a1.378 1.378 0 0 0-.342-.047Zm-1.862 3.632c-.1 1.756.86 3.239 2.204 3.634v-3.634z"/></svg>`,
        },
        mode: "link",
        content: "https://medium.com/@kram.gyorgy",
      },
      {
        icon: {
          svg: `<svg width="100%" height="100%" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="dev.to"><title>dev.to</title><path fill="currentColor" fill-rule="evenodd" d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H6l.02 2.44.04 2.45.56-.02c.41 0 .63-.07.83-.26.24-.24.26-.36.26-2.2 0-1.91-.02-1.96-.29-2.18zM0 4.94v14.12h24V4.94H0zM8.56 15.3c-.44.58-1.06.77-2.53.77H4.71V8.53h1.4c1.67 0 2.16.18 2.6.9.27.43.29.6.32 2.57.05 2.23-.02 2.73-.47 3.3zm5.09-5.47h-2.47v1.77h1.52v1.28l-.72.04-.75.03v1.77l1.22.03 1.2.04v1.28h-1.6c-1.53 0-1.6-.01-1.87-.3l-.3-.28v-3.16c0-3.02.01-3.18.25-3.48.23-.31.25-.31 1.88-.31h1.64v1.3zm4.68 5.45c-.17.43-.64.79-1 .79-.18 0-.45-.15-.67-.39-.32-.32-.45-.63-.82-2.08l-.9-3.39-.45-1.67h.76c.4 0 .75.02.75.05 0 .06 1.16 4.54 1.26 4.83.04.15.32-.7.73-2.3l.66-2.52.74-.04c.4-.02.73 0 .73.04 0 .14-1.67 6.38-1.8 6.68z"/></svg>`,
        },
        mode: "link",
        content: "https://dev.to/gyorgy",
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
            { text: "Object Storage", link: "/features/object-storage" },
            { text: "Async Messaging", link: "/features/async-messaging" },
            { text: "Scheduled Jobs", link: "/features/scheduled-jobs" },
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
            {
              text: "WAF Customization",
              link: "/customization/waf-customization",
            },
            {
              text: "Custom Email Provider",
              link: "/customization/email-provider",
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
          text: "Third-Party Integrations",
          items: [
            {
              text: "Resend (Email)",
              link: "/integrations/resend",
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
                  text: "Cost Estimation",
                  link: "/infrastructure/providers/gcp/cost-estimation",
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
                  text: "Cost Estimation",
                  link: "/infrastructure/providers/aws/cost-estimation",
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
                  text: "Cost Estimation",
                  link: "/infrastructure/providers/azure/cost-estimation",
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
          items: [
            { text: "tsdevstack (CLI)", link: "/packages/tsdevstack" },
            { text: "nest-common", link: "/packages/nest-common" },
            { text: "cli-mcp", link: "/packages/cli-mcp" },
            {
              text: "react-bot-detection",
              link: "/packages/react-bot-detection",
            },
          ],
        },
        {
          text: "Reference",
          items: [
            { text: "CLI Commands", link: "/reference/cli-commands" },
            { text: "Glossary", link: "/reference/glossary" },
          ],
        },
        {
          text: "Releases",
          items: [
            { text: "v0.3.0", link: "/releases/v0.3.0" },
            { text: "v0.2.8", link: "/releases/v0.2.8" },
            { text: "v0.2.7", link: "/releases/v0.2.7" },
            { text: "v0.2.6", link: "/releases/v0.2.6" },
            { text: "v0.2.5", link: "/releases/v0.2.5" },
            { text: "v0.2.4", link: "/releases/v0.2.4" },
            { text: "v0.2.3", link: "/releases/v0.2.3" },
            { text: "v0.2.2", link: "/releases/v0.2.2" },
            { text: "v0.2.1", link: "/releases/v0.2.1" },
            { text: "v0.2.0", link: "/releases/v0.2.0" },
            { text: "v0.1.29 – v0.1.30", link: "/releases/v0.1.29-0.1.30" },
            { text: "v0.1.28", link: "/releases/v0.1.28" },
            { text: "v0.1.24 – v0.1.27", link: "/releases/v0.1.24-0.1.27" },
            { text: "v0.1.19 – v0.1.23", link: "/releases/v0.1.19-0.1.23" },
            { text: "v0.1.17 – v0.1.18", link: "/releases/v0.1.17-0.1.18" },
            { text: "v0.1.6 – v0.1.16", link: "/releases/v0.1.6-0.1.16" },
            { text: "v0.1.5", link: "/releases/v0.1.5" },
            { text: "v0.1.1 – v0.1.4", link: "/releases/v0.1.1-0.1.4" },
          ],
        },
      ],
    },
  },
  markdown: {
    showLineNumbers: true,
  },
});
