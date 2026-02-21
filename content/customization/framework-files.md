# Framework Files vs User Files

The framework uses a layered file system that separates auto-generated configuration from your customizations. This pattern keeps your changes safe during upgrades while allowing the framework to evolve its defaults.

## The merge pattern

Many configuration areas follow a three-file pattern:

| File | Purpose | Edited by |
|------|---------|-----------|
| `*.tsdevstack.*` | Framework-generated defaults | Framework only |
| `*.user.*` | Your customizations | You |
| Final output | Merged result | Framework |

When you run a generate command, the framework merges the two input files to produce the final configuration.

### Example: Secrets

```
.secrets.tsdevstack.json  +  .secrets.user.json  =  .secrets.local.json
(framework-generated)        (your additions)        (merged output)
```

### Example: Kong

```
kong.tsdevstack.yml  +  kong.user.yml  =  kong.yml
(auto-generated routes)  (your plugins)    (final config)
```

## Why this pattern exists

The merge pattern solves a common framework dilemma: how do you provide sensible defaults while allowing customization?

**Without this pattern**, you would face difficult choices:

- **Copy and modify**: Fork the entire config, but lose framework updates
- **Manual patching**: Apply framework changes by hand after each upgrade
- **Configuration flags**: Limited to what the framework anticipated

**With this pattern**, you get the best of both worlds:

- Framework generates baseline configuration automatically
- Your customizations layer on top, preserved across regenerations
- Upgrades can improve framework defaults without touching your code
- Clear separation makes it obvious what you changed

## How merging works

The merge strategy depends on the data type:

### Objects (deep merge)

User values override framework values at each key:

```json
// .secrets.tsdevstack.json
{
  "secrets": {
    "REDIS_HOST": "localhost",
    "REDIS_PORT": "6379"
  }
}

// .secrets.user.json
{
  "secrets": {
    "REDIS_HOST": "redis.internal.example.com"
  }
}

// .secrets.local.json (merged)
{
  "secrets": {
    "REDIS_HOST": "redis.internal.example.com",  // user wins
    "REDIS_PORT": "6379"                         // framework preserved
  }
}
```

### Arrays (concatenation)

Arrays are typically appended, not replaced:

```yaml
# kong.tsdevstack.yml
plugins:
  - name: jwt

# kong.user.yml
plugins:
  - name: rate-limiting
    config:
      minute: 100

# kong.yml (merged)
plugins:
  - name: jwt
  - name: rate-limiting
    config:
      minute: 100
```

## When framework files regenerate

Framework files (`*.tsdevstack.*`) regenerate in these situations:

| Trigger | What regenerates |
|---------|------------------|
| `npx tsdevstack generate-secrets` | `.secrets.tsdevstack.json` (critical values preserved) |
| `npx tsdevstack generate-kong` | `kong.tsdevstack.yml` |
| `npx tsdevstack sync` | All framework files |
| Adding a new service | Affected framework files |
| Changing API decorators | `kong.tsdevstack.yml` |

Your user files are never modified by the framework.

**Note on secrets preservation:** When `.secrets.tsdevstack.json` regenerates, critical values are automatically preserved: JWT keys, service API keys, database credentials, and KONG_TRUST_TOKEN. The file is rewritten, but these values are read first and carried forward. Only delete `.secrets.tsdevstack.json` if you need completely fresh credentials.

## Safe customization practices

### Do: Edit user files

```bash
# Correct: edit the user file
kong.user.yml
.secrets.user.json
```

### Do not: Edit framework files

```bash
# Wrong: these will be overwritten
kong.tsdevstack.yml       # Lost on next generate
.secrets.tsdevstack.json  # Lost on next generate
```

### Do not: Edit merged output

```bash
# Wrong: these will be overwritten
kong.yml             # Lost on next generate
.secrets.local.json  # Lost on next generate
```

### What to commit

**Configuration files you CAN commit:**

- `kong.user.yml` - your Kong customizations (no secrets)
- `kong.tsdevstack.yml` - framework Kong routes (no secrets)
- `docker-compose.user.yml` - your Docker additions

**Files you should NOT commit:**

- `kong.yml` - merged output with resolved placeholder values
- `.secrets.*.json` - all secret files (contains credentials)
- `.env` - generated environment variables

Use `.secrets.user.example.json` (committed) to document what secrets your project needs:

```json
{
  "secrets": {
    "STRIPE_SECRET_KEY": "get from Stripe dashboard",
    "SENDGRID_API_KEY": "get from SendGrid"
  }
}
```

Developers copy this to `.secrets.user.json` and fill in actual values.

## When merging is not enough

Sometimes the framework's automatic generation does not fit your needs. For these cases, escape hatches provide full control:

| Area | Escape hatch |
|------|-------------|
| Kong | Create `kong.custom.yml` to bypass route generation |
| Docker | Use `docker-compose.user.yml` for local additions |

See [Escape Hatches](/customization/escape-hatches) for details on when and how to use these overrides.

## Troubleshooting

**My customizations disappeared**

You likely edited a framework file or the merged output. Check which file you modified:
- If it ends in `.tsdevstack.`, it is framework-managed
- If it has no suffix before the extension, it is probably the merged output
- Only `*.user.*` files preserve your changes

**Framework file has unexpected content**

The framework regenerates from your source code (OpenAPI specs, decorators, service definitions). Check whether your source changed.

**Merge conflict between framework and user values**

User values always win. If you see unexpected behavior, check whether your user file overrides something important. Remove the override to restore framework defaults.

