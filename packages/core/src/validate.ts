import { parseReviewMark } from "./parse.js";
import type { ReviewMarkDiagnostic } from "./types.js";

export function validateReviewMark(markdown: string): ReviewMarkDiagnostic[] {
  return parseReviewMark(markdown).diagnostics;
}
