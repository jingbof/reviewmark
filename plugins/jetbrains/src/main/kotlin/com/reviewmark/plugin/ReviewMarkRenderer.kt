package com.reviewmark.plugin

import com.intellij.openapi.application.PathManager
import java.io.File
import java.nio.file.Files
import java.util.concurrent.TimeUnit

sealed class RenderResult {
    data class Success(val html: String) : RenderResult()
    data class Failure(val message: String) : RenderResult()
}

object ReviewMarkRenderer {
    fun render(filePath: String, settings: ReviewMarkSettings.State): RenderResult {
        val bundled = tryBundledRenderer(filePath)
        if (bundled is RenderResult.Success) return bundled

        val cliPath = settings.externalCliPath.trim()
        if (cliPath.isNotEmpty()) {
            val external = tryExternalCli(filePath, cliPath)
            if (external is RenderResult.Success) return external
        }

        return bundled
    }

    private fun tryBundledRenderer(filePath: String): RenderResult {
        val renderer = bundledRendererFile()
        if (!renderer.exists()) {
            return RenderResult.Failure("Bundled ReviewMark renderer was not found at ${renderer.absolutePath}.")
        }
        return runProcess(listOf("node", renderer.absolutePath, "--file", filePath), "ReviewMark requires Node.js for bundled rendering in this version.\nPlease install Node.js or configure an external ReviewMark CLI path.")
    }

    private fun tryExternalCli(filePath: String, cliPath: String): RenderResult {
        return runProcess(listOf(cliPath, "render", filePath, "--stdout"), "ReviewMark renderer not available. Install the CLI with:\nnpm install -g reviewmark")
    }

    private fun runProcess(command: List<String>, fallbackMessage: String): RenderResult {
        return try {
            val process = ProcessBuilder(command)
                .redirectErrorStream(false)
                .start()
            val finished = process.waitFor(10, TimeUnit.SECONDS)
            val stdout = process.inputStream.bufferedReader().readText()
            val stderr = process.errorStream.bufferedReader().readText()

            if (!finished) {
                process.destroyForcibly()
                RenderResult.Failure("ReviewMark render timed out.")
            } else if (process.exitValue() == 0) {
                RenderResult.Success(stdout)
            } else {
                RenderResult.Failure(stderr.ifBlank { fallbackMessage })
            }
        } catch (error: Exception) {
            RenderResult.Failure("${fallbackMessage}\n\n${error.message ?: error.javaClass.simpleName}")
        }
    }

    private fun bundledRendererFile(): File {
        val unpacked = File(PathManager.getPluginsPath(), "reviewmark/reviewmark-renderer/renderer.js")
        if (unpacked.exists()) return unpacked

        val stream = ReviewMarkRenderer::class.java.classLoader.getResourceAsStream("reviewmark-renderer/renderer.js")
            ?: return File("missing-renderer")
        val temp = Files.createTempFile("reviewmark-renderer-", ".js").toFile()
        temp.deleteOnExit()
        stream.use { input -> temp.outputStream().use { output -> input.copyTo(output) } }
        return temp
    }
}
