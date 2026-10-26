@Composable
fun HomeScreen() {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        // Holographic orb
        Box(
            Modifier
                .size(280.dp)
                .align(Alignment.CenterHorizontally)
        ) {
            // Glow
            Box(Modifier.fillMaxSize().background(
                Brush.radialGradient(listOf(Color(0x9900D9FF), Color.Transparent))
            ))
            // Rings
            CircularProgressIndicator(
                modifier = Modifier.fillMaxSize(),
                color = Color(0x8000D9FF),
                strokeWidth = 1.dp
            )
            // Speed
            Text(
                text = "65",
                fontSize = 80.sp,
                color = Color.White,
                modifier = Modifier.align(Alignment.Center)
            )
        }
    }
}