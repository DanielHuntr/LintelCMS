# 3. A tenant column on every table from day one

Date: 2026-10-31

## Decision

Every table has a `tenant_id` column, defaulting to `"default"`. Unique indexes include it.

## Why

Lintel is self-hosted first, with a managed cloud planned later. In the cloud, many
customers will share a database, kept apart by Postgres row-level security on this column.
Adding the column now costs almost nothing; adding it to live databases later means a risky
migration on every install.

## Alternatives considered

- **Database per customer in the cloud**: simpler isolation, but far more expensive to run
  and to migrate. Still possible later for large customers; the column doesn't prevent it.
