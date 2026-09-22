# Stashi

Managed PostgreSQL with fixed monthly plans.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run check
npm run build
```

## Product surface

- Public marketing site
- Product and pricing pages
- Sign-in and account session boundary
- Database creation flow
- Database credentials and connection URL
- Service metrics and query activity
- Backup and restore controls
- Database lifecycle actions
- Operator node and quota views
- Provisioning API boundary

## Plans

| Plan | Monthly price | Storage | Connections |
| --- | ---: | ---: | ---: |
| Dev | $2 | 1 GB | 10 |
| Starter | $3 | 5 GB | 30 |
| Production | $5 | 15 GB | 75 |
| Dedicated | $9+ | 40 GB+ | 200 |

## Infrastructure model

Database nodes run PostgreSQL 17 behind PgBouncer, and public database connections require TLS. Dev databases are schema-isolated inside a shared PostgreSQL pool, while Starter and Production use separate databases and roles on managed nodes. Dedicated plans reserve node capacity. Tenant applications should keep migrations schema-agnostic rather than hard-coding `public`; see the architecture and product docs for the pooled-schema model.

The current repository contains the web control plane and a simulated provisioner. The node agent that performs PostgreSQL and PgBouncer changes is the next infrastructure component.

See [`docs/architecture.md`](docs/architecture.md).
