---
name: Planning actuals quantity fix
description: Expense transactions stored as negative; always use Math.abs for display totals in planning actuals.
---

Warehouse transactions stored by `warehouse-transaction-service.ts`:
- `receipt`, `transfer_in` → stored as **positive** quantity
- `sale`, `transfer_out` → stored as **negative** quantity
- `inventory` → sign reflects direction: positive = adding stock (income), negative = removing stock (expense)

**Rule:** In `getActuals`, always use `Math.abs(qty)` for display totals. Determine `isExpense` from `transactionType`, NOT the sign of qty (except for inventory, where sign is the signal).

**Why:** Naive summation of raw qty produced 0 for expense totals because negative numbers cancelled out in incorrect comparisons, causing "Факт расх" to always show dash.

**How to apply:** Any code computing expense/income totals from `warehouseTransactions` must use `Math.abs(parseFloat(t.quantity))` and check `transactionType` for direction.
