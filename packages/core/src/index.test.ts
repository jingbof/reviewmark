import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseReviewMark,
  renderReviewMarkHtml,
  stripReviewMark,
  stripReviewMarks,
  validateReviewMark,
} from "./index.ts";

const sample = `# Payment matching

Use debit date when matching payroll payruns.

<!-- reviewmark
id: rm-date
author: Ada
type: issue
status: open
---
This needs an example that covers bank-posted timing.
-->

## Follow-up

Keep the implementation scoped.`;

describe("parseReviewMark", () => {
  it("parses one ReviewMark comment with metadata and body", () => {
    const doc = parseReviewMark(sample);

    assert.equal(doc.comments.length, 1);
    assert.equal(doc.comments[0].id, "rm-date");
    assert.equal(doc.comments[0].metadata.author, "Ada");
    assert.equal(doc.comments[0].metadata.type, "issue");
    assert.equal(doc.comments[0].metadata.status, "open");
    assert.equal(doc.comments[0].body, "This needs an example that covers bank-posted timing.");
  });

  it("defaults author, type, and status", () => {
    const doc = parseReviewMark(`Paragraph.

<!-- reviewmark
---
Comment body.
-->`);

    assert.equal(doc.comments[0].metadata.author, "unknown");
    assert.equal(doc.comments[0].metadata.type, "note");
    assert.equal(doc.comments[0].metadata.status, "open");
  });

  it("generates a stable id from author, body, and start line", () => {
    const markdown = `Paragraph.

<!-- reviewmark
author: Codex
---
Generated id comment.
-->`;
    const first = parseReviewMark(markdown).comments[0].id;
    const second = parseReviewMark(markdown).comments[0].id;

    assert.match(first, /^rm_[a-f0-9]{8}$/);
    assert.equal(first, second);
  });

  it("normalizes legacy severity metadata into type", () => {
    const doc = parseReviewMark(`Paragraph.

<!-- reviewmark
severity: suggestion
---
Legacy comment.
-->`);

    assert.equal(doc.comments[0].metadata.type, "suggestion");
    assert.equal(doc.diagnostics.length, 0);
  });

  it("attaches a comment to the nearest previous block", () => {
    const doc = parseReviewMark(sample);

    assert.equal(doc.comments[0].attachedToBlockIndex, 1);
    assert.equal(doc.attachedReviews[0].block.text, "Use debit date when matching payroll payruns.");
  });

  it("attaches multiple consecutive comments to the same block", () => {
    const doc = parseReviewMark(`Paragraph under review.

<!-- reviewmark
id: rm-one
---
First comment.
-->

<!-- reviewmark
id: rm-two
---
Second comment.
-->`);

    assert.equal(doc.attachedReviews.length, 1);
    assert.deepEqual(
      doc.attachedReviews[0].comments.map((comment) => comment.id),
      ["rm-one", "rm-two"],
    );
  });

  it("reports orphan comments before any Markdown block", () => {
    const doc = parseReviewMark(`<!-- reviewmark
id: rm-orphan
---
No target.
-->

Paragraph.`);

    assert.equal(doc.comments[0].attachedToBlockIndex, undefined);
    assert.equal(doc.diagnostics[0].code, "orphan_comment");
  });

  it("reports invalid status and type without crashing", () => {
    const diagnostics = validateReviewMark(`Paragraph.

<!-- reviewmark
status: pending
type: risk
---
Invalid metadata.
-->`);

    assert.deepEqual(
      diagnostics.map((diagnostic) => diagnostic.code).sort(),
      ["invalid_status", "invalid_type"],
    );
  });

  it("strips hidden review blocks", () => {
    const stripped = stripReviewMarks(sample);

    assert.equal(stripped.includes("reviewmark"), false);
    assert.equal(stripped.includes("This needs an example"), false);
    assert.equal(stripped.includes("Use debit date"), true);
    assert.equal(stripReviewMark(sample), stripped);
  });

  it("renders comment HTML and diagnostics", () => {
    const html = renderReviewMarkHtml(sample, { title: "Spec" });

    assert.equal(html.includes("rm-date"), true);
    assert.equal(html.includes("This needs an example"), true);
    assert.equal(html.includes("<title>Spec</title>"), true);
  });
});
