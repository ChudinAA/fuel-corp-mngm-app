---
name: UI combobox browser tests
description: Avoiding cross-selection and flaky actions when browser tests automate shared comboboxes.
---

When automating the shared combobox through Chromium, close stale open popovers and select only visible options; hidden portal options can cause a click to choose a value for a different field.

**Why:** fast sequences of combobox interactions exposed stale and hidden option lists that could silently cross-select fields.

**How to apply:** browser-test helpers should constrain selection to visible options, verify the target trigger's selected label, and close remaining open comboboxes before the next action.
