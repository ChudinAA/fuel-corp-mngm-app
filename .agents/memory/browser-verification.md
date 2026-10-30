---
name: Browser verification constraints
description: Avoiding false results when verifying protected UI with the installed Chromium
---

A successful browser debugging connection is not proof that the application page was exercised. Installed Chromium exposes extension/background targets as well as page targets.

**Why:** selecting the first debugging target produced evaluations in an extension background page rather than the app. Coordinate-driven checks produced false failures during dialog exit animations, and document-wide text checks could pass on old table content before related values finished loading in a form.

**How to apply:** verify the target type and application URL before interpreting results. Scope UI assertions to the active dialog and the required dependent values inside it, wait for asynchronous defaults/related records before submitting, and distinguish driver failures from application failures. Verify each interaction directly.

When launching a separate Chromium process for authenticated UI checks, poll the debugging endpoint until a page target exists instead of sleeping for a fixed short interval.

**Why:** Chromium startup time varies; a fixed 1.5-second delay produced a false connection-refused failure before the browser was ready.

**How to apply:** wait with a bounded retry before selecting the page target, then clean up the browser profile only after the process exits.

For authenticated smoke coverage across a Vite app's protected routes, load one protected route directly after login, then navigate to additional routes through the app's SPA history events instead of forcing repeated document reloads.

**Why:** a cold Vite module graph can take longer to render than expected, and repeated full reloads stalled headless Chromium in this environment even though the same routes rendered through client-side navigation.

**How to apply:** keep at least one real protected-route document load in the smoke test, then use the router's normal client-side navigation for the remaining read-only page checks.

When opening Radix dropdown menus through CDP, a DOM `.click()` on the trigger does not emit the `pointerdown` event the menu listens for.

**Why:** synthetic clicks alone left row action menus closed in headless browser tests, creating false failures in edit flows.

**How to apply:** dispatch a primary mouse `pointerdown` on the trigger before asserting that its menu items appeared.

For forms that save a parent record and related chain rows through several HTTP writes, wait for every related write response before querying the child tables.

**Why:** the parent record may already reflect an edit while follow-up child replacements are still pending, so checking the parent alone can observe stale or transient child state.

**How to apply:** capture the expected child-write requests before submitting, wait for each successful response, then assert the final related rows and audit state.

When a browser test changes fixture data directly in PostgreSQL, an already-open React Query session may continue showing its cached result.

**Why:** toggling a nomenclature default in the database during an active UI test did not reliably refresh the client query; reloading also introduced a transient route state.

**How to apply:** prepare missing-default fixtures before the browser session starts, or use a separate clean session. Do not assume a direct database update invalidates client query caches.
