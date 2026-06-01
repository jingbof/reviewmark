plugins {
    id("org.jetbrains.kotlin.jvm") version "2.2.21"
    id("org.jetbrains.intellij.platform") version "2.10.4"
}

group = providers.gradleProperty("pluginGroup").get()
version = providers.gradleProperty("pluginVersion").get()

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        webstorm(providers.gradleProperty("platformVersion").get())
    }
}

kotlin {
    jvmToolchain(21)
}

intellijPlatform {
    pluginConfiguration {
        id = "com.reviewmark.plugin"
        name = providers.gradleProperty("pluginName")
        version = providers.gradleProperty("pluginVersion")
        ideaVersion {
            sinceBuild = providers.gradleProperty("pluginSinceBuild")
        }
        description = """
            ReviewMark keeps review comments inside plain Markdown and renders them as a focused review layer inside JetBrains IDEs.
        """.trimIndent()
    }

    pluginVerification {
        ides {
            ide("WS", providers.gradleProperty("platformVersion").get())
        }
    }
}
