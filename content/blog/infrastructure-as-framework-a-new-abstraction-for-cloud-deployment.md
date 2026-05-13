---
title: "Infrastructure as Framework: A New Abstraction for Cloud Deployment"
description: "A new abstraction between Infrastructure as Code and PaaS. One TypeScript config that deploys to GCP, AWS, or Azure without rewriting."
date: "2026-03-04"
sidebar: false
outline: false
head:
  - - link
    - rel: canonical
      href: "https://tsdevstack.dev/blog/infrastructure-as-framework-a-new-abstraction-for-cloud-deployment"
  - - meta
    - property: "og:title"
      content: "Infrastructure as Framework: A New Abstraction for Cloud Deployment"
  - - meta
    - property: "og:description"
      content: "A new abstraction between Infrastructure as Code and PaaS. One TypeScript config that deploys to GCP, AWS, or Azure without rewriting."
  - - meta
    - property: "og:image"
      content: "https://tsdevstack.dev/blog/storm.webp"
  - - meta
    - property: "og:type"
      content: "article"
  - - meta
    - property: "article:published_time"
      content: "2026-03-04"
  - - meta
    - name: "twitter:card"
      content: "summary_large_image"
  - - meta
    - name: "twitter:image"
      content: "https://tsdevstack.dev/blog/storm.webp"
  - - script
    - type: "application/ld+json"
    - '{"@context":"https://schema.org","@type":"Article","headline":"Infrastructure as Framework: A New Abstraction for Cloud Deployment","author":{"@type":"Person","name":"gyorgy"},"datePublished":"2026-03-04","dateModified":"2026-03-04","image":"https://tsdevstack.dev/blog/storm.webp","mainEntityOfPage":"https://tsdevstack.dev/blog/infrastructure-as-framework-a-new-abstraction-for-cloud-deployment"}'
---

![Infrastructure as Framework: A New Abstraction for Cloud Deployment](/blog/storm.webp)

# Infrastructure as Framework: A New Abstraction for Cloud Deployment

_Published March 4, 2026 by [gyorgy](https://github.com/gyrgy)_

There's a gap some of us are seeing.

You have your architecture diagram. Clean boxes, arrows between services, database here, cache there, API gateway in front. It looks great in Notion. Then you try to actually deploy it to AWS or GCP or Azure. And suddenly you're not only writing Terraform, learning provider-specific quirks, wiring up IAM roles, configuring VPCs, hitting ordering issues, struggling with documentation inconsistencies, debugging why your container can't reach the database, and none of that is in the diagram.

The architecture exists on paper. Getting it running on a real cloud provider is a completely different project.

Now multiply that by three.

Unless you're a certified platform engineer on that specific cloud. But then you're completely locked in. Your architecture doesn't live in your codebase anymore. It lives in thousands of lines of provider-specific config that nobody dares to touch.

**What if there was an abstraction layer that could take your entire TypeScript monorepo and translate it into any of those clouds, with a single command?**

That's the idea behind what I'm calling **Infrastructure as Framework, or IaF**.

Not Infrastructure as Code. IaC tools like Terraform, Pulumi, and CDK are still infrastructure-first. You're still thinking in resources, providers, and state files. Not Platform as a Service either. PaaS hides infrastructure entirely and charges you for the privilege of losing control.

Infrastructure as Framework sits in between. You write a TypeScript config that describes what your application is (services, workers, databases, routing) and the framework handles what that means on each cloud provider. The same config deploys to GCP Cloud Run, AWS ECS Fargate, or Azure Container Apps. Provider parity is a design constraint, not an afterthought.

This is the core idea behind [tsdevstack](https://tsdevstack.dev), an open-source TypeScript infrastructure framework I've been building for the last 6 months.

A few things that are real today:

- One config.json describes your entire application. Deploy it to GCP, AWS, or Azure without rewriting anything.
- Generates Terraform, CI/CD workflows, Kong API gateway config, and secrets management, all from your service definitions.
- NestJS + TypeScript monorepo as the application primitive.
- OpenTelemetry-first observability, BullMQ workers, PostgreSQL and Redis, all wired by the framework.
- Get started with `npx @tsdevstack/cli init`.

The framework is in early beta. Docs are at [tsdevstack.dev](https://tsdevstack.dev). The MCP server package (`@tsdevstack/cli-mcp`) is also published, so AI agents can understand and work with your infrastructure config directly.

- GitHub: [github.com/tsdevstack](https://github.com/tsdevstack)
- npm: [npmjs.com/package/@tsdevstack/cli](https://npmjs.com/package/@tsdevstack/cli)
- Docs: [tsdevstack.dev](https://tsdevstack.dev)
