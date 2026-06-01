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
const syntaxSnippet = `## Matching rules

1. Prefer provider connection provenance.

<!-- reviewmark
id: rm-scope
author: Ada
type: suggestion
status: open
~~~
State whether manual imports follow the same path.
-->`;

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
            <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="4.75" />
            <path d="m7.2 9.4 2.55 2.55-2.55 2.55" />
            <path d="M12.1 14.5h4.45" />
            <circle cx="17.1" cy="6.9" r="2.25" />
          </svg>
        </span>
        <span>ReviewMark</span>
      </button>
      <nav className="nav-links" aria-label="Primary">
        <NavButton label="Docs" route="/docs" current={route} onNavigate={onNavigate} />
        <a className="github-link" href="https://github.com/jingbof/reviewmark" rel="noreferrer" target="_blank">
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="M8 .2a8 8 0 0 0-2.5 15.6c.4.1.5-.2.5-.4v-1.4c-2.1.5-2.6-.9-2.6-.9-.3-.8-.8-1-.8-1-.7-.5.1-.5.1-.5.7.1 1.1.8 1.1.8.7 1.1 1.8.8 2.2.6.1-.5.3-.8.5-1-1.7-.2-3.5-.9-3.5-3.9 0-.9.3-1.6.8-2.2-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.7 7.7 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.2 0 3-1.8 3.6-3.5 3.8.3.2.5.7.5 1.4v2.1c0 .2.1.5.5.4A8 8 0 0 0 8 .2Z" />
          </svg>
          <span>GitHub</span>
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
    "Agent skill included",
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
          <CommandCopy label="Install CLI" command={installCommand} />
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

      <HowItWorks cleanMarkdown={cleanMarkdown} />
      <SyntaxSection />
      <GetStarted />
    </section>
  );
}

function HowItWorks({ cleanMarkdown }: { cleanMarkdown: string }) {
  return (
    <section className="section-block" id="how-it-works">
      <div className="section-heading">
        <span>How it works</span>
        <h2>Comments live in the file. The preview does the review work.</h2>
        <p>ReviewMark keeps source Markdown portable, then renders hidden comments as anchored annotations.</p>
      </div>
      <div className="feature-rail" aria-label="ReviewMark capabilities">
        <article>
          <span>01</span>
          <h3>Invisible to Markdown renderers</h3>
          <p>Comments are ordinary HTML comments, so GitHub, npm, and static-site generators keep showing clean Markdown.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Anchored to the reviewed block</h3>
          <p>Each note attaches to the nearest previous Markdown block and renders in the margin beside it.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Tooling that travels</h3>
          <p>The same parser powers the browser demo, CLI output, WebStorm preview, and agent skill.</p>
        </article>
      </div>
      <div className="source-strip">
        <div>
          <h3>Portable source, enhanced preview</h3>
          <p>Strip or validate ReviewMark comments without changing the underlying document.</p>
        </div>
        <pre>{cleanMarkdown}</pre>
      </div>
    </section>
  );
}

function SyntaxSection() {
  return (
    <section className="section-block" id="syntax">
      <div className="section-heading">
        <span>Syntax</span>
        <h2>A normal HTML comment with typed review metadata.</h2>
        <p>The comment body is Markdown, and the whole block stays invisible to standard CommonMark rendering.</p>
      </div>
      <div className="syntax-grid">
        <pre>{syntaxSnippet}</pre>
        <div className="steps">
          <article>
            <span>1</span>
            <div>
              <h3>Open with <code>&lt;!-- reviewmark</code></h3>
              <p>It is plain Markdown-compatible HTML comment syntax.</p>
            </div>
          </article>
          <article>
            <span>2</span>
            <div>
              <h3>Add metadata</h3>
              <p><code>id</code>, <code>author</code>, <code>type</code>, and <code>status</code> drive the rendered note.</p>
            </div>
          </article>
          <article>
            <span>3</span>
            <div>
              <h3>Separate body with <code>~~~</code></h3>
              <p>The body can include Markdown and renders inside the review card.</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function GetStarted() {
  return (
    <section className="section-block get-started" id="get-started">
      <div className="section-heading">
        <span>Get started</span>
        <h2>Install once, then preview or lint any Markdown file.</h2>
        <p>Use the global CLI for local docs, CI checks, and generated review HTML.</p>
      </div>
      <div className="command-stack">
        <CommandCopy label="Install" command={installCommand} />
        <CommandCopy label="Preview" command={runOnceCommand.replace("npx reviewmarks", "reviewmark")} />
        <CommandCopy label="Validate" command="reviewmark validate review.md" />
      </div>
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
        <pre>{`npx skills add jingbof/reviewmark --skill reviewmark`}</pre>
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
      --rm-accent: #45d0e8;
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
    .reviewmark-document, .reviewmark-diagnostics {
      background: rgba(11, 16, 23, 0.96);
      border-color: #222b38;
      border-radius: 10px;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.26);
    }
    .reviewmark-document { padding: 26px; }
    .reviewmark-row {
      grid-template-columns: minmax(0, 1fr) minmax(190px, 250px);
      gap: 16px;
    }
    .reviewmark-block { border-radius: 7px; padding: 13px 16px; }
    .reviewmark-row.has-comments .reviewmark-block::before {
      background: #45d0e8;
      opacity: 0.8;
    }
    .reviewmark-row.has-comments:hover .reviewmark-block {
      background: rgba(69, 208, 232, 0.075);
    }
    .reviewmark-block-content h1 { font-size: 30px; letter-spacing: 0; }
    .reviewmark-block-content h2 { font-size: 22px; margin-top: 0; }
    .reviewmark-block-content { color: #dce4ee; font-size: 14px; line-height: 1.65; }
    .reviewmark-block-content li::marker { color: #45d0e8; }
    .reviewmark-comment {
      border-left-width: 2px;
      background: rgba(16, 22, 31, 0.96);
      border-radius: 8px;
    }
    .reviewmark-comment.issue { --rm-comment-color: #ff8a6b; }
    .reviewmark-comment.suggestion { --rm-comment-color: #45d0e8; }
    .reviewmark-comment.question { --rm-comment-color: #b596f0; }
    .reviewmark-comment.praise { --rm-comment-color: #83e29e; }
    @media (max-width: 560px) {
      .reviewmark-shell { padding: 18px; }
      .reviewmark-row { grid-template-columns: 1fr; }
    }
  `;
  return html.replace("<head>", `<head><base href="about:srcdoc">`).replace("</style>", `${css}</style>`);
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
