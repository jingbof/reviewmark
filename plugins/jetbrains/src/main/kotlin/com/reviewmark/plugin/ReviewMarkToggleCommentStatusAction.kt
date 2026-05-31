package com.reviewmark.plugin

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.ui.Messages

class ReviewMarkToggleCommentStatusAction : AnAction() {
    override fun update(event: AnActionEvent) {
        val file = event.getData(CommonDataKeys.VIRTUAL_FILE)
        val editor = event.getData(CommonDataKeys.EDITOR)
        event.presentation.isEnabledAndVisible =
            file != null && editor != null && ReviewMarkFileDetector.isMarkdownFile(file)
    }

    override fun actionPerformed(event: AnActionEvent) {
        val project = event.project ?: return
        val file = event.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        val editor = event.getData(CommonDataKeys.EDITOR) ?: return
        val document = editor.document
        val text = document.text
        val caretOffset = editor.caretModel.offset
        val range = findNearestCommentRange(text, caretOffset)

        if (range == null) {
            Messages.showInfoMessage(project, "Place the caret inside or near a ReviewMark comment block.", "ReviewMark")
            return
        }

        val block = text.substring(range.first, range.second)
        val currentStatus = Regex("""(?m)^status:\s*(open|resolved|rejected)\s*$""").find(block)?.groupValues?.get(1) ?: "open"
        val nextStatus = if (currentStatus == "open") "resolved" else "open"
        val updatedBlock = if (Regex("""(?m)^status:\s*(open|resolved|rejected)\s*$""").containsMatchIn(block)) {
            block.replace(Regex("""(?m)^status:\s*(open|resolved|rejected)\s*$"""), "status: $nextStatus")
        } else {
            block.replaceFirst("---", "status: $nextStatus\n---")
        }

        WriteCommandAction.runWriteCommandAction(project, "Toggle ReviewMark Comment Status", null, Runnable {
            document.replaceString(range.first, range.second, updatedBlock)
        })

        ReviewMarkPreviewService.getInstance(project).refreshIfActive(file)
    }

    private fun findNearestCommentRange(text: String, caretOffset: Int): Pair<Int, Int>? {
        val regex = Regex("""<!--\s*reviewmark\b[\s\S]*?-->""")
        return regex.findAll(text)
            .map { it.range.first to it.range.last + 1 }
            .minByOrNull { range ->
                if (caretOffset in range.first..range.second) 0
                else minOf(kotlin.math.abs(caretOffset - range.first), kotlin.math.abs(caretOffset - range.second))
            }
    }
}
