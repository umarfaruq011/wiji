package com.umarfaruq.wiji.managers

import ai.picovoice.porcupine.PorcupineManager
import android.content.Context
import android.util.Log
import androidx.core.content.ContextCompat

class WakeWordManager(private val context: Context) {
    private var porcupineManager: PorcupineManager? = null
    private val accessKey = "YOUR_PICOVOICE_ACCESS_KEY"  // from console

    fun start(onWakeWord: () -> Unit) {
        try {
            porcupineManager = PorcupineManager.Builder()
                .setAccessKey(accessKey)
                .setKeywords(arrayOf("Hey-WIJI"))  // .ppn filename
                .setSensitivity(0.7f)
                .build(context) { keywordIndex ->
                    Log.d("WIJI", "Wake word: $keywordIndex")
                    onWakeWord()
                }
            porcupineManager?.start()
        } catch (e: Exception) {
            Log.e("WIJI", "Wake word init failed", e)
        }
    }

    fun stop() {
        porcupineManager?.stop()
        porcupineManager?.delete()
        porcupineManager = null
    }
}