package com.reviewmark.plugin

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory

class ReviewMarkToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        ReviewMarkPreviewService.getInstance(project).syncWithSelectedEditor(toolWindow)
    }

    override fun shouldBeAvailable(project: Project): Boolean = true
}
