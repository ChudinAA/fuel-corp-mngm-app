---
name: SSE Real-time Updates Architecture
description: How multi-user real-time data freshness is implemented — SSE, polling, clientId filtering
---

## Architecture

### SSE endpoint
- URL: `/api/warehouses/sse/events?clientId=<uuid>`
- Handler: `server/modules/warehouses/routes/warehouses.ts` (bottom of file)
- Service: `server/services/sse-service.ts` — in-process Set<SSEClient>, stores clientId per connection

### Events
1. `warehouse_recalculated` — fired by recalculation workers after warehouse balance recalc
2. `entity_changed` — fired after any mutation, payload: `{ entity: string }`

### Entity → query key mapping (frontend)
Defined in `client/src/hooks/use-warehouse-sse.ts` as `ENTITY_QUERY_KEYS`:
- opt → /api/opt
- refueling → /api/refueling
- refueling-abroad → /api/refueling-abroad
- movement → /api/movement
- transportation → /api/transportation
- exchange-deals → /api/exchange-deals
- equipment-movement → /api/equipment-movement
- prices → /api/prices + /api/prices/list
- warehouses → /api/warehouses

### ClientId filtering
- `client/src/lib/client-id.ts` generates a UUID per browser tab
- `apiRequest` sends it as `X-Client-Id` header on all mutations
- Backend reads `req.headers["x-client-id"]` and passes to `SSEService.notifyEntityChanged(entity, excludeClientId)`
- SSE service skips the initiating client — they already invalidated their own cache via mutation.onSuccess

### Polling (fallback if SSE misses an event)
`refetchInterval: 30_000, refetchIntervalInBackground: false` added to all transactional infinite-query hooks:
- use-opt-table.ts, use-refueling-table.ts, use-movement-table.ts
- use-transportation-table.ts, use-exchange-deals-table.ts
- use-equipment-movement-table.ts, use-refueling-abroad-table.ts
- prices-table.tsx

### onerror fix
`use-warehouse-sse.ts`: removed `eventSource.close()` from onerror handler — browser auto-reconnects EventSource on network errors. Only close on `auth_error`.

**Why:** previously SSE died permanently on any transient error (server restart, network blip). Now browser handles reconnection automatically.
