import type {
  AttachedReview,
  MarkdownBlock,
  MarkdownBlockType,
  ReviewMarkComment,
  ReviewMarkDiagnostic,
  ReviewMarkDocument,
  ReviewMarkMetadata,
  ReviewMarkStatus,
  ReviewMarkType,
} from "./types.js";

const REVIEW_COMMENT_RE = /<!--\s*reviewmark\b([\s\S]*?)-->/gi;
const CANONICAL_BODY_SEPARATOR = "~~~";
const LEGACY_BODY_SEPARATOR = "---";
const BODY_SEPARATORS = new Set([CANONICAL_BODY_SEPARATOR, LEGACY_BODY_SEPARATOR]);
const STATUSES = new Set<ReviewMarkStatus>(["open", "resolved", "rejected"]);
const TYPES = new Set<ReviewMarkType>(["note", "issue", "suggestion", "question", "praise"]);
const SEVERITY_TO_TYPE: Record<string, ReviewMarkType | undefined> = {
  note: "note",
  low: "note",
  medium: "issue",
  high: "issue",
  critical: "issue",
  suggestion: "suggestion",
  issue: "issue",
  blocker: "issue",
};

type PendingComment = {
  comment: ReviewMarkComment;
  strippedStartOffset: number;
};

export function parseReviewMark(markdown: string): ReviewMarkDocument {
  const diagnostics: ReviewMarkDiagnostic[] = [];
  const pendingComments: PendingComment[] = [];
  let strippedMarkdown = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  REVIEW_COMMENT_RE.lastIndex = 0;

  while ((match = REVIEW_COMMENT_RE.exec(markdown)) !== null) {
    const [raw, inner = ""] = match;
    const startIndex = match.index;
    const endIndex = startIndex + raw.length;
    const startLine = lineNumberAt(markdown, startIndex);
    const endLine = lineNumberAt(markdown, endIndex);

    strippedMarkdown += markdown.slice(lastIndex, startIndex);

    const parsed = parseCommentInner(inner, raw, startLine, endLine);
    diagnostics.push(...parsed.diagnostics);
    pendingComments.push({
      comment: parsed.comment,
      strippedStartOffset: strippedMarkdown.length,
    });

    lastIndex = endIndex;
  }

  strippedMarkdown += markdown.slice(lastIndex);

  const unmatchedOpenings = countReviewOpenings(markdown) - pendingComments.length;
  if (unmatchedOpenings > 0) {
    diagnostics.push({
      level: "error",
      code: "unclosed_comment",
      message: `${unmatchedOpenings} ReviewMark comment block(s) were opened but not closed.`,
      line: 1,
    });
  }

  const blocks = extractMarkdownBlocks(strippedMarkdown);
  const comments = pendingComments.map(({ comment, strippedStartOffset }) => {
    const target = findTargetBlock(blocks, lineNumberAt(strippedMarkdown, strippedStartOffset));
    if (!target) {
      diagnostics.push({
        level: "warning",
        code: "orphan_comment",
        message: `ReviewMark comment "${comment.id}" does not have a previous Markdown block to attach to.`,
        line: comment.startLine,
      });
      return comment;
    }

    return {
      ...comment,
      attachedToBlockIndex: target.index,
    };
  });

  for (const id of findDuplicateIds(comments)) {
    diagnostics.push({
      level: "warning",
      code: "duplicate_id",
      message: `Duplicate ReviewMark id "${id}".`,
      line: comments.find((comment) => comment.id === id)?.startLine,
    });
  }

  return {
    markdown,
    strippedMarkdown,
    blocks,
    comments,
    attachedReviews: attachReviews(blocks, comments),
    diagnostics,
  };
}

function parseCommentInner(
  inner: string,
  raw: string,
  startLine: number,
  endLine: number,
): { comment: ReviewMarkComment; diagnostics: ReviewMarkDiagnostic[] } {
  const diagnostics: ReviewMarkDiagnostic[] = [];
  const normalized = inner.replace(/^\s*\n/, "").replace(/\s+$/, "");
  const lines = normalized.split(/\r?\n/);
  const dividerIndex = lines.findIndex((line) => BODY_SEPARATORS.has(line.trim()));
  const metaLines = dividerIndex >= 0 ? lines.slice(0, dividerIndex) : collectLeadingMetaLines(lines);
  const bodyLines = dividerIndex >= 0 ? lines.slice(dividerIndex + 1) : lines.slice(metaLines.length);
  const meta = parseMeta(metaLines);
  const body = trimBlankLines(bodyLines).join("\n").trim();
  const author = meta.author ?? meta.reviewer ?? "unknown";
  const type = readType(meta, diagnostics, startLine);
  const status = readStatus(meta.status, diagnostics, startLine);
  const id = meta.id ?? stableCommentId(author, body, startLine);

  if (dividerIndex < 0 && metaLines.length > 0) {
    diagnostics.push({
      level: "warning",
      code: "missing_separator",
      message: `ReviewMark comment "${id}" has metadata but no "${CANONICAL_BODY_SEPARATOR}" body separator.`,
      line: startLine,
    });
  }

  if (lines[dividerIndex]?.trim() === LEGACY_BODY_SEPARATOR) {
    diagnostics.push({
      level: "warning",
      code: "legacy_separator",
      message: `ReviewMark comment "${id}" uses legacy "${LEGACY_BODY_SEPARATOR}" separator. Use "${CANONICAL_BODY_SEPARATOR}" so built-in Markdown previews keep the HTML comment hidden safely.`,
      line: startLine,
    });
  }

  if (!body) {
    diagnostics.push({
      level: "warning",
      code: "empty_body",
      message: `ReviewMark comment "${id}" has an empty body.`,
      line: startLine,
    });
  }

  const metadata: ReviewMarkMetadata = {
    id,
    author,
    type,
    status,
    created_at: meta.created_at ?? meta.created,
  };

  return {
    comment: {
      id,
      metadata,
      body,
      raw,
      startLine,
      endLine,
    },
    diagnostics,
  };
}

function readType(meta: Record<string, string>, diagnostics: ReviewMarkDiagnostic[], line: number): ReviewMarkType {
  if (meta.type) {
    if (TYPES.has(meta.type as ReviewMarkType)) {
      return meta.type as ReviewMarkType;
    }
    diagnostics.push({
      level: "warning",
      code: "invalid_type",
      message: `Invalid ReviewMark type "${meta.type}". Expected one of: ${Array.from(TYPES).join(", ")}.`,
      line,
    });
    return "note";
  }

  if (meta.severity) {
    const mapped = SEVERITY_TO_TYPE[meta.severity];
    if (mapped) {
      return mapped;
    }
    diagnostics.push({
      level: "warning",
      code: "invalid_type",
      message: `Invalid ReviewMark severity "${meta.severity}". Expected a known type or legacy severity.`,
      line,
    });
  }

  return "note";
}

function readStatus(value: string | undefined, diagnostics: ReviewMarkDiagnostic[], line: number): ReviewMarkStatus {
  if (!value) {
    return "open";
  }
  if (STATUSES.has(value as ReviewMarkStatus)) {
    return value as ReviewMarkStatus;
  }
  diagnostics.push({
    level: "warning",
    code: "invalid_status",
    message: `Invalid ReviewMark status "${value}". Expected one of: ${Array.from(STATUSES).join(", ")}.`,
    line,
  });
  return "open";
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

function trimBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(start, end);
}

function extractMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
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
    const blockType = detectBlockType(lines, lineIndex);
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
        if (blockType === "table" && !looksLikeTableContinuation(lines, lineIndex)) {
          break;
        }
        endLine = lineIndex + 1;
        endOffset = offset + lines[lineIndex].length;
        offset += lines[lineIndex].length + 1;
        lineIndex += 1;
      }
    }

    const blockMarkdown = markdown.slice(lineStartOffset, endOffset);
    blocks.push({
      index: blocks.length,
      type: blockType,
      text: excerpt(blockMarkdown, 400),
      markdown: blockMarkdown,
      startLine,
      endLine,
    });
  }

  return blocks;
}

function detectBlockType(lines: string[], index: number): MarkdownBlockType {
  const line = lines[index];
  if (/^\s{0,3}#{1,6}\s+/.test(line)) return "heading";
  if (/^\s{0,3}(`{3,}|~{3,})/.test(line)) return "code";
  if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) return "thematicBreak";
  if (/^\s{0,3}(?:[-+*]|\d+[.)])\s+/.test(line)) return "list";
  if (/^\s{0,3}>/.test(line)) return "blockquote";
  if (line.includes("|") && lines[index + 1] && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])) {
    return "table";
  }
  return "paragraph";
}

function looksLikeTableContinuation(lines: string[], index: number): boolean {
  return lines[index].includes("|");
}

function findTargetBlock(blocks: MarkdownBlock[], commentLine: number): MarkdownBlock | undefined {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const endLine = blocks[index].endLine ?? 0;
    if (endLine < commentLine) {
      return blocks[index];
    }
  }
  return undefined;
}

function attachReviews(blocks: MarkdownBlock[], comments: ReviewMarkComment[]): AttachedReview[] {
  const reviews = new Map<number, ReviewMarkComment[]>();
  for (const comment of comments) {
    if (comment.attachedToBlockIndex === undefined) continue;
    const existing = reviews.get(comment.attachedToBlockIndex) ?? [];
    existing.push(comment);
    reviews.set(comment.attachedToBlockIndex, existing);
  }

  return blocks
    .filter((block) => reviews.has(block.index))
    .map((block) => ({
      block,
      comments: reviews.get(block.index) ?? [],
    }));
}

function findDuplicateIds(comments: ReviewMarkComment[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const comment of comments) {
    if (seen.has(comment.id)) duplicates.add(comment.id);
    seen.add(comment.id);
  }
  return Array.from(duplicates);
}

function countReviewOpenings(markdown: string): number {
  return markdown.match(/<!--\s*reviewmark\b/gi)?.length ?? 0;
}

function stableCommentId(author: string, body: string, startLine: number): string {
  return `rm_${fnv1a(`${author}\n${body}\n${startLine}`)}`;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function lineNumberAt(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function excerpt(markdown: string, max: number): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/[#>*_`[\]()!-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
