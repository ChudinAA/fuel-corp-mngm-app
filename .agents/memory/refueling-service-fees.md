---
name: Refueling deal service fees (agent fee + other service)
description: Architecture of agent fee and other service fee storage, UI checkboxes, and recalculation in aircraft_refueling deals.
---

## Fee units and stored totals

The UI and primary API express agent-fee rates in ₽/т. The legacy ₽/кг rate remains a synchronized compatibility mirror. `agentFee` and `otherServiceFee` are stored per-deal money totals; `otherServiceQuantity` for fixed fees is a count, not a mass.

**Why:** A mass-unit migration must not scale money totals or reinterpret service counts, while downstream legacy inventory code may still need the per-kg mirror.

**How to apply:** Convert the rate unit only; preserve fee totals, enable flags, and fixed-service counts. When recalculating inventory cost, reuse the saved fee totals rather than recalculating them from a changed average cost.

## Profit formula (client + recalculation service)

```
profit = saleAmount - purchaseAmount
         - (isAgentFeeEnabled ? agentFee : 0)
         - (isOtherServiceEnabled ? otherServiceFee : 0)
```

For regular deals, enabled fees reduce profit but do not change the sale amount. When a service/PVKJ recharge flag is active, enabled agent and other-service fees are added to saleAmount as buyer surcharges and are also deducted in the profit formula, leaving the base recharged margin at zero.

## State management (client)

`isAgentFeeEnabled` and `isOtherServiceEnabled` are React state in `refueling-form.tsx` (NOT react-hook-form fields). They:
- Default to true on new deals
- Initialize from `editData.isAgentFeeEnabled ?? true` on edit
- Sync with isPriceRecharge/isPvkjRecharge via useEffect

## Recalculation service

`warehouse-recalculation-service.ts` `updateRelatedDeal()` for REFUELING:
- Uses stored `agentFee` total (not rate × new qty — qty doesn't change in auto-recalc)
- Uses stored `otherServiceFee` total
- Respects `isAgentFeeEnabled !== false` and `isOtherServiceEnabled !== false` (null → true)
- For PVKJ recharge, advances salePrice with recalculated purchase cost and stores saleAmount as purchase amount plus enabled fees

**Why:** Auto-recalc changes average cost, and a recharged product must continue passing that cost through to the buyer while preserving zero margin. Fee totals remain stored per deal and are reused.

## Display (pricing section)

`refueling-pricing-section.tsx` shows bordered boxes (not Alert) with:
- Independently selectable checkboxes, including during recharge
- Agent fee: "X.X ₽/т = Y ₽" with strikethrough when disabled
- Other service: "TypeLabel · Name · × N шт." with amount, strikethrough when disabled
- When enabled fees are recharged, note below sale amount identifies the included surcharges
