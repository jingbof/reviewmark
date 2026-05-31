package com.reviewmark.plugin

import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.components.JBLabel
import com.intellij.util.ui.JBUI
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowManager
import java.awt.BorderLayout
import java.util.concurrent.ConcurrentHashMap
import javax.swing.JPanel
import javax.swing.SwingConstants

@Service(Service.Level.PROJECT)
class ReviewMarkPreviewService(private val project: Project) : Disposable {
    private val panels = ConcurrentHashMap<String, ReviewMarkPreviewPanel>()

    fun openPreview(file: VirtualFile) {
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID) ?: return
        openPreview(file, toolWindow, showToolWindow = true)
    }

    fun syncWithSelectedEditor(toolWindow: ToolWindow, showToolWindow: Boolean = false) {
        val file = selectedReviewMarkFile() ?: run {
            ensureEmptyState(toolWindow)
            return
        }
        openPreview(file, toolWindow, showToolWindow)
    }

    private fun openPreview(file: VirtualFile, toolWindow: ToolWindow, showToolWindow: Boolean) {
        val contentManager = toolWindow.contentManager
        val existingPanel = panels[file.path]
        if (existingPanel != null) {
            val existingContent = contentManager.contents.firstOrNull { it.component == existingPanel }
            if (existingContent != null) {
                contentManager.setSelectedContent(existingContent)
                existingPanel.refresh()
                if (showToolWindow) toolWindow.show()
                return
            }
            panels.remove(file.path)
        }

        removeEmptyState(toolWindow)
        val panel = ReviewMarkPreviewPanel(project, file)
        panels[file.path] = panel
        val content = ContentFactory.getInstance().createContent(panel, "${file.name} Preview", true)
        Disposer.register(panel, Disposable { panels.remove(file.path) })
        content.setDisposer(panel)
        contentManager.addContent(content)
        contentManager.setSelectedContent(content)
        if (showToolWindow) toolWindow.show()
    }

    fun refreshIfActive(file: VirtualFile) {
        panels[file.path]?.refresh()
    }

    private fun selectedReviewMarkFile(): VirtualFile? {
        return FileEditorManager.getInstance(project).selectedFiles.firstOrNull { file ->
            ReviewMarkFileDetector.isMarkdownFile(file) && containsReviewMark(file)
        }
    }

    private fun containsReviewMark(file: VirtualFile): Boolean {
        return ReadAction.compute<Boolean, RuntimeException> {
            runCatching {
                ReviewMarkFileDetector.containsReviewMark(String(file.contentsToByteArray(), file.charset))
            }.getOrDefault(false)
        }
    }

    private fun ensureEmptyState(toolWindow: ToolWindow) {
        val contentManager = toolWindow.contentManager
        if (contentManager.contentCount > 0) return

        val panel = JPanel(BorderLayout()).apply {
            border = JBUI.Borders.empty(24)
            add(
                JBLabel("Open a Markdown file with ReviewMark comments.", SwingConstants.CENTER).apply {
                    foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
                },
                BorderLayout.CENTER,
            )
        }
        val content = ContentFactory.getInstance().createContent(panel, EMPTY_STATE_TITLE, false)
        contentManager.addContent(content)
    }

    private fun removeEmptyState(toolWindow: ToolWindow) {
        val contentManager = toolWindow.contentManager
        contentManager.contents
            .filter { it.displayName == EMPTY_STATE_TITLE }
            .forEach { contentManager.removeContent(it, true) }
    }

    override fun dispose() {
        panels.values.forEach(Disposer::dispose)
        panels.clear()
    }

    companion object {
        const val TOOL_WINDOW_ID = "ReviewMark Preview"
        private const val EMPTY_STATE_TITLE = "ReviewMark"

        fun getInstance(project: Project): ReviewMarkPreviewService = project.service()
    }
}
