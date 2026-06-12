---
title: "Agentic loops don't fix lying agents"
description: 'Loop engineering is the current answer to unreliable coding agents. But a loop is only as good as its verifier, and I have the receipts for what slips through.'
date: '2026-06-15'
sidebar: false
outline: false
head:
  - - link
    - rel: canonical
      href: 'https://tsdevstack.dev/blog/agentic-loops-dont-fix-lying-agents'
  - - meta
    - property: 'og:title'
      content: "Agentic loops don't fix lying agents"
  - - meta
    - property: 'og:description'
      content: 'Loop engineering is the current answer to unreliable coding agents. But a loop is only as good as its verifier, and I have the receipts for what slips through.'
  - - meta
    - property: 'og:image'
      content: 'https://tsdevstack.dev/blog/agentic-loops.webp'
  - - meta
    - property: 'og:type'
      content: 'article'
  - - meta
    - property: 'article:published_time'
      content: '2026-06-15'
  - - meta
    - name: 'twitter:card'
      content: 'summary_large_image'
  - - meta
    - name: 'twitter:image'
      content: 'https://tsdevstack.dev/blog/agentic-loops.webp'
  - - script
    - type: 'application/ld+json'
    - '{"@context":"https://schema.org","@type":"Article","headline":"Agentic loops don''t fix lying agents","author":{"@type":"Person","name":"gyorgy"},"datePublished":"2026-06-15","dateModified":"2026-06-15","image":"https://tsdevstack.dev/blog/agentic-loops.webp","mainEntityOfPage":"https://tsdevstack.dev/blog/agentic-loops-dont-fix-lying-agents"}'
---

![Agentic loops don't fix lying agents](/blog/agentic-loops.webp)

# Agentic loops don't fix lying agents

_Published June 15, 2026 by [gyorgy](https://github.com/gyrgy)_

The current discourse says you should stop prompting coding agents and start designing loops around them. Give the agent a trigger and a verifiable goal, let an evaluator check the result, and only stop when it passes. One major provider shipped a dedicated `/goal` command for it. People are running 25-hour unattended sessions and calling it loop engineering.

The instinct is correct. Never accept the agent's word that something is done. Demand proof.

But "verifiable" is doing all the work in that sentence. I build a framework that generates cloud infrastructure across GCP, AWS, and Azure, and I use coding agents on it daily. I keep an audit document of every serious failure. Reading it through the loop engineering lens is uncomfortable, because every bug in it would have survived a loop. Not because the loop iterated too few times. Because the verifier could not see the lie.

Here are three of them.

## The init job that never existed

During the AWS implementation, the agent generated the Terraform for the database layer. The GCP equivalent creates per-service databases and users through native Terraform resources. AWS has no such resources, so something else has to create them.

The agent solved this with a comment:

```hcl
# Individual databases and users are created at deploy time via init job
```

There was no init job. Not a stub, not a TODO, not a half-finished Lambda. The agent wrote documentation for a mechanism it never built, then moved on. The code compiled. `terraform validate` passed. The RDS instance deployed fine. Services failed to connect the first time I tested against a real cloud environment, because the databases they were configured to use did not exist. This was during development, long before any release.

A comment is the cheapest possible way to make code look complete. It costs one line and satisfies any reviewer who skims.

## The variable that nothing consumes

When I pointed out the missing databases, the agent fixed it. Its fix was to copy the GCP pattern: pass each service's database password to Terraform as `TF_VAR_db_{service}_password`.

```typescript
for (const [serviceName, password] of Object.entries(dbPasswords)) {
  const suffix = toTfVarSuffix(serviceName);
  tfEnv[`TF_VAR_db_${suffix}_password`] = password;
}
```

On GCP this variable exists because `google_sql_user` consumes it to create the user. On AWS, no resource consumed it. Terraform accepted the variable and ignored it. The connection string was then built with a password for a user that would never exist.

The agent copied syntax without understanding semantics. It never asked the one question that mattered: what Terraform resource uses this variable? Again, everything compiled. Everything validated. The fix made the codebase look more correct while leaving it exactly as broken.

## The bug that passed a real deploy

This one is the worst, because it survived the strongest verifier I have.

The Azure Front Door generator needed to create an endpoint, origin, and route for each Next.js service. The agent wrote this:

```typescript
const firstNextjsService = nextjsServiceNames[0];
```

One hardcoded index. It created routing for the first Next.js service and silently ignored the rest. And it deployed. Real Terraform apply, real Front Door, real traffic flowing to a real app. Green across the board.

It was green because the test project had one Next.js service. tsdevstack is a framework. Users can add as many as they want. The spec was "N services must work" and the verifier only ever asked about one. No loop catches that, no matter how many iterations you give it, unless the verification encodes the spec instead of the happy path.

## Every bug passed a verification layer

Line the three up against the checks they survived:

| Bug | Compiles | terraform validate | Real deploy |
|---|---|---|---|
| Phantom init job | passed | passed | failed |
| Unconsumed TF_VAR | passed | passed | failed |
| Hardcoded first service | passed | passed | passed |

A loop wired to the compiler would have terminated and reported success three times. A loop wired to `terraform validate` would have done the same. A loop wired to a live deploy still misses the third one.

The agent was not failing to iterate. The verifier was failing to see.

## Why infrastructure is the worst case

Loops genuinely work in domains with cheap, strong verifiers. A compiler error is instant and unambiguous. A type checker is free. A fast unit test suite gives a tight feedback signal, and an agent looping against it converges on working code. That is the environment where the loop engineering results come from, and the results are real.

Infrastructure inverts every one of those properties. The cheap checks are weak: validation confirms your HCL is well-formed, not that your architecture works. The strong check is a real deploy that takes 20 minutes and costs money. And the strongest check might not exist yet. The second Next.js service that exposes the hardcoded index is a user action that happens months after release.

There is one more failure mode worth naming. An agent under pressure to make a verifier pass will sometimes change the verifier instead of the code. Adjust the test expectation. Delete the failing assertion. I have watched this happen. When it does, the loop is not converging on correctness. It is training the agent to fake completion more efficiently.

## What I actually do

The answer is not more iterations. It is matching each verification layer to the lies it can catch, and being honest about what each layer cannot see.

For tsdevstack the split looks like this. Snapshot tests on every generated output catch unintended changes to Terraform, Kong configs, and CI workflows the moment they happen. That is the fast loop, and the agent runs inside it constantly.

Real cloud deploys are reserved for the apply, deploy, and verify chain. Slow and expensive, so they run when the cheap layers cannot answer the question. The phantom init job and the unconsumed variable both died here, before any release.

And the hardcoded index taught me the last rule: the spec has to live in the tests, not in my head. The fix for that bug was iteration over all Next.js services, and the regression test now deploys with more than one. The verifier had to learn the framework's actual contract before it could defend it.

The one verifier I never rely on is the agent's self-report. It is the weakest signal in the entire system, and a loop built on it is just the agent agreeing with itself faster.

## The part you can delegate

If you cannot define done in a way the agent cannot fake, the loop is just faster fabrication. That is the whole argument.

Loops are the right structure. But the engineering effort moves from prompting into verification, and verification is where the domain knowledge lives. For infrastructure, that means encoding contracts the agent will not infer on its own: every service, not the first one. A user that exists, not a variable that compiles.

Agents are good at producing work. They are not yet trustworthy at judging it. Knowledge is the part you can safely delegate. Outcomes are not.

---

This experience shaped how tsdevstack treats AI agents. The framework ships an MCP server, `@tsdevstack/cli-mcp`, built as a knowledge layer rather than an autopilot. It makes an agent a framework expert: every command, the config schema, the routing, the secret assignments. What it does not do is hand the agent ownership of outcomes. People stay in command, because the responsibility is theirs. I wrote about the boundary between hints and enforcement in [MCP annotations are a UX layer, not a security layer](https://tsdevstack.dev/blog/mcp-annotations-are-a-ux-layer-not-a-security-layer).

## References

- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/2025-03-26)
- [@tsdevstack/cli-mcp on npm](https://www.npmjs.com/package/@tsdevstack/cli-mcp)
- [MCP annotations are a UX layer, not a security layer](https://tsdevstack.dev/blog/mcp-annotations-are-a-ux-layer-not-a-security-layer)
