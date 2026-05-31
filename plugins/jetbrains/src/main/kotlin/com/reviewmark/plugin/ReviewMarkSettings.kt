package com.reviewmark.plugin

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service

@Service(Service.Level.APP)
@State(name = "ReviewMarkSettings", storages = [Storage("reviewmark.xml")])
class ReviewMarkSettings : PersistentStateComponent<ReviewMarkSettings.State> {
    data class State(
        var autoOpenPreview: Boolean = true,
        var externalCliPath: String = "reviewmark",
    )

    private var state = State()

    override fun getState(): State = state

    override fun loadState(state: State) {
        this.state = state
    }

    companion object {
        fun getInstance(): ReviewMarkSettings = service()
    }
}
