# Multi-Agent Review Example

Multiple agents should preserve each other's comments and add separate blocks.

```md
We should charge $99/mo.

<!-- reviewmark
id: rm-claude-pricing
reviewer: claude
status: open
severity: medium
---
This may be too expensive for SMB users.
-->

<!-- reviewmark
id: rm-codex-pricing
reviewer: codex
status: open
severity: low
---
Consider mentioning annual discounts.
-->
```
