---
title: 'IaC, FdI, IaF: three ways a codebase becomes infrastructure'
description: 'Frameworks defining infrastructure is suddenly a live idea, and the terms are blurring. Here is a clean taxonomy of the three approaches and what each one trades away.'
date: '2026-06-17'
sidebar: false
outline: false
head:
  - - link
    - rel: canonical
      href: 'https://tsdevstack.dev/blog/iac-fdi-iaf-three-ways-a-codebase-becomes-infrastructure'
  - - meta
    - property: 'og:title'
      content: 'IaC, FdI, IaF: three ways a codebase becomes infrastructure'
  - - meta
    - property: 'og:description'
      content: 'Frameworks defining infrastructure is suddenly a live idea, and the terms are blurring. Here is a clean taxonomy of the three approaches and what each one trades away.'
  - - meta
    - property: 'og:image'
      content: 'https://tsdevstack.dev/blog/iac-fdi-iaf-cover.webp'
  - - meta
    - property: 'og:type'
      content: 'article'
  - - meta
    - property: 'article:published_time'
      content: '2026-06-17'
  - - meta
    - name: 'twitter:card'
      content: 'summary_large_image'
  - - meta
    - name: 'twitter:image'
      content: 'https://tsdevstack.dev/blog/iac-fdi-iaf-cover.webp'
  - - script
    - type: 'application/ld+json'
    - '{"@context":"https://schema.org","@type":"Article","headline":"IaC, FdI, IaF: three ways a codebase becomes infrastructure","author":{"@type":"Person","name":"gyorgy"},"datePublished":"2026-06-17","dateModified":"2026-06-17","image":"https://tsdevstack.dev/blog/iac-fdi-iaf-cover.webp","mainEntityOfPage":"https://tsdevstack.dev/blog/iac-fdi-iaf-three-ways-a-codebase-becomes-infrastructure"}'
---

![IaC, FdI, IaF: three ways a codebase becomes infrastructure](/blog/iac-fdi-iaf-cover.webp)

# IaC, FdI, IaF: three ways a codebase becomes infrastructure

_Published June 17, 2026 by [gyorgy](https://github.com/gyrgy)_

Infrastructure used to be something you wrote separately from your application. Lately that boundary has been dissolving, and the vocabulary has not kept up. Three distinct ideas are getting blurred together, partly because they all start from the same place: your code already implies what infrastructure it needs, so why state it twice.

They diverge sharply on what they do about that. Here is the short version, then the longer one.

## The short version

**Infrastructure as Code (IaC).** You describe the infrastructure explicitly, in its own files. The tool turns those files into real resources. Total control, total verbosity, and your infrastructure definition lives apart from your application code.

**Framework-defined Infrastructure (FdI).** The framework infers the infrastructure from your application code, and a managed platform provisions it for you. Almost no configuration, no drift between app and infra, but the inference only covers what the framework exposes, and the resulting infrastructure runs on the platform's rails.

**Infrastructure as Framework (IaF).** The framework reads your applications and generates infrastructure code that you own, deployed into your own cloud accounts. The framework does the inferring, you keep the output and the account.

| | Who writes the infra | Who owns the output | Where it runs | Scope |
|---|---|---|---|---|
| IaC | You, by hand | You | Any cloud | Anything you can express |
| FdI | The framework | The platform | The platform | What the framework exposes |
| IaF | The framework | You | Your cloud accounts | What the framework covers |

The rest of this is just those three rows, explained.

## Infrastructure as Code

IaC is the established answer. You write declarations, in HCL or a general-purpose language, that spell out the resources you want: this VPC, this load balancer, this database, these IAM bindings. A tool like Terraform or Pulumi reads the declarations and reconciles your cloud to match.

The strength is that nothing is hidden. Every resource is something you chose and can see. If you need an unusual topology, you can express it, because you are working directly with the primitives.

The cost is the verbosity and the drift. A production system is hundreds to thousands of lines of declarations, and most of it is boilerplate that looks the same across projects. And the infrastructure definition is a separate artifact from the application it serves. The app says it needs a queue; somewhere else, by hand, you wrote the queue. Those two facts can drift apart, and keeping them in sync is manual work that nothing enforces.

IaC is not going anywhere. It is the layer the other two approaches generate down to. The question the newer ideas ask is not whether the declarations get written, but whether you have to be the one writing them by hand.

## Framework-defined Infrastructure

FdI says no. The insight, which Vercel articulated and named, is that a framework already encodes most of what the infrastructure needs to know. Vercel's own description is that it leverages the predictable structure of framework-based applications to map framework concepts onto infrastructure without explicit configuration.

The canonical examples are frontend primitives. In Next.js, a file in the routing directory implies a route, so the route table can be generated rather than declared. A page using server-side rendering implies a compute resource to render it, so a serverless function is provisioned. Middleware implies edge compute. You change the code, and the inferred infrastructure changes with it, at the same commit. There is no separate infra artifact to drift, because there is no separate infra artifact at all.

This is genuinely elegant for what it targets. It grew out of the frontend cloud, and that is where it is strongest: deploying framework-based frontends with zero configuration and no drift.

The trade follows from the design rather than being a flaw in it. First, the inference can only reach what the framework exposes, so the model is strongest on frontend and request-response work and thinner on backend systems that want always-on processes, long-lived connections, or full control over the runtime. The platform keeps narrowing that gap, with longer-running and more server-like compute, so the boundary is moving rather than fixed. But the inference is rooted in framework structure, and that structure is richest at the frontend. Second, the provisioning runs on the platform's own infrastructure and accounts. That is what makes the zero-configuration experience possible, and also what bounds it.

## Infrastructure as Framework

IaF starts from the same observation as FdI, reached independently from a different direction: if the framework understands the project, its services and how they fit together, the framework can produce the infrastructure. But it answers two questions differently, and those answers are the whole distinction.

The first is ownership of the output. An IaF framework reads your application and generates infrastructure code as a real artifact, the same IaC a person would have written by hand, except a person did not write it. You keep that output. It lives in your repository and deploys into your own cloud accounts. The framework is a generator, not a runtime. When it is done, what you have is yours, and you could in principle stop using the framework and keep the infrastructure.

The second is scope. Because the generated artifact is ordinary infrastructure code targeting ordinary cloud primitives, there is no inherent ceiling at the frontend. The same approach that generates a gateway and a CDN can generate a VPC, a managed database per service, background workers, a message queue, scheduled jobs, and the observability stack around them. The framework reads the whole project, backend included, and emits the infrastructure that architecture implies.

tsdevstack is one implementation of this idea. You build standard application-framework services through its CLI, and the framework keeps track of what your project contains. From that it generates the Terraform, the gateway configuration, the CI pipelines, and the rest, across GCP, AWS, and Azure, deployed into accounts you control. Your application code carries no cloud-provider-specific code, so a different provider is a target you choose, handled by the tooling but open to anyone who wants to change it by hand. The framework holds the knowledge of how to build the infrastructure. You hold the infrastructure.

This idea has relatives. There is a broader movement, often called infrastructure from code, where you express infrastructure needs from inside your application and a tool derives the infrastructure from them. Some of those tools are an SDK you add to an existing framework. Others ask you to adopt a framework of their own. Either way, the infrastructure primitives end up living in your application code. IaF parts ways on exactly that coupling. Your application stays in standard frameworks, with no infrastructure primitives mixed into your business logic. A separate config describes what you want, and the framework generates infrastructure code you own. The knowledge of how to build the infrastructure lives in the framework, not spread through your application code.

The cost here is honesty about a different boundary. The framework covers what it has been taught to cover. It is opinionated about architecture, and an application that wants a fundamentally different shape than the framework models will fit it poorly. IaF trades some of IaC's open-ended expressiveness for the automation, in exchange for keeping the ownership that FdI gives up.

## Reading the three together

The three approaches are three points on the same map, defined by two axes: who produces the infrastructure, and who owns and runs what comes out.

IaC keeps everything in your hands, which is also the problem, because everything is in your hands. FdI takes nearly all of it off your hands, which is also the boundary, because the output and its scope are defined by the platform. IaF tries to hold the middle: the framework produces the infrastructure, and you keep the output and the account.

None of these is strictly better than the others. They optimize for different things. IaC optimizes for control and expressiveness. FdI optimizes for the least possible configuration on a focused set of concerns. IaF optimizes for keeping ownership while letting the framework do the writing. The right one depends on which trade you actually want to make, and the only mistake is not noticing that you are making one.

---

tsdevstack is the IaF framework I build. You create standard application-framework services through its CLI, the framework stays aware of what is in your project, and from that it generates production infrastructure across GCP, AWS, and Azure, as Terraform and gateway configuration and CI pipelines that live in your repository and deploy to your accounts. The framework does the writing. You keep the output. It is open source.

A note on timing. This part of the field moves fast. Platform limits, pricing, and capabilities shift month to month, and some of what is described here will have moved by the time you read it. Everything above reflects the state of things as of June 2026, sourced to the providers' own documentation below where it matters.

## References

- [Framework-defined infrastructure - Vercel](https://vercel.com/blog/framework-defined-infrastructure)
- [The foundations of the Frontend Cloud - Vercel](https://vercel.com/blog/the-foundations-of-the-frontend-cloud)
- [Fluid compute - Vercel](https://vercel.com/blog/fluid-how-we-built-serverless-servers)
- [Terraform](https://www.terraform.io/)
- [Pulumi](https://www.pulumi.com/)
