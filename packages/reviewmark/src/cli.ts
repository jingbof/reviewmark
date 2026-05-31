#!/usr/bin/env node

import { createServer, type ServerResponse } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, watchFile, unwatchFile } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { parseReviewMark, renderReviewMarkHtml, stripReviewMarks, type ReviewMarkDocument } from "@reviewmark/core";

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Map<string, string | boolean>;
}

const DEFAULT_PORT = 4317;

async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);

  switch (args.command) {
    case "list":
      await listCommand(args);
      return;
    case "validate":
      await validateCommand(args);
      return;
    case "render":
      await renderCommand(args);
      return;
    case "strip":
      await stripCommand(args);
      return;
    case "preview":
      await previewCommand(args);
      return;
    case "help":
    case "--help":
    case "-h":
    case "":
      printHelp();
      return;
    default:
      throw new CliError(`Unknown command "${args.command}". Run reviewmark help.`);
  }
}

async function listCommand(args: ParsedArgs): Promise<void> {
  const file = requiredFile(args);
  const doc = await readDocument(file);

  if (args.flags.get("json")) {
    process.stdout.write(`${JSON.stringify(doc.comments, null, 2)}\n`);
    return;
  }

  if (doc.comments.length === 0) {
    process.stdout.write("No ReviewMark comments found.\n");
    return;
  }

  const rows = doc.comments.map((comment) => ({
    id: comment.id,
    author: comment.metadata.author,
    type: comment.metadata.type,
    status: comment.metadata.status,
    line: String(comment.startLine ?? ""),
    target:
      comment.attachedToBlockIndex !== undefined
        ? (doc.blocks[comment.attachedToBlockIndex]?.text ?? "No target block")
        : "No target block",
  }));

  printTable(rows, ["id", "author", "type", "status", "line", "target"]);
}

async function validateCommand(args: ParsedArgs): Promise<void> {
  const file = requiredFile(args);
  const doc = await readDocument(file);

  if (doc.diagnostics.length === 0) {
    process.stdout.write(`ReviewMark validation passed: ${doc.comments.length} comment${doc.comments.length === 1 ? "" : "s"} found.\n`);
    return;
  }

  for (const diagnostic of doc.diagnostics) {
    const prefix = diagnostic.line ? `Line ${diagnostic.line}: ` : "";
    process.stderr.write(`${diagnostic.level.toUpperCase()} ${diagnostic.code}: ${prefix}${diagnostic.message}\n`);
  }
  process.exitCode = 1;
}

async function renderCommand(args: ParsedArgs): Promise<void> {
  const file = requiredFile(args);
  const out = readStringFlag(args, "out");
  const stdout = args.flags.get("stdout") === true;

  if (out && stdout) {
    throw new CliError("render --stdout and --out are mutually exclusive.");
  }

  if (stdout) {
    process.stdout.write(await renderPreviewHtml(file));
    return;
  }

  const outputPath = out ?? defaultRenderOut(file);
  await writeRenderedHtml(file, outputPath, args.flags.get("live") === true);
  process.stdout.write(`Rendered ${file} -> ${outputPath}\n`);

  if (args.flags.get("watch")) {
    process.stdout.write(`Watching ${file}...\n`);
    watchFile(file, { interval: 250 }, async () => {
      try {
        await writeRenderedHtml(file, outputPath, args.flags.get("live") === true);
        process.stdout.write(`Rendered ${file} -> ${outputPath}\n`);
      } catch (error) {
        process.stderr.write(`${formatError(error)}\n`);
      }
    });
  }
}

async function stripCommand(args: ParsedArgs): Promise<void> {
  const file = requiredFile(args);
  const out = readStringFlag(args, "out");
  const markdown = await readFile(file, "utf8");
  const stripped = stripReviewMarks(markdown);

  if (out) {
    await writeFile(out, stripped, "utf8");
    process.stdout.write(`Wrote ${out}\n`);
    return;
  }

  process.stdout.write(stripped);
}

async function previewCommand(args: ParsedArgs): Promise<void> {
  const file = requiredFile(args);
  const requestedPort = Number(readStringFlag(args, "port") ?? DEFAULT_PORT);
  const host = readStringFlag(args, "host") ?? "127.0.0.1";
  const port = await findOpenPort(host, requestedPort);
  const clients = new Set<ServerResponse>();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${host}:${port}`);

    if (url.pathname === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("event: ready\ndata: ready\n\n");
      clients.add(res);
      req.on("close", () => {
        clients.delete(res);
      });
      return;
    }

    if (url.pathname === "/" || url.pathname === `/${encodeURIComponent(previewSlug(file))}` || url.pathname === `/${previewSlug(file)}`) {
      try {
        const html = await renderPreviewHtml(file);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(injectLiveReload(html));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(formatError(error));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  await new Promise<void>((resolvePromise) => {
    server.listen(port, host, () => resolvePromise());
  });

  const url = `http://${host}:${port}/${encodeURIComponent(previewSlug(file))}`;
  process.stdout.write(`ReviewMark preview running:\n${url}\n\nWatching ${file}...\n`);

  watchFile(file, { interval: 250 }, () => {
    for (const client of clients) {
      client.write("event: reload\ndata: reload\n\n");
    }
  });

  process.once("SIGINT", () => {
    unwatchFile(file);
    server.close();
    process.exit(0);
  });

  if (args.flags.get("no-open") !== true) {
    openBrowser(url);
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [name, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      flags.set(name, inlineValue);
      continue;
    }

    const next = rest[index + 1];
    if (next && !next.startsWith("-")) {
      flags.set(name, next);
      index += 1;
      continue;
    }

    flags.set(name, true);
  }

  return { command, positional, flags };
}

function requiredFile(args: ParsedArgs): string {
  const raw = args.positional[0];
  if (!raw) {
    throw new CliError(`Missing file argument for "${args.command}".`);
  }

  const file = resolve(raw);
  if (!existsSync(file)) {
    throw new CliError(`File does not exist: ${file}`);
  }

  return file;
}

async function readDocument(file: string): Promise<ReviewMarkDocument> {
  const markdown = await readFile(file, "utf8");
  return parseReviewMark(markdown);
}

async function writeRenderedHtml(file: string, out: string, live: boolean): Promise<void> {
  const html = await renderPreviewHtml(file);
  await writeFile(out, live ? injectLiveReload(html) : html, "utf8");
}

async function renderPreviewHtml(file: string): Promise<string> {
  const markdown = await readFile(file, "utf8");
  return renderReviewMarkHtml(markdown, { title: basename(file) });
}

function injectLiveReload(html: string): string {
  const script = `<script>
(() => {
  const events = new EventSource("/events");
  events.addEventListener("reload", () => window.location.reload());
})();
</script>`;
  return html.replace("</body>", `${script}\n</body>`);
}

async function findOpenPort(host: string, startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await canListen(host, port)) return port;
  }

  throw new CliError(`Could not find an open port starting at ${startPort}.`);
}

function canListen(host: string, port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const server = createServer();
    server.once("error", () => resolvePromise(false));
    server.once("listening", () => {
      server.close(() => resolvePromise(true));
    });
    server.listen(port, host);
  });
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function printTable<T extends Record<string, string>>(rows: T[], columns: Array<keyof T>): void {
  const widths = new Map<keyof T, number>();
  for (const column of columns) {
    widths.set(
      column,
      Math.max(String(column).length, ...rows.map((row) => row[column].length)),
    );
  }

  const renderRow = (values: Record<string, string>): string =>
    columns
      .map((column) => values[String(column)].padEnd(widths.get(column) ?? 0))
      .join("  ");

  process.stdout.write(`${renderRow(Object.fromEntries(columns.map((column) => [column, String(column)])))}\n`);
  process.stdout.write(`${columns.map((column) => "-".repeat(widths.get(column) ?? 0)).join("  ")}\n`);
  for (const row of rows) {
    process.stdout.write(`${renderRow(row)}\n`);
  }
}

function readStringFlag(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

function defaultRenderOut(file: string): string {
  const extension = extname(file);
  return extension ? file.slice(0, -extension.length) + ".review.html" : `${file}.review.html`;
}

function previewSlug(file: string): string {
  return basename(file).replace(/\W+/g, "-").replace(/^-|-$/g, "") || "preview";
}

function printHelp(): void {
  process.stdout.write(`ReviewMark v0

Usage:
  reviewmark list <file> [--json]
  reviewmark validate <file>
  reviewmark render <file> [--stdout | --out file.html] [--watch] [--live]
  reviewmark strip <file> [--out clean.md]
  reviewmark preview <file> [--port 4317] [--host 127.0.0.1] [--no-open]

Review comments are hidden HTML comments:

  <!-- reviewmark
  id: rm-1
  author: Ada
  type: issue
  status: open
  ~~~
  Comment body in Markdown.
  -->
`);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class CliError extends Error {}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
});
