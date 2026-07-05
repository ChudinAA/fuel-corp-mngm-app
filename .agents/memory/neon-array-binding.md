---
name: Neon serverless array binding
description: Raw SQL `= ANY(${jsArray})` fails against Neon serverless driver; use Drizzle inArray() instead.
---

When using `@neondatabase/serverless` with Drizzle ORM, writing raw SQL like:

```ts
sql`${table.id} = ANY(${someJsArray})`
```

fails at runtime with `error: malformed array literal: "<first-element>"` (Postgres error code 22P02). The driver serializes the JS array as a plain comma-joined string parameter rather than a Postgres array literal, so `ANY()` can't parse it.

**Why:** The neon-serverless driver's parameter binding for `sql` template tagged queries does not auto-cast JS arrays into Postgres array syntax the way node-postgres sometimes does.

**How to apply:** Always use Drizzle's `inArray(column, jsArray)` helper instead of raw `ANY()` SQL when filtering by a dynamic list of IDs/values. It generates correct parameterized SQL (`IN (...)`) that works reliably with the Neon serverless driver. This bit us in a module that built resource/summary aggregation queries joining against dynamic ID sets fetched from other tables.
