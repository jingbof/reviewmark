package com.reviewmark.plugin

import com.intellij.openapi.Disposable
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.jcef.JBCefBrowser
import org.cef.browser.CefBrowser
import org.cef.handler.CefRequestHandlerAdapter
import org.cef.network.CefRequest
import java.awt.BorderLayout
import javax.swing.JPanel

class ReviewMarkPreviewPanel(
    private val project: Project,
    private val file: VirtualFile,
) : JPanel(BorderLayout()), Disposable {
    private val browser = JBCefBrowser()

    init {
        add(browser.component, BorderLayout.CENTER)
        browser.jbCefClient.addRequestHandler(object : CefRequestHandlerAdapter() {
            override fun onBeforeBrowse(
                browser: CefBrowser?,
                frame: org.cef.browser.CefFrame?,
                request: CefRequest?,
                user_gesture: Boolean,
                is_redirect: Boolean,
            ): Boolean {
                val url = request?.url ?: return false
                if (!url.startsWith("reviewmark://line/")) return false
                val line = url.removePrefix("reviewmark://line/").toIntOrNull() ?: return true
                FileEditorManager.getInstance(project).openTextEditor(OpenFileDescriptor(project, file, (line - 1).coerceAtLeast(0), 0), true)
                return true
            }
        }, browser.cefBrowser)
        Disposer.register(this, browser)
        refresh()
    }

    fun refresh() {
        val html = when (val result = ReviewMarkRenderer.render(file.path, ReviewMarkSettings.getInstance().state)) {
            is RenderResult.Success -> result.html
            is RenderResult.Failure -> errorHtml(result.message)
        }
        browser.loadHTML(html)
    }

    override fun dispose() = Unit

    private fun errorHtml(message: String): String {
        val escaped = message
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        return """
            <!doctype html>
            <html>
            <head>
              <style>
                :root {
                  color-scheme: light dark;
                  --bg: #f6f7f4;
                  --text: #20221e;
                  --muted: #687069;
                  --panel: #fffefa;
                  --border: #deded5;
                  --accent: #2f6f73;
                }
                @media (prefers-color-scheme: dark) {
                  :root {
                    --bg: #07090d;
                    --text: #eef3f8;
                    --muted: #9aa5b4;
                    --panel: #0c1017;
                    --border: #222b38;
                    --accent: #45d0e8;
                  }
                }
                body {
                  margin: 0;
                  font-family: system-ui, sans-serif;
                  padding: 24px;
                  background:
                    radial-gradient(circle at 50% -20%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 28rem),
                    var(--bg);
                  color: var(--text);
                }
                h2 { margin-top: 0; color: var(--text); }
                pre {
                  white-space: pre-wrap;
                  overflow: auto;
                  padding: 16px;
                  border: 1px solid var(--border);
                  border-radius: 8px;
                  background: var(--panel);
                  color: var(--text);
                }
                p { color: var(--muted); }
              </style>
            </head>
            <body>
              <h2>ReviewMark render failed</h2>
              <p>ReviewMark keeps comments inside Markdown. The JetBrains preview could not render this file.</p>
              <pre>$escaped</pre>
            </body>
            </html>
        """.trimIndent()
    }
}
