export type ReviewMarkType = "note" | "issue" | "suggestion" | "question" | "praise";

export type ReviewMarkStatus = "open" | "resolved" | "rejected";

export type ReviewMarkMetadata = {
  id: string;
  author: string;
  type: ReviewMarkType;
  status: ReviewMarkStatus;
  created_at?: string;
};

export type MarkdownBlockType =
  | "heading"
  | "paragraph"
  | "list"
  | "blockquote"
  | "code"
  | "table"
  | "thematicBreak"
  | "unknown";

export type MarkdownBlock = {
  index: number;
  type: MarkdownBlockType;
  text: string;
  markdown: string;
  startLine?: number;
  endLine?: number;
};

export type ReviewMarkComment = {
  id: string;
  metadata: ReviewMarkMetadata;
  body: string;
  raw: string;
  startLine?: number;
  endLine?: number;
  attachedToBlockIndex?: number;
};

export type AttachedReview = {
  block: MarkdownBlock;
  comments: ReviewMarkComment[];
};

export type ReviewMarkDiagnostic = {
  level: "error" | "warning";
  code: string;
  message: string;
  line?: number;
};

export type ReviewMarkDocument = {
  markdown: string;
  strippedMarkdown: string;
  blocks: MarkdownBlock[];
  comments: ReviewMarkComment[];
  attachedReviews: AttachedReview[];
  diagnostics: ReviewMarkDiagnostic[];
};
