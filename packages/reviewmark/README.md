# ReviewMark CLI

ReviewMark adds hidden, structured review comments to Markdown and renders them beside the blocks they review.

## Install

```bash
npm install -g reviewmarks
```

Or run it without a global install:

```bash
npx reviewmarks preview spec.md
```

## Commands

```bash
reviewmark list spec.md
reviewmark validate spec.md
reviewmark render spec.md --stdout
reviewmark render spec.md --out spec.review.html
reviewmark render spec.md --watch --out spec.review.html
reviewmark strip spec.md --out spec.clean.md
reviewmark preview spec.md
```

The package ships as a self-contained CLI bundle. It does not require installing `@reviewmark/core` separately.

Docs and live demo: <https://reviewmark.dev>
