package com.reviewmark.plugin

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.content.ContentFactory
import com.intellij.openapi.wm.ToolWindowManager
import java.util.concurrent.ConcurrentHashMap

@Service(Service.Level.PROJECT)
class ReviewMarkPreviewService(private val project: Project) : Disposable {
    private val panels = ConcurrentHashMap<String, ReviewMarkPreviewPanel>()

    fun openPreview(file: VirtualFile) {
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID) ?: return
        val contentManager = toolWindow.contentManager
        val existingPanel = panels[file.path]
        if (existingPanel != null) {
            contentManager.setSelectedContent(contentManager.contents.first { it.component == existingPanel })
            existingPanel.refresh()
            toolWindow.show()
            return
        }

        val panel = ReviewMarkPreviewPanel(project, file)
        panels[file.path] = panel
        val content = ContentFactory.getInstance().createContent(panel, "${file.name} Preview", true)
        Disposer.register(panel, Disposable { panels.remove(file.path) })
        content.setDisposer(panel)
        contentManager.addContent(content)
        contentManager.setSelectedContent(content)
        toolWindow.show()
    }

    fun refreshIfActive(file: VirtualFile) {
        panels[file.path]?.refresh()
    }

    override fun dispose() {
        panels.values.forEach(Disposer::dispose)
        panels.clear()
    }

    companion object {
        const val TOOL_WINDOW_ID = "ReviewMark Preview"

        fun getInstance(project: Project): ReviewMarkPreviewService = project.service()
    }
}
