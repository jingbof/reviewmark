import { parseReviewMark } from "./parse.js";

export function stripReviewMarks(markdown: string): string {
  return parseReviewMark(markdown).strippedMarkdown;
}

export const stripReviewMark = stripReviewMarks;
