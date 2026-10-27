---
name: Stock-test database isolation
description: Why stock restoration tests isolate concurrent runs with temporary databases rather than temporary schemas.
---

Use a unique temporary database per stock-test run rather than a per-run schema. The application's Drizzle tables are declared in the default `public` schema; changing only `search_path` does not make Drizzle Kit prepare those definitions in a custom schema.

**Why:** Concurrent runs must not share DDL or test data, and a search-path-only approach could leave schema preparation targeting `public` or omit the application's declared tables.

**How to apply:** The stock-test runner needs `TEST_DATABASE_URL` for a dedicated PostgreSQL database whose role can create and drop databases. Prepare the current schema and run tests against the new database, then clean it up in `finally`. Preserve the guard against matching the configured application or Neon database; never use either as a fallback.
