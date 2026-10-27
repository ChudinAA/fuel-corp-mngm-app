---
name: Critical-flow recalculation waits
description: Reliable assertions for API scenarios that trigger asynchronous stock recalculation.
---

For end-to-end inventory scenarios involving backdated updates, deletes, or restores, wait until every recalculation task for the affected warehouse/product completes before asserting final balances or average costs. A linked equipment destination can be recalculated inline during the warehouse cascade and may not have a separate equipment queue task.

**Why:** Immediate reads can observe intermediate balances and costs while background stock recalculation is still running; waiting for a nonexistent queue on an inline-cascaded destination also causes avoidable test timeouts.

**How to apply:** Capture the expected baseline, perform the API mutation, wait for queued source and destination warehouse/equipment tasks that actually exist, then verify both the parent stock rows and associated transaction ledgers.
