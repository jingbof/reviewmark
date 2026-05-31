import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReviewMark, renderReviewMarkHtml, stripReviewMark } from "./index.ts";

const sample = `# Payment matching

Use debit date when matching payroll payruns.

<!-- reviewmark
id: rm-date
author: Ada
severity: issue
status: open
---
This needs an example that covers bank-posted timing.
-->

## Follow-up

Keep the implementation scoped.`;

describe("parseReviewMark", () => {
  it("extracts comments and attaches them to the previous block", () => {
    const doc = parseReviewMark(sample);

    assert.equal(doc.comments.length, 1);
    assert.equal(doc.comments[0].id, "rm-date");
    assert.equal(doc.comments[0].severity, "issue");
    assert.equal(doc.comments[0].target?.excerpt, "Use debit date when matching payroll payruns.");
  });

  it("strips hidden review blocks", () => {
    const stripped = stripReviewMark(sample);

    assert.equal(stripped.includes("reviewmark"), false);
    assert.equal(stripped.includes("This needs an example"), false);
    assert.equal(stripped.includes("Use debit date"), true);
  });

  it("renders comment HTML", () => {
    const html = renderReviewMarkHtml(sample, { title: "Spec" });

    assert.equal(html.includes("rm-date"), true);
    assert.equal(html.includes("This needs an example"), true);
    assert.equal(html.includes("<title>Spec</title>"), true);
  });
});
