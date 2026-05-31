#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { renderReviewMarkHtml } from "@reviewmark/core";

async function main(argv: string[]): Promise<void> {
  const file = readFlag(argv, "file") ?? argv[0];
  if (!file || argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`Usage:
  node renderer.js --file /path/to/spec.md
  node renderer.js /path/to/spec.md
`);
    return;
  }

  const markdown = await readFile(file, "utf8");
  process.stdout.write(renderReviewMarkHtml(markdown, { title: basename(file) }));
}

function readFlag(argv: string[], name: string): string | undefined {
  const flag = `--${name}`;
  const index = argv.indexOf(flag);
  if (index >= 0) {
    return argv[index + 1];
  }

  const inline = argv.find((arg) => arg.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
