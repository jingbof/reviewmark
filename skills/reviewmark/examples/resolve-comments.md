# Resolve Comments Example

## Before

```md
<!-- reviewmark
id: rm-pricing-1
reviewer: claude
status: open
severity: medium
---
This may be too expensive for SMB users.
-->
```

## After

```md
<!-- reviewmark
id: rm-pricing-1
reviewer: claude
status: resolved
severity: medium
---
Resolved by adding a lower starter tier.
-->
```
