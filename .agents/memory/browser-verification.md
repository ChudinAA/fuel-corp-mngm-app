---
name: Browser verification constraints
description: Avoiding false results when verifying protected UI with the installed Chromium
---

A successful browser debugging connection is not proof that the application page was exercised. Installed Chromium exposes extension/background targets as well as page targets.

**Why:** selecting the first debugging target produced evaluations in an extension background page rather than the app. Coordinate-driven checks also produced false failures during dialog exit animations.

**How to apply:** verify the target type and application URL before interpreting results. Target active dialogs, wait for transitions, and distinguish driver failures from application failures. Do not claim an interaction passed merely because other interactions using the same component passed.
