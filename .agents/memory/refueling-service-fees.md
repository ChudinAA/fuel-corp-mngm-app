---
name: Refueling deal service fees (agent fee + other service)
description: Architecture of agent fee and other service fee storage, UI checkboxes, and recalculation in aircraft_refueling deals.
---

## What was built

7 new columns added to `aircraft_refueling` (migration applied via executeSql):
- `agent_fee_rate` decimal(19,6) — rate ₽/кг (for accounting/display)
- `is_agent_fee_enabled` boolean default true — whether included in deal profit
- `other_service_fee` decimal(15,2) — total other service amount
- `other_service_name` text — name of service
- `other_service_type` text — type: royalty_per_ton | percent_of_amount | fixed
- `other_service_quantity` decimal(15,4) — quantity for "fixed" type
- `is_other_service_enabled` boolean default true — whether included in deal profit

## Profit formula (client + recalculation service)

```
profit = saleAmount - purchaseAmount
         - (isAgentFeeEnabled ? agentFee : 0)
         - (isOtherServiceEnabled ? otherServiceFee : 0)
```

When `isPriceRecharge || isPvkjRecharge` is active → both fees forced to 0 and checkboxes disabled.

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

**Why:** Auto-recalc only changes `purchasePrice` (avg cost), not quantity. Fees don't need recomputing — the stored totals are already correct.

## Display (pricing section)

`refueling-pricing-section.tsx` shows bordered boxes (not Alert) with:
- Checkbox (disabled when isRechargeActive)
- Agent fee: "X.X ₽/кг = Y ₽" with strikethrough when disabled
- Other service: "TypeLabel · Name · × N шт." with amount, strikethrough when disabled
