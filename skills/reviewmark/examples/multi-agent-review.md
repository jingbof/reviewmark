# Multi-Agent Review Example

Multiple agents should preserve each other's comments and add separate blocks.

```md
We should charge $99/mo.

<!-- reviewmark
id: rm-claude-pricing
author: Claude
status: open
type: issue
---
This may be too expensive for SMB users.
-->

<!-- reviewmark
id: rm-codex-pricing
author: Codex
status: open
type: suggestion
---
Consider mentioning annual discounts.
-->
```
