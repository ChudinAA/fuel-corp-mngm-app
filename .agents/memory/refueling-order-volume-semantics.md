---
name: Refueling order volume rules
description: Product-specific volume entry and service-volume rules for multi-product refueling orders.
---

For multi-product aircraft refueling orders, kerosene and PVKJ keep independent liters/density or tonnes inputs; newly added liquid products default to liters/density. The service is tonnes-only and initially equals the sum of liquid-product tonnes, with manual override until a liquid volume changes. Legacy kg values are compatibility mirrors, not user-facing units.

**Why:** The app-wide conversion requires every entered mass, including service volume, to use tonnes; the service charge still applies to all liquids delivered and must preserve the combined-volume rule.

**How to apply:** Keep the liquid-product unit switch visible and default it to liters/density when adding a product. Keep service volume tonnes-only and synchronized to the combined liquid tonnes until a liquid input changes. Preserve the legacy single-product flow.
