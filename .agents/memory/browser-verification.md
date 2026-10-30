---
name: Browser verification constraints
description: Avoiding false results when verifying protected UI with the installed Chromium
---

A successful browser debugging connection is not proof that the application page was exercised. Installed Chromium exposes extension/background targets as well as page targets.

**Why:** selecting the first debugging target produced evaluations in an extension background page rather than the app. Coordinate-driven checks also produced false failures during dialog exit animations.

**How to apply:** verify the target type and application URL before interpreting results. Target active dialogs, wait for transitions, and distinguish driver failures from application failures. Do not claim an interaction passed merely because other interactions using the same component passed.

When launching a separate Chromium process for authenticated UI checks, poll the debugging endpoint until a page target exists instead of sleeping for a fixed short interval.

**Why:** Chromium startup time varies; a fixed 1.5-second delay produced a false connection-refused failure before the browser was ready.

**How to apply:** wait with a bounded retry before selecting the page target, then clean up the browser profile only after the process exits.

For authenticated smoke coverage across a Vite app's protected routes, load one protected route directly after login, then navigate to additional routes through the app's SPA history events instead of forcing repeated document reloads.

**Why:** a cold Vite module graph can take longer to render than expected, and repeated full reloads stalled headless Chromium in this environment even though the same routes rendered through client-side navigation.

**How to apply:** keep at least one real protected-route document load in the smoke test, then use the router's normal client-side navigation for the remaining read-only page checks.
