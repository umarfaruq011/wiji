/* ============================================================
   WIJI — Stage 8.0 · Base44-style Cockpit
   ============================================================ */

const WORKER_URL = "https://wiji-worker-backend.umaremotions.workers.dev/";
const STORAGE_KEY = 'wiji.v1';
const BOOT_FLAG = 'wijiBooted';
const SPEED_MAX = 180;
const SPEED_LIMIT = 110;
const GPS_STALE_MS = 6000;
const PULL_THRESHOLD = 64;
const AUDIO_CACHE_LIMIT = 8;

/* ---------- Storage ---------- */
function storeGet() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { return {}; } }
function storeRead(key, fallback) { const s = storeGet(); return s[key] === undefined ? fallback : s[key]; }
function storeWrite(key, value) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...storeGet(), [key]: value })); } catch {} }
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------- Utils ---------- */
function haversine(a, b) {
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
  return 12742000 * Math.asin(Math.sqrt(s));
}
const isStale = (ts, ms = GPS_STALE_MS) => !ts || Date.now() - ts > ms;
const fmtKm = m => m ? (m / 1000).toFixed(m < 10000 ? 2 : 1) : '0.0';
const fmtTime = (d = new Date()) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
const fmtDate = (d = new Date()) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', weekday: 'short', day: '2-digit', month: 'short' }).format(d);
const fmtDuration = ms => { if (!ms || ms < 1000) return '0m'; const m = Math.floor(ms/60000), h = Math.floor(m/60), r = m%60; return h > 0 ? `${h}h ${r}m` : `${r}m`; };
const compass = deg => deg == null ? '--' : ['N','NE','E','SE','S','SW','W','NW'][Math.round(((deg%360)+360)%360 / 45) % 8];
const getBrowserLang = () => (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';
const isAndroid = () => typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

/* ---------- Weather codes ---------- */
const WEATHER_CODES = { 0:['Clear','☀️'],1:['Mostly clear','🌤️'],2:['Partly cloudy','⛅'],3:['Overcast','☁️'],45:['Fog','🌫️'],48:['Fog','🌫️'],51:['Light drizzle','🌦️'],53:['Drizzle','🌦️'],55:['Heavy drizzle','🌧️'],61:['Light rain','🌦️'],63:['Rain','🌧️'],65:['Heavy rain','🌧️'],71:['Light snow','❄️'],73:['Snow','❄️'],75:['Heavy snow','❄️'],80:['Showers','🌦️'],81:['Showers','🌧️'],82:['Heavy showers','⛈️'],95:['Thunderstorm','⛈️'],96:['Thunderstorm','⛈️'],99:['Thunderstorm','⛈️'] };
const weatherLabel = c => WEATHER_CODES[c] ? WEATHER_CODES[c][0] : 'Weather';
const weatherTemp = w => typeof w?.current?.temperature_2m === 'number' ? w.current.temperature_2m : undefined;
const weatherCond = w => w?.current?.weather_code == null ? '' : weatherLabel(w.current.weather_code);

/* ---------- Sound FX ---------- */
let audioCtx = null, masterGain = null, soundEnabled = true;
function ensureAudio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}
function tone({ from, to, dur, level, type = 'sine', at }) {
  if (!soundEnabled) return;
  const c = ensureAudio(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  if (to && to !== from) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(level, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(masterGain);
  o.start(at); o.stop(at + dur + 0.02);
}
function noise(at, dur, level) {
  if (!soundEnabled) return;
  const c = ensureAudio(); if (!c) return;
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i/n);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.9;
  const g = c.createGain(); g.gain.value = level;
  src.connect(f); f.connect(g); g.connect(masterGain);
  src.start(at);
}
function sfxTap() { if (!soundEnabled) return; const c = ensureAudio(); if (!c) return; const t0 = c.currentTime + 0.001; noise(t0, 0.05, 0.16); tone({ from: 1240, to: 1860, dur: 0.1, level: 0.18, type: 'triangle', at: t0 }); tone({ from: 2480, to: 3100, dur: 0.07, level: 0.06, at: t0 + 0.01 }); }
function sfxMicOn() { if (!soundEnabled) return; const c = ensureAudio(); if (!c) return; const t0 = c.currentTime + 0.001; tone({ from: 320, to: 940, dur: 0.26, level: 0.24, type: 'triangle', at: t0 }); tone({ from: 640, to: 1880, dur: 0.24, level: 0.08, at: t0 + 0.02 }); tone({ from: 120, to: 70, dur: 0.18, level: 0.26, at: t0 }); noise(t0, 0.08, 0.09); }
function sfxMicOff() { if (!soundEnabled) return; const c = ensureAudio(); if (!c) return; const t0 = c.currentTime + 0.001; tone({ from: 940, to: 340, dur: 0.22, level: 0.2, type: 'triangle', at: t0 }); tone({ from: 1880, to: 620, dur: 0.2, level: 0.07, at: t0 + 0.01 }); tone({ from: 100, to: 60, dur: 0.16, level: 0.22, at: t0 }); noise(t0, 0.06, 0.07); }
function sfxBoot() {
  if (!soundEnabled) return;
  const c = ensureAudio(); if (!c) return;
  const t0 = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
  g.connect(masterGain);
  [523.25, 783.99, 1046.5].forEach((f, i) => {
    const t = t0 + i * 0.13;
    const o = c.createOscillator(), gg = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t);
    gg.gain.setValueAtTime(0.0001, t);
    gg.gain.linearRampToValueAtTime(0.5, t + 0.05);
    gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    o.connect(gg); gg.connect(g);
    o.start(t); o.stop(t + 1.05);
  });
}
/* ============================================================
   TRADING CHART (TradingView Lightweight Charts)
   ============================================================ */
let tradingChart = null, candleSeries = null, currentSymbol = 'BTCUSDT';

// Load library dynamically
function loadChartLib() {
  return new Promise((resolve) => {
    if (window.LightweightCharts) return resolve();
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js';
    s.onload = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });
}

async function initTradingChart() {
  await loadChartLib();
  if (!window.LightweightCharts) return;
  
  const { createChart, CandlestickSeries } = window.LightweightCharts;
  const container = document.getElementById('tradingChart');
  if (!container) return;
  
  tradingChart = createChart(container, {
    width: container.clientWidth,
    height: 180,
    layout: { background: { color: 'transparent' }, textColor: '#9d92d6' },
    grid: { vertLines: { color: 'rgba(124,92,255,0.1)' }, horzLines: { color: 'rgba(124,92,255,0.1)' } },
    rightPriceScale: { borderColor: 'rgba(124,92,255,0.3)' },
    timeScale: { borderColor: 'rgba(124,92,255,0.3)', timeVisible: true },
    crosshair: { mode: 1 }
  });
  
  candleSeries = tradingChart.addSeries(CandlestickSeries, {
    upColor: '#00e0ff', downColor: '#ff3d8a',
    borderUpColor: '#00e0ff', borderDownColor: '#ff3d8a',
    wickUpColor: '#00e0ff', wickDownColor: '#ff3d8a'
  });
  
  // Generate demo data (real API baad mein)
  generateDemoCandles();
  
  // Symbol switch
  document.querySelectorAll('[data-symbol]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSymbol = btn.dataset.symbol;
      generateDemoCandles();
    });
  });
}

function generateDemoCandles() {
  const now = Math.floor(Date.now() / 1000);
  const basePrice = currentSymbol === 'BTCUSDT' ? 67000 : currentSymbol === 'ETHUSDT' ? 3500 : 150;
  const candles = [];
  let price = basePrice;
  
  for (let i = 100; i >= 0; i--) {
    const time = now - i * 60; // 1-min candles
    const open = price;
    const change = (Math.random() - 0.48) * basePrice * 0.01;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * basePrice * 0.002;
    const low = Math.min(open, close) - Math.random() * basePrice * 0.002;
    candles.push({ time, open, high, low, close });
    price = close;
  }
  
  if (candleSeries) {
    candleSeries.setData(candles);
    tradingChart.timeScale().fitContent();
    document.getElementById('chartPrice').textContent = `$${Math.round(price).toLocaleString()}`;
  }
  
  // Simulate real-time update every 2s
  if (window._chartInterval) clearInterval(window._chartInterval);
  window._chartInterval = setInterval(() => {
    if (!candleSeries) return;
    const last = candles[candles.length - 1];
    const newClose = last.close + (Math.random() - 0.5) * basePrice * 0.002;
    const newCandle = {
      time: Math.floor(Date.now() / 1000),
      open: last.close,
      high: Math.max(last.close, newClose),
      low: Math.min(last.close, newClose),
      close: newClose
    };
    candleSeries.update(newCandle);
    document.getElementById('chartPrice').textContent = `$${Math.round(newClose).toLocaleString()}`;
  }, 2000);
}

/* ============================================================
   SALAH TIMING (Aladhan API)
   ============================================================ */
async function initSalah() {
  const lat = state.fix ? state.fix.lat : 24.7136;
  const lng = state.fix ? state.fix.lng : 46.6753;
  
  try {
    const url = `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=4`;
    const r = await fetch(url);
    const data = await r.json();
    const timings = data?.data?.timings;
    if (!timings) throw new Error('no timings');
    
    const prayers = [
      { name: 'Fajr', key: 'Fajr', icon: '🌅' },
      { name: 'Dhuhr', key: 'Dhuhr', icon: '☀️' },
      { name: 'Asr', key: 'Asr', icon: '🌤️' },
      { name: 'Maghrib', key: 'Maghrib', icon: '🌇' },
      { name: 'Isha', key: 'Isha', icon: '🌙' }
    ];
    
    const list = document.getElementById('salahList');
    list.innerHTML = prayers.map(p => {
      const time = timings[p.key];
      return `<div class="wi-sys-row" style="padding:8px 10px">
        <em class="wi-cap" style="font-size:11px">${p.icon} ${p.name}</em>
        <b class="num" style="font-size:13px">${time}</b>
      </div>`;
    }).join('');
    
    // Next prayer
    const now = new Date();
    const [h, m] = timings.Fajr.split(':').map(Number);
    const fajrTime = new Date(); fajrTime.setHours(h, m, 0);
    document.getElementById('nextPrayerLabel').textContent = 'Riyadh · Umm Al-Qura';
    
    // Date
    const hijri = data?.data?.date?.hijri;
    if (hijri) document.getElementById('salahDate').textContent = `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
    
  } catch (e) {
    document.getElementById('salahList').innerHTML = '<p class="wi-tx" style="font-size:12px;color:#9d92d6">Salah timing unavailable</p>';
  }
}

// init() mein add karo:
// initTradingChart();
// initSalah();
// setTimeout(initSalah, 3000); // GPS fix ke baad

/* ---------- State ---------- */
const state = {
  online: typeof navigator > 'u' || navigator.onLine,
  fix: null, gpsStatus: 'idle',
  weather: null,
  trip: storeRead('trip', { active: false, startedAt: null, meters: 0 }),
  today: (() => { const t = storeRead('today', { date: todayISO(), meters: 0 }); return t.date === todayISO() ? t : { date: todayISO(), meters: 0 }; })(),
  driver: storeRead('driver', {}),
  settings: { voiceReplies: true, soundFx: true, ...storeRead('settings', {}) },
  messages: storeRead('chat', []),
  listening: false, speaking: false, thinking: false, error: false,
  transcript: '', lastReply: '',
  battery: { supported: false, level: null, charging: null },
  fills: storeRead('fills', []),
  currentTab: 'home',
  chatOpen: false
};

/* ---------- Battery (native hook) ---------- */
async function initBattery() {
  if (typeof navigator > 'u' || typeof navigator.getBattery !== 'function') return;
  try {
    const b = await navigator.getBattery();
    const update = () => { state.battery = { supported: true, level: b.level, charging: b.charging }; renderVitals(); };
    update();
    b.addEventListener('levelchange', update);
    b.addEventListener('chargingchange', update);
  } catch {}
}

/* ---------- GPS ---------- */
let gpsWatchId = null;
function initGPS() {
  if (typeof navigator > 'u' || !navigator.geolocation) { state.gpsStatus = 'unavailable'; renderVitals(); return; }
  state.gpsStatus = 'locating'; renderVitals();
  let lastFix = null;
  const onPos = (pos) => {
    const c = pos.coords;
    let spd = (c.speed != null && !Number.isNaN(c.speed)) ? c.speed * 3.6 : null;
    if ((spd == null || spd < 0) && lastFix) {
      const dt = (pos.timestamp - lastFix.ts) / 1000;
      if (dt > 0.5) {
        const calc = haversine({ lat: lastFix.lat, lng: lastFix.lng }, { lat: c.latitude, lng: c.longitude }) / dt * 3.6;
        spd = calc > 300 ? null : calc;
      }
    }
    const prevSpd = lastFix?.speed;
    const smoothed = spd == null ? null : (prevSpd == null ? spd : prevSpd * 0.6 + spd * 0.4);
    lastFix = { lat: c.latitude, lng: c.longitude, ts: pos.timestamp, speed: smoothed };
    state.fix = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, heading: c.heading, speed: smoothed, ts: pos.timestamp };
    state.gpsStatus = 'ok';
    renderHome(); renderVitals(); renderTrip();
    processTripMovement();
    renderNavLocation();
  };
  const onErr = (e) => { state.gpsStatus = e.code === 1 ? 'denied' : 'unavailable'; renderVitals(); };
  gpsWatchId = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
}

/* ---------- Weather ---------- */
async function fetchWeather() {
  if (state.fix == null) return;
  const lat = state.fix.lat.toFixed(1), lng = state.fix.lng.toFixed(1);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('weather');
    state.weather = await r.json();
    renderVitals(); renderTelemetry();
  } catch {}
}

/* ---------- Trip ---------- */
let tripLast = null;
function processTripMovement() {
  if (!state.fix) return;
  const prev = tripLast;
  tripLast = { lat: state.fix.lat, lng: state.fix.lng };
  if (!state.trip.active || !prev) return;
  const d = haversine(prev, { lat: state.fix.lat, lng: state.fix.lng });
  if (d < 2 || d > 2000) return;
  state.trip = { ...state.trip, meters: state.trip.meters + d };
  state.today = { ...state.today, meters: state.today.meters + d };
  storeWrite('trip', state.trip);
  storeWrite('today', state.today);
  renderTrip();
}
function tripStart() {
  tripLast = state.fix ? { lat: state.fix.lat, lng: state.fix.lng } : null;
  state.trip = { active: true, startedAt: Date.now(), meters: 0 };
  storeWrite('trip', state.trip); renderTrip();
}
function tripStop() {
  state.trip = { ...state.trip, active: false };
  storeWrite('trip', state.trip); renderTrip();
}
function tripReset() {
  tripLast = state.fix ? { lat: state.fix.lat, lng: state.fix.lng } : null;
  state.trip = { active: false, startedAt: null, meters: 0 };
  storeWrite('trip', state.trip); renderTrip();
}

/* ---------- Speech ---------- */
const audioCache = new Map();
let speechRec = null, currentAudio = null;
function base64ToUrl(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime || 'audio/mpeg' }));
}
function systemTTS(text) {
  return new Promise(resolve => {
    if (!window.speechSynthesis) return resolve();
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = getBrowserLang();
      u.rate = 1.02;
      u.onend = resolve; u.onerror = resolve;
      window.speechSynthesis.speak(u);
      setTimeout(resolve, Math.min(20000, 1800 + text.length * 90));
    } catch { resolve(); }
  });
}
async function speak(text) {
  const t = (text || '').trim();
  if (!t || !state.settings.voiceReplies) return;
  state.speaking = true; renderPresenceState();
  try {
    let url = audioCache.get(t);
    if (!url) {
      try {
        const r = await fetch(WORKER_URL + 'speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }) });
        const data = await r.json();
        const b64 = data?.audio;
        if (!b64) throw new Error('no audio');
        url = base64ToUrl(b64, data.mime);
        audioCache.set(t, url);
        if (audioCache.size > AUDIO_CACHE_LIMIT) {
          const firstKey = audioCache.keys().next().value;
          URL.revokeObjectURL(audioCache.get(firstKey));
          audioCache.delete(firstKey);
        }
      } catch { return systemTTS(t); }
    }
    const audio = new Audio(url);
    audio.playbackRate = 1.06;
    currentAudio = audio;
    await new Promise((res, rej) => { audio.onended = res; audio.onerror = rej; audio.play().catch(rej); });
  } catch { await systemTTS(t); }
  finally { currentAudio = null; state.speaking = false; renderPresenceState(); }
}
function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  speechRec = new SR();
  speechRec.lang = getBrowserLang();
  speechRec.interimResults = true;
  speechRec.continuous = false;
  speechRec.maxAlternatives = 1;
  speechRec.onstart = () => { state.listening = true; state.transcript = ''; renderPresenceState(); };
  speechRec.onerror = () => { state.listening = false; renderPresenceState(); };
  speechRec.onend = () => { state.listening = false; renderPresenceState(); };
  speechRec.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t; else interim += t;
    }
    state.transcript = final || interim;
    renderCoreText();
    if (final.trim()) { state.listening = false; handleCommand(final.trim()); }
  };
}
function listenToggle() {
  if (!speechRec) { state.lastReply = 'Voice input is not available in this browser — type in the chat instead.'; renderCoreText(); return; }
  if (state.listening) { try { speechRec.stop(); } catch {} sfxMicOff(); return; }
  sfxMicOn();
  try { speechRec.start(); } catch {}
}

/* ---------- NLU ---------- */
const IDENTITY_RE = /(who\s+(made|created|built|designed|owns)|who\s+is\s+your\s+(creator|maker|builder|owner)|kisne\s+banaya|kis\s+ne\s+banaya|aapko\s+kisne|tumhe\s+kisne|who\s+are\s+you|what\s+are\s+you|your\s+name|tumhara\s+naam|aapka\s+naam)/;
const DIR_TRIGGERS = ['raasta','rasta','route','direction','navigate','le chalo','jana hai','jaana hai','kaise jaun','kaise pahunch'];
const DIR_FILLERS = ['ka raasta','ki raasta','ka rasta','ka route','ka direction','ki direction','tak le chalo','le chalo','navigate to','directions to','route to','kaise jaun','kaise pahunch','jana hai','jaana hai','raasta','rasta','route','directions','direction','navigate'];
const GREETING_WORDS = /\b(hey|hi|hii|hlo|hello|helo|salam|salaam|assalam|assalamualaikum|namaste|good morning|good evening|good afternoon|kaise ho|kya haal|how are you|whats up|sup)\b/g;
const NAME_WORDS = /\b(wiji|wizy|wji|bhai|yaar|dost|buddy|sir)\b/g;
const DEG_RE = /(\d{2,3})\s*(?:°|deg\b|degree|degrees|darja|darje|celsius|celcius|centigrade)/;
const WEATHER_RE = /(temperature|temp|degree|degrees|darja|darje|garmi|thand|sardi|mausam|weather|climate)/;
function detectIntent(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return { type: 'none' };
  if (t.includes('youtube') && ['kholo','khol','open','launch','chalu','chala'].some(w => t.includes(w))) return { type: 'youtube' };
  if (t.includes('traffic') && ['dikhao','dikha','show','lagao','on','layer'].some(w => t.includes(w))) return { type: 'traffic' };
  if (IDENTITY_RE.test(t)) return { type: 'identity' };
  if (DIR_TRIGGERS.some(w => t.includes(w))) return { type: 'directions', ...parseDirections(t) };
  if (['news','khabar','samachar','headline'].some(w => t.includes(w)) && ['aaj','today','latest','bata','dikha','sun','bol','tell','show','kya','what'].some(w => t.includes(w))) return { type: 'news' };
  const cleaned = t.replace(GREETING_WORDS, ' ').replace(NAME_WORDS, ' ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return { type: 'greeting' };
  const m = t.match(DEG_RE);
  if (m && Number(m[1]) <= 150) return { type: 'temperature', celsius: Number(m[1]) };
  if (WEATHER_RE.test(t)) return { type: 'weather' };
  return { type: 'chat' };
}
function parseDirections(text) {
  let t = text;
  DIR_FILLERS.forEach(f => { t = t.split(f).join(' '); });
  t = t.replace(/[?!.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = t.split(' se ');
  const cleanDest = s => (s || '').replace(/\b(mujhe|please|plz|karo|do|ka|ki|ke|ko|hai|tak|chalo|le|batao|dikhao|show)\b/g, ' ').replace(/\b(from|to)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (parts.length >= 2 && parts[0].trim() && parts[parts.length - 1].trim()) return { from: cleanDest(parts[0]), to: cleanDest(parts.slice(1).join(' se ')) };
  return { from: null, to: cleanDest(t) };
}

/* ---------- Responses ---------- */
function getRiyadhHour() { try { return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: 'numeric', hour12: false }).format(new Date())); } catch { return new Date().getHours(); } }
function greetingResponse(name) { const h = getRiyadhHour(); const tod = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; return `${tod}${name ? ', ' + name : ''}. WIJI online — your holographic co-pilot. What do you need?`; }
function identityResponse() { return 'I was created by Umar Faruq as his personal holographic co-pilot for the Mitsubishi Attrage 2023.'; }
function temperatureResponse(celsius, currentTemp) {
  const extra = typeof currentTemp === 'number' ? ` Right now it is ${Math.round(currentTemp)}°C at your location.` : '';
  if (celsius >= 40) return `${celsius} degrees? That is extreme heat, Sir. Full AC, keep drinking water and park in the shade.${extra}`;
  if (celsius >= 30) return `${celsius} degrees is hot. Keep the AC on and stay hydrated.${extra}`;
  if (celsius >= 20) return `${celsius} degrees — perfect weather for driving.${extra}`;
  if (celsius >= 10) return `${celsius} degrees is a bit cool. Windows up and AC off.${extra}`;
  return `${celsius} degrees? Very cold. Heater on and drive carefully.${extra}`;
}
function weatherResponse(temp, cond) {
  if (typeof temp !== 'number') return 'Live weather needs internet — no reading available right now.';
  return `It is ${Math.round(temp)}°C at your location${cond ? ' and it is ' + cond : ''}. Safe drive.`;
}
function overspeedAlert(speed) { return `Sir, you are at ${Math.round(speed)} km/h — above the ${SPEED_LIMIT} limit. Please slow down.`; }

/* ---------- Local actions ---------- */
function openYouTube() {
  if (isAndroid()) {
    const f = document.createElement('iframe');
    f.style.display = 'none'; f.src = 'vnd.youtube://';
    document.body.appendChild(f);
    setTimeout(() => { f.parentNode && f.parentNode.removeChild(f); if (document.visibilityState === 'visible') window.open('https://www.youtube.com', '_blank'); }, 1200);
    return 'Opening YouTube.';
  }
  window.open('https://www.youtube.com', '_blank');
  return 'Opening YouTube.';
}
function openTraffic(fix) {
  const c = fix ? `${fix.lat.toFixed(5)},${fix.lng.toFixed(5)}` : '24.7136,46.6753';
  window.open(`https://www.google.com/maps/@?api=1&map_action=map&center=${c}&zoom=13&layer=traffic`, '_blank');
  return 'Opening the Google Maps traffic layer.';
}
function openDirections({ from, to }) {
  if (!to) return null;
  const p = new URLSearchParams({ api: '1', destination: to, travelmode: 'driving' });
  if (from) p.set('origin', from);
  window.open(`https://www.google.com/maps/dir/?${p.toString()}`, '_blank');
  return from ? `Opening the route from ${from} to ${to}.` : `Opening the route to ${to}.`;
}
function handleLocalIntent(intent) {
  switch (intent.type) {
    case 'youtube': return openYouTube();
    case 'traffic': return openTraffic(state.fix);
    case 'directions': return openDirections(intent);
    case 'identity': return identityResponse();
    case 'greeting': return greetingResponse(state.driver.firstName);
    case 'temperature': return temperatureResponse(intent.celsius, weatherTemp(state.weather));
    case 'weather': return weatherResponse(weatherTemp(state.weather), weatherCond(state.weather));
    default: return null;
  }
}

/* ---------- Chat ---------- */
function pushMessage(role, content, error = false) {
  const id = `${role}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  state.messages = [...state.messages, { id, role, content, error }].slice(-40);
  storeWrite('chat', state.messages);
  renderMessages();
}
async function sendChat(text) {
  const t = (text || '').trim();
  if (!t) return;
  state.lastReply = '';
  const history = state.messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
  pushMessage('user', t);
  state.thinking = true; renderPresenceState();
  try {
    const r = await fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: t, history, context: buildContext() }) });
    const data = await r.json();
    const reply = data?.reply;
    if (!reply) throw new Error(data?.error || 'no reply');
    state.messages = state.messages.map(m => m.role === 'user' && m.content === t && !m.error ? m : m);
    pushMessage('assistant', reply);
    state.lastReply = reply;
    await speak(reply);
  } catch {
    state.messages = state.messages.map(m => m.role === 'user' && m.content === t ? { ...m, error: true } : m);
    pushMessage('assistant', 'Connection issue — try again.', true);
    state.lastReply = 'Connection issue.';
  } finally {
    state.thinking = false; renderPresenceState();
  }
}
async function handleCommand(text) {
  const t = (text || '').trim();
  if (!t) return;
  const intent = detectIntent(t);
  const localReply = handleLocalIntent(intent);
  if (localReply) {
    pushMessage('user', t);
    pushMessage('assistant', localReply);
    state.lastReply = localReply;
    await speak(localReply);
    return;
  }
  if (state.online) await sendChat(t);
  else {
    pushMessage('user', t);
    const msg = 'No internet — search and news are off, other features still work.';
    pushMessage('assistant', msg);
    state.lastReply = msg;
    await speak(msg);
  }
}
function buildContext() {
  return {
    tz: 'Asia/Riyadh',
    online: state.online,
    fix: state.fix ? { lat: state.fix.lat, lng: state.fix.lng, accuracy: state.fix.accuracy, speedKmh: state.fix.speed, heading: state.fix.heading } : null,
    trip: { active: state.trip.active, meters: Math.round(state.trip.meters), todayMeters: Math.round(state.today.meters) },
    weather: state.weather?.current || null
  };
}

/* ---------- Rendering ---------- */
function $(id) { return document.getElementById(id); }

function renderPresenceState() {
  const s = state.listening ? 'listening' : state.thinking ? 'thinking' : state.speaking ? 'speaking' : state.error ? 'error' : 'idle';
  const badgeLabels = { idle: 'Standby', listening: 'Listening', thinking: 'Processing', speaking: 'Speaking', error: 'Fault' };
  ['speedDial', 'corePresence', 'voiceMicStage'].forEach(id => { const el = $(id); if (el) el.dataset.state = s; });
  const badge = $('coreBadge');
  if (badge) { badge.textContent = badgeLabels[s]; badge.className = 'wi-holo-badge ' + (s === 'error' ? 'wi-holo-badge-warn' : 'wi-holo-badge-live'); badge.innerHTML = '<i></i>' + badgeLabels[s]; }
  const vm = $('voiceMode'); if (vm) vm.textContent = badgeLabels[s];
  renderCoreText();
}
function renderCoreText() {
  const el = $('coreText'); if (!el) return;
  if (state.listening) el.textContent = state.transcript || 'Listening — speak now.';
  else if (state.lastReply) el.textContent = state.lastReply;
  else el.textContent = 'Core online. Tap the core or say what you need.';
}

function renderSpeedDial() {
  const speed = state.fix ? state.fix.speed : null;
  const stale = isStale(state.fix?.ts);
  const safeSpeed = stale ? 0 : Math.max(0, Math.min(typeof speed === 'number' && !Number.isNaN(speed) ? speed : 0, SPEED_MAX));
  const pct = safeSpeed / SPEED_MAX;
  const overSpeed = state.fix?.speed >= SPEED_LIMIT && !stale;
  const color = overSpeed ? '#ff3d8a' : '#00e0ff';
  const angleRad = (pct * 360 - 90) * Math.PI / 180;
  const cx = 100 + 68 * Math.cos(angleRad), cy = 100 + 68 * Math.sin(angleRad);
  const circumference = 2 * Math.PI * 68;

  const arc = $('dialArc'); if (arc) { arc.setAttribute('stroke-dasharray', `${circumference * pct} ${circumference}`); arc.setAttribute('stroke', color); }
  const dot = $('dialDot'); if (dot) { dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('fill', color); }
  const num = $('dialNum'); if (num) { num.textContent = stale ? '--' : Math.round(safeSpeed); num.style.fill = overSpeed ? '#ff3d8a' : '#fff'; }
  const hd = $('dialHeading'); if (hd) hd.textContent = compass(state.fix?.heading) + (state.fix?.heading != null ? `  ${Math.round(state.fix.heading)}°` : '');
  const flag = $('dialFlag'); if (flag) flag.style.display = overSpeed ? 'inline-block' : 'none';

  // Update ticks
  const ticksG = $('dialTicks');
  if (ticksG && ticksG.children.length === 0) {
    let html = '';
    for (let i = 0; i < 72; i++) {
      const on = i / 72 <= pct;
      html += `<line x1="100" y1="12" x2="100" y2="${i % 6 === 0 ? 25 : 19}" class="${on ? 'wi-dial-tick-on' : 'wi-dial-tick'}" transform="rotate(${i * 5} 100 100)"/>`;
    }
    ticksG.innerHTML = html;
  } else if (ticksG) {
    Array.from(ticksG.children).forEach((line, i) => line.className.baseVal = i / 72 <= pct ? 'wi-dial-tick-on' : 'wi-dial-tick');
  }
}

function renderSpeedStatic() {
  // Nodes
  const nodesG = $('dialNodes');
  if (nodesG) nodesG.innerHTML = [0, 120, 240].map(a => `<circle class="wi-dial-node" cx="100" cy="12" r="2.1" transform="rotate(${a} 100 100)"/>`).join('');
  // Mini ticks
  const miniG = $('dialMini');
  if (miniG) miniG.innerHTML = Array.from({length: 12}).map((_, i) => `<line class="wi-dial-mini" x1="100" y1="34" x2="100" y2="40" transform="rotate(${i * 30} 100 100)"/>`).join('');
  // Hash marks
  const hashG = $('dialHash');
  if (hashG) hashG.innerHTML = [45,135,225,315].map(a => `<line class="wi-dial-hash" x1="100" y1="58" x2="100" y2="66" transform="rotate(${a} 100 100)"/>`).join('');
}

function renderTelemetry() {
  const el = $('teleLine'); if (!el) return;
  const items = [
    ['TIME', `${fmtTime()} KSA`],
    ['SPD', isStale(state.fix?.ts) ? '-- km/h' : `${Math.round(state.fix?.speed || 0)} km/h`],
    ['TRP', `${fmtKm(state.trip.meters)} km`],
    ['DAY', `${fmtKm(state.today.meters)} km`],
    ['TEMP', weatherTemp(state.weather) === undefined ? '--' : `${Math.round(weatherTemp(state.weather))}°C`]
  ];
  const overSpeed = state.fix?.speed >= SPEED_LIMIT && !isStale(state.fix?.ts);
  el.innerHTML = items.map(([k, v], i) => `${i ? '<u></u>' : ''}<span class="wi-tele-item"><em class="${overSpeed && k === 'SPD' ? 'wi-tele-hot' : ''}">${k}</em><b class="${overSpeed && k === 'SPD' ? 'wi-tele-hot' : ''}">${v}</b></span>`).join('');
}

function renderTrip() {
  const lbl = $('tripStatusLabel');
  if (lbl) lbl.textContent = state.trip.active ? 'Recording' : (state.trip.meters > 0 ? 'Ended' : 'Ready');
  $('tripToday').textContent = `${fmtKm(state.today.meters)} km`;
  $('tripTrip').textContent = `${fmtKm(state.trip.meters)} km`;
  $('tripTime').textContent = state.trip.active && state.trip.startedAt ? fmtDuration(Date.now() - state.trip.startedAt) : '—';
  $('tripStartBtn').style.display = state.trip.active ? 'none' : 'flex';
  $('tripStopBtn').style.display = state.trip.active ? 'flex' : 'none';
}

function renderVitals() {
  const net = $('vitalNet'), gps = $('vitalGps'), pow = $('vitalPower'), air = $('vitalAir');
  if (net) { net.textContent = state.online ? 'Linked' : 'Offline'; $('vitalNetBar').style.width = state.online ? '100%' : '6%'; }
  const acc = state.fix && typeof state.fix.accuracy === 'number' ? Math.round(state.fix.accuracy) : null;
  if (gps) { gps.textContent = acc === null ? (state.gpsStatus || 'Waiting') : `${acc} m`; $('vitalGpsBar').style.width = acc === null ? '8%' : `${Math.max(12, 100 - acc)}%`; }
  const b = state.battery;
  const lvl = b.level == null ? null : Math.round(b.level * 100);
  if (pow) { pow.textContent = lvl === null ? 'Not reported' : `${lvl}%${b.charging ? ' · charging' : ''}`; $('vitalPowerBar').style.width = lvl === null ? '0%' : `${lvl}%`; }
  const t = weatherTemp(state.weather), h = state.weather?.current?.relative_humidity_2m;
  if (air) air.textContent = t === undefined ? '--' : `${Math.round(t)}°C · ${Math.round(h ?? 0)}%`;

  // Header pills
  const pOn = $('pillOnline');
  if (pOn) pOn.classList.toggle('wi-pill-w', !state.online);
  const pGps = $('pillGps');
  if (pGps) pGps.classList.toggle('wi-pill-w', state.gpsStatus !== 'ok' || isStale(state.fix?.ts));
}

function renderNavLocation() {
  const gs = $('navGpsStatus'); if (gs) gs.textContent = { ok: 'Active', locating: 'Searching', denied: 'Denied', unavailable: 'No signal', idle: 'Idle' }[state.gpsStatus] || state.gpsStatus;
  $('navLat') && ($('navLat').textContent = state.fix ? state.fix.lat.toFixed(5) : '—');
  $('navLon') && ($('navLon').textContent = state.fix ? state.fix.lng.toFixed(5) : '—');
  $('navAcc') && ($('navAcc').textContent = state.fix && state.fix.accuracy != null ? `±${Math.round(state.fix.accuracy)} m` : '—');
}

function renderMessages() {
  const containers = [$('voiceConversation'), $('chatMessages')];
  containers.forEach(c => {
    if (!c) return;
    if (state.messages.length === 0) {
      c.innerHTML = '<p class="wi-tx text-center" style="color:#9d92d6">Tap the mic or type to begin.</p>';
      return;
    }
    c.innerHTML = state.messages.map(m => {
      const isUser = m.role === 'user';
      const bg = m.error ? 'rgba(255,61,138,.15)' : isUser ? 'rgba(0,224,255,.15)' : 'rgba(20,14,56,.55)';
      const border = m.error ? 'rgba(255,61,138,.5)' : isUser ? 'rgba(0,224,255,.4)' : 'rgba(124,92,255,.4)';
      const align = isUser ? 'flex-end' : 'flex-start';
      return `<div class="select-text" style="align-self:${align};max-width:85%;padding:10px 14px;border-radius:16px;background:${bg};border:1px solid ${border};color:#d9d3ff;font-size:14px;line-height:1.5">${escapeHtml(m.content)}</div>`;
    }).join('');
    c.scrollTop = c.scrollHeight;
  });
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function renderClock() { $('clockValue').textContent = fmtTime(); $('dateValue').textContent = fmtDate(); }

function renderHome() { renderSpeedDial(); renderTelemetry(); renderTrip(); renderVitals(); }

/* ---------- Drive (fuel tracker) ---------- */
function renderDrive() {
  const fills = state.fills || [];
  $('fillsCount').textContent = String(fills.length);
  const list = $('fillsList');
  if (fills.length === 0) { list.innerHTML = '<li class="wi-cap" style="justify-content:center;color:#9d92d6">No fills yet</li>'; }
  else {
    list.innerHTML = fills.slice().reverse().slice(0, 20).map(f => `<li><b>${f.liters.toFixed(2)} L · SAR ${(f.liters * f.price).toFixed(2)} · ${f.odo} km</b><button type="button" class="wi-xbtn" data-fill="${f.id}">✕</button></li>`).join('');
    list.querySelectorAll('[data-fill]').forEach(btn => btn.addEventListener('click', () => deleteFill(btn.dataset.fill)));
  }
  // Stats
  const sorted = fills.slice().sort((a, b) => a.odo - b.odo);
  let totalCost = 0, totalDistance = 0, totalLiters = 0;
  fills.forEach(f => totalCost += f.liters * f.price);
  for (let i = 1; i < sorted.length; i++) { totalDistance += sorted[i].odo - sorted[i - 1].odo; totalLiters += sorted[i].liters; }
  $('statCost').textContent = `SAR ${totalCost.toFixed(2)}`;
  $('statDistance').textContent = totalDistance > 0 ? `${totalDistance} km` : '—';
  $('statConsumption').textContent = totalDistance > 0 ? `${(totalDistance / totalLiters).toFixed(2)} km/L` : '—';
  $('statCostPerKm').textContent = totalDistance > 0 ? `SAR ${(totalCost / totalDistance).toFixed(3)}/km` : '—';
  // Tank level (simplified: last odometer vs avg consumption)
  const avgL = 42;
  let lastLevel = 0;
  if (sorted.length > 0) { const lastOdo = sorted[sorted.length - 1].odo; const drivenSince = Math.max(0, (state.trip.active && state.trip.startedAt ? 0 : 0) + 0); lastLevel = 0.7; }
  $('fuelLevel').textContent = sorted.length > 0 ? '~70%' : '—';
  $('fuelBar').style.width = sorted.length > 0 ? '70%' : '0%';
}
function addFill() {
  const l = parseFloat($('fillLiters').value);
  const p = parseFloat($('fillPrice').value);
  const o = parseInt($('fillOdo').value, 10);
  if (!Number.isFinite(l) || l <= 0) { alert('Enter valid liters'); return; }
  if (!Number.isFinite(p) || p <= 0) { alert('Enter valid price'); return; }
  if (!Number.isFinite(o) || o < 0) { alert('Enter valid odometer'); return; }
  state.fills = [...state.fills, { id: 'f_' + Date.now(), liters: l, price: p, odo: o }];
  storeWrite('fills', state.fills);
  $('fillLiters').value = ''; $('fillOdo').value = '';
  renderDrive();
}
function deleteFill(id) {
  state.fills = state.fills.filter(f => f.id !== id);
  storeWrite('fills', state.fills);
  renderDrive();
}

/* ---------- Navigation (screens) ---------- */
function showTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.wi-screen').forEach(s => s.style.display = 'none');
  const el = $('screen-' + tab);
  if (el) el.style.display = 'block';
  document.querySelectorAll('.wi-docklink').forEach(a => a.classList.toggle('wi-docklink-on', a.dataset.tab === tab));
  $('main').scrollTop = 0;
}

/* ---------- Pull to refresh ---------- */
function initPullRefresh() {
  const main = $('main');
  if (!main) return;
  let startY = null, pull = 0;
  main.addEventListener('touchstart', e => { if (main.scrollTop === 0) startY = e.touches[0].clientY; }, { passive: true });
  main.addEventListener('touchmove', e => { if (startY == null) return; const d = e.touches[0].clientY - startY; if (d > 0 && main.scrollTop === 0) pull = Math.min(d * 0.5, 90); }, { passive: true });
  main.addEventListener('touchend', async () => { if (pull >= PULL_THRESHOLD) { await fetchWeather(); } startY = null; pull = 0; });
}

/* ---------- Overspeed watcher ---------- */
let overspeedAlerted = false;
function initOverspeedWatcher() {
  setInterval(() => {
    const spd = state.fix?.speed;
    const stale = isStale(state.fix?.ts);
    if (typeof spd !== 'number' || stale) return;
    if (spd >= SPEED_LIMIT && !overspeedAlerted) {
      overspeedAlerted = true;
      const msg = overspeedAlert(spd);
      state.lastReply = msg;
      renderCoreText();
      speak(msg);
    } else if (spd <= 100) {
      overspeedAlerted = false;
    }
  }, 1000);
}

/* ---------- Boot intro ---------- */
function runBoot() {
  const boot = $('bootScreen');
  if (!boot) return;
  let hasBooted = false;
  try { hasBooted = !!sessionStorage.getItem(BOOT_FLAG); } catch {}
  if (hasBooted) { boot.remove(); return; }
  const steps = ['Hologram core', 'GPS receiver', 'Voice link — Sarah', 'Groq uplink', 'Attrage 2023 telemetry'];
  const list = $('bootList');
  list.innerHTML = steps.map(s => `<div class="flex items-center justify-between gap-3" data-step><span class="label-cap" style="font-size:14px;color:rgba(157,146,214,.6)">${s}</span><span class="num" style="font-size:14px;color:rgba(157,146,214,.4)">--</span></div>`).join('');
  const items = list.querySelectorAll('[data-step]');
  let idx = 0, skipped = false;
  const skip = () => {
    if (skipped) return;
    skipped = true;
    try { sessionStorage.setItem(BOOT_FLAG, '1'); } catch {}
    boot.style.opacity = '0';
    boot.style.pointerEvents = 'none';
    setTimeout(() => boot.remove(), 500);
  };
  boot.addEventListener('click', skip);
  sfxBoot();
  const tick = () => {
    if (skipped) return;
    if (idx < items.length) {
      items.forEach((el, i) => {
        const label = el.querySelector('.label-cap'); const val = el.querySelector('.num');
        if (i < idx) { label.style.color = '#d9d3ff'; val.style.color = '#00e0ff'; val.textContent = 'OK'; }
        else if (i === idx) { label.style.color = '#00e0ff'; val.style.color = 'rgba(0,224,255,.7)'; val.textContent = '…'; }
        else { label.style.color = 'rgba(157,146,214,.6)'; val.style.color = 'rgba(157,146,214,.4)'; val.textContent = '--'; }
      });
      $('bootBar').style.width = `${((idx + 1) / items.length) * 100}%`;
      idx++;
      setTimeout(tick, 240);
    } else {
      items.forEach(el => { el.querySelector('.label-cap').style.color = '#d9d3ff'; el.querySelector('.num').style.color = '#00e0ff'; el.querySelector('.num').textContent = 'OK'; });
      $('bootStatus').textContent = 'SYSTEM ONLINE';
      $('bootBar').style.width = '100%';
      setTimeout(skip, 500);
    }
  };
  tick();
}

/* ---------- Chat modal ---------- */
function openChat() { state.chatOpen = true; $('chatModal').style.display = 'flex'; setTimeout(() => $('chatInput').focus(), 100); }
function closeChat() { state.chatOpen = false; $('chatModal').style.display = 'none'; }

/* ---------- Init ---------- */
function init() {
  if (state.settings.soundFx === false) soundEnabled = false;
  renderSpeedStatic();
  renderClock();
  setInterval(renderClock, 1000);
  renderMessages();
  renderHome();
  renderDrive();
  renderNavLocation();
  showTab('home');
  runBoot();
  initGPS();
  fetchWeather();
  setInterval(fetchWeather, 900000);
  setInterval(renderTrip, 1000);
  initBattery();
  initSpeech();
  initOverspeedWatcher();
  initPullRefresh();

  // Dock
  document.querySelectorAll('.wi-docklink').forEach(a => a.addEventListener('click', e => { e.preventDefault(); showTab(a.dataset.tab); }));

  // Header chat
  $('openChatBtn').addEventListener('click', openChat);
  $('coreOpenChatBtn').addEventListener('click', openChat);
  $('chatCloseBtn').addEventListener('click', closeChat);
  $('chatModal').addEventListener('click', e => { if (e.target.id === 'chatModal') closeChat(); });

  // Chat form
  $('chatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('chatInput').value.trim(); if (!v) return; $('chatInput').value = ''; handleCommand(v); });

  // Voice screen
  $('voiceMicBtn').addEventListener('click', listenToggle);
  $('voiceSendBtn').addEventListener('click', () => { const v = $('voiceInput').value.trim(); if (!v) return; $('voiceInput').value = ''; handleCommand(v); });
  $('voiceInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('voiceSendBtn').click(); } });

  // Core mic
  $('coreMicBtn').addEventListener('click', listenToggle);

  // Quick chips
  document.querySelectorAll('[data-cmd]').forEach(btn => btn.addEventListener('click', () => handleCommand(btn.dataset.cmd)));

  // Trip buttons
  $('tripStartBtn').addEventListener('click', tripStart);
  $('tripStopBtn').addEventListener('click', tripStop);
  $('tripResetBtn').addEventListener('click', tripReset);

  // Nav
  $('navOpenBtn').addEventListener('click', () => { const d = $('navDest').value.trim(); if (d) openDirections({ from: null, to: d }); else window.open('https://www.google.com/maps', '_blank'); });
  document.querySelectorAll('[data-dest]').forEach(btn => btn.addEventListener('click', () => { window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(btn.dataset.dest)}`, '_blank'); }));
  $('navRefreshBtn').addEventListener('click', () => { if (gpsWatchId != null) navigator.geolocation.clearWatch(gpsWatchId); initGPS(); });

  // Apps: internal launcher tiles switch to dedicated WIJI screens.
  document.querySelectorAll('[data-open-tab]').forEach(btn => btn.addEventListener('click', () => {
    const tab = btn.dataset.openTab;
    if (['home', 'drive', 'voice', 'nav', 'media', 'tools'].includes(tab)) showTab(tab);
  }));

  // External web apps open separately so WIJI stays available as the launcher.
  document.querySelectorAll('[data-url]').forEach(btn => btn.addEventListener('click', () => window.open(btn.dataset.url, '_blank', 'noopener,noreferrer')));

  // Tools
  $('toggleVoice').checked = state.settings.voiceReplies !== false;
  $('toggleVoice').addEventListener('change', e => { state.settings.voiceReplies = e.target.checked; storeWrite('settings', state.settings); });
  $('toggleSound').checked = state.settings.soundFx !== false;
  $('toggleSound').addEventListener('change', e => { state.settings.soundFx = e.target.checked; soundEnabled = e.target.checked; storeWrite('settings', state.settings); });
  $('clearChatBtn').addEventListener('click', () => { if (confirm('Clear all chat history?')) { state.messages = []; storeWrite('chat', []); renderMessages(); } });

  // Drive fills
  $('fillSubmitBtn').addEventListener('click', addFill);

  // Backend health
  fetch(WORKER_URL.replace(/\/$/, '') + '/health').then(r => r.json()).then(d => $('backendStatus').textContent = d.status === 'ok' ? 'Online' : 'Unknown').catch(() => $('backendStatus').textContent = 'Offline');

  // Driver name
  fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '__whoami__' }) }).catch(() => {});

  // Online/offline
  window.addEventListener('online', () => { state.online = true; renderVitals(); });
  window.addEventListener('offline', () => { state.online = false; renderVitals(); });

  // Ambient tap sound
  document.addEventListener('pointerdown', e => { const b = e.target.closest('button, a'); if (b && soundEnabled && b.id !== 'voiceMicBtn' && b.id !== 'coreMicBtn') sfxTap(); }, { passive: true });
}

document.addEventListener('DOMContentLoaded', init);
