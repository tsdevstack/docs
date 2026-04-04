# WAF Customization

tsdevstack ships with WAF (Web Application Firewall) protection enabled by default on all three providers. This page explains what's included, how to diagnose issues, and how to add your own rules.

## What's included by default

The framework generates WAF rules covering these attack categories:

| Category | GCP | AWS | Azure |
|----------|-----|-----|-------|
| SQL injection | `sqli-v33-stable` managed ruleset | `AWSManagedRulesSQLiRuleSet` | Custom rules (500-511) |
| XSS | `xss-v33-stable` managed ruleset | `AWSManagedRulesCommonRuleSet` | Custom rules (600-610) |
| Remote code execution | `rce-v33-stable` managed ruleset | `AWSManagedRulesCommonRuleSet` | Custom rules (850-855) |
| Local/remote file inclusion | `lfi-v33-stable` + `rfi-v33-stable` | `AWSManagedRulesCommonRuleSet` + `LinuxRuleSet` | Custom rules (700-711) |
| Protocol attacks | `protocolattack-v33-stable` | `AWSManagedRulesCommonRuleSet` | Custom rules (900-906) |
| Session fixation | `sessionfixation-v33-stable` | `AWSManagedRulesCommonRuleSet` | Custom rules (950-951) |
| Scanner detection | `scannerdetection-v33-stable` | IP Reputation + Anonymous IP lists | Custom rules (300-304) |
| Node.js specific | `nodejs-v33-stable` | Custom `__proto__` + `child_process` rules | Custom rules (800-802) |
| SSRF | Custom metadata endpoint rule | Custom metadata endpoint rule | Custom rule (710) |
| Known CVEs | — | `AWSManagedRulesKnownBadInputsRuleSet` | Custom rules (400-404) |
| Rate limiting | 1000 req/60s per IP | 5000 req/5min per IP (same effective rate) | 1000 req/min per IP |
| Path blocking | — | — | WordPress/CMS paths (rule 201) |
| Request size limits | — | — | Custom rules (150-153) |

**GCP and AWS** use provider-managed rulesets where available — these are auto-updated by the cloud provider's security team. **Azure Standard** uses ~75 custom rules written by tsdevstack (Azure Standard doesn't offer managed rulesets). **Azure Premium** uses Microsoft's DRS 2.1 managed rulesets for the major categories, with ~31 custom rules covering the gaps.

All providers achieve equivalent coverage — the mechanism differs but the protection is the same.

## Rate limit configuration

The default rate limit is 1000 requests per 60 seconds per IP. Override it in `infrastructure.json`:

```json
{
  "prod": {
    "security": {
      "waf": {
        "rateLimit": {
          "count": 500,
          "intervalSec": 60
        }
      }
    }
  }
}
```

The framework translates this to each provider's native format:

| Provider | Native format | Translation for 1000/60s |
|----------|--------------|--------------------------|
| GCP | Cloud Armor throttle action | Direct: `count=1000`, `interval_sec=60` |
| AWS | `rate_based_statement` (5-min minimum window) | Scaled: `limit=5000` per 300s |
| Azure | `RateLimitRule` (per-minute minimum) | Scaled: `threshold=1000`, `duration=1` min |

## Adding custom rules

Each provider has its own custom rule format. The JSON schema is provider-aware — your IDE autocomplete will show only the format relevant to your cloud provider.

### GCP (Cloud Armor — CEL expressions)

```json
{
  "security": {
    "waf": {
      "customRules": [
        {
          "name": "block-bad-ips",
          "priority": 800,
          "action": "deny(403)",
          "expression": "inIpRange(origin.ip, '192.0.2.0/24')",
          "description": "Block known bad IP range"
        }
      ]
    }
  }
}
```

GCP rules use [CEL (Common Expression Language)](https://cloud.google.com/armor/docs/rules-language-reference). Available actions: `"allow"`, `"deny(403)"`, `"deny(404)"`, `"deny(429)"`, `"throttle"`.

Use priority 800-899 for custom rules to avoid conflicts with framework rules (1-799).

### AWS (WAF v2 — byte match, rate, geo)

```json
{
  "security": {
    "waf": {
      "awsCustomRules": [
        {
          "name": "block-country",
          "priority": 100,
          "action": "block",
          "matchType": "geo_match",
          "geoMatch": { "countryCodes": ["CN", "RU"] },
          "description": "Block traffic from specific countries"
        },
        {
          "name": "block-internal-path",
          "priority": 200,
          "action": "block",
          "matchType": "byte_match",
          "byteMatch": {
            "searchString": "/internal",
            "fieldToMatch": "uri_path",
            "positionalConstraint": "STARTS_WITH"
          }
        }
      ]
    }
  }
}
```

AWS rules support three match types: `byte_match` (string matching), `rate_based` (rate limiting), and `geo_match` (country blocking). Available actions: `"block"`, `"allow"`, `"count"`.

Use priority 100-899 for custom rules (managed rules use 1-99).

### Azure (Front Door — match conditions)

```json
{
  "security": {
    "waf": {
      "azureCustomRules": [
        {
          "name": "BlockBadBot",
          "type": "MatchRule",
          "priority": 1000,
          "action": "Block",
          "matchConditions": [
            {
              "matchVariable": "RequestHeader",
              "operator": "Contains",
              "matchValues": ["bad-bot", "scraper"],
              "selector": "User-Agent",
              "transforms": ["Lowercase"]
            }
          ]
        },
        {
          "name": "RateLimitExpensiveEndpoint",
          "type": "RateLimitRule",
          "priority": 1001,
          "action": "Block",
          "rateLimitDurationInMinutes": 5,
          "rateLimitThreshold": 50,
          "matchConditions": [
            {
              "matchVariable": "RequestUri",
              "operator": "Contains",
              "matchValues": ["/api/expensive"]
            }
          ]
        }
      ]
    }
  }
}
```

Azure rules support two types: `MatchRule` (block/allow based on conditions) and `RateLimitRule` (rate limiting with conditions). Available actions: `"Block"`, `"Allow"`, `"Log"`.

Match variables: `RequestUri`, `RequestMethod`, `RequestHeader`, `RequestBody`, `SocketAddr`, `QueryString`. Operators: `Contains`, `Equal`, `IPMatch`, `GreaterThan`. Optional transforms: `Lowercase`, `UrlDecode`.

Use priority 1000+ for custom rules to avoid conflicts with framework rules (100-999).

## Diagnosing false positives

If the WAF blocks a legitimate request (you get a 403 that shouldn't happen):

### 1. Check the logs

| Provider | Where to look |
|----------|--------------|
| GCP | Cloud Logging → filter by `resource.type="http_load_balancer"` and `jsonPayload.enforcedSecurityPolicy` |
| AWS | CloudWatch Log Group → look for `aws-waf-logs-*` with `action: "BLOCK"` |
| Azure | Log Analytics → `AzureDiagnostics` table, category `FrontDoorWebApplicationFirewallLog` |

### 2. Identify the rule

The logs will show which rule triggered. Look for:
- **GCP:** `enforcedSecurityPolicy.name` and `enforcedSecurityPolicy.configuredAction`
- **AWS:** `terminatingRuleId` in the WAF log entry
- **Azure:** `ruleName` and `action` in the WAF diagnostic log

### 3. Add an exclusion or override

Once you identify the rule, add a custom rule with higher priority that allows the specific traffic pattern. For example, if a GCP managed ruleset blocks a specific path:

```json
{
  "security": {
    "waf": {
      "customRules": [
        {
          "name": "allow-webhook-path",
          "priority": 50,
          "action": "allow",
          "expression": "request.path.matches('/api/webhooks/stripe')",
          "description": "Allow Stripe webhooks (blocked by XSS rule)"
        }
      ]
    }
  }
}
```

## Known exclusions

The framework ships with these exclusions to prevent known false positives:

| Provider | Exclusion | Reason |
|----------|-----------|--------|
| GCP | Protocol attack rules 921120, 921150 | Multipart/form-data boundaries contain `\r\n` by spec, triggering CR/LF injection detection |

## Applying changes

After modifying WAF configuration in `infrastructure.json`:

```bash
npx tsdevstack infra:generate --env <environment>
npx tsdevstack infra:deploy --env <environment>
```

WAF rule changes take effect immediately after deployment. There is no propagation delay on any provider.

## Further reading

- [Service Configuration — WAF Rules](/infrastructure/service-configuration#waf-rules) for the full configuration reference
- [GCP Architecture](/infrastructure/providers/gcp/architecture), [AWS Architecture](/infrastructure/providers/aws/architecture), [Azure Architecture](/infrastructure/providers/azure/architecture) for provider-specific WAF details
- [Compliance Readiness](/security/compliance-readiness) for how WAF maps to compliance frameworks
