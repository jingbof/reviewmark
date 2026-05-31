# Architecture

The renderer should be bundled with the JetBrains plugin so users do not need to install the CLI separately.

<!-- reviewmark
id: rm-node-runtime
author: Codex
type: question
status: open
---
Should the plugin require Node.js for v0, or should the renderer be ported to JVM before wider release?
-->

The preview refreshes on save rather than on every keystroke.

<!-- reviewmark
id: rm-refresh-scope
author: Human
type: praise
status: open
---
Save-only refresh keeps the v0 plugin predictable and avoids rendering churn while editing.
-->
