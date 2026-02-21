# Escape Hatches

The framework provides sensible defaults and a merge-based customization system for most needs. But sometimes you need full control. Escape hatches let you bypass framework automation entirely when the standard patterns do not fit.

## When to use escape hatches

Consider an escape hatch when:

- **Framework assumptions do not match your architecture** - You have a non-standard service topology, custom routing requirements, or an unusual deployment pattern
- **You need unsupported features** - The framework does not expose configuration for a specific Kong plugin, Docker feature, or authentication flow
- **Merge-based customization creates conflicts** - The way your customizations interact with framework defaults causes problems
- **You are migrating from another system** - Your existing configuration does not map cleanly to framework conventions

Do not use escape hatches for:

- **Simple additions** - Adding a rate limiter, extra consumer, or new secret works fine with user files
- **One-off overrides** - Changing a single default value belongs in your user file
- **Temporary experiments** - Test changes in user files first; promote to escape hatch only if needed

## Available escape hatches

### Kong: kong.custom.yml

The most common escape hatch. When this file exists, the framework stops generating routes from your OpenAPI specs.

**What happens:**
- Framework detects `kong.custom.yml`
- Skips all automatic route generation
- Only resolves `${PLACEHOLDER}` values from your secrets
- Copies result to output locations

**Create it:**

```yaml
# kong.custom.yml
_format_version: '3.0'
_transform: true

services:
  - name: auth-service
    url: ${KONG_SERVICE_HOST}:3001
    routes:
      - name: custom-routes
        paths: [/api]
        strip_path: false
    plugins:
      - name: jwt
        config:
          key_claim_name: kid
          claims_to_verify: [exp]

plugins:
  - name: cors
    config:
      origins: ${KONG_CORS_ORIGINS}
```

**Return to framework mode:**

```bash
mv kong.custom.yml kong.custom.yml.backup
npx tsdevstack generate-kong
```

### Docker: docker-compose.user.yml

Not strictly an escape hatch (it merges rather than replaces), but provides extensive control over local development.

**What you can do:**
- Add any service Docker supports
- Override any setting on framework services
- Mount custom volumes
- Change networking

See [Docker Overrides](/customization/docker-overrides) for detailed examples.

### Authentication: External OIDC

Bypass the framework's auth service entirely by using an external identity provider.

**Configure in `.tsdevstack/config.json`:**

```json
{
  "framework": {
    "template": null
  }
}
```

**Provide your OIDC discovery URL in `.secrets.user.json`:**

```json
{
  "secrets": {
    "OIDC_DISCOVERY_URL": "https://your-domain.auth0.com/.well-known/openid-configuration"
  }
}
```

**What happens:**
- Framework skips auth service generation
- No JWT keys are generated
- Kong validates tokens against your provider's JWKS
- Your provider handles all authentication flows
- `kong.user.yml` is generated with commented-out JWT claim headers — uncomment the claims your provider uses (see [Kong Customization](/customization/kong-customization#template-aware-defaults))

## Tradeoffs of breaking conventions

Using escape hatches involves tradeoffs. Understand these before committing.

### Kong escape hatch tradeoffs

| Aspect | With framework | With kong.custom.yml |
|--------|----------------|---------------------|
| Route generation | Automatic from OpenAPI | Manual |
| Security decorators | @Public, @ApiBearerAuth, @PartnerApi work | Ignored |
| Service discovery | Automatic | Manual URL management |
| Upgrades | Framework handles changes | You maintain everything |
| Debugging | Framework-generated config is predictable | Custom config can have subtle issues |

### External OIDC tradeoffs

| Aspect | Framework auth | External OIDC |
|--------|---------------|---------------|
| Setup complexity | Automatic | Provider configuration required |
| User data location | Your database | Provider's systems |
| Customization | Full control over auth logic | Limited to provider features |
| Cost | Infrastructure only | Provider pricing |
| Compliance | You manage everything | Shared responsibility |

### General tradeoffs

**You gain:**
- Full control over the specific area
- Ability to use features the framework does not expose
- Exact configuration matching your requirements

**You lose:**
- Automatic updates when the framework improves
- Consistency with framework conventions
- Some debugging support (framework cannot validate custom configs)
- Documentation alignment (guides assume standard setup)

## How to stay upgradeable

Even with escape hatches, you can minimize upgrade friction.

### Document your customizations

Create a `CUSTOMIZATIONS.md` in your project:

```markdown
# Framework Customizations

## Kong (kong.custom.yml)

We use kong.custom.yml because:
- Need custom header routing not supported by framework
- Legacy service integration requires specific path handling

Key differences from standard:
- Routes use header-based routing instead of path-based
- Legacy service at /v1/* proxies to external system

## External Auth (Auth0)

Using Auth0 instead of framework auth because:
- Enterprise SSO requirement
- Existing Auth0 tenant with user base

Configuration:
- Tenant: mycompany.auth0.com
- Audience: https://api.mycompany.com
```

### Keep escape hatches minimal

Use the smallest scope possible:

```
Most flexible (prefer this)
├── User files (kong.user.yml, .secrets.user.json)
├── Partial escape hatches (external OIDC)
└── Full escape hatches (kong.custom.yml)
Least flexible (use sparingly)
```

### Track framework changes

When upgrading the framework:

1. Read the changelog for changes to areas you have escaped
2. Compare your custom config against new framework defaults
3. Decide whether to adopt new patterns or maintain your approach

### Consider returning to framework mode

Periodically evaluate whether your escape hatch is still necessary:

- Has the framework added support for what you needed?
- Have your requirements changed?
- Is the maintenance burden worth the customization?

To test returning to framework mode:

```bash
# Backup your custom config
mv kong.custom.yml kong.custom.yml.backup

# Generate framework config
npx tsdevstack generate-kong

# Compare the results
diff kong.yml kong.custom.yml.backup

# Decide which to keep
```

## Migration strategies

### From custom to framework

If the framework now supports what you needed:

1. **Audit your custom config** - List every customization
2. **Map to framework features** - Identify which map to user files, which are now defaults
3. **Create user file** - Add necessary customizations to `kong.user.yml`
4. **Test thoroughly** - Generate and compare before committing
5. **Remove escape hatch** - Delete or rename the custom file

### From framework to custom

If you need to escape:

1. **Generate current config** - Run `npx tsdevstack generate-kong` to see current output
2. **Copy as starting point** - Use `kong.yml` as your `kong.custom.yml` base
3. **Make your changes** - Modify the copied config
4. **Test thoroughly** - Ensure all routes work as expected
5. **Document the reasons** - Future you will thank present you

## Troubleshooting

**Custom config not being used**

Check that the file is named exactly right:
- `kong.custom.yml` (not `kong-custom.yml` or `kong.custom.yaml`)
- File is in the project root

**Secret placeholders not resolving**

Ensure you use the exact syntax `${SECRET_NAME}`:
- Correct: `${KONG_CORS_ORIGINS}`
- Wrong: `$KONG_CORS_ORIGINS`, `{{ KONG_CORS_ORIGINS }}`

**Cannot return to framework mode**

If `kong.custom.yml` exists, the framework will not generate routes. Rename or delete it:

```bash
mv kong.custom.yml kong.custom.yml.disabled
npx tsdevstack generate-kong
```

**External OIDC not validating tokens**

Verify:
1. Discovery URL is accessible from Kong container
2. Your tokens include the expected claims
3. Audience and issuer match your provider configuration

