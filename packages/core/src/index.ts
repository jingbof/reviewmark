import { marked } from "marked";

export type ReviewMarkStatus = "open" | "resolved" | "rejected";
export type ReviewMarkSeverity = "note" | "low" | "medium" | "high" | "critical" | "suggestion" | "issue" | "blocker";

export interface ReviewMarkTarget {
  blockIndex: number;
  startLine: number;
  endLine: number;
  excerpt: string;
}

export interface ReviewMarkSourceRange {
  startLine: number;
  endLine: number;
}

export interface ReviewMarkComment {
  id: string;
  author?: string;
  status: ReviewMarkStatus;
  severity: ReviewMarkSeverity;
  created?: string;
  body: string;
  source: ReviewMarkSourceRange;
  target?: ReviewMarkTarget;
}

export interface ReviewMarkBlock {
  index: number;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  markdown: string;
  excerpt: string;
}

export interface ReviewMarkWarning {
  line: number;
  message: string;
}

export interface ReviewMarkDocument {
  markdown: string;
  strippedMarkdown: string;
  blocks: ReviewMarkBlock[];
  comments: ReviewMarkComment[];
  warnings: ReviewMarkWarning[];
}

interface PendingComment {
  comment: Omit<ReviewMarkComment, "target">;
  strippedStartOffset: number;
}

const REVIEW_COMMENT_RE = /<!--\s*reviewmark\b([\s\S]*?)-->/gi;
const STATUSES = new Set<ReviewMarkStatus>(["open", "resolved", "rejected"]);
const SEVERITIES = new Set<ReviewMarkSeverity>([
  "note",
  "low",
  "medium",
  "high",
  "critical",
  "suggestion",
  "issue",
  "blocker",
]);

export function parseReviewMark(markdown: string): ReviewMarkDocument {
  const warnings: ReviewMarkWarning[] = [];
  const pendingComments: PendingComment[] = [];
  let strippedMarkdown = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let commentIndex = 0;

  REVIEW_COMMENT_RE.lastIndex = 0;

  while ((match = REVIEW_COMMENT_RE.exec(markdown)) !== null) {
    const [raw, inner = ""] = match;
    const startIndex = match.index;
    const endIndex = startIndex + raw.length;
    const sourceStartLine = lineNumberAt(markdown, startIndex);
    const sourceEndLine = lineNumberAt(markdown, endIndex);

    strippedMarkdown += markdown.slice(lastIndex, startIndex);

    commentIndex += 1;
    const { comment, warnings: commentWarnings } = parseCommentInner(
      inner,
      commentIndex,
      sourceStartLine,
      sourceEndLine,
    );

    warnings.push(...commentWarnings);
    pendingComments.push({
      comment,
      strippedStartOffset: strippedMarkdown.length,
    });

    lastIndex = endIndex;
  }

  strippedMarkdown += markdown.slice(lastIndex);

  const unmatchedOpenings = countReviewOpenings(markdown) - pendingComments.length;
  if (unmatchedOpenings > 0) {
    warnings.push({
      line: 1,
      message: `${unmatchedOpenings} ReviewMark comment block(s) were opened but not closed.`,
    });
  }

  const blocks = extractMarkdownBlocks(strippedMarkdown);
  const comments = pendingComments.map(({ comment, strippedStartOffset }) => {
    const target = findTargetBlock(blocks, lineNumberAt(strippedMarkdown, strippedStartOffset));
    if (!target) {
      warnings.push({
        line: comment.source.startLine,
        message: `Review comment ${comment.id} does not have a previous Markdown block to attach to.`,
      });
      return comment;
    }

    return {
      ...comment,
      target: {
        blockIndex: target.index,
        startLine: target.startLine,
        endLine: target.endLine,
        excerpt: target.excerpt,
      },
    };
  });

  const duplicateIds = findDuplicateIds(comments);
  for (const id of duplicateIds) {
    const first = comments.find((comment) => comment.id === id);
    warnings.push({
      line: first?.source.startLine ?? 1,
      message: `Duplicate review comment id "${id}".`,
    });
  }

  return {
    markdown,
    strippedMarkdown,
    blocks,
    comments,
    warnings,
  };
}

export function stripReviewMark(markdown: string): string {
  return parseReviewMark(markdown).strippedMarkdown;
}

export function renderReviewMarkHtml(input: string | ReviewMarkDocument, options: { title?: string } = {}): string {
  const doc = typeof input === "string" ? parseReviewMark(input) : input;
  const title = options.title ?? "ReviewMark";
  const commentsByBlock = groupCommentsByBlock(doc.comments);
  const articleHtml = renderArticle(doc, commentsByBlock);
  const sidebarHtml = renderSidebar(doc.comments);
  const warningHtml = renderWarnings(doc.warnings);

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
        <p>${doc.comments.length} comment${doc.comments.length === 1 ? "" : "s"} found</p>
      </div>
      <a href="#reviewmark-comments">Comments</a>
    </header>
    ${warningHtml}
    <main class="reviewmark-layout">
      <article class="reviewmark-document">${articleHtml}</article>
      ${sidebarHtml}
    </main>
  </div>
</body>
</html>`;
}

function parseCommentInner(
  inner: string,
  index: number,
  startLine: number,
  endLine: number,
): { comment: Omit<ReviewMarkComment, "target">; warnings: ReviewMarkWarning[] } {
  const warnings: ReviewMarkWarning[] = [];
  const normalized = inner.replace(/^\s*\n/, "").replace(/\s+$/, "");
  const lines = normalized.split(/\r?\n/);
  const dividerIndex = lines.findIndex((line) => line.trim() === "---");
  const metaLines = dividerIndex >= 0 ? lines.slice(0, dividerIndex) : collectLeadingMetaLines(lines);
  const bodyLines = dividerIndex >= 0 ? lines.slice(dividerIndex + 1) : lines.slice(metaLines.length);
  const meta = parseMeta(metaLines);
  const body = trimBlankLines(bodyLines).join("\n").trim();

  const status = readStatus(meta.status);
  const severity = readSeverity(meta.severity);

  if (meta.status && !status) {
    warnings.push({
      line: startLine,
      message: `Invalid status "${meta.status}". Expected one of: ${Array.from(STATUSES).join(", ")}.`,
    });
  }

  if (meta.severity && !severity) {
    warnings.push({
      line: startLine,
      message: `Invalid severity "${meta.severity}". Expected one of: ${Array.from(SEVERITIES).join(", ")}.`,
    });
  }

  if (!body) {
    warnings.push({
      line: startLine,
      message: `Review comment ${meta.id ?? `rm-${index}`} has an empty body.`,
    });
  }

  return {
    comment: {
      id: meta.id ?? `rm-${index}`,
      author: meta.reviewer ?? meta.author,
      status: status ?? "open",
      severity: severity ?? "note",
      created: meta.created,
      body,
      source: {
        startLine,
        endLine,
      },
    },
    warnings,
  };
}

function parseMeta(lines: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const line of lines) {
    const match = /^([A-Za-z][\w-]*):\s*(.*?)\s*$/.exec(line);
    if (match) {
      meta[match[1].toLowerCase()] = match[2];
    }
  }
  return meta;
}

function collectLeadingMetaLines(lines: string[]): string[] {
  const metaLines: string[] = [];
  for (const line of lines) {
    if (/^([A-Za-z][\w-]*):\s*(.*?)\s*$/.test(line)) {
      metaLines.push(line);
      continue;
    }

    if (line.trim() === "" && metaLines.length > 0) {
      metaLines.push(line);
      continue;
    }

    break;
  }
  return metaLines;
}

function readStatus(value: string | undefined): ReviewMarkStatus | undefined {
  if (!value) return undefined;
  return STATUSES.has(value as ReviewMarkStatus) ? (value as ReviewMarkStatus) : undefined;
}

function readSeverity(value: string | undefined): ReviewMarkSeverity | undefined {
  if (!value) return undefined;
  return SEVERITIES.has(value as ReviewMarkSeverity) ? (value as ReviewMarkSeverity) : undefined;
}

function trimBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(start, end);
}

function extractMarkdownBlocks(markdown: string): ReviewMarkBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: ReviewMarkBlock[] = [];
  let lineIndex = 0;
  let offset = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    const lineStartOffset = offset;

    if (line.trim() === "") {
      offset += line.length + 1;
      lineIndex += 1;
      continue;
    }

    const startLine = lineIndex + 1;
    let endLine = startLine;
    let endOffset = lineStartOffset + line.length;
    const fence = /^(\s*)(`{3,}|~{3,})/.exec(line);

    if (fence) {
      const fenceMarker = fence[2][0];
      lineIndex += 1;
      offset += line.length + 1;

      while (lineIndex < lines.length) {
        const current = lines[lineIndex];
        endLine = lineIndex + 1;
        endOffset = offset + current.length;
        offset += current.length + 1;
        lineIndex += 1;

        if (current.trim().startsWith(fenceMarker.repeat(3))) {
          break;
        }
      }
    } else {
      lineIndex += 1;
      offset += line.length + 1;

      while (lineIndex < lines.length && lines[lineIndex].trim() !== "") {
        endLine = lineIndex + 1;
        endOffset = offset + lines[lineIndex].length;
        offset += lines[lineIndex].length + 1;
        lineIndex += 1;
      }
    }

    const blockMarkdown = markdown.slice(lineStartOffset, endOffset);
    blocks.push({
      index: blocks.length,
      startLine,
      endLine,
      startOffset: lineStartOffset,
      endOffset,
      markdown: blockMarkdown,
      excerpt: excerpt(blockMarkdown),
    });
  }

  return blocks;
}

function findTargetBlock(blocks: ReviewMarkBlock[], commentLine: number): ReviewMarkBlock | undefined {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index].endLine < commentLine) {
      return blocks[index];
    }
  }
  return undefined;
}

function countReviewOpenings(markdown: string): number {
  return markdown.match(/<!--\s*reviewmark\b/gi)?.length ?? 0;
}

function findDuplicateIds(comments: ReviewMarkComment[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const comment of comments) {
    if (seen.has(comment.id)) {
      duplicates.add(comment.id);
    }
    seen.add(comment.id);
  }
  return Array.from(duplicates);
}

function groupCommentsByBlock(comments: ReviewMarkComment[]): Map<number, ReviewMarkComment[]> {
  const groups = new Map<number, ReviewMarkComment[]>();
  for (const comment of comments) {
    if (!comment.target) continue;
    const commentsForBlock = groups.get(comment.target.blockIndex) ?? [];
    commentsForBlock.push(comment);
    groups.set(comment.target.blockIndex, commentsForBlock);
  }
  return groups;
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

      return `<section class="reviewmark-block${hasCommentsClass}" id="block-${block.index + 1}">
  <div class="reviewmark-block-content">${renderedBlock}</div>
  ${callouts ? `<div class="reviewmark-inline-comments">${callouts}</div>` : ""}
</section>`;
    })
    .join("\n");
}

function renderInlineComment(comment: ReviewMarkComment): string {
  return `<aside class="reviewmark-comment ${escapeHtml(comment.status)} ${escapeHtml(comment.severity)}" id="${escapeHtml(comment.id)}">
  <div class="reviewmark-comment-meta">
    <span>${escapeHtml(comment.severity)}</span>
    <span>${escapeHtml(comment.status)}</span>
  </div>
  ${comment.author ? `<div class="reviewmark-author">${escapeHtml(comment.author)}</div>` : ""}
  <div class="reviewmark-comment-body">${marked.parse(comment.body, { async: false }) as string}</div>
</aside>`;
}

function renderSidebar(comments: ReviewMarkComment[]): string {
  const items = comments
    .map((comment) => {
      const targetLink = comment.target ? `#block-${comment.target.blockIndex + 1}` : `#${comment.id}`;
      return `<li>
  <a href="${targetLink}">
    <strong>${escapeHtml(comment.id)}</strong>
    <span>${escapeHtml(comment.severity)} · ${escapeHtml(comment.status)}</span>
    <em>${escapeHtml(comment.target?.excerpt ?? "No target block")}</em>
  </a>
</li>`;
    })
    .join("");

  return `<aside class="reviewmark-sidebar" id="reviewmark-comments">
  <h2>Comments</h2>
  ${items ? `<ol>${items}</ol>` : `<p>No ReviewMark comments found.</p>`}
</aside>`;
}

function renderWarnings(warnings: ReviewMarkWarning[]): string {
  if (warnings.length === 0) return "";
  const items = warnings
    .map((warning) => `<li>Line ${warning.line}: ${escapeHtml(warning.message)}</li>`)
    .join("");
  return `<section class="reviewmark-warnings"><h2>Validation warnings</h2><ul>${items}</ul></section>`;
}

function lineNumberAt(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function excerpt(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/[#>*_`[\]()!-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
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
  color-scheme: light;
  --rm-bg: #f7f7f4;
  --rm-paper: #fffdfa;
  --rm-ink: #20211d;
  --rm-muted: #6b6d63;
  --rm-border: #dfddd4;
  --rm-accent: #2f6f73;
  --rm-accent-soft: #e2f1ef;
  --rm-issue: #a0461f;
  --rm-blocker: #9d2438;
  --rm-note: #53606f;
  --rm-shadow: 0 18px 50px rgba(42, 41, 34, 0.08);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--rm-bg);
  color: var(--rm-ink);
}

.reviewmark-shell {
  max-width: 1440px;
  margin: 0 auto;
  padding: 28px;
}

.reviewmark-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 10px 0 28px;
}

.reviewmark-header h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 48px);
  line-height: 1.02;
  letter-spacing: 0;
}

.reviewmark-header p {
  margin: 8px 0 0;
  color: var(--rm-muted);
  font-size: 15px;
}

.reviewmark-header a {
  color: var(--rm-accent);
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}

.reviewmark-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
  align-items: start;
}

.reviewmark-document,
.reviewmark-sidebar,
.reviewmark-warnings {
  background: var(--rm-paper);
  border: 1px solid var(--rm-border);
  box-shadow: var(--rm-shadow);
}

.reviewmark-document {
  padding: 26px;
}

.reviewmark-block {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid transparent;
  border-radius: 8px;
}

.reviewmark-block + .reviewmark-block {
  margin-top: 8px;
}

.reviewmark-block.has-comments {
  border-color: #c8dad6;
  background: #fbfffe;
}

.reviewmark-block-content > :first-child,
.reviewmark-comment-body > :first-child {
  margin-top: 0;
}

.reviewmark-block-content > :last-child,
.reviewmark-comment-body > :last-child {
  margin-bottom: 0;
}

.reviewmark-block-content {
  min-width: 0;
  font-size: 16px;
  line-height: 1.68;
}

.reviewmark-block-content h1,
.reviewmark-block-content h2,
.reviewmark-block-content h3 {
  line-height: 1.15;
  letter-spacing: 0;
}

.reviewmark-block-content h1 {
  font-size: 34px;
}

.reviewmark-block-content h2 {
  font-size: 26px;
}

.reviewmark-block-content code {
  background: #efeee8;
  border-radius: 4px;
  padding: 0.1em 0.3em;
}

.reviewmark-block-content pre {
  overflow: auto;
  background: #20211d;
  color: #f8f6ee;
  border-radius: 8px;
  padding: 16px;
}

.reviewmark-inline-comments {
  display: grid;
  gap: 10px;
}

.reviewmark-comment {
  border-left: 4px solid var(--rm-note);
  background: #f5f6f3;
  border-radius: 6px;
  padding: 12px 14px;
}

.reviewmark-comment.issue,
.reviewmark-comment.medium,
.reviewmark-comment.high {
  border-left-color: var(--rm-issue);
}

.reviewmark-comment.blocker,
.reviewmark-comment.critical {
  border-left-color: var(--rm-blocker);
}

.reviewmark-comment.suggestion,
.reviewmark-comment.low {
  border-left-color: var(--rm-accent);
}

.reviewmark-comment.resolved,
.reviewmark-comment.rejected {
  opacity: 0.66;
}

.reviewmark-comment-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  color: var(--rm-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.reviewmark-author {
  margin-bottom: 7px;
  color: var(--rm-ink);
  font-size: 13px;
  font-weight: 800;
}

.reviewmark-comment-body {
  font-size: 14px;
  line-height: 1.55;
}

.reviewmark-sidebar {
  position: sticky;
  top: 20px;
  padding: 20px;
  border-radius: 8px;
}

.reviewmark-sidebar h2,
.reviewmark-warnings h2 {
  margin: 0 0 14px;
  font-size: 16px;
}

.reviewmark-sidebar ol {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.reviewmark-sidebar a {
  display: grid;
  gap: 4px;
  padding: 12px;
  border-radius: 6px;
  background: var(--rm-accent-soft);
  color: var(--rm-ink);
  text-decoration: none;
}

.reviewmark-sidebar span {
  color: var(--rm-accent);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.reviewmark-sidebar em {
  color: var(--rm-muted);
  font-size: 13px;
  font-style: normal;
  line-height: 1.4;
}

.reviewmark-warnings {
  margin-bottom: 24px;
  padding: 18px 20px;
  border-radius: 8px;
}

.reviewmark-warnings li {
  color: var(--rm-blocker);
  font-size: 14px;
}

.reviewmark-empty {
  color: var(--rm-muted);
}

@media (max-width: 900px) {
  .reviewmark-shell {
    padding: 18px;
  }

  .reviewmark-layout {
    grid-template-columns: 1fr;
  }

  .reviewmark-sidebar {
    position: static;
  }
}
`;
