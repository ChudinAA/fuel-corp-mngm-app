---
name: Audit double-normalization fix
description: Root cause and fix for audit panel not showing date changes, services, baseIds, priceValues
---

## The Bug

`audit-middleware.ts` called `normalizeAuditData(capturedOldData)` and `normalizeAuditData(rawNewData)`
before passing to `AuditService.log`. But `AuditService.log` ALSO calls `normalizeDataForAudit` internally.

This double normalization destroyed arrays:
- `services: [{serviceType, serviceValue}]` → `String([...])` = `"[object Object]"` → client showed "—"
- `baseIds: ["uuid1", "uuid2"]` → `"uuid1,uuid2"` (string) → UUIDs not resolved from entityMeta
- `priceValues: [{price: 100}]` → `"[object Object]"` → client showed "—"
- Date strings like `"2026-09-01"` → normalized to `"2026-09-01 00:00:00"` → sometimes compared incorrectly

## The Fix

Removed `normalizeAuditData` calls from `audit-middleware.ts`. Now raw `capturedOldData` and
`rawNewData` are passed directly to `AuditService.log`, which handles ALL normalization internally
via `normalizeDataForAudit`. Nested objects (supplier, buyer, etc.) are automatically skipped by
`normalizeDataForAudit`'s `typeof value === 'object'` guard.

**Why:** `AuditService.normalizeDataForAudit` already handles: services→string, priceValues→string,
baseIds→array-of-UUIDs (kept for client-side UUID resolution), numbers (5 decimal places),
nested objects (skipped). The middleware normalization was redundant and destructive.

**How to apply:** Never add pre-normalization before `AuditService.log`. Always pass raw data.

## Related fixes in the same session

- Backfill pagination bug: was using `offset += batchSize` but processed records leave WHERE clause;
  fixed to always query at offset=0, and update ALL entries (even empty meta = {}) to prevent re-reads.
- priceValues from DB stored as `text[]` of JSON-strings (`'{"price":100}'`) — `normalizeDataForAudit`
  now parses JSON strings before extracting `.price`.
- Abroad refueling: intermediaries/banks audit used `getAuditContext(req)` (no userName) instead of
  enriched `(req as any).auditContext` — caused "неизвестно" as author.
- Warehouse getNewData: body sends `bases: [{baseId}]` but DB has `baseIds: [uuid]` — transform in
  getNewData to avoid false-positive changedFields.
- Duplicate `case "prices"` in audit-helpers.ts caused Vite warning; removed duplicate.
- equipment_movement summary used `transactionDate`/`quantity` (wrong fields) — fixed to `movementDate`/`quantityKg`.
