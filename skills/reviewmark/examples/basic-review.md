# Basic Review Example

## Input

```md
We should charge $99/mo for the Pro plan.
```

## Correct ReviewMark Output

```md
We should charge $99/mo for the Pro plan.

<!-- reviewmark
id: rm-pricing-1
reviewer: codex
status: open
severity: medium
---
This may be too expensive for early SMB users. Consider testing $49/mo or adding a starter plan.
-->
```
