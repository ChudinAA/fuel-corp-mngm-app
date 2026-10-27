---
name: Refueling order volume rules
description: Product-specific volume entry and service-volume rules for multi-product refueling orders.
---

For multi-product aircraft refueling orders, both kerosene and PVKJ support liters/density or kilograms; newly added liquid products default to liters/density and retain independent volumes. Only the service uses kilograms, initially equal to the sum of liquid-product kilograms (or the sole liquid's volume), with manual override until a liquid volume changes.

**Why:** Kerosene and PVKJ require flexible unit entry; the service charge applies to all liquids delivered and should be based on their combined kilograms.

**How to apply:** Keep the liquid-product unit switch visible and default it to liters/density when adding a product. Keep only service volume kilograms-only. Preserve the legacy single-product flow.
