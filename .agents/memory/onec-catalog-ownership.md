---
name: 1C catalog ownership
description: Ownership boundaries and matching rules for phased 1C catalog sync.
---

- Nomenclature's `isDefault` is managed locally by the application. Never send it from 1C or overwrite it during synchronization.
- Currency code and name, plus exchange-rate pair/value/date, are authoritative in 1C. Initially match currencies by currency code and rates by currency pair plus date; once linked, use the external 1C UUID for later updates.
- Currency symbols remain application-owned and editable locally. Bases and prices are application-owned and exposed to 1C through read-only GET endpoints.

**Why:** Mixing ownership lets synchronization overwrite user settings or create duplicate catalog records.

**How to apply:** Keep 1C-owned fields limited to sync contracts and updates. Preserve locally managed fields when syncing, and do not add sync endpoints for application-owned catalogs.
