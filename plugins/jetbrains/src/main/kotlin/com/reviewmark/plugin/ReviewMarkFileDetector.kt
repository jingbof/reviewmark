package com.reviewmark.plugin

import com.intellij.openapi.vfs.VirtualFile

object ReviewMarkFileDetector {
    fun isMarkdownFile(file: VirtualFile): Boolean {
        val extension = file.extension?.lowercase()
        return extension == "md" || extension == "markdown"
    }

    fun containsReviewMark(content: String): Boolean {
        return content.contains("<!-- reviewmark", ignoreCase = true)
    }
}
