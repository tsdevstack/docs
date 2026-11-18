# Database Migrations

Every NestJS service with a database owns its schema at `apps/<service>/prisma/schema.prisma` and gets its own Postgres database. Migrations are standard Prisma; the framework wires up the connection and runs them for you at the right times, locally and in the cloud.

## Change your schema

1. Edit `apps/<service>/prisma/schema.prisma`.
2. Create and apply the migration from the service directory:

```bash
cd apps/<service>
npx prisma migrate dev --name describe-your-change
```

This creates a folder under `apps/<service>/prisma/migrations/`, applies it to your local database, and regenerates the Prisma client.

3. Commit the new migration folder. Cloud environments apply exactly what you commit.

The Prisma CLI reads `DATABASE_URL` from the auto-generated `.env` in the service directory. That file is written by `generate-secrets` (and `sync`) for Prisma tooling only; the running service gets its configuration from `SecretsService`. Don't edit the `.env`, it is overwritten on every regeneration.

## Database users

Each service with a database has two Postgres users:

- `<service>` owns the tables. Migrations and Prisma's tools (`migrate dev`, Studio, the seed script) use it.
- `<service>_app` is what the running service connects as. It reads and writes rows. It can't create, change, drop or empty tables, and it can't connect to another service's database.

So a bug or an injected query in a running service can't drop a table or change the schema.

Locally, `sync` sets both up in each Postgres container, every time it runs. In `.secrets.local.json`, a service's `DATABASE_URL` is the `_app` user and `MIGRATION_DATABASE_URL` is the owner. The `.env` in the service directory holds the owner's URL, under the name Prisma reads (`DATABASE_URL`). Locally the owner is also the container's admin user.

On AWS, GCP and Azure, `infra:deploy` sets both up on every deploy, with a short job inside your private network, and keeps their URLs in the cloud's secret store. Migration jobs connect as the owner. A running service can't read the owner's URL. On GCP the job also takes away the extra rights Cloud SQL gives every user it creates. On Azure the owner's URL sits in a separate Key Vault, the database jobs' vault, since a service can read everything in its own vault. `remove-service` drops both users.

On Azure, services and migrations used to connect as the server's admin user. The first deploy after the upgrade gives the tables to the owner. Each service switches to its `_app` user on its next `infra:deploy-services`.

If your code changes the schema while it runs (a raw `CREATE TABLE` or `TRUNCATE`), move that into a migration. The `_app` user can't do it.

Coming from an earlier version? Run `npx tsdevstack sync` once. It creates the `_app` user in your existing databases and lets it use your tables. Your data stays where it is. In the cloud, the next `infra:deploy` does the same. Running services keep working until `infra:deploy-services` moves them to the `_app` user.

## What `sync` does

`npx tsdevstack sync` runs `prisma migrate deploy` and `prisma generate` for every service that has a database. It applies committed migrations, for example after pulling a teammate's changes. It never creates migrations; that is always `prisma migrate dev`, run by you.

## Cloud environments

Migrations are part of every deploy. `infra:deploy` and `infra:deploy-services` run `prisma migrate deploy` for each service with a database in a short-lived job inside your cloud environment (a Cloud Run Job on GCP, an ECS Task on AWS, a Container Apps Job on Azure), right before the service's new revision goes live. There is nothing to run by hand.

To inspect or apply migrations without a full deploy:

```bash
# Preview pending migrations for a service
npx tsdevstack infra:plan-db-migrate --service <service-name> --env <environment>

# Apply pending migrations without deploying
npx tsdevstack infra:run-db-migrate --service <service-name> --env <environment>
```

Both are also available as MCP tools (`plan_db_migrate`, `run_db_migrate`).

## Rules

- **Never edit or delete an applied migration.** Create a new migration that makes the change instead. Cloud databases have already recorded the applied history, and rewriting it breaks `migrate deploy`.
- **Never point `prisma migrate dev` at a cloud database.** Migrations are created locally and only ever applied (`migrate deploy`) in the cloud.
- **Commit `prisma/migrations/` with the code that needs it**, so a single deploy ships the schema change and the code together.

## Seeding

Each service template includes a seed script:

```bash
npm run db:seed -w <service-name>
```

It runs `prisma db seed` using `apps/<service>/prisma/seed.ts`.
