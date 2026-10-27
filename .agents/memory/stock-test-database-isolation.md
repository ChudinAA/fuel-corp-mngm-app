---
name: Stock-test database isolation
description: Why stock restoration tests isolate concurrent runs with temporary databases rather than temporary schemas.
---

Use a unique temporary database per stock-test run rather than a per-run schema. The application's Drizzle tables are declared in the default `public` schema; changing only `search_path` does not make Drizzle Kit prepare those definitions in a custom schema.

**Why:** Concurrent runs must not share DDL or test data, and a search-path-only approach could leave schema preparation targeting `public` or omit the application's declared tables.

**How to apply:** Use only a disposable local PostgreSQL cluster with a temporary data directory. Create the test databases inside that cluster, apply the current schema, and stop/remove the cluster in `finally`. Never accept an external test-database URL or fall back to the application database.

The user specified: «у нас не будет отдельной тестовой БД … Наш главный рабочий вариант — это локальный способ поднимать временный PostgreSQL-кластер».

**Why:** The user does not want a separately configured test database or competing setup instructions.
