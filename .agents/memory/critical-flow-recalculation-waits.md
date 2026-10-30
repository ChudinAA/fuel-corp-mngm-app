---
name: Critical-flow recalculation waits
description: Reliable assertions for API scenarios that trigger asynchronous stock recalculation.
---

For end-to-end inventory scenarios involving backdated updates, deletes, or restores, wait until every recalculation task for the affected warehouse/product completes before asserting final balances or average costs. A linked equipment destination can be recalculated inline during the warehouse cascade and may not have a separate equipment queue task.

Warehouse and equipment workers must also share a transaction-scoped advisory lock by product type. Separate per-entity locks do not prevent a warehouse job from replaying a transfer with its old cost while an equipment job is updating that same transfer and cascading the corrected cost into the warehouse.

**Why:** Immediate reads can observe intermediate balances and costs while background recalculation is running. Even after both queues report completion, concurrent workers can leave the receiving warehouse with a stale average cost unless their cross-entity cascades are serialized.

**How to apply:** Capture the expected baseline, perform the API mutation, wait for queued source and destination warehouse/equipment tasks that actually exist, then verify both stock rows and associated transaction ledgers. Keep both worker paths on the same product-scoped lock.

For independent same-product recalculations, a load test of three warehouse tasks and three equipment tasks, each replaying 16 transactions, completed with about 9.5 seconds average queue wait and 14.5 seconds maximum. Processing itself averaged about 25 ms; the measured delay was dominated by the workers' five-second polling cadence rather than advisory-lock contention.

**Why:** Queue latency and lock wait are different costs. Narrowing the shared lock based on queue wait alone could reintroduce stale transfer costs without improving the actual bottleneck.

**How to apply:** When investigating recalculation latency, compare enqueue-to-claim time with claim-to-completion time. Consider changing the worker polling cadence before weakening cross-worker synchronization.
