package com.reviewmark.plugin

import com.intellij.execution.ExecutionException
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.configurations.PathEnvironmentVariableUtil
import com.intellij.openapi.application.PathManager
import com.intellij.openapi.util.SystemInfo
import com.intellij.util.EnvironmentUtil
import java.io.File
import java.io.FileFilter
import java.nio.file.Files
import java.util.concurrent.TimeUnit

sealed class RenderResult {
    data class Success(val html: String) : RenderResult()
    data class Failure(val message: String) : RenderResult()
}

object ReviewMarkRenderer {
    fun render(filePath: String, settings: ReviewMarkSettings.State): RenderResult {
        val bundled = tryBundledRenderer(filePath, settings)
        if (bundled is RenderResult.Success) return bundled

        val cliPath = settings.externalCliPath.trim()
        if (cliPath.isNotEmpty()) {
            val external = tryExternalCli(filePath, cliPath)
            if (external is RenderResult.Success) return external
        }

        return bundled
    }

    private fun tryBundledRenderer(filePath: String, settings: ReviewMarkSettings.State): RenderResult {
        val renderer = bundledRendererFile()
        if (!renderer.exists()) {
            return RenderResult.Failure("Bundled ReviewMark renderer was not found at ${renderer.absolutePath}.")
        }
        val node = findExecutable(settings = settings, command = "node", overridePath = settings.nodeExecutablePath)
        return runProcess(
            executable = node ?: "node",
            args = listOf(renderer.absolutePath, "--file", filePath),
            fallbackMessage = nodeMissingMessage(settings),
        )
    }

    private fun tryExternalCli(filePath: String, cliPath: String): RenderResult {
        val executable = findExecutable(settings = ReviewMarkSettings.getInstance().state, command = cliPath) ?: cliPath
        return runProcess(
            executable = executable,
            args = listOf("render", filePath, "--stdout"),
            fallbackMessage = "ReviewMark renderer not available. Install the CLI with:\nnpm install -g reviewmarks",
        )
    }

    private fun runProcess(executable: String, args: List<String>, fallbackMessage: String): RenderResult {
        return try {
            val commandLine = GeneralCommandLine()
                .withExePath(executable)
                .withParameters(args)
                .withParentEnvironmentType(GeneralCommandLine.ParentEnvironmentType.CONSOLE)
                .withEnvironment("PATH", augmentedPath())
                .withRedirectErrorStream(false)
            val process = commandLine.createProcess()
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
        } catch (error: ExecutionException) {
            RenderResult.Failure("${fallbackMessage}\n\n${error.message ?: error.javaClass.simpleName}")
        } catch (error: Exception) {
            RenderResult.Failure("${fallbackMessage}\n\n${error.message ?: error.javaClass.simpleName}")
        }
    }

    private fun findExecutable(settings: ReviewMarkSettings.State, command: String, overridePath: String = ""): String? {
        val explicit = overridePath.trim().ifBlank { command.trim() }
        if (looksLikePath(explicit)) {
            return explicit.takeIf { isExecutableFile(File(it)) }
        }

        val fromPath = PathEnvironmentVariableUtil.findInPath(
            explicit,
            augmentedPath(),
            FileFilter { isExecutableFile(it) },
        )
        if (fromPath != null) return fromPath.absolutePath

        return commonExecutableCandidates(explicit, settings)
            .firstOrNull(::isExecutableFile)
            ?.absolutePath
    }

    private fun augmentedPath(): String {
        val environmentPath = EnvironmentUtil.getEnvironmentMap()["PATH"].orEmpty()
        val processPath = System.getenv("PATH").orEmpty()
        return (commonPathDirs() + environmentPath.split(File.pathSeparator) + processPath.split(File.pathSeparator))
            .filter { it.isNotBlank() }
            .distinct()
            .joinToString(File.pathSeparator)
    }

    private fun commonPathDirs(): List<String> {
        val home = System.getProperty("user.home").orEmpty()
        val dirs = mutableListOf<String>()

        if (SystemInfo.isWindows) {
            val programFiles = System.getenv("ProgramFiles").orEmpty()
            val programFilesX86 = System.getenv("ProgramFiles(x86)").orEmpty()
            val localAppData = System.getenv("LOCALAPPDATA").orEmpty()
            val appData = System.getenv("APPDATA").orEmpty()
            dirs += listOf(
                "$programFiles\\nodejs",
                "$programFilesX86\\nodejs",
                "$localAppData\\Programs\\nodejs",
                "$appData\\npm",
            )
        } else {
            dirs += listOf(
                "/opt/homebrew/bin",
                "/usr/local/bin",
                "/usr/bin",
                "/bin",
                "/usr/sbin",
                "/sbin",
                "/snap/bin",
                "$home/.local/bin",
                "$home/.volta/bin",
                "$home/.asdf/shims",
            )
        }

        return dirs
    }

    private fun commonExecutableCandidates(command: String, settings: ReviewMarkSettings.State): List<File> {
        val names = executableNames(command)
        val home = System.getProperty("user.home").orEmpty()
        val versionManagerRoots = listOf(
            File(home, ".nvm/versions/node"),
            File(home, ".fnm/node-versions"),
            File(home, ".local/share/fnm/node-versions"),
        )
        val versionManagerDirs = mutableListOf<File>()
        for (root in versionManagerRoots) {
            if (!root.isDirectory) continue
            root.walkTopDown()
                .maxDepth(4)
                .filter { it.isDirectory && it.name == "bin" }
                .forEach { versionManagerDirs.add(it) }
        }

        val configuredNode = settings.nodeExecutablePath.trim()
            .takeIf(::looksLikePath)
            ?.let(::File)

        val candidates = mutableListOf<File>()
        if (configuredNode != null) candidates.add(configuredNode)
        for (dir in commonPathDirs().map(::File)) {
            for (name in names) candidates.add(File(dir, name))
        }
        for (dir in versionManagerDirs) {
            for (name in names) candidates.add(File(dir, name))
        }
        return candidates
    }

    private fun executableNames(command: String): List<String> {
        if (!SystemInfo.isWindows) return listOf(command)
        val lower = command.lowercase()
        if (lower.endsWith(".exe") || lower.endsWith(".cmd") || lower.endsWith(".bat")) return listOf(command)
        return listOf(command, "$command.exe", "$command.cmd", "$command.bat")
    }

    private fun looksLikePath(value: String): Boolean {
        if (value.isBlank()) return false
        return value.contains("/") || value.contains("\\") || Regex("^[A-Za-z]:").containsMatchIn(value)
    }

    private fun isExecutableFile(file: File): Boolean {
        return file.isFile && (file.canExecute() || SystemInfo.isWindows)
    }

    private fun nodeMissingMessage(settings: ReviewMarkSettings.State): String {
        val configured = settings.nodeExecutablePath.trim()
        val configuredText = if (configured.isBlank()) "" else "\nConfigured Node path: $configured"
        return "ReviewMark requires Node.js for bundled rendering in this version.\nNode was not found in the IDE environment.$configuredText\nConfigure Node executable path in Settings > ReviewMark, or install Node.js and restart the IDE."
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
