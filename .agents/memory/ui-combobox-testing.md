---
name: UI combobox browser tests
description: Avoiding cross-selection and flaky actions when browser tests automate shared comboboxes.
---

When automating the shared combobox through Chromium, close stale open popovers and select only visible options; hidden portal options can cause a click to choose a value for a different field.

**Why:** fast sequences of combobox interactions exposed stale and hidden option lists that could silently cross-select fields.

**How to apply:** browser-test helpers should constrain selection to visible options, verify the target trigger's selected label, and close remaining open comboboxes before the next action.

The shared Combobox clears its current value when its already-selected option is selected again. Some dependent forms automatically select a linked basis after choosing a supplier, so clicking that same option again clears the form field.

**Why:** the foreign-refueling browser flow appeared to lose its basis because the test clicked the auto-selected option, triggering the component's explicit toggle-off behavior.

**How to apply:** inspect the target trigger after changing prerequisite fields. Assert an automatic selection directly; click an option only when it differs from the current value. Continue to verify the trigger label and dependent prices after each change.
