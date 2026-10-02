# Kong Plugins

Kong ships with a long list of bundled plugins (CORS, rate limiting, request size limits, caching, and so on); you enable those in `kong.user.yml` without any extra setup, see [Kong Customization](/docs/customization/kong-customization). This page is about the other case: your own Lua plugin, baked into the gateway image.

## The gateway image

tsdevstack builds one Kong image, the same one locally and in every cloud environment. The generated Dockerfile starts from `kong:3.8.0` and adds:

- the OIDC plugin (`oidc`) that validates JWTs, with nginx shared memory caches for the discovery document and the signing keys (fetched once and reused for 24 hours; a token signed with a key Kong has not seen yet triggers a refetch),
- the framework plugins shipped with the CLI (see [below](#framework-plugins)),
- every plugin in the `kong-plugins/` folder at your project root.

All of them are copied into the image and listed in `KONG_PLUGINS`, next to Kong's bundled plugins. The differences between local and cloud are runtime settings only: locally the config file is mounted and the Admin API is on (port 8001); in the cloud the config is baked into the image and the Admin API is off.

The image definition lives in two generated files:

```
infrastructure/kong/
├── Dockerfile      # Generated, do not edit
├── .dockerignore   # Generated, do not edit
├── kong-plugins/   # Generated copy of the framework plugins and yours (gitignored)
└── declarative/    # Generated, empty locally (gitignored)
```

`generate-kong` (and `sync`) rewrite all of them. Editing the Dockerfile has no lasting effect: your changes are overwritten on the next run, and cloud builds never used that file anyway (`infra:build-kong` writes its own copy of the same Dockerfile into a temporary build context). If you had a hand-written Dockerfile from an older version, `generate-kong` overwrites it with a warning; move custom plugins into `kong-plugins/`.

## Adding a plugin

Create one folder per plugin in `kong-plugins/` at the project root:

```
kong-plugins/
└── request-audit/
    ├── handler.lua
    └── schema.lua
```

Rules, checked by `generate-kong` and `infra:build-kong`:

- **The folder name is the plugin name.** Lowercase letters and digits, words joined by `-` or `_` (for example `request-audit`). It must match the `name` in your `schema.lua`.
- **`handler.lua` and `schema.lua` are required.** Other Lua files in the folder are copied too and can be required as `kong.plugins.<name>.<file>`.
- **No name collisions.** A folder named like a plugin bundled with Kong (for example `cors`), like the OIDC plugin (`oidc`) or like a framework plugin fails generation with a hint. Rename it.
- Hidden folders and loose files in `kong-plugins/` are ignored. Symlinked folders are copied as their targets.

A minimal plugin that adds a response header:

```lua
-- kong-plugins/request-audit/handler.lua
local RequestAudit = {
  PRIORITY = 10,
  VERSION = "1.0.0",
}

function RequestAudit:header_filter(conf)
  kong.response.set_header(conf.header_name, "audited")
end

return RequestAudit
```

```lua
-- kong-plugins/request-audit/schema.lua
local typedefs = require "kong.db.schema.typedefs"

return {
  name = "request-audit",
  fields = {
    { protocols = typedefs.protocols_http },
    { config = {
        type = "record",
        fields = {
          { header_name = { type = "string", default = "X-Audit" } },
        },
      },
    },
  },
}
```

`PRIORITY` decides where your plugin runs relative to the others (higher runs first). The framework's identity-stripping plugin runs at 50000 in the access phase: a plugin with a higher priority would still see identity headers sent by the client, so keep yours below that unless you know why you need it. See Kong's [plugin development guide](https://docs.konghq.com/gateway/latest/plugin-development/) for the handler phases and schema format.

**Commit `kong-plugins/`.** CI builds the cloud image from the repository, so a plugin that exists only on your machine never reaches the cloud.

## Enabling it

Being in the image only makes a plugin available. Turn it on in `kong.user.yml`, like any bundled plugin, globally or on one of your custom services:

```yaml
# kong.user.yml
plugins:
  - name: request-audit
    config:
      header_name: X-Audit
```

## Getting it running

**Locally**, `npx tsdevstack sync` regenerates the build context and restarts the stack with `docker compose up --build`, so the gateway image is rebuilt with your plugin. If you only ran `generate-kong`, rebuild the gateway yourself:

```bash
docker compose up -d --build gateway
```

`docker compose up` without `--build` keeps the old image, which does not know your plugin, and Kong refuses to start when the config enables a plugin the image lacks.

**In the cloud**, the plugin ships with the gateway image:

```bash
npx tsdevstack infra:generate-kong --env dev   # after changing kong.user.yml
npx tsdevstack infra:build-kong --env dev      # builds the image with kong-plugins/ inside
npx tsdevstack infra:deploy-kong --env dev
```

A full `npx tsdevstack infra:deploy --env dev` runs these steps as well.

A fresh clone needs `npx tsdevstack sync` (or `generate-kong`) before the first `docker compose up`: the build context folders under `infrastructure/kong/` are generated and not committed.

## Framework plugins

Three plugins ship with the CLI and are always in the image. You don't enable or configure them; `generate-kong` does.

| Plugin | Where | What it does |
|---|---|---|
| `tsdevstack-strip-identity` | Global, in `kong.tsdevstack.yml` | Removes identity headers sent by clients (`X-Userinfo`, `X-Consumer-*`, `X-Credential-Identifier`, `X-Kong-Trust` and similar) before any authentication plugin runs, so backends only ever see identity that Kong set |
| `tsdevstack-api-key` | On each partner service | Checks the `x-api-key` against the key records in Redis and enforces the key's limits; see [API Keys](/docs/authentication/api-keys) |
| `tsdevstack-api-prefix` | On each partner service | Partner routes match `/api/...`; this plugin removes `/api` before the request reaches your service, which serves the path without it |

Don't declare any of them in `kong.user.yml`. A global `tsdevstack-strip-identity` there fails generation (Kong allows one global instance per plugin name), and a `kong-plugins/` folder with one of these names is a collision. The only place you add them yourself is a full [`kong.custom.yml`](/docs/customization/kong-customization#escape-hatch-with-kongcustomyml) override.
