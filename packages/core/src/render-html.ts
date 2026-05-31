import { marked } from "marked";
import type { ReviewMarkComment, ReviewMarkDocument } from "./types.js";
import { parseReviewMark } from "./parse.js";

export function renderReviewMarkHtml(input: string | ReviewMarkDocument, options: { title?: string } = {}): string {
  const doc = typeof input === "string" ? parseReviewMark(input) : input;
  const title = options.title ?? "ReviewMark";
  const commentsByBlock = groupCommentsByBlock(doc.comments);
  const articleHtml = renderArticle(doc, commentsByBlock);
  const sidebarHtml = renderSidebar(doc.comments);
  const diagnosticHtml = renderDiagnostics(doc);

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
        <p>${doc.comments.length} comment${doc.comments.length === 1 ? "" : "s"} · ${doc.diagnostics.length} diagnostic${doc.diagnostics.length === 1 ? "" : "s"}</p>
      </div>
      <nav>
        <a href="#reviewmark-comments">Comments</a>
        <a href="#reviewmark-diagnostics">Diagnostics</a>
      </nav>
    </header>
    ${diagnosticHtml}
    <main class="reviewmark-layout">
      <article class="reviewmark-document">${articleHtml}</article>
      ${sidebarHtml}
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
      const callouts = comments.map(renderInlineComment).join("");
      const hasCommentsClass = comments.length > 0 ? " has-comments" : "";

      return `<section class="reviewmark-block${hasCommentsClass}" id="block-${block.index + 1}" data-line="${block.startLine ?? ""}">
  <div class="reviewmark-block-content">${renderedBlock}</div>
  ${callouts ? `<div class="reviewmark-inline-comments">${callouts}</div>` : ""}
</section>`;
    })
    .join("\n");
}

function renderInlineComment(comment: ReviewMarkComment): string {
  const line = comment.startLine ? ` <a href="reviewmark://line/${comment.startLine}">line ${comment.startLine}</a>` : "";
  return `<aside class="reviewmark-comment ${escapeHtml(comment.metadata.status)} ${escapeHtml(comment.metadata.type)}" id="${escapeHtml(comment.id)}">
  <div class="reviewmark-comment-meta">
    <span>${escapeHtml(comment.metadata.author)}</span>
    <span>${escapeHtml(comment.metadata.type)}</span>
    <span>${escapeHtml(comment.metadata.status)}</span>
    ${line}
  </div>
  <div class="reviewmark-comment-body">${marked.parse(comment.body, { async: false }) as string}</div>
</aside>`;
}

function renderSidebar(comments: ReviewMarkComment[]): string {
  const items = comments
    .map((comment) => {
      const targetLink =
        comment.attachedToBlockIndex !== undefined ? `#block-${comment.attachedToBlockIndex + 1}` : `#${comment.id}`;
      return `<li>
  <a href="${targetLink}">
    <strong>${escapeHtml(comment.id)}</strong>
    <span>${escapeHtml(comment.metadata.author)} · ${escapeHtml(comment.metadata.type)} · ${escapeHtml(comment.metadata.status)}</span>
  </a>
</li>`;
    })
    .join("");

  return `<aside class="reviewmark-sidebar" id="reviewmark-comments">
  <h2>Review Comments</h2>
  ${items ? `<ol>${items}</ol>` : `<p>No ReviewMark comments found.</p>`}
</aside>`;
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

const REVIEWMARK_CSS = `
:root {
  color-scheme: light dark;
  --rm-bg: #f7f7f4;
  --rm-paper: #fffdfa;
  --rm-ink: #20211d;
  --rm-muted: #6b6d63;
  --rm-border: #dfddd4;
  --rm-accent: #2f6f73;
  --rm-accent-soft: #e2f1ef;
  --rm-issue: #a0461f;
  --rm-critical: #9d2438;
  --rm-praise: #3d7b45;
  --rm-note: #53606f;
  --rm-shadow: 0 18px 50px rgba(42, 41, 34, 0.08);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --rm-bg: #151718;
    --rm-paper: #1d2021;
    --rm-ink: #e8eceb;
    --rm-muted: #a5aaa7;
    --rm-border: #343a3b;
    --rm-accent: #7dc9c4;
    --rm-accent-soft: #1f3536;
    --rm-issue: #f0a06f;
    --rm-critical: #ff7b96;
    --rm-praise: #91d18b;
    --rm-note: #96a3b4;
    --rm-shadow: none;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--rm-bg); color: var(--rm-ink); }
.reviewmark-shell { max-width: 1440px; margin: 0 auto; padding: 28px; }
.reviewmark-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 10px 0 28px; }
.reviewmark-header h1 { margin: 0; font-size: clamp(28px, 4vw, 48px); line-height: 1.02; letter-spacing: 0; }
.reviewmark-header p { margin: 8px 0 0; color: var(--rm-muted); font-size: 15px; }
.reviewmark-header nav { display: flex; gap: 14px; }
.reviewmark-header a { color: var(--rm-accent); font-size: 14px; font-weight: 700; text-decoration: none; }
.reviewmark-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px; align-items: start; }
.reviewmark-document, .reviewmark-sidebar, .reviewmark-diagnostics { background: var(--rm-paper); border: 1px solid var(--rm-border); box-shadow: var(--rm-shadow); }
.reviewmark-document { padding: 26px; }
.reviewmark-block { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 16px 18px; border: 1px solid transparent; border-radius: 8px; }
.reviewmark-block + .reviewmark-block { margin-top: 8px; }
.reviewmark-block.has-comments { border-color: #c8dad6; background: #fbfffe; }
@media (prefers-color-scheme: dark) {
  .reviewmark-block.has-comments { border-color: #345457; background: #182425; }
}
.reviewmark-block-content > :first-child, .reviewmark-comment-body > :first-child { margin-top: 0; }
.reviewmark-block-content > :last-child, .reviewmark-comment-body > :last-child { margin-bottom: 0; }
.reviewmark-block-content { min-width: 0; font-size: 16px; line-height: 1.68; }
.reviewmark-block-content h1, .reviewmark-block-content h2, .reviewmark-block-content h3 { line-height: 1.15; letter-spacing: 0; }
.reviewmark-block-content h1 { font-size: 34px; }
.reviewmark-block-content h2 { font-size: 26px; }
.reviewmark-block-content code { background: #efeee8; border-radius: 4px; padding: 0.1em 0.3em; }
.reviewmark-block-content pre { overflow: auto; background: #20211d; color: #f8f6ee; border-radius: 8px; padding: 16px; }
.reviewmark-inline-comments { display: grid; gap: 10px; }
.reviewmark-comment { border-left: 4px solid var(--rm-note); background: #f5f6f3; border-radius: 6px; padding: 12px 14px; }
@media (prefers-color-scheme: dark) {
  .reviewmark-block-content code { background: #2a2f31; }
  .reviewmark-block-content pre { background: #111314; color: #e8eceb; }
  .reviewmark-comment { background: #242829; }
}
.reviewmark-comment.issue { border-left-color: var(--rm-issue); }
.reviewmark-comment.suggestion { border-left-color: var(--rm-accent); }
.reviewmark-comment.question { border-left-color: #7561a8; }
.reviewmark-comment.praise { border-left-color: var(--rm-praise); }
.reviewmark-comment.resolved, .reviewmark-comment.rejected { opacity: 0.66; }
.reviewmark-comment-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; color: var(--rm-muted); font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.reviewmark-comment-meta a { color: var(--rm-accent); text-decoration: none; }
.reviewmark-comment-body { font-size: 14px; line-height: 1.55; }
.reviewmark-sidebar { position: sticky; top: 20px; padding: 20px; border-radius: 8px; }
.reviewmark-sidebar h2, .reviewmark-diagnostics h2 { margin: 0 0 14px; font-size: 16px; }
.reviewmark-sidebar ol { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.reviewmark-sidebar a { display: grid; gap: 4px; padding: 12px; border-radius: 6px; background: var(--rm-accent-soft); color: var(--rm-ink); text-decoration: none; }
.reviewmark-sidebar span { color: var(--rm-accent); font-size: 12px; font-weight: 800; text-transform: uppercase; }
.reviewmark-diagnostics { margin-bottom: 24px; padding: 18px 20px; border-radius: 8px; }
.reviewmark-diagnostics li { color: var(--rm-critical); font-size: 14px; }
.reviewmark-diagnostics li.warning { color: var(--rm-issue); }
.reviewmark-empty { color: var(--rm-muted); }
@media (max-width: 900px) {
  .reviewmark-shell { padding: 18px; }
  .reviewmark-layout { grid-template-columns: 1fr; }
  .reviewmark-sidebar { position: static; }
}
`;
