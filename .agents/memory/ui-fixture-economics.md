---
name: UI fixture economics isolation
description: Keep reusable directory fixtures from changing expected totals in core business-flow tests.
---

Use a dedicated supplier for service, agency, and other basis-linked fees when adding directory fixtures. Keep the supplier used by baseline stock/deal scenarios fee-free unless the scenario explicitly tests those fees.

**Why:** Basis-linked fees affect deal cost and profit; adding them to a shared baseline supplier changed an unrelated UI flow's expected economics.

**How to apply:** When extending UI test data, isolate nonzero supplier-basis rates on purpose-built mixed/foreign suppliers, and add assertions for their economics only in the corresponding fee-specific scenario.
