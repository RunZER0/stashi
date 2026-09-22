# Stashi architecture

## Database node

Each node runs PostgreSQL 17 and PgBouncer. PostgreSQL listens on a private interface. PgBouncer accepts client connections over TLS.

The Dev plan uses pooled tenancy: tenants share the physical `stashi_pool` database but receive separate PostgreSQL roles and schemas. Each pooled role has its tenant schema configured as the database-level default `search_path`, and it does not receive `CREATE` privileges on `public`. Starter and Production plans use separate PostgreSQL databases and roles on shared nodes. Dedicated plans reserve node capacity for one customer.

## Control plane

The web application stores:

- customer and account records
- plan and billing state
- database metadata and credentials references
- quotas
- node inventory and capacity snapshots
- provisioning job state
- backup metadata
- audit events

Provisioning runs as a background job. A create-database job validates the request, selects an eligible node, creates the PostgreSQL role and database, applies plan configuration, updates PgBouncer authentication, probes the connection and records the result.

The current application uses a simulated provisioner behind the same API boundary.

## Placement

The scheduler evaluates declared node capacity and recent telemetry. Initial placement thresholds are:

- sustained CPU below 60%
- memory utilization below 75%
- disk utilization below 70%
- available customer and connection quota

Thresholds are configuration, not product promises. Capacity data should be retained so node upgrades can be tied to observed pressure.

## Backups

The first backup implementation uses PostgreSQL custom-format dumps copied to S3-compatible object storage. Each upload is verified before local cleanup. Retention is set by plan.

Later tiers may use physical backups and WAL archiving when recovery-point requirements justify the extra operational cost.

## Provisioner interface

The node agent needs authenticated commands for:

- create database and role
- rotate credentials
- suspend or resume access
- delete database
- run health probe
- create backup
- restore backup
- report database metrics
- report node capacity

Control-plane requests should be idempotent. Jobs need durable states so retries do not create duplicate roles, databases or restore targets.

## Billing

Plans are fixed-price records with explicit storage, connection and retention limits. Usage metrics enforce those limits and support capacity planning. Billing does not derive a variable compute charge from runtime telemetry.


## Application migration compatibility

Tenant applications should use schema-agnostic migrations. Unqualified objects such as `CREATE TABLE users (...)` are resolved through the connection's configured `search_path` and therefore work on both pooled Dev databases and isolated databases.

Applications should not assume that `public` is writable. On pooled Dev databases, explicit references such as `public.users`, `CREATE TYPE public.status`, or foreign keys targeting `public.<table>` cross the tenant schema boundary and are rejected by PostgreSQL permissions. This is intentional.

ORMs and migration tools should be configured to emit unqualified object names or to target `current_schema()`. Stashi does not grant pooled tenant roles broader access to `public` to accommodate migration tools; the migration configuration must preserve the isolation model.
