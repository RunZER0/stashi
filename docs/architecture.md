# Stashi architecture

## Database node

Each node runs PostgreSQL 17 and PgBouncer. PostgreSQL listens on a private interface. PgBouncer accepts client connections over TLS.

Shared plans use separate PostgreSQL databases and roles on the same node. Dedicated plans reserve node capacity for one customer.

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
