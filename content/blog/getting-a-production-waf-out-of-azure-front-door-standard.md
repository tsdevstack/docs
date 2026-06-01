---
title: 'Getting a production WAF out of Azure Front Door Standard'
description: "Front Door Standard caps a WAF at 100 custom rules for $35 a month. What that covers, and when Premium's $330 tier earns the extra $295."
date: '2026-06-01'
sidebar: false
outline: false
head:
  - - link
    - rel: canonical
      href: 'https://tsdevstack.dev/blog/getting-a-production-waf-out-of-azure-front-door-standard'
  - - meta
    - property: 'og:title'
      content: 'Getting a production WAF out of Azure Front Door Standard'
  - - meta
    - property: 'og:description'
      content: "Front Door Standard caps a WAF at 100 custom rules for $35 a month. What that covers, and when Premium's $330 tier earns the extra $295."
  - - meta
    - property: 'og:image'
      content: 'https://tsdevstack.dev/blog/azure-front-door-waf.webp'
  - - meta
    - property: 'og:type'
      content: 'article'
  - - meta
    - property: 'article:published_time'
      content: '2026-06-01'
  - - meta
    - name: 'twitter:card'
      content: 'summary_large_image'
  - - meta
    - name: 'twitter:image'
      content: 'https://tsdevstack.dev/blog/azure-front-door-waf.webp'
  - - script
    - type: 'application/ld+json'
    - '{"@context":"https://schema.org","@type":"Article","headline":"Getting a production WAF out of Azure Front Door Standard","author":{"@type":"Person","name":"gyorgy"},"datePublished":"2026-06-01","dateModified":"2026-06-01","image":"https://tsdevstack.dev/blog/azure-front-door-waf.webp","mainEntityOfPage":"https://tsdevstack.dev/blog/getting-a-production-waf-out-of-azure-front-door-standard"}'
---

![Getting a production WAF out of Azure Front Door Standard](/blog/azure-front-door-waf.webp)

# Getting a production WAF out of Azure Front Door Standard

_Published June 1, 2026 by [gyorgy](https://github.com/gyrgy)_

Azure Front Door covers the whole edge in a single resource: CDN, managed SSL, a load balancer, and a WAF. On AWS and GCP that job is spread across two or three services. On Azure it is one. When I set it up for an Azure deployment, that consolidation was the part I liked.

The first surprise was the floor. Front Door Standard has a base fee of around $35 a month, before you serve a single request. The closest AWS setup, the new CloudFront Free plan, gives you a CDN, a WAF, and DDoS protection for $0 at small scale. So on Azure you start at $35 for roughly the thing AWS hands you for nothing. Not a fortune. But a fixed monthly floor where the competition has none.

The second surprise took longer to find.

## The WAF has a ceiling

On Standard, the Front Door WAF runs on custom rules you write yourself. There are no managed rule sets at this tier. That was fine by me. I would rather read the rules than trust a black box.

What I did not expect: Standard caps a WAF policy at 100 custom rules. That is a hard limit. Your entire protection has to fit inside 100 lines.

To cover the usual ground I ended up with about 80 rules, grouped into priority bands: rate limiting, restricted paths and methods, scanner fingerprints, known CVE patterns, SQL injection, XSS, path traversal, command injection, and protocol abuse. That left around 20 rules of headroom under the cap for anything app-specific.

Enough for now. But you can feel the ceiling. A larger app carrying a lot of its own rules would start bumping into it.

## What custom rules cost you

Custom rules are static. They match what you told them to match. They don't learn, and they don't update when a new attack pattern shows up next month. Someone has to maintain them. That someone is you.

A managed rule set works the other way. Microsoft tracks new attack patterns and updates the signatures, and you inherit the updates without touching anything. For an OWASP baseline you would rather not hand-maintain, that is worth real money.

On Front Door, managed rule sets are Premium only.

## What Premium buys, and what it costs

Premium replaces the OWASP bands (SQL injection, XSS, path traversal, command injection) with Microsoft's managed Default Rule Set 2.1, which updates as new signatures land. It adds bot management. And it adds Private Link origins, so your origin services lose their public endpoint entirely. The custom-rule cap goes from 100 to 500.

The price for all of that: the Front Door SKU goes from about $35 a month to about $330. A flat $295 difference, every month, no matter the traffic.

| Tier | Base fee | WAF | Bot management |
| --- | --- | --- | --- |
| AWS CloudFront Free plan | $0 | 5 custom rules | No, starts on the $200 Business plan |
| Azure Front Door Standard | ~$35/mo | ~80 custom rules, 100 cap | No |
| Azure Front Door Premium | ~$330/mo | Managed DRS 2.1 plus ~35 custom, 500 cap | Yes |

Usage, the data transfer and request charges, sits on top of the base fee for all three. The AWS Free plan covers small scale: 100 GB and one million requests a month, five WAF rules. Past that you move up its paid tiers. The point here is the starting line, not the ceiling.

## Which tier to pick

For an early or small service, Standard with a solid custom rule set is the right call. You get real WAF coverage, you can read every rule, and you pay $35 instead of $330. Maintaining 80 rules by hand is not free work, but it is a few hours now and then, not a second job.

You move to Premium when that maintenance stops being worth your time, or when you specifically need bot management or origins with no public endpoint. Managed rules you pay for beat static rules you forget to update. Decide which side of that line you are on before you commit, because $295 a month adds up fast. The move is also hard to walk back. Azure has no in-place downgrade from Premium to Standard, so reversing it rebuilds the Front Door profile from scratch: new hostnames, new certificates, and 15 to 20 minutes of downtime.

For someone landing on Azure for the first time, this is a lot to work out on day one. Two tiers, a rule cap, managed against custom, a $295 gap. None of it shows up in a getting-started guide. It is the kind of decision that should live in your tooling, not in your head.

## References

- Azure Front Door pricing: <https://azure.microsoft.com/pricing/details/frontdoor/>
- AWS CloudFront pricing: <https://aws.amazon.com/cloudfront/pricing/>
- Google Cloud Armor pricing: <https://cloud.google.com/armor/pricing>

---

Standard with this rule set is the default Azure tier in [tsdevstack](https://tsdevstack.dev). The framework generates the full custom WAF policy from one config file, and switches to Premium's managed rule sets when you set a single flag. You pick the tier. It writes the rules.

---

_Tags: azure, waf, security, cloud_
