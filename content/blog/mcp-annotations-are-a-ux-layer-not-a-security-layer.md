---
title: 'MCP annotations are a UX layer, not a security layer'
description: 'Tool annotations like readOnlyHint are server-declared hints, not enforcement. Treating them as permissions is a category error the spec warns against.'
date: '2026-05-05'
sidebar: false
outline: false
head:
  - - link
    - rel: canonical
      href: 'https://tsdevstack.dev/blog/mcp-annotations-are-a-ux-layer-not-a-security-layer'
  - - meta
    - property: 'og:title'
      content: 'MCP annotations are a UX layer, not a security layer'
  - - meta
    - property: 'og:description'
      content: 'Tool annotations like readOnlyHint are server-declared hints, not enforcement. Treating them as permissions is a category error the spec warns against.'
  - - meta
    - property: 'og:image'
      content: 'https://tsdevstack.dev/blog/mcp-annotations.webp'
  - - meta
    - property: 'og:type'
      content: 'article'
  - - meta
    - property: 'article:published_time'
      content: '2026-05-05'
  - - meta
    - name: 'twitter:card'
      content: 'summary_large_image'
  - - meta
    - name: 'twitter:image'
      content: 'https://tsdevstack.dev/blog/mcp-annotations.webp'
  - - script
    - type: 'application/ld+json'
    - '{"@context":"https://schema.org","@type":"Article","headline":"MCP annotations are a UX layer, not a security layer","author":{"@type":"Person","name":"gyorgy"},"datePublished":"2026-05-05","dateModified":"2026-05-05","image":"https://tsdevstack.dev/blog/mcp-annotations.webp","mainEntityOfPage":"https://tsdevstack.dev/blog/mcp-annotations-are-a-ux-layer-not-a-security-layer"}'
---

![MCP annotations are a UX layer, not a security layer](/blog/mcp-annotations.webp)

# MCP annotations are a UX layer, not a security layer

_Published May 5, 2026 by [gyorgy](https://github.com/gyrgy)_

When the Model Context Protocol added tool annotations like `readOnlyHint`, `destructiveHint`, and `idempotentHint`, a lot of MCP server authors and host implementers read them as a permission system. The mental model goes something like: a tool declares itself destructive, the host sees that, and the host either prompts the user or refuses outright. Annotations as enforcement, the way file permissions work in a Unix filesystem.

That's not what they are. A tool annotation is a string the server author typed into a tool definition. The model sees it, the host sees it, and they can use it for confirmation prompts or sorting or color coding. Nothing in the protocol verifies the annotation is true. A server can declare `readOnlyHint: true` on a tool that drops your production database, and the protocol won't notice. The host can choose to trust the annotation or not, but the trust is a policy decision the host makes about the server, not something the protocol provides.

This distinction matters because the annotation system is being asked to carry weight it wasn't designed to carry. Two active spec proposals ([SEP-1862](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1862) and [SEP-1913](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1913)) extend the annotation surface in useful ways. Neither of them changes what annotations fundamentally are. They make a UX layer better. They do not turn it into a security layer.

## What annotations actually are

Annotations are server-declared hints. The server author writes them into the tool definition, the server sends them to the client in `tools/list`, and that's the entire chain of custody. There is no signature, no third-party verification, no model-side analysis of what the tool actually does. The annotation is exactly as trustworthy as the server that produced it.

The MCP specification is explicit about this. From the [schema documentation](https://modelcontextprotocol.io/specification/2025-06-18/schema): "All properties in ToolAnnotations are hints. They are not guaranteed to provide a faithful description of tool behavior... Clients should never make tool use decisions based on ToolAnnotations received from untrusted servers." That language is in the spec because the working group knows annotations are forgeable.

Justin Spahr-Summers, one of the MCP co-creators, raised the obvious question during the original review of the annotation system: if a client knows the annotations can't be trusted, what's the point of having them? It's the right question and the spec hasn't really answered it. The working answer in practice is that annotations are useful for two things. First, hosts can build better UX on top of them when the server is trusted (skip the confirmation prompt for a tool that declares itself read-only, render destructive tools in a different color, sort tools so safer ones are surfaced first). Second, hosts can use annotations as one signal among many when scoring how much to scrutinize a tool call.

Neither of those is enforcement. Both assume the host has already decided the server is honest. The annotation tells the host how to render the tool's intent, not whether to allow it.

## The two SEPs in flight

Two annotation-related proposals are currently working through the MCP spec process, both authored or co-authored by Sam Morrow at GitHub.

[SEP-1862](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1862) (Tool Resolution) addresses a real problem with static annotations: a single tool that takes an `action` argument and behaves differently based on its value has to declare itself destructive at all times, because the static annotation has to cover the worst case. A `manage_files` tool that supports both `read` and `delete` operations is forced to look as dangerous as its most dangerous mode, even on read calls. The fix is a new `tools/resolve` method, inspired by LSP's `codeAction/resolve` pattern. Before invoking the tool, the client asks the server: given these specific arguments, what are the real annotations? The server returns refined metadata for that call. Multi-action tools become viable again without sacrificing UX accuracy.

[SEP-1913](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1913) (Trust and Sensitivity Annotations), co-authored with OpenAI, works on a different axis. Where existing annotations describe what a tool does, SEP-1913 adds annotations that describe what the data flowing through a tool means. New fields like `sensitiveHint` (low/medium/high), `privateHint`, `maliciousActivityHint`, and `attribution` let servers mark returned data with trust and sensitivity metadata, and let that metadata propagate through an agent session so a host can enforce policies like "do not send data marked private to tools marked open-world."

Both proposals fill genuine gaps. SEP-1862 unblocks a tool design pattern that was effectively forbidden by static annotations. SEP-1913 extends the annotation surface from what tools do to what data they handle, which is the right direction if you care about prompt injection and exfiltration.

What neither proposal changes is the trust model. SEP-1862's resolved annotations are still server-declared. SEP-1913's data annotations are still server-declared. A server that lies in `tools/list` can lie just as easily in `tools/resolve` or in a `sensitiveHint` field on returned content. The proposals make honest servers more expressive. They do not make dishonest servers detectable.

## What this means for MCP server design today

If annotations are a UX layer, design your server so the UX layer stays accurate without depending on protocol-level enforcement.

The first decision is tool granularity. A multi-action tool with an `action` argument forces a worst-case static annotation, which means honest hosts will over-prompt and well-tuned models will steer around the tool because it looks dangerous. Until SEP-1862 lands, separate tools per action keep static annotations honest. One tool reads, one tool lists, one tool removes. Each declares its real shape and the annotation is true at all times. This costs you a few more tool definitions and saves the host from making bad UX decisions on your behalf.

The second decision is how to use the existing annotation fields. The boolean grid (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) is independent flags rather than ordered tiers, but in practice tools cluster into three groups. Read-only tools (`readOnlyHint: true`). Mutating but recoverable tools (`readOnlyHint: false, destructiveHint: false`). Destructive tools (`readOnlyHint: false, destructiveHint: true`). Treating these as a tier internally simplifies host policy, even though the protocol doesn't enforce the structure. It also makes it obvious which tier a new tool belongs to when you add one, which matters at scale.

The third decision is what to do about the trust gap. The honest answer is that the protocol can't close it for you, so you close it elsewhere. Sandboxed execution, infrastructure-level egress controls, and third-party scanners ([Snyk's Agent Scan](https://github.com/snyk/agent-scan) is one example) sit outside the protocol and verify or constrain what tools actually do, regardless of what they claim. If your MCP server runs in a context where any of those layers exist, lean on them. The annotations on your tools should be honest, but the security boundary lives somewhere else.

What you should not do is treat annotation correctness as the security boundary. A server author who annotates carefully and a server author who lies look identical to the protocol. If your design assumes the host can tell them apart through annotations alone, you have a gap.

## The actual security layer lives outside MCP

Once you accept that annotations are a UX layer, the question of where security actually lives becomes easier to answer. It lives in three places, none of them in the protocol.

The first is host-level policy on which servers to trust. The host decides which MCP servers it accepts tools from, what scopes those servers operate under, and what the user has approved. That's where the real allow/deny decision happens. Annotations help the host build clearer prompts and better defaults, but the host is the one accepting or rejecting the tool call.

The second is infrastructure-level enforcement. Sandboxed execution, network egress rules, filesystem permissions, container boundaries. These don't care what a tool's annotations say. A tool that claims to be read-only but tries to write outside its sandbox is stopped by the sandbox, not by the annotation. For any MCP server doing real work in production, this layer is where deletion, exfiltration, and lateral movement actually get prevented.

The third is third-party verification. Scanners that examine MCP server code or behavior independently of what the server claims. [Snyk's Agent Scan](https://github.com/snyk/agent-scan) is one example of this category, and more will appear as the ecosystem matures. These tools occupy the space the protocol can't, because by definition they treat the server as untrusted and verify rather than trust.

None of this makes annotations useless. Annotations let honest servers communicate intent, let hosts build interfaces that match that intent, and give users the right amount of friction at the right moments. SEP-1862 will make that signal sharper for multi-action tools. SEP-1913 will extend it to the data flowing through tools. Both are worth shipping.
