import { StrictMode, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { parseReviewMark, renderReviewMarkHtml, stripReviewMarks } from "@reviewmark/core";
import "./styles.css";

const sampleMarkdown = `# Payroll payrun matching

Use the bank debit date when matching payroll payruns to bank transactions.

<!-- reviewmark
id: rm-payrun-date
author: Ada
type: issue
status: open
~~~
Add one concrete example showing a provider pay date that differs from the bank debit date.
-->

## Matching rules

1. Prefer provider connection provenance when it is available.
2. Match against the debit date for cash movement.
3. Keep the pay date available for payroll-period reporting.

<!-- reviewmark
id: rm-scope
author: Lin
type: suggestion
status: open
~~~
This rule list is good, but it should state whether manual imports follow the same precedence.
-->

## Non-goals

ReviewMark v0 does not edit comments from the browser and does not require a backend.`;

const examples = [
  {
    title: "PRD review",
    markdown: sampleMarkdown,
  },
  {
    title: "Architecture note",
    markdown: `# Event pipeline

The ingestion service stores source events and emits normalized records for review.

<!-- reviewmark
id: rm-retry-policy
author: Priya
type: question
status: open
~~~
What retry policy applies after a downstream validation timeout?
-->

## Storage

Raw payloads are retained for seven days. Normalized records are retained for audit workflows.

<!-- reviewmark
id: rm-retention
author: Tomas
type: issue
status: open
~~~
Seven days may be too short for month-end reconciliation. Tie this to the audit requirement.
-->`,
  },
  {
    title: "Pricing draft",
    markdown: `# Pricing

ReviewMark is free for local Markdown files and open-source repositories.

<!-- reviewmark
id: rm-positioning
author: Mira
type: praise
status: open
~~~
The free local workflow is the right first promise. It makes the format feel portable instead of locked to a service.
-->

## Teams

Team features can add shared review dashboards later.

<!-- reviewmark
id: rm-teams
author: Ada
type: suggestion
status: resolved
~~~
Resolved: moved team dashboards out of v0 scope.
-->`,
  },
];

type Route = "/" | "/playground" | "/spec" | "/docs" | "/examples";

function App() {
  const [route, setRoute] = useState<Route>(readRoute());
  const [markdown, setMarkdown] = useState(sampleMarkdown);

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const document = useMemo(() => parseReviewMark(markdown), [markdown]);
  const previewHtml = useMemo(() => renderReviewMarkHtml(document, { title: "ReviewMark Live Preview" }), [document]);
  const cleanMarkdown = useMemo(() => stripReviewMarks(markdown), [markdown]);

  function navigate(nextRoute: Route) {
    if (nextRoute === route) return;
    window.history.pushState(null, "", nextRoute);
    setRoute(nextRoute);
  }

  function loadExample(nextMarkdown: string) {
    setMarkdown(nextMarkdown);
    navigate("/playground");
  }

  return (
    <div className="site-shell">
      <Header route={route} onNavigate={navigate} />
      <main>
        {(route === "/" || route === "/playground") && (
          <Playground
            markdown={markdown}
            setMarkdown={setMarkdown}
            previewHtml={previewHtml}
            comments={document.comments.length}
            diagnostics={document.diagnostics.length}
            cleanMarkdown={cleanMarkdown}
          />
        )}
        {route === "/spec" && <Spec />}
        {route === "/docs" && <Docs />}
        {route === "/examples" && <Examples onLoad={loadExample} />}
      </main>
    </div>
  );
}

function Header({ route, onNavigate }: { route: Route; onNavigate: (route: Route) => void }) {
  return (
    <header className="topbar">
      <button className="brand" type="button" onClick={() => onNavigate("/")}>
        <span className="brand-mark">RM</span>
        <span>ReviewMark</span>
      </button>
      <nav className="nav-links" aria-label="Primary">
        <NavButton label="Demo" route="/playground" current={route} onNavigate={onNavigate} />
        <NavButton label="Spec" route="/spec" current={route} onNavigate={onNavigate} />
        <NavButton label="Docs" route="/docs" current={route} onNavigate={onNavigate} />
        <NavButton label="Examples" route="/examples" current={route} onNavigate={onNavigate} />
        <a href="https://github.com/jingbof/reviewmark" rel="noreferrer" target="_blank">
          GitHub
        </a>
      </nav>
    </header>
  );
}

function NavButton({
  label,
  route,
  current,
  onNavigate,
}: {
  label: string;
  route: Route;
  current: Route;
  onNavigate: (route: Route) => void;
}) {
  return (
    <button className={current === route ? "active" : ""} type="button" onClick={() => onNavigate(route)}>
      {label}
    </button>
  );
}

function Playground({
  markdown,
  setMarkdown,
  previewHtml,
  comments,
  diagnostics,
  cleanMarkdown,
}: {
  markdown: string;
  setMarkdown: (value: string) => void;
  previewHtml: string;
  comments: number;
  diagnostics: number;
  cleanMarkdown: string;
}) {
  return (
    <section className="playground" aria-label="ReviewMark live demo">
      <div className="intro">
        <div>
          <h1>Markdown review comments that stay hidden until you need them.</h1>
          <p>
            Write normal Markdown. Add ReviewMark blocks as hidden HTML comments. Render them as attached side
            comments for humans, AI agents, CLIs, and IDE plugins.
          </p>
        </div>
        <div className="status-grid" aria-label="Current document status">
          <Stat label="Comments" value={comments} />
          <Stat label="Diagnostics" value={diagnostics} />
        </div>
      </div>

      <div className="workspace">
        <section className="pane editor-pane">
          <div className="pane-header">
            <div>
              <h2>Markdown</h2>
              <span>Editable source</span>
            </div>
            <button type="button" onClick={() => setMarkdown(sampleMarkdown)}>
              Reset
            </button>
          </div>
          <textarea
            aria-label="Editable ReviewMark Markdown"
            spellCheck={false}
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
          />
        </section>

        <section className="pane preview-pane">
          <div className="pane-header">
            <div>
              <h2>Preview</h2>
              <span>Rendered comments</span>
            </div>
            <span>Live</span>
          </div>
          <iframe title="Rendered ReviewMark preview" sandbox="" srcDoc={previewHtml} />
        </section>
      </div>

      <section className="strip-preview">
        <div>
          <h2>Clean Markdown remains clean</h2>
          <p>ReviewMark comments can be stripped when you need a comment-free artifact.</p>
        </div>
        <pre>{cleanMarkdown}</pre>
      </section>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Spec() {
  return (
    <ContentPage title="ReviewMark v0 Spec" deck="A tiny CommonMark-compatible convention for block-attached review comments.">
      <section>
        <h2>Syntax</h2>
        <pre>{`<!-- reviewmark
id: rm-example
author: Ada
type: issue
status: open
~~~
Comment body in Markdown.
-->`}</pre>
      </section>
      <section>
        <h2>Attachment model</h2>
        <p>
          A ReviewMark comment attaches to the nearest previous non-review Markdown block. That keeps source documents
          readable while preserving precise review context.
        </p>
      </section>
      <section>
        <h2>Metadata</h2>
        <ul>
          <li>
            <code>id</code> is optional and stable when supplied.
          </li>
          <li>
            <code>author</code> identifies the reviewer or agent.
          </li>
          <li>
            <code>type</code> is <code>note</code>, <code>issue</code>, <code>suggestion</code>, <code>question</code>,
            or <code>praise</code>.
          </li>
          <li>
            <code>status</code> is <code>open</code>, <code>resolved</code>, or <code>rejected</code>.
          </li>
        </ul>
      </section>
    </ContentPage>
  );
}

function Docs() {
  return (
    <ContentPage title="Docs" deck="Use ReviewMark from the browser, CLI, JetBrains plugin, or an agent skill.">
      <section>
        <h2>CLI</h2>
        <pre>{`reviewmark list spec.md
reviewmark validate spec.md
reviewmark render spec.md --out spec.review.html
reviewmark strip spec.md --out spec.clean.md
reviewmark preview spec.md`}</pre>
      </section>
      <section>
        <h2>JetBrains plugin</h2>
        <p>
          The WebStorm plugin adds a ReviewMark Preview tool window and editor actions for inserting comments and
          toggling comment status. It does not replace the built-in Markdown preview.
        </p>
      </section>
      <section>
        <h2>Agent skill</h2>
        <p>
          The repo includes a ReviewMark skill so coding agents can preserve existing comments, add new comments near
          the block under review, and validate syntax before finishing.
        </p>
      </section>
    </ContentPage>
  );
}

function Examples({ onLoad }: { onLoad: (markdown: string) => void }) {
  return (
    <ContentPage title="Examples" deck="Load a sample into the playground and see how comments attach to Markdown blocks.">
      <div className="example-list">
        {examples.map((example) => (
          <article className="example-row" key={example.title}>
            <div>
              <h2>{example.title}</h2>
              <p>{parseReviewMark(example.markdown).comments.length} ReviewMark comments</p>
            </div>
            <button type="button" onClick={() => onLoad(example.markdown)}>
              Open in demo
            </button>
          </article>
        ))}
      </div>
    </ContentPage>
  );
}

function ContentPage({ title, deck, children }: { title: string; deck: string; children: ReactNode }) {
  return (
    <section className="content-page">
      <div className="page-heading">
        <h1>{title}</h1>
        <p>{deck}</p>
      </div>
      <div className="content-grid">{children}</div>
    </section>
  );
}

function readRoute(): Route {
  const path = window.location.pathname;
  if (path === "/playground" || path === "/spec" || path === "/docs" || path === "/examples") return path;
  return "/";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
