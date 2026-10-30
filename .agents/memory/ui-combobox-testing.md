---
name: UI combobox browser tests
description: Avoiding cross-selection and flaky actions when browser tests automate shared comboboxes.
---

When automating the shared combobox through Chromium, close stale open popovers and select only visible options; hidden portal options can cause a click to choose a value for a different field.

**Why:** fast sequences of combobox interactions exposed stale and hidden option lists that could silently cross-select fields.

**How to apply:** browser-test helpers should constrain selection to visible options, verify the target trigger's selected label, and close remaining open comboboxes before the next action.

For dependent forms, visible options do not prove that a value can be committed. Verify the selected trigger after choosing prerequisite parties and bases; if the value does not persist after a few evidence-based sequences, leave the path explicitly uncovered rather than weakening the assertion or changing a shared helper without a root cause.

**Why:** foreign refueling UI checks exposed a case where the filtered basis was visible but repeated selection attempts did not update the form state.

**How to apply:** inspect the form's dependency order and selected state before expanding fixtures for foreign or transportation price lookup flows.
