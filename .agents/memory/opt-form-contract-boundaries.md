---
name: OPT form/API boundaries
description: Keep mixed-basis selection semantic and OPT request payloads limited to API fields.
---

In OPT forms, select an associated basis by the business-required base type, not by the first supplier-basis association; relation order is not a reliable semantic choice.

Composite selected-price values are UI state. Convert them to canonical price IDs and numeric indices before sending requests, and omit composite selectors and route IDs from request bodies. The API uses the route for the record ID and strict schemas reject unrelated form state.

**Why:** mixed suppliers can have refueling and wholesale bases in either order; draft create/edit tests exposed rejected UI-only fields and a route ID copied into the update body.

**How to apply:** when changing OPT form submission or edit initialization, test a mixed supplier and a nonzero price tier through draft create, database verification, edit prefill, and update.
