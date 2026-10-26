# WIJI — Holographic AI Co-Pilot

AI co-pilot for **Mitsubishi Attrage 2023**. Speed, trip, weather, fuel, voice assistant, safety alerts — sab ek sci-fi holographic UI mein.

![WIJI Banner](https://media.base44.com/images/public/6ade5107e92122298f26ef0e/b829bd5bf_generated_1c721bb0.jpg/v1/fill/w_760,h_950,al_c,q_90,usm_0.66_1.00_0.01,enc_auto,quality_auto/b829bd5bf_generated_1c721bb0.jpg)

## ✨ Features

### Working Now (Web App)
- 🎨 **Sci-fi holographic design** — Base44-style orb, boot intro, scan lines, particles
- ⚡ **Speedometer** — GPS-based speed with color zones (cyan → amber → red)
- 🧭 **Compass / heading** — GPS direction indicator
- 📊 **Trip tracking** — distance, duration, today total, cost estimate
- ⛽ **Fuel estimate** — based on distance + configurable km/L
- 🎯 **Driving score** — 0-100 based on smoothness
- 🛡️ **Fatigue detection** — alerts after 2h continuous driving
- 🚨 **Crash detection** — accelerometer-based SOS
- 📞 **SOS button** — emergency call to 999
- 🌤️ **Weather** — live from Open-Meteo
- 🗺️ **Navigation** — quick links to Google Maps
- 🔧 **Maintenance reminders** — by date or mileage
- 🎙️ **AI voice assistant** — Groq + ElevenLabs (tap mic)
- 📱 **PWA** — installable on home screen
- 🌙 **Dark theme** — by default
- 📐 **Responsive** — mobile, tablet, laptop, PC, landscape

### Coming Soon (Hardware)
- 🔌 **OBD-II real data** — RPM, coolant, fuel level, error codes (ELM327 adapter)
- 🎤 **"Hey WIJI" wake word** — native Android app (Siri-style)
- 📻 **Media control** — native Android app
- 🛞 **TPMS** — tire pressure (future)

## 🚀 Quick Start

### Local Development
```bash
# Clone repo
git clone https://github.com/YOUR_USERNAME/wiji-app.git
cd wiji-app

# Serve locally (Python)
python3 -m http.server 8000

# Or with Node.js
npx serve

# Open browser
# http://localhost:8000