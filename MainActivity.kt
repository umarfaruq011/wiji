class MainActivity : ComponentActivity() {
    private lateinit var wakeWordManager: WakeWordManager
    private lateinit var voiceManager: VoiceManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { WijiApp() }

        // Init wake word
        wakeWordManager = WakeWordManager(this)
        voiceManager = VoiceManager(this)

        // Request permissions
        requestPermissions()

        // Start wake word listener
        wakeWordManager.start {
            // Wake word detected!
            runOnUiThread {
                voiceManager.startListening { text ->
                    // Send to AI
                    AiManager.sendToAI(text) { reply ->
                        voiceManager.speak(reply)
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        wakeWordManager.stop()
        super.onDestroy()
    }

    private fun requestPermissions() {
        // Request RECORD_AUDIO, LOCATION, etc.
        ActivityCompat.requestPermissions(
            this,
            arrayOf(
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.CALL_PHONE
            ),
            100
        )
    }
}