---
name: reviewmark
description: Add, preserve, resolve, and validate ReviewMark comments in Markdown files. Use when the user asks to review, critique, annotate, comment on, or resolve feedback in a Markdown document using ReviewMark; when multiple agents need to leave separate review comments in the same Markdown file; or when validating ReviewMark syntax before rendering with the reviewmark CLI.
---

# ReviewMark

ReviewMark stores review feedback inside hidden HTML comment blocks. Normal Markdown renderers hide the comments, while the `reviewmark` CLI can list, validate, render, strip, and preview them.

## Core Rule

A ReviewMark comment applies to the nearest previous non-review Markdown block. Insert the comment directly below the paragraph, heading, list, code block, table, or section it refers to.

## Syntax

Use this hidden single-block format:

```md
<!-- reviewmark
id: rm-1
reviewer: codex
status: open
severity: medium
---
Comment body in Markdown.
-->
```

Do not use a separate `<!-- /reviewmark -->` closing marker. The comment body must stay inside the hidden HTML comment block so normal Markdown previews do not display it.

## Metadata

Use these fields:

- `id`: stable comment id, such as `rm-pricing-1`; if omitted, the CLI generates one.
- `reviewer`: reviewer or agent name, such as `codex`, `claude`, `opencode`, `cursor`, or `human`.
- `status`: `open`, `resolved`, or `rejected`.
- `severity`: `note`, `low`, `medium`, `high`, or `critical`.

Legacy files may use `author` instead of `reviewer`, or `suggestion`, `issue`, and `blocker` severities. Preserve those values when editing existing comments unless the user asks you to normalize them.

## Reviewing

When asked to review a Markdown document:

1. Do not rewrite the document unless explicitly asked.
2. Insert ReviewMark comments directly below the relevant Markdown block.
3. Preserve all existing content.
4. Preserve existing ReviewMark comments from other reviewers.
5. Add your comments as separate ReviewMark blocks.
6. Keep comments concise, actionable, and specific.
7. Use severity honestly. Most comments should be `note`, `low`, or `medium`; use `high` or `critical` only for major correctness, security, legal, financial, architectural, or product risks.
8. Validate before finishing when the CLI is available: `npx reviewmark validate <file>` or `pnpm reviewmark validate <file>` inside this repo.

## Resolving

When asked to resolve a comment, update only that comment's `status` and body if needed. Do not delete other reviewers' comments unless the user explicitly asks.

```md
<!-- reviewmark
id: rm-pricing-1
reviewer: codex
status: resolved
severity: medium
---
Resolved by adding a lower starter tier.
-->
```

## Do Not

- Do not use visible blockquotes such as `> Comment: ...`.
- Do not leave normal prose comments outside the ReviewMark block.
- Do not insert comments far away from the block they refer to.
- Do not delete, rewrite, or merge other reviewers' comments unless explicitly asked.
- Do not use the visible two-comment form with `<!-- /reviewmark -->`.

## Examples

Read the examples only when needed:

- `examples/basic-review.md`: add one comment below the relevant block.
- `examples/multi-agent-review.md`: preserve existing comments from other agents.
- `examples/resolve-comments.md`: mark an existing comment resolved.
