---
name: Integration test process isolation
description: Establishing authenticated sessions in separately launched API integration test processes.
---

Each API integration test process must log in and establish its own HTTP session, even when multiple test files use the same temporary PostgreSQL cluster.

**Why:** The regression runner launches test files as separate Node.js processes; a cookie captured in one process is not shared with another.

**How to apply:** Authenticated integration suites should use their own login helper and reuse that cookie only within that process.
