---
title: 'Agent knowledge is a trigger problem, not a writing problem'
description: 'I put everything the agent needed into an MCP resource and it never got read. The four channels for teaching an agent your framework are not four kinds of content. They are four trigger conditions, each with a different price.'
date: '2026-08-08'
sidebar: false
outline: false
head:
  - - link
    - rel: canonical
      href: 'https://tsdevstack.dev/blog/agent-knowledge-is-a-trigger-problem'
  - - meta
    - property: 'og:title'
      content: 'Agent knowledge is a trigger problem, not a writing problem'
  - - meta
    - property: 'og:description'
      content: 'MCP tools, AGENTS.md, docs, and skills are not four kinds of content. They are four trigger conditions with different price tags, and most agent docs are priced wrong.'
  - - meta
    - property: 'og:image'
      content: 'https://tsdevstack.dev/blog/agent-knowledge-channels.webp'
  - - meta
    - property: 'og:type'
      content: 'article'
  - - meta
    - property: 'article:published_time'
      content: '2026-08-08'
  - - meta
    - name: 'twitter:card'
      content: 'summary_large_image'
  - - meta
    - name: 'twitter:image'
      content: 'https://tsdevstack.dev/blog/agent-knowledge-channels.webp'
  - - script
    - type: 'application/ld+json'
    - '{"@context":"https://schema.org","@type":"Article","headline":"Agent knowledge is a trigger problem, not a writing problem","author":{"@type":"Person","name":"gyorgy"},"datePublished":"2026-08-08","dateModified":"2026-08-08","image":"https://tsdevstack.dev/blog/agent-knowledge-channels.webp","mainEntityOfPage":"https://tsdevstack.dev/blog/agent-knowledge-is-a-trigger-problem"}'
---

![Agent knowledge is a trigger problem, not a writing problem](/blog/agent-knowledge-channels.webp)

# Agent knowledge is a trigger problem, not a writing problem

I put everything an agent needs to work in my framework into an MCP resource. Conventions, workflows, which files are generated, where secrets come from. It was accurate, it was complete, and it was one call away.

The agent almost never read it.

Meanwhile I was doing that job by hand. Stopping it mid-task. Correcting the same thing for the fourth time. Re-reviewing work I had stopped trusting three steps earlier. The knowledge existed, it was cheap to fetch, and it never arrived. I spent a while assuming I was prompting wrong.

I was not. A resource is passive. Passive means the agent has to decide to look, and it does not decide to look, because nothing tells it there is anything worth looking at. I had solved content and shipped zero delivery.

That is the part I had backwards. The four places you can put knowledge for an agent are not four kinds of content. They are four trigger conditions, and each one bills differently.

## Four triggers, four prices

**AGENTS.md fires every turn.** Unconditional. It is also the only channel you pay for unconditionally, on every request, forever, whether or not this turn had anything to do with it.

**MCP tools fire when the agent wants to act.** The trigger is intent, which is reliable, because the agent already knows it needs to do something. You pay for the schemas sitting in context.

**Skills fire when a description matches the situation.** Cheap until they hit — the description is in context, the body is not. The match is the entire mechanism, and it is the one thing the other channels lack.

**Docs fire when the agent decides to go read them.** Which is rarely. Effectively free, and frequently worth exactly that.

Say it as a budget and the design falls out on its own. The always-on channel is the expensive one, so it holds the least: a router that says where to look, and the guardrails that must hold on every single turn. Never edit generated files. Read secrets through the service. That is it. Everything else has to earn its load by matching something.

## Misrouting

Every failure I hit was the same failure: right content, wrong trigger.

A guardrail in a skill never fires, because "do not edit generated files" has no trigger. There is no moment that matches it. The agent edits the file, and the skill that would have stopped it wakes up never.

A walkthrough in AGENTS.md bills every turn for something that matters twice a month. You are paying rent on context you use almost never.

Workflow knowledge in a resource, or in docs, is the failure I already described. Nothing points at it, so nothing reaches it.

## Two things I only learned by shipping it

Write against the running code. Building the auth skill, I found the docs naming one guard three different ways and describing the same header two. The code had one answer. A skill written from drifted docs teaches the drift, at the exact moment the agent is most likely to act on it.

Install it before you trust it. The first time I installed my own set, the tool rejected one skill over a formatting mistake in its description. It read fine. It did not parse. A skill that does not parse is not a weaker skill, it is no skill, and nothing tells you.

Also worth knowing before you lean on any of this: skills need an install step, and people skip install steps. The always-on file and the docs still have to carry anyone who never installs anything.

## The point

Agent knowledge is not documentation. Documentation assumes a reader who goes looking. An agent does not go looking, and it starts from zero every session, so every session pays the onboarding cost again.

Which means the question is never "have I written this down." It is "what fires this, and what does firing cost." Get that wrong and you can have every answer sitting in the repo while the agent guesses in front of you.

---

_This came out of adding a skill set to [tsdevstack](https://tsdevstack.dev), an opinionated full-stack TypeScript framework that generates your infrastructure from one config file. The MCP server, the AGENTS.md, and the skills ship with it._
