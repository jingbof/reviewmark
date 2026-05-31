# ReviewMark

ReviewMark is a v0 CLI for keeping review comments inside Markdown without showing those comments in the clean document. Comments live in hidden HTML comment blocks and attach to the nearest previous non-review top-level Markdown block.

## Install CLI

```bash
npm install -g reviewmark
```

Or run without a global install:

```bash
npx reviewmark preview spec.md
```

## Develop locally

```bash
pnpm install
pnpm build
pnpm reviewmark help
```

During development you can run the CLI from TypeScript:

```bash
pnpm dev -- preview examples/spec.md
```

## Syntax

```markdown
The paragraph being reviewed.

<!-- reviewmark
id: rm-1
reviewer: Ada
severity: medium
status: open
---
This needs a concrete example.
-->
```

Supported statuses:

- `open`
- `resolved`
- `rejected`

Supported severities:

- `note`
- `low`
- `medium`
- `high`
- `critical`

Legacy files may also contain `author`, `suggestion`, `issue`, or `blocker`; the CLI accepts those for compatibility.

Metadata is optional. If `id` is missing, ReviewMark generates `rm-1`, `rm-2`, and so on. Plain review blocks also work:

```markdown
<!-- reviewmark
Quick note without metadata.
-->
```

## CLI

```bash
reviewmark list spec.md
reviewmark validate spec.md
reviewmark render spec.md --out spec.review.html
reviewmark render spec.md --watch --out spec.review.html
reviewmark strip spec.md --out spec.clean.md
reviewmark preview spec.md
```

`reviewmark preview` starts a local HTTP server, opens the generated review view in the default browser, watches the Markdown file, and refreshes the browser when the file changes.

Example output:

```text
ReviewMark preview running:
http://127.0.0.1:4317/spec-md

Watching spec.md...
```

## Install Agent Skill

This repo includes a ReviewMark agent skill at `skills/reviewmark` so Codex, Claude Code, OpenCode, Cursor, and similar agents can learn the comment format.

```bash
npx skills add jingbof/reviewmark --skill reviewmark
```

After installing it, ask your agent:

```text
Review this Markdown file using ReviewMark.
```

## Using ReviewMark in WebStorm

Use the external preview workflow for v0:

```bash
reviewmark preview spec.md
```

Then edit `spec.md` in WebStorm and keep the browser preview open beside it. You can also configure a WebStorm file watcher or external tool to run:

```bash
reviewmark render spec.md --out spec.review.html
```

## Using ReviewMark in VS Code

Use the same external preview workflow for v0:

```bash
reviewmark preview spec.md
```

Edit the Markdown file in VS Code and keep the browser preview open. The preview refreshes when the Markdown file changes.

## Future native VS Code extension

The core package exports:

- `parseReviewMark(markdown)`
- `stripReviewMark(markdown)`
- `renderReviewMarkHtml(markdownOrDocument)`

A future VS Code extension can call those functions, open a webview beside the current editor, refresh on save, and jump from a comment to the target source block.

## Future JetBrains/WebStorm plugin

The v0 recommendation is still the CLI preview. A future JetBrains plugin can call the `reviewmark` CLI or import the core parser through a Node subprocess and show comments in a tool window.
