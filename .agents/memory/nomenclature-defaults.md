---
name: Nomenclature defaults in operations
description: Product rule for default nomenclature selection and required values in new operation records
---

For new operation records, the nomenclature must be selected from the product type's default in the directory; it must not remain empty, including in drafts. This applies to all operation forms that expose a nomenclature selector.

**Why:** the user confirmed that each product type has a configured default nomenclature and every created record must carry it; nullable schemas and database columns previously allowed invalid empty IDs through draft APIs.

**How to apply:** UI tests should wait for nomenclature data to load, verify the correct default is selected and persisted, and cover changing product type. Create APIs must reject missing, deleted, or wrong-type nomenclature even for drafts. API fixtures should send valid IDs rather than weakening this guard. Test old records with no nomenclature separately as legacy edit cases; preserve null only while the product type remains unchanged.
