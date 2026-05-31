package com.reviewmark.plugin

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.ui.Messages
import java.security.MessageDigest

class ReviewMarkInsertCommentAction : AnAction() {
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
        val body = Messages.showInputDialog(project, "Comment body:", "Insert ReviewMark Comment", null)?.trim()
            ?: return
        if (body.isBlank()) return

        val selection = editor.selectionModel
        val insertOffset = if (selection.hasSelection()) {
            document.getLineEndOffset(document.getLineNumber(selection.selectionEnd))
        } else {
            document.getLineEndOffset(editor.caretModel.logicalPosition.line)
        }
        val comment = buildCommentBlock(body, insertOffset)

        WriteCommandAction.runWriteCommandAction(project, "Insert ReviewMark Comment", null, Runnable {
            document.insertString(insertOffset, comment)
        })

        ReviewMarkPreviewService.getInstance(project).refreshIfActive(file)
    }

    private fun buildCommentBlock(body: String, insertOffset: Int): String {
        val id = stableId(body, insertOffset)
        return """


<!-- reviewmark
id: $id
author: Human
type: note
status: open
~~~
$body
-->
        """.trimEnd()
    }

    private fun stableId(body: String, insertOffset: Int): String {
        val digest = MessageDigest.getInstance("SHA-1")
            .digest("$body\n$insertOffset".toByteArray())
            .joinToString("") { "%02x".format(it) }
            .take(8)
        return "rm_$digest"
    }
}
