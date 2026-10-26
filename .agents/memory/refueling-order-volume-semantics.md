---
name: Refueling order volume rules
description: Product-specific volume entry and service-volume rules for multi-product refueling orders.
---

For a multi-product aircraft refueling order, kerosene volume is entered in kilograms only. PVKJ starts with the kerosene volume as a convenience, but its liters/density or kilogram quantity is then independent and may be manually recalculated. A refueling service uses kilograms equal to the sum of kerosene and PVKJ; with only one liquid it follows that liquid. Users may override the service quantity, and a later liquid-volume change recalculates it.

**Why:** The service charge applies to all liquids delivered, while PVKJ is normally calculated separately from kerosene and should not be silently forced to the same amount.

**How to apply:** Keep these rules in the unified multi-product order flow. Preserve the existing single-product flow until a second product is added.
