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
const runOnceCommand = "npx reviewmarks preview review.md";
const installCommand = "npm install -g reviewmarks";

function App() {
  const [route, setRoute] = useState<Route>(readRoute());
  const [markdown, setMarkdown] = useState(sampleMarkdown);

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const document = useMemo(() => parseReviewMark(markdown), [markdown]);
  const previewHtml = useMemo(() => forceDarkPreview(renderReviewMarkHtml(document, { title: "ReviewMark Live Preview" })), [document]);
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
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path d="M5 18.5V6.2A2.2 2.2 0 0 1 7.2 4h9.6A2.2 2.2 0 0 1 19 6.2v7.9a2.2 2.2 0 0 1-2.2 2.2H9.1L5 20v-1.5Z" />
            <path d="m8.2 11.8 2.7-3.1 2.2 2.2 2.7-3.2" />
          </svg>
        </span>
        <span>ReviewMark</span>
      </button>
      <nav className="nav-links" aria-label="Primary">
        <NavButton label="Docs" route="/docs" current={route} onNavigate={onNavigate} />
        <a href="https://github.com/jingbof/reviewmark" rel="noreferrer" target="_blank">
          GitHub
        </a>
        <button className="nav-cta" type="button" onClick={() => onNavigate("/playground")}>
          Try demo
        </button>
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
  const detailItems = [
    "CommonMark-compatible",
    "CLI + WebStorm plugin",
    "Review comments in Markdown",
    "Portable source, enhanced preview",
  ];

  return (
    <section className="playground" aria-label="ReviewMark live demo">
      <div className="intro">
        <div className="hero-copy">
          <h1>Review comments for Markdown, without breaking CommonMark.</h1>
          <p>
            ReviewMark keeps annotations in portable Markdown comments, then renders them as a clean review layer beside
            the document.
          </p>
        </div>
        <div className="install-card" aria-label="CLI install">
          <CommandCopy label="Run once" command={runOnceCommand} />
          <CommandCopy label="Install globally" command={installCommand} />
        </div>
        <div className="signal-line" aria-label="Technical details">
          {detailItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <div className="workspace">
        <section className="pane editor-pane">
          <div className="pane-header">
            <div className="file-label">
              <span className="file-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="M4 2.5h5.2L12 5.3v8.2H4z" />
                  <path d="M9.2 2.5v2.8H12" />
                </svg>
              </span>
              <div>
                <h2>review.md</h2>
                <span>Markdown source</span>
              </div>
            </div>
            <div className="pane-actions">
              <StatusDot label={`${comments} comments`} />
              <StatusDot label={`${diagnostics} diagnostics`} muted={diagnostics === 0} />
              <button type="button" onClick={() => setMarkdown(sampleMarkdown)}>
                Reset
              </button>
            </div>
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
            <div className="file-label">
              <span className="file-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="M2.5 8s2.1-3.4 5.5-3.4S13.5 8 13.5 8 11.4 11.4 8 11.4 2.5 8 2.5 8Z" />
                  <path d="M8 6.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z" />
                </svg>
              </span>
              <div>
                <h2>Rendered Preview</h2>
                <span>Review layer</span>
              </div>
            </div>
            <div className="pane-actions">
              <span>{comments} comments</span>
              <span>Live</span>
            </div>
          </div>
          <iframe title="Rendered ReviewMark preview" sandbox="" srcDoc={previewHtml} />
        </section>
      </div>

      <section className="strip-preview">
        <div>
          <h2>Hidden in source. Visible in review.</h2>
          <p>ReviewMark comments can be stripped, validated, or rendered without changing the underlying document.</p>
        </div>
        <pre>{cleanMarkdown}</pre>
      </section>
      <section className="feature-rail" aria-label="ReviewMark capabilities">
        <article>
          <span>01</span>
          <h2>Agent safe</h2>
          <p>Multiple reviewers can leave separate hidden blocks without rewriting the document.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Renderer portable</h2>
          <p>The same parser powers the browser demo, CLI output, and JetBrains preview.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Markdown first</h2>
          <p>Normal Markdown preview stays readable because comments are stored as HTML comments.</p>
        </article>
      </section>
    </section>
  );
}

function CommandCopy({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(command);
      } else {
        fallbackCopy(command);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      fallbackCopy(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  }

  return (
    <div className="command-copy">
      <span>{label}</span>
      <div className="command-line">
        <code>{command}</code>
        <button type="button" onClick={copyCommand} aria-label={`Copy command: ${command}`}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function fallbackCopy(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function StatusDot({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span className={muted ? "status-dot muted" : "status-dot"}>
      <span aria-hidden="true" />
      {label}
    </span>
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

function forceDarkPreview(html: string): string {
  const css = `
    :root {
      color-scheme: dark;
      --rm-bg: #070a0f;
      --rm-paper: #0b1017;
      --rm-ink: #f2f7fb;
      --rm-muted: #8d98a8;
      --rm-border: #222b38;
      --rm-accent: #58d6bd;
      --rm-accent-soft: #0e2425;
      --rm-issue: #ff6f8d;
      --rm-critical: #ff6f9d;
      --rm-praise: #83e29e;
      --rm-note: #9bb2ff;
      --rm-shadow: none;
    }
    * { scrollbar-color: #263241 #090d13; }
    body {
      background:
        linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        #070a0f;
      background-size: 32px 32px;
    }
    .reviewmark-shell { max-width: 1280px; padding: 26px; }
    .reviewmark-header { display: none; }
    .reviewmark-layout { grid-template-columns: minmax(0, 1fr) minmax(210px, 280px); gap: 14px; }
    .reviewmark-document, .reviewmark-sidebar, .reviewmark-diagnostics {
      background: rgba(11, 16, 23, 0.96);
      border-color: #222b38;
      border-radius: 10px;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.26);
    }
    .reviewmark-document { padding: 26px; }
    .reviewmark-block { border-radius: 7px; padding: 15px 16px; }
    .reviewmark-block.has-comments {
      border-color: rgba(88, 214, 189, 0.3);
      background: rgba(12, 28, 29, 0.7);
    }
    .reviewmark-block-content h1 { font-size: 30px; letter-spacing: 0; }
    .reviewmark-block-content h2 { font-size: 22px; margin-top: 0; }
    .reviewmark-block-content { color: #dce4ee; font-size: 14px; line-height: 1.65; }
    .reviewmark-block-content li::marker { color: #58d6bd; }
    .reviewmark-comment {
      border-left-width: 3px;
      background: rgba(16, 22, 31, 0.96);
      border-radius: 8px;
    }
    .reviewmark-comment-meta { color: #9ba7b7; letter-spacing: 0; text-transform: none; }
    .reviewmark-comment.issue { border-left-color: #ff6f8d; }
    .reviewmark-comment.suggestion { border-left-color: #58d6bd; }
    .reviewmark-sidebar { top: 18px; padding: 17px; }
    .reviewmark-sidebar h2 { font-size: 13px; letter-spacing: 0.02em; text-transform: uppercase; color: #cbd5e1; }
    .reviewmark-sidebar a {
      border: 1px solid rgba(141, 152, 168, 0.14);
      background: rgba(88, 214, 189, 0.075);
    }
    .reviewmark-sidebar strong { font-size: 13px; }
    .reviewmark-sidebar span { color: #58d6bd; font-size: 11px; letter-spacing: 0; }
    @media (max-width: 760px) {
      .reviewmark-shell { padding: 18px; }
      .reviewmark-layout { grid-template-columns: 1fr; }
    }
  `;
  return html.replace("</style>", `${css}</style>`);
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
