package com.reviewmark.plugin

import com.intellij.openapi.options.Configurable
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import java.awt.GridBagConstraints
import java.awt.GridBagLayout
import javax.swing.JComponent
import javax.swing.JPanel

class ReviewMarkSettingsConfigurable : Configurable {
    private val autoOpen = JBCheckBox("Auto-open ReviewMark Preview")
    private val nodeExecutablePath = JBTextField()
    private val externalCliPath = JBTextField()
    private var panel: JPanel? = null

    override fun getDisplayName(): String = "ReviewMark"

    override fun createComponent(): JComponent {
        val constraints = GridBagConstraints().apply {
            anchor = GridBagConstraints.WEST
            fill = GridBagConstraints.HORIZONTAL
            weightx = 1.0
        }

        panel = JPanel(GridBagLayout()).apply {
            constraints.gridx = 0
            constraints.gridy = 0
            constraints.gridwidth = 2
            add(autoOpen, constraints)

            constraints.gridy = 1
            constraints.gridwidth = 1
            constraints.weightx = 0.0
            add(JBLabel("Node executable path:"), constraints)

            constraints.gridx = 1
            constraints.weightx = 1.0
            add(nodeExecutablePath, constraints)

            constraints.gridx = 0
            constraints.gridy = 2
            constraints.weightx = 0.0
            add(JBLabel("External CLI fallback path:"), constraints)

            constraints.gridx = 1
            constraints.weightx = 1.0
            add(externalCliPath, constraints)
        }

        reset()
        return panel!!
    }

    override fun isModified(): Boolean {
        val state = ReviewMarkSettings.getInstance().state
        return autoOpen.isSelected != state.autoOpenPreview ||
            nodeExecutablePath.text != state.nodeExecutablePath ||
            externalCliPath.text != state.externalCliPath
    }

    override fun apply() {
        val state = ReviewMarkSettings.getInstance().state
        state.autoOpenPreview = autoOpen.isSelected
        state.nodeExecutablePath = nodeExecutablePath.text.trim()
        state.externalCliPath = externalCliPath.text.trim().ifBlank { "reviewmark" }
    }

    override fun reset() {
        val state = ReviewMarkSettings.getInstance().state
        autoOpen.isSelected = state.autoOpenPreview
        nodeExecutablePath.text = state.nodeExecutablePath
        externalCliPath.text = state.externalCliPath
    }
}
