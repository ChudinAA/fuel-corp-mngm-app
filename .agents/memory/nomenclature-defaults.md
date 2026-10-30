---
name: Nomenclature defaults in operations
description: Product rule for default nomenclature selection and required values in new operation records
---

For new operation records, the nomenclature must be selected from the product type's default in the directory; it must not remain empty, including in drafts. This applies to all operation forms that expose a nomenclature selector.

**Why:** the user confirmed that each product type has a configured default nomenclature and that every created record must carry it.

**How to apply:** UI tests should wait for nomenclature data to load, verify the correct default is selected and persisted, and cover changing product type. Test old records with no nomenclature separately as legacy edit cases; do not let legacy preservation behavior weaken new-record requirements.
