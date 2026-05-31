package com.reviewmark.plugin

import com.intellij.AppTopics
import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileDocumentManagerListener
import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ex.ToolWindowManagerListener

class ReviewMarkStartupActivity : StartupActivity, DumbAware {
    override fun runActivity(project: Project) {
        val connection = project.messageBus.connect()

        connection.subscribe(FileEditorManagerListener.FILE_EDITOR_MANAGER, object : FileEditorManagerListener {
            override fun fileOpened(source: com.intellij.openapi.fileEditor.FileEditorManager, file: VirtualFile) {
                if (!ReviewMarkSettings.getInstance().state.autoOpenPreview) return
                if (!ReviewMarkFileDetector.isMarkdownFile(file)) return
                val content = ReadAction.compute<String, RuntimeException> {
                    runCatching { String(file.contentsToByteArray(), file.charset) }.getOrDefault("")
                }
                if (ReviewMarkFileDetector.containsReviewMark(content)) {
                    ReviewMarkPreviewService.getInstance(project).openPreview(file)
                }
            }
        })

        connection.subscribe(AppTopics.FILE_DOCUMENT_SYNC, object : FileDocumentManagerListener {
            override fun beforeDocumentSaving(document: com.intellij.openapi.editor.Document) {
                val file = FileDocumentManager.getInstance().getFile(document) ?: return
                ReviewMarkPreviewService.getInstance(project).refreshIfActive(file)
            }
        })

        connection.subscribe(ToolWindowManagerListener.TOPIC, object : ToolWindowManagerListener {
            override fun toolWindowShown(toolWindow: ToolWindow) {
                if (toolWindow.id != ReviewMarkPreviewService.TOOL_WINDOW_ID) return
                ReviewMarkPreviewService.getInstance(project).syncWithSelectedEditor(toolWindow)
            }
        })
    }
}
