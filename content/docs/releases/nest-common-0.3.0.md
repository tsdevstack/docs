# nest-common 0.3.0

Released: June 11, 2026

This release ships `@tsdevstack/nest-common` 0.3.0 only. CLI packages are unchanged.

---

## Faster secret reads: shared scope is now checked first

Cloud secrets are stored as `{projectName}-{scope}-{KEY}`, where scope is either `shared` or a service name. Until now, when a service read a secret at runtime, `SecretsService` probed the service scope first and fell back to shared.

In practice that first probe never hit. Every secret read at runtime lives in the shared scope. The only service-scoped secret, DATABASE_URL, is injected as an env var at deploy time and never goes through this lookup. So every cache miss paid a guaranteed not-found round-trip to the cloud secret store before finding the value in shared.

As of 0.3.0, the lookup order is reversed: shared first, service scope as the fallback. Cold lookups resolve in one round-trip instead of two. The same reordering applies to the existence check. This cuts the periodic latency spike that appeared every time the 5-minute secret cache expired on a hot path like the auth guard's trust-token check.

The change applies to the GCP, AWS, and Azure providers. Local development is not affected: the local provider uses a flat file structure with no scope probing.

## Behavior change (why this is a minor bump)

If you created the same key in both scopes, the shared value now wins. Previously the service-scoped value won.

This only affects keys set explicitly with the `--service` flag:

```bash
npx tsdevstack cloud-secrets:set MY_KEY --service auth-service --env prod
```

If you use service-scoped keys as per-service overrides of a shared key, rename them so the service is part of the key itself (for example `AUTH_SERVICE_MY_KEY`) and read that key from your code. The framework follows the same convention for its own per-service values, like `AUTH_SERVICE_API_KEY`.

If you never passed `--service` to `cloud-secrets:set`, nothing changes for you.

## Action

The upgrade is opt-in. Existing `^0.2.x` ranges do not resolve to 0.3.0; update the dependency in each NestJS service:

```bash
npm install @tsdevstack/nest-common@^0.3.0
```

Then redeploy your services to pick up the new lookup order. New projects created from the templates get 0.3.0 out of the box.
