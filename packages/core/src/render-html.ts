import { marked } from "marked";
import type { ReviewMarkComment, ReviewMarkDocument } from "./types.js";
import { parseReviewMark } from "./parse.js";

export function renderReviewMarkHtml(input: string | ReviewMarkDocument, options: { title?: string } = {}): string {
  const doc = typeof input === "string" ? parseReviewMark(input) : input;
  const title = options.title ?? "ReviewMark";
  const commentsByBlock = groupCommentsByBlock(doc.comments);
  const articleHtml = renderArticle(doc, commentsByBlock);
  const diagnosticHtml = renderDiagnostics(doc);
  const commentSummary = `${doc.comments.length} comment${doc.comments.length === 1 ? "" : "s"}`;
  const diagnosticSummary = `${doc.diagnostics.length} diagnostic${doc.diagnostics.length === 1 ? "" : "s"}`;
  const firstCommentHref = doc.comments.length > 0 ? `#${escapeHtml(doc.comments[0].id)}` : "#reviewmark-document";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${REVIEWMARK_CSS}</style>
</head>
<body>
  <div class="reviewmark-shell">
    <header class="reviewmark-header">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>${commentSummary} · ${diagnosticSummary}</p>
      </div>
      <nav>
        <a href="${firstCommentHref}">Comments</a>
        <a href="#reviewmark-diagnostics">Diagnostics</a>
      </nav>
    </header>
    ${diagnosticHtml}
    <main class="reviewmark-layout">
      <article class="reviewmark-document" id="reviewmark-document">${articleHtml}</article>
    </main>
  </div>
</body>
</html>`;
}

function renderArticle(doc: ReviewMarkDocument, commentsByBlock: Map<number, ReviewMarkComment[]>): string {
  if (doc.blocks.length === 0) {
    return `<div class="reviewmark-empty">No Markdown content found.</div>`;
  }

  return doc.blocks
    .map((block) => {
      const comments = commentsByBlock.get(block.index) ?? [];
      const renderedBlock = marked.parse(block.markdown, { async: false }) as string;
      const blockId = `block-${block.index + 1}`;
      const callouts = comments.map((comment) => renderCommentCard(comment, blockId)).join("");
      const hasCommentsClass = comments.length > 0 ? " has-comments" : "";

      return `<section class="reviewmark-row${hasCommentsClass}" id="${blockId}" data-line="${block.startLine ?? ""}">
  <div class="reviewmark-block">
    <div class="reviewmark-block-content">${renderedBlock}</div>
  </div>
  <div class="reviewmark-comment-gutter" aria-label="Review comments for block ${block.index + 1}">
    ${callouts || `<span class="reviewmark-gutter-empty" aria-hidden="true"></span>`}
  </div>
</section>`;
    })
    .join("\n");
}

function renderCommentCard(comment: ReviewMarkComment, blockId: string): string {
  const line = comment.startLine ? `<span class="reviewmark-line">line ${comment.startLine}</span>` : "";
  const status = escapeHtml(comment.metadata.status);
  const type = escapeHtml(comment.metadata.type);
  return `<a class="reviewmark-comment ${status} ${type}" id="${escapeHtml(comment.id)}" href="#${blockId}" aria-label="Jump to reviewed Markdown block" style="--rm-comment-color: var(--rm-${type})">
  <header class="reviewmark-comment-header">
    <span class="reviewmark-avatar" aria-hidden="true">${escapeHtml(initials(comment.metadata.author))}</span>
    <span class="reviewmark-comment-meta">
      <strong>${escapeHtml(comment.metadata.author)}</strong>
      <span><i></i>${type}</span>
    </span>
    <span class="reviewmark-status">${status}</span>
  </header>
  <div class="reviewmark-comment-body">${marked.parse(comment.body, { async: false }) as string}</div>
  <footer class="reviewmark-comment-footer">
    <code>${escapeHtml(comment.id)}</code>
    ${line}
  </footer>
</a>`;
}

function renderDiagnostics(doc: ReviewMarkDocument): string {
  if (doc.diagnostics.length === 0) return "";
  const items = doc.diagnostics
    .map((diagnostic) => `<li class="${escapeHtml(diagnostic.level)}">${diagnostic.line ? `Line ${diagnostic.line}: ` : ""}${escapeHtml(diagnostic.code)} - ${escapeHtml(diagnostic.message)}</li>`)
    .join("");
  return `<section class="reviewmark-diagnostics" id="reviewmark-diagnostics"><h2>Diagnostics</h2><ul>${items}</ul></section>`;
}

function groupCommentsByBlock(comments: ReviewMarkComment[]): Map<number, ReviewMarkComment[]> {
  const groups = new Map<number, ReviewMarkComment[]>();
  for (const comment of comments) {
    if (comment.attachedToBlockIndex === undefined) continue;
    const commentsForBlock = groups.get(comment.attachedToBlockIndex) ?? [];
    commentsForBlock.push(comment);
    groups.set(comment.attachedToBlockIndex, commentsForBlock);
  }
  return groups;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "RM";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

const REVIEWMARK_CSS = `
:root {
  color-scheme: light dark;
  --rm-bg: #f6f7f4;
  --rm-paper: #fffefa;
  --rm-paper-soft: #f5f6f1;
  --rm-ink: #20221e;
  --rm-muted: #687069;
  --rm-faint: #8d948d;
  --rm-border: #deded5;
  --rm-border-strong: #c8cbc0;
  --rm-accent: #2f6f73;
  --rm-accent-soft: #e3f1ef;
  --rm-issue: #b45d22;
  --rm-suggestion: #2f6f73;
  --rm-question: #7356a8;
  --rm-praise: #347a49;
  --rm-note: #596372;
  --rm-critical: #9d2438;
  --rm-shadow: 0 22px 60px rgba(42, 41, 34, 0.08);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --rm-bg: #07090d;
    --rm-paper: #0c1017;
    --rm-paper-soft: #111721;
    --rm-ink: #eef3f8;
    --rm-muted: #9aa5b4;
    --rm-faint: #687487;
    --rm-border: #222b38;
    --rm-border-strong: #334155;
    --rm-accent: #45d0e8;
    --rm-accent-soft: #0e2425;
    --rm-issue: #f0a45d;
    --rm-suggestion: #45d0e8;
    --rm-question: #b596f0;
    --rm-praise: #83e29e;
    --rm-note: #9bb2ff;
    --rm-critical: #ff6f9d;
    --rm-shadow: none;
  }
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background:
    radial-gradient(circle at 48% -16%, color-mix(in srgb, var(--rm-accent) 10%, transparent), transparent 34rem),
    var(--rm-bg);
  color: var(--rm-ink);
}
.reviewmark-shell { max-width: 1320px; margin: 0 auto; padding: 28px; }
.reviewmark-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 10px 0 28px; }
.reviewmark-header h1 { margin: 0; font-size: clamp(28px, 4vw, 48px); line-height: 1.02; letter-spacing: 0; }
.reviewmark-header p { margin: 8px 0 0; color: var(--rm-muted); font-size: 15px; }
.reviewmark-header nav { display: flex; gap: 14px; }
.reviewmark-header a { color: var(--rm-accent); font-size: 14px; font-weight: 700; text-decoration: none; }
.reviewmark-layout { display: block; }
.reviewmark-document, .reviewmark-diagnostics {
  background: color-mix(in srgb, var(--rm-paper) 96%, transparent);
  border: 1px solid var(--rm-border);
  border-radius: 10px;
  box-shadow: var(--rm-shadow);
}
.reviewmark-document { padding: 28px; }
.reviewmark-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(190px, 286px);
  gap: 22px;
  align-items: start;
  min-width: 0;
}
.reviewmark-row + .reviewmark-row { margin-top: 4px; }
.reviewmark-block {
  position: relative;
  min-width: 0;
  border-radius: 7px;
  padding: 11px 14px;
  transition: background 0.16s ease;
}
.reviewmark-row.has-comments .reviewmark-block::before {
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: -1px;
  width: 2px;
  border-radius: 999px;
  background: var(--rm-accent);
  opacity: 0.72;
  content: "";
}
.reviewmark-row.has-comments:hover .reviewmark-block {
  background: color-mix(in srgb, var(--rm-accent) 8%, transparent);
}
.reviewmark-row:target .reviewmark-block {
  background: color-mix(in srgb, var(--rm-accent) 12%, transparent);
}
.reviewmark-row:target .reviewmark-block::before {
  opacity: 1;
}
.reviewmark-comment-gutter {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding-top: 8px;
}
.reviewmark-gutter-empty { display: block; min-height: 1px; }
.reviewmark-block-content > :first-child, .reviewmark-comment-body > :first-child { margin-top: 0; }
.reviewmark-block-content > :last-child, .reviewmark-comment-body > :last-child { margin-bottom: 0; }
.reviewmark-block-content { min-width: 0; font-size: 16px; line-height: 1.68; }
.reviewmark-block-content h1, .reviewmark-block-content h2, .reviewmark-block-content h3 { line-height: 1.15; letter-spacing: 0; }
.reviewmark-block-content h1 { margin-top: 0; font-size: 34px; }
.reviewmark-block-content h2 { font-size: 24px; }
.reviewmark-block-content h3 { font-size: 18px; }
.reviewmark-block-content p, .reviewmark-block-content li { color: var(--rm-muted); }
.reviewmark-block-content li::marker { color: var(--rm-faint); }
.reviewmark-block-content code {
  border: 1px solid color-mix(in srgb, var(--rm-border) 70%, transparent);
  border-radius: 5px;
  padding: 0.1em 0.32em;
  background: var(--rm-paper-soft);
  color: var(--rm-ink);
  font-size: 0.9em;
}
.reviewmark-block-content pre {
  overflow: auto;
  border: 1px solid var(--rm-border);
  border-radius: 8px;
  padding: 16px;
  background: #20211d;
  color: #f8f6ee;
}
.reviewmark-comment {
  --rm-comment-color: var(--rm-note);
  display: block;
  border: 1px solid var(--rm-border);
  border-left: 2px solid var(--rm-comment-color);
  border-radius: 8px;
  padding: 11px 12px 10px;
  background: var(--rm-paper-soft);
  color: inherit;
  cursor: pointer;
  text-decoration: none;
  transition: border-color 0.16s ease, background 0.16s ease, transform 0.16s ease;
}
.reviewmark-row:hover .reviewmark-comment {
  border-color: color-mix(in srgb, var(--rm-comment-color) 46%, var(--rm-border));
  background: color-mix(in srgb, var(--rm-comment-color) 9%, var(--rm-paper-soft));
}
.reviewmark-comment:hover {
  transform: translateY(-1px);
}
.reviewmark-comment:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--rm-comment-color) 65%, transparent);
  outline-offset: 3px;
}
.reviewmark-comment.resolved, .reviewmark-comment.rejected { opacity: 0.64; }
.reviewmark-comment-header { display: flex; align-items: center; gap: 9px; min-width: 0; }
.reviewmark-avatar {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--rm-comment-color) 34%, transparent);
  border-radius: 6px;
  color: var(--rm-comment-color);
  background: color-mix(in srgb, var(--rm-comment-color) 14%, transparent);
  font-size: 10px;
  font-weight: 800;
}
.reviewmark-comment-meta { display: grid; min-width: 0; line-height: 1.25; }
.reviewmark-comment-meta strong { overflow: hidden; color: var(--rm-ink); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.reviewmark-comment-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--rm-faint);
  font-size: 11px;
  font-weight: 700;
  text-transform: lowercase;
}
.reviewmark-comment-meta i {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--rm-comment-color);
}
.reviewmark-status {
  margin-left: auto;
  border: 1px solid color-mix(in srgb, var(--rm-border) 80%, transparent);
  border-radius: 999px;
  padding: 2px 7px;
  color: var(--rm-faint);
  font-size: 10px;
  font-weight: 800;
  text-transform: lowercase;
}
.reviewmark-comment-body { margin-top: 10px; color: var(--rm-muted); font-size: 13px; line-height: 1.52; }
.reviewmark-comment-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}
.reviewmark-comment-footer code {
  overflow: hidden;
  color: var(--rm-faint);
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reviewmark-line { flex: 0 0 auto; color: var(--rm-comment-color); font-size: 11px; font-weight: 700; }
.reviewmark-diagnostics { margin-bottom: 24px; padding: 18px 20px; border-radius: 8px; }
.reviewmark-diagnostics h2 { margin: 0 0 14px; font-size: 16px; }
.reviewmark-diagnostics li { color: var(--rm-critical); font-size: 14px; }
.reviewmark-diagnostics li.warning { color: var(--rm-issue); }
.reviewmark-empty { color: var(--rm-muted); }
@media (prefers-color-scheme: dark) {
  .reviewmark-block-content pre { background: #090d13; color: #e8eceb; }
}
@media (max-width: 560px) {
  .reviewmark-shell { padding: 18px; }
  .reviewmark-header { display: grid; }
  .reviewmark-document { padding: 18px; }
  .reviewmark-row { grid-template-columns: 1fr; gap: 6px; }
  .reviewmark-row + .reviewmark-row { margin-top: 14px; }
  .reviewmark-comment-gutter { padding: 0 0 0 14px; }
}
`;
