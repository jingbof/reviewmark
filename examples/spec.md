# Payroll payrun matching

Use the bank debit date when matching payroll payruns to bank transactions. Payroll providers often expose a pay date that differs from the date cash leaves the account.

<!-- reviewmark
id: rm-payrun-date
author: Ada
type: issue
status: open
---
Add one concrete example showing a provider pay date that differs from the posted bank debit date.
-->

## Matching rules

1. Prefer provider connection provenance when it is available.
2. Match against the debit date for cash movement.
3. Keep the pay date available for payroll-period reporting.

<!-- reviewmark
id: rm-scope
type: suggestion
status: open
---
This rule list is good, but it should state whether manual imports follow the same matching path.
-->

## Non-goals

ReviewMark v0 does not edit comments from the browser and does not integrate with native IDE previews.
