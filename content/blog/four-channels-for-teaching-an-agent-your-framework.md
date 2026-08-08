---
title: 'Four channels for teaching an agent your framework'
description: 'A coding agent opens a project built on your framework knowing nothing about your conventions. MCP tools, AGENTS.md, docs, and skills are four channels for fixing that, each good at a different job.'
date: '2026-08-03'
sidebar: false
outline: false
head:
  - - link
    - rel: canonical
      href: 'https://tsdevstack.dev/blog/four-channels-for-teaching-an-agent-your-framework'
  - - meta
    - property: 'og:title'
      content: 'Four channels for teaching an agent your framework'
  - - meta
    - property: 'og:description'
      content: 'MCP tools, AGENTS.md, docs, and skills are four channels for teaching an agent your framework. Here is what each is good at, and the trap of using the wrong one.'
  - - meta
    - property: 'og:image'
      content: 'https://tsdevstack.dev/blog/agent-knowledge-channels.webp'
  - - meta
    - property: 'og:type'
      content: 'article'
  - - meta
    - property: 'article:published_time'
      content: '2026-08-03'
  - - meta
    - name: 'twitter:card'
      content: 'summary_large_image'
  - - meta
    - name: 'twitter:image'
      content: 'https://tsdevstack.dev/blog/agent-knowledge-channels.webp'
  - - script
    - type: 'application/ld+json'
    - '{"@context":"https://schema.org","@type":"Article","headline":"Four channels for teaching an agent your framework","author":{"@type":"Person","name":"gyorgy"},"datePublished":"2026-08-03","dateModified":"2026-08-03","image":"https://tsdevstack.dev/blog/agent-knowledge-channels.webp","mainEntityOfPage":"https://tsdevstack.dev/blog/four-channels-for-teaching-an-agent-your-framework"}'
---

![Four channels for teaching an agent your framework](/blog/agent-knowledge-channels.webp)

# Four channels for teaching an agent your framework

A coding agent opens a project built on your framework and knows almost nothing about it. It knows generic NestJS and generic Next.js from training, and half of what it remembers is a version or two out of date. It does not know that your gateway config is generated, that secrets come from an injected service and not `process.env`, or that adding a service is a command and not a copy-paste. So it guesses. In a framework full of generated files and conventions, a guess is not a small mistake. It edits a file that gets overwritten on the next sync, or hand-rolls something the shared library already provides, and the damage looks like the framework being broken.

The fix is not "write more docs." It is putting each kind of knowledge in the channel that actually delivers it at the right moment. There are four, and they do different jobs.

## The four channels

**MCP tools are the verbs.** An MCP server exposes your operations as tools: add a service, push a secret, deploy. The agent calls them instead of reinventing shell commands. This is the channel for doing things, and it travels across agents because the protocol does. Tools are not the place for how-to or judgment. They are the actions.

**AGENTS.md is the always-on context.** It loads on every turn, so it is the right home for two things and only two things: a short router that says where to look, and the handful of guardrails that must hold every single time. "Never edit generated files." "Read secrets through the service." Because you pay for AGENTS.md on every turn, the discipline is to keep it lean. A catalog of every tool and every workflow does not belong here. A pointer to them does.

**The docs are the reference.** They are deep, single sourced, and any agent with a fetch can read them. Their weakness is that they are passive. The agent only reads a doc if it decides to, and most of the time it does not think to. Docs are where depth lives, not where the agent gets nudged.

**Skills are triggered procedural knowledge.** A skill is a small file with a description that says when it applies and a body that says what to do. The agent loads the body only when the situation matches. That trigger is the whole point. It is the thing docs and MCP resources lack. It fires the right how-to at the exact moment the work starts, and it does it across agents through an open, installable format.

## The trap is the wrong channel

Once you see the four, the mistakes are obvious.

Put a guardrail in a triggered skill and it fails, because a skill only loads when its trigger fires, and "do not edit generated files" has no trigger. The agent edits the file before any skill wakes up. Guardrails have to be always on, so they live in AGENTS.md.

Put a deep walkthrough in AGENTS.md and it taxes every turn for a thing that matters once a week. That walkthrough belongs in a skill, or in the docs the skill points at.

Push your workflow knowledge into an MCP resource and expect the agent to read it, and you will be disappointed. I did exactly this first. The knowledge was all there, sitting in a resource, and the agent almost never pulled it, because resources are passive the same way docs are. The missing ingredient was not content. It was a trigger. That is what moved the workflow guidance into skills.

## What building it taught me

A few things only showed up once I stopped designing and started shipping.

Author against the running code, not the docs. Writing the authentication skill, I found the docs named one guard three different ways and described the same header two different ways. The code had one answer. Docs drift, and a skill written from a drifted doc teaches the drift. The shipped package is the source of truth.

Test the install, do not just read the file. The moment I actually installed the set, the tool rejected one skill outright for a small formatting mistake in its description that I would never have caught by eye. A skill that does not parse is a skill nobody has. Reading it looked fine. Installing it told the truth.

Do not let skills become load bearing. They are the nicest channel, but they need an install step, and some people will skip it. So the free channels, the always-on file and the docs, have to carry anyone who never installs a thing. Skills are the topping. They are not the cake.

## The point

An agent does not arrive knowing your framework, and no single channel teaches it well. Tools for actions, skills to guide, docs for depth, and a lean always-on file to route and to guard. The work is not writing more. It is routing each kind of knowledge to the channel that delivers it when it counts.
