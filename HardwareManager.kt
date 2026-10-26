class HardwareManager(private val context: Context) {
    private val bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
    private var socket: BluetoothSocket? = null
    private var inputStream: InputStream? = null
    private var outputStream: OutputStream? = null

    fun connectOBD(deviceAddress: String, onConnected: () -> Unit) {
        val device = bluetoothAdapter.getRemoteDevice(deviceAddress)
        socket = device.createRfcommSocketToServiceRecord(
            UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        )
        socket?.connect()
        inputStream = socket?.inputStream
        outputStream = socket?.outputStream
        onConnected()
    }

    fun sendCommand(cmd: String): String {
        outputStream?.write("$cmd\r".toByteArray())
        Thread.sleep(100)
        val buffer = ByteArray(1024)
        val bytes = inputStream?.read(buffer) ?: 0
        return String(buffer, 0, bytes)
    }

    fun getRPM(): Int {
        val resp = sendCommand("010C")
        // Parse "41 0C XX XX" → ((A*256)+B)/4
        return 0
    }
}