---
name: Planning periodFrom timestamp fix
description: DB stores periodFrom/periodTo as full timestamp strings; compare only first 10 chars with date-only strings.
---

`supplier_allocated_volumes.period_from` is stored as a full ISO timestamp (e.g. `"2025-07-01 00:00:00"`), not just a date string.

**Rule:** When comparing to a date-only string like `"2025-07-01"`, use `.slice(0, 10)` on the DB value before comparing.

**Why:** Strict equality `v.periodFrom === selectedMonthData.from` always fails because `"2025-07-01 00:00:00" !== "2025-07-01"`, so the pre-fill logic in `AllocatedVolumeDialog` never found an existing record.

**How to apply:** Anywhere comparing DB timestamp columns to date-only JS strings: `v.periodFrom.slice(0, 10) === dateStr`.
