import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const cliPath = join(repoRoot, "packages/reviewmark/dist/cli.js");
const bundledRendererPath = join(repoRoot, "plugins/jetbrains/src/main/resources/reviewmark-renderer/renderer.js");

const validMarkdown = `Paragraph.

<!-- reviewmark
id: rm-cli
author: Codex
type: issue
status: open
~~~
CLI test comment.
-->`;

describe("reviewmark CLI", () => {
  it("renders to stdout", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reviewmark-cli-"));
    try {
      const file = join(dir, "spec.md");
      await writeFile(file, validMarkdown, "utf8");
      const result = runCli(["render", file, "--stdout"]);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /CLI test comment/);
      assert.match(result.stdout, /<!doctype html>/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("renders to an output file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reviewmark-cli-"));
    try {
      const file = join(dir, "spec.md");
      const out = join(dir, "spec.html");
      await writeFile(file, validMarkdown, "utf8");
      const result = runCli(["render", file, "--out", out]);

      assert.equal(result.status, 0);
      assert.match(await readFile(out, "utf8"), /CLI test comment/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects render --stdout with --out", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reviewmark-cli-"));
    try {
      const file = join(dir, "spec.md");
      await writeFile(file, validMarkdown, "utf8");
      const result = runCli(["render", file, "--stdout", "--out", join(dir, "spec.html")]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /mutually exclusive/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("validates valid and invalid metadata", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reviewmark-cli-"));
    try {
      const valid = join(dir, "valid.md");
      const invalid = join(dir, "invalid.md");
      await writeFile(valid, validMarkdown, "utf8");
      await writeFile(
        invalid,
        `Paragraph.

<!-- reviewmark
type: risk
status: waiting
~~~
Invalid.
-->`,
        "utf8",
      );

      assert.equal(runCli(["validate", valid]).status, 0);
      const invalidResult = runCli(["validate", invalid]);
      assert.notEqual(invalidResult.status, 0);
      assert.match(invalidResult.stderr, /invalid_type/);
      assert.match(invalidResult.stderr, /invalid_status/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runs the bundled renderer from a temporary .js file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reviewmark-renderer-"));
    try {
      const file = join(dir, "spec.md");
      const tempRenderer = join(dir, "renderer.js");
      await writeFile(file, validMarkdown, "utf8");
      await copyFile(bundledRendererPath, tempRenderer);

      const result = spawnSync(process.execPath, [tempRenderer, "--file", file], {
        cwd: repoRoot,
        encoding: "utf8",
      });

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /CLI test comment/);
      assert.match(result.stdout, /<!doctype html>/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function runCli(args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}
