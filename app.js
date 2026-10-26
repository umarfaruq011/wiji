/* ============================================================
   WIJI — Stage 8.0 · Main Application Logic
   ============================================================ */

/* ---------- CONFIG ---------- */
const WORKER_URL = "https://wiji-worker-backend.umaremotions.workers.dev/";
const TIMEZONE = "Asia/Riyadh";
const SILENCE_MS = 1500;
const HISTORY_KEY = 'wiji_history_v1';
const TRIP_KEY = 'wiji_trip_v1';
const MAINT_KEY = 'wiji_maint_v1';
const SETTINGS_KEY = 'wiji_settings_v1';
const MAX_HISTORY = 30;
const SEND_HISTORY = 6;
const SPEED_STALE_MS = 30000;
const TRIP_ACCURACY_LIMIT = 30;
const TRIP_MAX_SPEED_KMH = 200;
const TRIP_MIN_DT = 1;
const TRIP_MAX_DT = 60;
const MAINT_DUE_SOON_DAYS = 7;
const MAINT_DUE_SOON_KM = 500;

/* ---------- AUDIO FX ---------- */
const AudioFX = (() => {
  let ctx = null, master = null, enabled = true;
  const ensure = () => {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };
  const tone = (from, to, dur, level, type = 'sine', at) => {
    if (!enabled) return;
    const c = ensure(); if (!c) return;
    const t0 = at ?? c.currentTime + 0.001;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(level, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  };
  const noise = (t0, dur, level) => {
    if (!enabled) return;
    const c = ensure(); if (!c) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 3200; filt.Q.value = 0.9;
    const g = c.createGain(); g.gain.value = level;
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t0);
  };
  return {
    enable(v) { enabled = !!v; },
    tap() {
      if (!enabled) return;
      const c = ensure(); if (!c) return;
      const t0 = c.currentTime + 0.001;
      noise(t0, 0.05, 0.16);
      tone(1240, 1860, 0.10, 0.18, 'triangle', t0);
      tone(2480, 3100, 0.07, 0.06, 'sine', t0 + 0.01);
    },
    micOn() {
      if (!enabled) return;
      const c = ensure(); if (!c) return;
      const t0 = c.currentTime + 0.001;
      tone(320, 940, 0.26, 0.24, 'triangle', t0);
      tone(640, 1880, 0.24, 0.08, 'sine', t0 + 0.02);
      tone(120, 70, 0.18, 0.26, 'sine', t0);
      noise(t0, 0.08, 0.09);
    },
    micOff() {
      if (!enabled) return;
      const c = ensure(); if (!c) return;
      const t0 = c.currentTime + 0.001;
      tone(940, 340, 0.22, 0.20, 'triangle', t0);
      tone(1880, 620, 0.20, 0.07, 'sine', t0 + 0.01);
      tone(100, 60, 0.16, 0.22, 'sine', t0);
      noise(t0, 0.06, 0.07);
    },
    bootChime() {
      if (!enabled) return;
      const c = ensure(); if (!c) return;
      const t0 = c.currentTime + 0.001;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      g.connect(master);
      [523.25, 783.99, 1046.5].forEach((freq, i) => {
        const t = t0 + i * 0.13;
        const osc = c.createOscillator();
        const gg = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gg.gain.setValueAtTime(0.0001, t);
        gg.gain.linearRampToValueAtTime(0.5, t + 0.05);
        gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
        osc.connect(gg); gg.connect(g);
        osc.start(t); osc.stop(t + 1.05);
      });
    }
  };
})();

['pointerdown', 'touchstart', 'keydown'].forEach(ev => {
  window.addEventListener(ev, function once() {
    try { new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    window.removeEventListener(ev, once);
  }, { once: true, passive: true });
});

document.addEventListener('pointerdown', (e) => {
  const btn = e.target instanceof Element ? e.target.closest('button, a, [role="button"]') : null;
  if (btn && !btn.classList.contains('wi-orb-mic') && !btn.classList.contains('wi-mic') && !btn.classList.contains('wi-mic-large')) {
    AudioFX.tap();
  }
});

/* ---------- DOM REFS ---------- */
const bodyEl = document.body;
const clockValue = document.getElementById('clockValue');
const dateValue = document.getElementById('dateValue');
const statusPill = document.getElementById('statusPill');
const gpsPill = document.getElementById('gpsPill');
const speedValue = document.getElementById('speedValue');
const speedSource = document.getElementById('speedSource');
const headingValue = document.getElementById('headingValue');
const headingDir = document.getElementById('headingDir');
const tripValue = document.getElementById('tripValue');
const accValue = document.getElementById('accValue');
const fuelValue = document.getElementById('fuelValue');
const scoreValue = document.getElementById('scoreValue');
const tempValue = document.getElementById('tempValue');
const voiceMic = document.getElementById('voiceMic');
const orbMic = document.getElementById('orbMic');
const textInput = document.getElementById('textInput');
const sendBtn = document.getElementById('sendBtn');
const conversation = document.getElementById('conversation');
const weatherWidget = document.getElementById('weatherWidget');
const chatWidget = document.getElementById('chatWidget');
const navDest = document.getElementById('navDest');
const navOpen = document.getElementById('navOpen');
const navGpsStatus = document.getElementById('navGpsStatus');
const navLat = document.getElementById('navLat');
const navLon = document.getElementById('navLon');
const navAcc = document.getElementById('navAcc');
const navRefreshGps = document.getElementById('navRefreshGps');
const gpsToggleDesc = document.getElementById('gpsToggleDesc');
const fuelToggleDesc = document.getElementById('fuelToggleDesc');
const tripStatus = document.getElementById('tripStatus');
const tripCurrent = document.getElementById('tripCurrent');
const tripDurSub = document.getElementById('tripDurSub');
const tripToday = document.getElementById('tripToday');
const tripCost = document.getElementById('tripCost');
const tripStartBtn = document.getElementById('tripStartBtn');
const tripEndBtn = document.getElementById('tripEndBtn');
const tripResetBtn = document.getElementById('tripResetBtn');
const maintOdo = document.getElementById('maintOdo');
const maintName = document.getElementById('maintName');
const maintType = document.getElementById('maintType');
const maintDateRow = document.getElementById('maintDateRow');
const maintKmRow = document.getElementById('maintKmRow');
const maintDate = document.getElementById('maintDate');
const maintKm = document.getElementById('maintKm');
const maintNotes = document.getElementById('maintNotes');
const maintAddBtn = document.getElementById('maintAddBtn');
const maintList = document.getElementById('maintList');
const rateRange = document.getElementById('rateRange');
const rateValue = document.getElementById('rateValue');
const fuelEfficiency = document.getElementById('fuelEfficiency');
const fuelPrice = document.getElementById('fuelPrice');
const aiBackendStatus = document.getElementById('aiBackendStatus');

/* ---------- STATE ---------- */
let recognition = null;
let startingRecognition = false;
let isListening = false;
let isSpeaking = false;
let isWaitingForAI = false;
let finalTranscript = "";
let silenceTimer = null;
let currentState = 'idle';
let currentAudio = null;

const gps = { status: 'waiting', lat: null, lon: null, accuracy: null, heading: null, lastUpdate: null, watchId: null };
let fixHistory = [];
let smoothedSpeedKmh = null;
let firstFixLogged = false;
let overspeedAlerted = false;
let overspeedTimeout = null;

const trip = { active: false, startTime: null, endTime: null, distanceMeters: 0, lastPosition: null, todayDate: null, todayTotalMeters: 0 };
let maintenance = { odometerKm: null, reminders: [] };

let settings = {
  shareGps: localStorage.getItem('wiji_shareGps') === '1',
  fuelEfficiency: 12,
  fuelPrice: 2.18,
  ttsRate: 1.0
};

let chatHistory = [];
let lastSpokenText = '';
let lastSpokenAt = 0;
let ttsPrimed = false;

/* ---------- SETTINGS ---------- */
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        if (saved.fuelEfficiency) settings.fuelEfficiency = parseFloat(saved.fuelEfficiency) || 12;
        if (saved.fuelPrice) settings.fuelPrice = parseFloat(saved.fuelPrice) || 2.18;
        if (saved.ttsRate) settings.ttsRate = parseFloat(saved.ttsRate) || 1.0;
      }
    }
  } catch {}
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

/* ---------- BOOT INTRO ---------- */
(function runBoot() {
  const bootScreen = document.getElementById('bootScreen');
  if (!bootScreen) return;
  const bootStatus = document.getElementById('bootStatus');
  const bootList = document.getElementById('bootList');
  const bootBarFill = document.getElementById('bootBarFill');
  const steps = ['Hologram core', 'GPS receiver', 'Voice link', 'Groq uplink', 'Attrage 2023 telemetry'];
  steps.forEach(label => {
    const el = document.createElement('div');
    el.className = 'wi-boot-item';
    el.innerHTML = `<span class="lbl">${label}</span><span class="val">--</span>`;
    bootList.appendChild(el);
  });
  const items = bootList.querySelectorAll('.wi-boot-item');
  let idx = 0;
  let skipped = false;
  const STEP_MS = 220;
  const skip = () => {
    if (skipped) return;
    skipped = true;
    bootScreen.classList.add('wi-boot-done');
    setTimeout(() => bootScreen.remove(), 600);
  };
  bootScreen.addEventListener('click', skip);
  AudioFX.bootChime();
  const tick = () => {
    if (skipped) return;
    if (idx < items.length) {
      items.forEach((el, i) => {
        el.classList.remove('wi-active', 'wi-done');
        if (i < idx) el.classList.add('wi-done');
        if (i === idx) el.classList.add('wi-active');
        const v = el.querySelector('.val');
        if (i < idx) v.textContent = 'OK';
        else if (i === idx) v.textContent = '...';
        else v.textContent = '--';
      });
      bootBarFill.style.width = `${((idx + 1) / items.length) * 100}%`;
      idx++;
      setTimeout(tick, STEP_MS);
    } else {
      items.forEach(el => { el.classList.add('wi-done'); el.querySelector('.val').textContent = 'OK'; });
      bootStatus.textContent = 'SYSTEM ONLINE';
      bootBarFill.style.width = '100%';
      setTimeout(skip, 500);
    }
  };
  tick();
})();

/* ---------- STATE ---------- */
function setState(state) {
  currentState = state;
  bodyEl.className = 'state-' + state;
  if (gps.status === 'unavailable' || (gps.lastUpdate && Date.now() - gps.lastUpdate > SPEED_STALE_MS)) {
    bodyEl.classList.add('gps-stale');
  }
  const pillLabels = { idle: 'Ready', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking', error: 'Error' };
  if (statusPill) statusPill.querySelector('span').textContent = pillLabels[state] || 'Ready';
}

async function checkInternet() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    await fetch('https://www.google.com/favicon.ico', { method: 'HEAD', mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    return true;
  } catch { return false; }
}

/* ---------- CLOCK ---------- */
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: true });
const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, weekday: 'short', day: '2-digit', month: 'short' });
function updateClock() {
  if (document.hidden) return;
  const now = new Date();
  if (clockValue) clockValue.textContent = timeFmt.format(now);
  if (dateValue) dateValue.textContent = dateFmt.format(now);
}
function getRiyadhDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const p = {}; for (const x of parts) if (x.type !== 'literal') p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}
function updateTodayDate() {
  const current = getRiyadhDate();
  if (trip.todayDate !== current) { trip.todayDate = current; trip.todayTotalMeters = 0; saveTrip(); }
}

/* ---------- SCREEN NAVIGATION ---------- */
function showScreen(name) {
  document.querySelectorAll('.wi-screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
  document.querySelectorAll('.wi-docklink').forEach(t => {
    const map = { 'home': 'home', 'voice': 'voice', 'nav': 'nav', 'media': 'media', 'tools': 'tools', 'trip': 'tools', 'maint': 'tools', 'settings': 'tools', 'obd': 'tools', 'about': 'tools' };
    t.classList.toggle('wi-docklink-on', map[name] === t.dataset.tab);
  });
  const main = document.getElementById('main');
  if (main) main.scrollTop = 0;
}
document.querySelectorAll('.wi-docklink').forEach(tab => {
  tab.addEventListener('click', () => showScreen(tab.dataset.tab));
});
document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.back));
});

/* ---------- CHAT HISTORY ---------- */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    chatHistory = arr.slice(-MAX_HISTORY);
    for (const m of chatHistory) if (m.role === 'user' || m.role === 'assistant') addMessage(m.role === 'user' ? 'user' : 'wiji', m.content, false);
    renderChatWidget();
  } catch {}
}
function saveHistory() {
  try { const trimmed = chatHistory.slice(-MAX_HISTORY); localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed)); chatHistory = trimmed; } catch {}
}
function pushHistory(role, content) {
  chatHistory.push({ role, content });
  if (chatHistory.length > MAX_HISTORY) chatHistory = chatHistory.slice(-MAX_HISTORY);
  saveHistory();
  renderChatWidget();
}
function clearConversation() {
  chatHistory = [];
  localStorage.removeItem(HISTORY_KEY);
  if (conversation) conversation.innerHTML = '<div class="wi-conv-empty">Tap the mic or type to begin.</div>';
  renderChatWidget();
}
function renderChatWidget() {
  if (!chatWidget) return;
  if (chatHistory.length === 0) { chatWidget.textContent = 'No messages yet'; return; }
  const last = chatHistory[chatHistory.length - 1];
  const preview = last.content.slice(0, 40) + (last.content.length > 40 ? '…' : '');
  chatWidget.textContent = (last.role === 'user' ? 'You: ' : 'WIJI: ') + preview;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- TRIP ---------- */
function saveTrip() { try { localStorage.setItem(TRIP_KEY, JSON.stringify(trip)); } catch {} }
function loadTrip() {
  try {
    const raw = localStorage.getItem(TRIP_KEY); if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') for (const k of ['active','startTime','endTime','distanceMeters','lastPosition','todayDate','todayTotalMeters']) if (k in saved) trip[k] = saved[k];
  } catch {}
}
function setupTripControls() {
  if (tripStartBtn) tripStartBtn.addEventListener('click', () => {
    if (trip.active) return;
    if (trip.startTime == null) trip.startTime = Date.now();
    trip.active = true; trip.endTime = null;
    if (gps.status === 'active' && gps.lat != null) trip.lastPosition = { lat: gps.lat, lon: gps.lon, t: Date.now(), accuracy: gps.accuracy };
    saveTrip(); renderTrip();
  });
  if (tripEndBtn) tripEndBtn.addEventListener('click', () => {
    if (!trip.active) return;
    trip.active = false; trip.endTime = Date.now(); saveTrip(); renderTrip();
    const m = Math.round(trip.distanceMeters), dur = formatDuration(trip.startTime);
    const summary = `Trip ended. ${m} meters in ${dur}.`;
    addMessage('wiji', summary); pushHistory('assistant', summary); setState('idle'); speak(summary);
  });
  if (tripResetBtn) tripResetBtn.addEventListener('click', () => {
    trip.active = false; trip.startTime = null; trip.endTime = null; trip.distanceMeters = 0; trip.lastPosition = null;
    saveTrip(); renderTrip();
  });
}
function processTripFix(lat, lon, accuracy, now) {
  if (!trip.active) return;
  updateTodayDate();
  if (!trip.lastPosition) { trip.lastPosition = { lat, lon, t: now, accuracy }; saveTrip(); return; }
  const dt = (now - trip.lastPosition.t) / 1000;
  const d = haversineMeters(trip.lastPosition.lat, trip.lastPosition.lon, lat, lon);
  const acc = Number.isFinite(accuracy) ? accuracy : 999;
  if (dt > TRIP_MAX_DT) { trip.lastPosition = { lat, lon, t: now, accuracy }; saveTrip(); return; }
  if (dt < TRIP_MIN_DT) return;
  if (acc > TRIP_ACCURACY_LIMIT) return;
  if (d / dt * 3.6 > TRIP_MAX_SPEED_KMH) return;
  if (d < Math.max(2, acc * 0.5)) return;
  trip.distanceMeters += d; trip.todayTotalMeters += d;
  trip.lastPosition = { lat, lon, t: now, accuracy }; saveTrip(); renderTrip();
}
function formatDuration(startTime) {
  if (!startTime) return '00:00';
  const end = trip.active ? Date.now() : (trip.endTime || Date.now());
  const totalSec = Math.max(0, Math.floor((end - startTime) / 1000));
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`;
  const s = totalSec % 60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function formatMeters(m) { return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`; }
function renderTrip() {
  if (tripStatus) {
    if (trip.active) tripStatus.textContent = 'Recording';
    else if (trip.startTime && trip.distanceMeters > 0) tripStatus.textContent = 'Ended';
    else tripStatus.textContent = 'Idle';
  }
  if (tripCurrent) tripCurrent.textContent = formatMeters(trip.distanceMeters);
  if (tripDurSub) tripDurSub.textContent = formatDuration(trip.startTime);
  if (tripToday) tripToday.textContent = formatMeters(trip.todayTotalMeters);
  if (tripCost) {
    const km = trip.distanceMeters / 1000;
    const liters = km / settings.fuelEfficiency;
    const cost = liters * settings.fuelPrice;
    tripCost.textContent = `SAR ${cost.toFixed(2)}`;
  }
  if (tripStartBtn) tripStartBtn.disabled = trip.active;
  if (tripEndBtn) tripEndBtn.disabled = !trip.active;
  if (tripValue) tripValue.textContent = formatMeters(trip.distanceMeters);
}

/* ---------- MAINTENANCE ---------- */
function loadMaintenance() {
  try {
    const raw = localStorage.getItem(MAINT_KEY); if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      maintenance.odometerKm = Number.isFinite(saved.odometerKm) ? saved.odometerKm : null;
      maintenance.reminders = Array.isArray(saved.reminders) ? saved.reminders : [];
    }
  } catch {}
}
function saveMaintenance() { try { localStorage.setItem(MAINT_KEY, JSON.stringify(maintenance)); } catch {} }
function setupMaintenance() {
  if (maintType) maintType.addEventListener('change', () => {
    const isDate = maintType.value === 'date';
    if (maintDateRow) maintDateRow.style.display = isDate ? '' : 'none';
    if (maintKmRow) maintKmRow.style.display = isDate ? 'none' : '';
  });
  if (maintOdo) maintOdo.addEventListener('change', () => {
    const n = parseInt(maintOdo.value, 10);
    maintenance.odometerKm = Number.isFinite(n) && n >= 0 ? n : null;
    saveMaintenance(); renderMaintenanceList();
  });
  if (maintAddBtn) maintAddBtn.addEventListener('click', () => {
    const name = maintName.value.trim();
    if (!name) { alert('Please enter a name.'); return; }
    const type = maintType.value;
    let dueDate = null, dueKm = null;
    if (type === 'date') { if (!maintDate.value) { alert('Pick a due date.'); return; } dueDate = maintDate.value; }
    else { const n = parseInt(maintKm.value, 10); if (!Number.isFinite(n) || n < 0) { alert('Enter a due odometer.'); return; } dueKm = n; }
    maintenance.reminders.push({ id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), name, type, dueDate, dueKm, notes: maintNotes.value.trim() });
    saveMaintenance();
    maintName.value = ''; maintDate.value = ''; maintKm.value = ''; maintNotes.value = '';
    renderMaintenanceList();
  });
}
function deleteReminder(id) { maintenance.reminders = maintenance.reminders.filter(r => r.id !== id); saveMaintenance(); renderMaintenanceList(); }
function getReminderStatus(r) {
  if (r.type === 'date' && r.dueDate) {
    const daysUntil = Math.ceil((new Date(r.dueDate + 'T00:00:00Z').getTime() - Date.now()) / (1000*60*60*24));
    return { due: daysUntil <= MAINT_DUE_SOON_DAYS, label: daysUntil < 0 ? `Overdue by ${Math.abs(daysUntil)}d` : daysUntil === 0 ? 'Due today' : `Due in ${daysUntil}d` };
  }
  if (r.type === 'mileage' && r.dueKm != null) {
    if (maintenance.odometerKm == null) return { due: false, label: `Due at ${r.dueKm} km` };
    const kmUntil = r.dueKm - maintenance.odometerKm;
    return { due: kmUntil <= MAINT_DUE_SOON_KM, label: kmUntil < 0 ? `Overdue by ${Math.abs(kmUntil)}km` : kmUntil === 0 ? 'Due now' : `Due in ${kmUntil}km` };
  }
  return { due: false, label: '' };
}
function renderMaintenanceList() {
  if (!maintList) return;
  maintList.innerHTML = '';
  if (maintenance.reminders.length === 0) { maintList.innerHTML = '<p style="font-size:13px;color:var(--text-3);padding:12px 0;text-align:center;font-weight:500;">No reminders yet.</p>'; return; }
  for (const r of maintenance.reminders) {
    const st = getReminderStatus(r);
    const item = document.createElement('div'); item.className = 'wi-maint-item';
    const info = document.createElement('div'); info.className = 'wi-maint-info';
    const nm = document.createElement('div'); nm.className = 'wi-maint-name'; nm.textContent = r.name;
    const du = document.createElement('div'); du.className = 'wi-maint-due' + (st.due ? (st.label.startsWith('Overdue') ? ' overdue' : ' soon') : '');
    du.textContent = st.label + (r.notes ? ` · ${r.notes}` : '');
    info.appendChild(nm); info.appendChild(du);
    const del = document.createElement('button'); del.className = 'wi-maint-delete'; del.textContent = '✕';
    del.addEventListener('click', () => deleteReminder(r.id));
    item.appendChild(info); item.appendChild(del);
    maintList.appendChild(item);
  }
}
function getDueRemindersForContext() {
  return maintenance.reminders.map(r => ({ r, st: getReminderStatus(r) })).filter(x => x.st.due).slice(0,3).map(x => ({ name: x.r.name, dueInfo: x.st.label }));
}

/* ---------- SPEECH RECOGNITION ---------- */
function setupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    setState('error');
    addMessage('system', 'Speech recognition unavailable. Use text input.');
    return;
  }
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-IN';
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    startingRecognition = false;
    isListening = true;
    finalTranscript = "";
    setState('listening');
  };

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += t + " ";
      else interim += t;
    }
    const display = (finalTranscript + interim).trim();
    if (silenceTimer) clearTimeout(silenceTimer);
    if (display) {
      silenceTimer = setTimeout(() => { if (isListening) { try { recognition.stop(); } catch {} } }, SILENCE_MS);
    }
  };

  recognition.onerror = (event) => {
    startingRecognition = false;
    if (event.error === 'not-allowed') { addMessage('system', 'Microphone denied. Allow in browser settings.'); setState('error'); }
    else if (event.error === 'no-speech') setState('idle');
    else if (event.error === 'aborted') {}
    else if (event.error === 'network') { addMessage('system', 'Microphone network error.'); setState('error'); }
    else { addMessage('system', 'Speech error: ' + event.error); setState('error'); }
  };

  recognition.onend = () => {
    startingRecognition = false;
    if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
    const text = finalTranscript.trim();
    finalTranscript = "";
    isListening = false;
    if (text) setTimeout(() => handleUserUtterance(text), 200);
    else if (currentState === 'listening') setState('idle');
  };
}

function handleMicTap() {
  if (isSpeaking) {
    if (currentAudio) { try { currentAudio.pause(); currentAudio = null; } catch {} }
    try { window.speechSynthesis.cancel(); } catch {}
    isSpeaking = false;
    setState('idle');
    return;
  }
  if (isWaitingForAI) { addMessage('system', 'Still thinking…'); return; }
  if (!recognition) return;
  primeTts();
  if (isListening) { AudioFX.micOff(); try { recognition.stop(); } catch {} return; }
  if (startingRecognition) return;
  AudioFX.micOn();
  startingRecognition = true;
  try { recognition.start(); }
  catch (e) {
    startingRecognition = false;
    const msg = String(e.message || '');
    if (msg.includes('already started')) {
      try { recognition.stop(); } catch {}
      setTimeout(() => { try { recognition.start(); startingRecognition = true; } catch (e2) { startingRecognition = false; addMessage('system', 'Mic error: ' + e2.message); } }, 400);
    } else {
      addMessage('system', 'Could not start mic: ' + msg);
    }
  }
}

if (voiceMic) voiceMic.addEventListener('click', handleMicTap);
if (orbMic) orbMic.addEventListener('click', handleMicTap);

function sendTextMessage() {
  if (!textInput) return;
  const t = textInput.value.trim();
  if (!t || isWaitingForAI) return;
  textInput.value = '';
  primeTts();
  handleUserUtterance(t);
}
if (sendBtn) sendBtn.addEventListener('click', sendTextMessage);
if (textInput) textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); sendTextMessage(); }
});

/* ---------- USER UTTERANCE ---------- */
async function handleUserUtterance(text) {
  if (isWaitingForAI) return;
  isWaitingForAI = true;

  const online = await checkInternet();

  const dest = detectMapIntent(text);
  if (dest !== undefined) {
    addMessage('user', text); pushHistory('user', text);
    const url = dest ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}` : `https://www.google.com/maps`;
    const spoken = dest ? `Opening map to ${dest}.` : `Opening Google Maps.`;
    addMessage('wiji', spoken); pushHistory('assistant', spoken); setState('idle'); speak(spoken);
    try { window.open(url, '_blank'); } catch {}
    isWaitingForAI = false; return;
  }

  addMessage('user', text); pushHistory('user', text); setState('thinking');

  let finalMessage = text;
  if (!online) finalMessage = `[System: Internet is OFF. Answer using only your training data. Keep it brief.] User asked: ${text}`;

  const context = buildContext();
  const historyPayload = chatHistory.slice(-SEND_HISTORY - 1, -1).filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.content.slice(0,500) }));

  try {
    const result = await sendWithRetry(finalMessage, context, historyPayload, online, online);
    addMessage('wiji', result.text);
    pushHistory('assistant', result.text);
    setState('idle');
    if (result.audio) playAudioFromBase64(result.audio);
    else speak(result.text);
  } catch (err) {
    try {
      const result = await sendWithRetry(finalMessage, context, historyPayload, false, false);
      addMessage('wiji', result.text);
      pushHistory('assistant', result.text);
      setState('idle');
      speak(result.text);
    } catch (err2) {
      addMessage('system', 'Connection issue. Please try again.');
      setState('idle');
    }
  } finally {
    isWaitingForAI = false;
    if (currentState === 'thinking') setState('idle');
  }
}

function detectMapIntent(text) {
  const patterns = [
    /^(?:open|show|launch|start)\s+(?:me\s+)?(?:the\s+)?(?:google\s+)?maps?(?:\s+(?:to|for)\s+(.+))?$/i,
    /^(?:navigate|directions?)\s+(?:me\s+)?(?:to\s+)?(.+)$/i,
    /^(?:take\s+me|drive\s+me|drive)\s+to\s+(.+)$/i,
  ];
  for (const p of patterns) { const m = text.match(p); if (m) return (m[1] || '').trim().replace(/[.,!?]+$/, ''); }
  return undefined;
}

async function sendWithRetry(text, context, history, useSearch, useElevenLabs, attempt = 1) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  const payload = { message: text, context, history, useSearch, useElevenLabs };
  try {
    const response = await fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (attempt === 1) { await new Promise(r => setTimeout(r, 1000)); return sendWithRetry(text, context, history, false, false, 2); }
      throw new Error(data.error || 'Request failed');
    }
    if (!data.reply) throw new Error('Empty reply');
    return { text: data.reply, audio: data.audio || null };
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Timed out');
    throw e;
  }
}

function buildContext() {
  const includeGps = settings.shareGps && gps.status === 'active' && gps.lat != null;
  const ageSec = gps.lastUpdate ? Math.round((Date.now() - gps.lastUpdate) / 1000) : null;
  let tripDurationSec = 0;
  if (trip.startTime) { const end = trip.active ? Date.now() : (trip.endTime || Date.now()); tripDurationSec = Math.max(0, Math.floor((end - trip.startTime) / 1000)); }
  return {
    tz: TIMEZONE, clientTime: new Date().toISOString(), shareGps: !!includeGps,
    gps: includeGps ? { lat: gps.lat, lon: gps.lon, accuracy: gps.accuracy, speedKmh: smoothedSpeedKmh, heading: gps.heading, ageSeconds: ageSec } : null,
    trip: { active: trip.active, hasStarted: !!trip.startTime, distanceMeters: Math.round(trip.distanceMeters), todayTotalMeters: Math.round(trip.todayTotalMeters), durationSeconds: tripDurationSec },
    maintenance: getDueRemindersForContext(),
  };
}

/* ---------- WEATHER ---------- */
async function fetchWeather() {
  if (gps.status !== 'active' || gps.lat == null) {
    if (weatherWidget) weatherWidget.textContent = 'Needs GPS';
    return;
  }
  if (weatherWidget) weatherWidget.textContent = 'Loading…';
  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${gps.lat.toFixed(4)}&longitude=${gps.lon.toFixed(4)}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=Asia%2FRiyadh`;
    const resp = await fetch(url, { signal: controller.signal }); clearTimeout(timer);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json(); const cur = data.current; if (!cur) throw new Error('No data');
    const desc = weatherCodeToText(cur.weather_code);
    const temp = Math.round(cur.temperature_2m);
    const wind = Math.round(cur.wind_speed_10m);
    const hum = Math.round(cur.relative_humidity_2m);
    const reply = `Weather: ${desc}, ${temp}°, wind ${wind} km/h, humidity ${hum}%.`;
    if (weatherWidget) weatherWidget.textContent = `${temp}° · ${desc}`;
    if (tempValue) tempValue.textContent = `${temp}°C`;
    addMessage('wiji', reply); pushHistory('assistant', reply); setState('idle'); speak(reply);
    showScreen('voice');
  } catch (e) {
    if (weatherWidget) weatherWidget.textContent = 'Unavailable';
    addMessage('system', 'Weather failed: ' + (e.name === 'AbortError' ? 'timeout' : e.message));
  }
}
function weatherCodeToText(code) {
  const map = { 0:'clear',1:'mostly clear',2:'partly cloudy',3:'overcast',45:'fog',48:'freezing fog',51:'light drizzle',53:'drizzle',55:'dense drizzle',61:'light rain',63:'rain',65:'heavy rain',71:'light snow',73:'snow',75:'heavy snow',80:'showers',81:'heavy showers',82:'violent showers',95:'thunderstorm',96:'thunder + hail',99:'severe thunder' };
  return map[code] || 'unknown';
}

/* ---------- TTS ---------- */
function primeTts() {
  if (ttsPrimed || !window.speechSynthesis) return;
  ttsPrimed = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0; u.rate = 2; u.lang = 'en-IN';
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
function chunkText(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { chunks.push(remaining); break; }
    let cut = remaining.lastIndexOf(' ', maxLen);
    if (cut < maxLen * 0.4) cut = maxLen;
    chunks.push(remaining.substring(0, cut).trim());
    remaining = remaining.substring(cut).trim();
  }
  return chunks.filter(c => c.length > 0);
}
function speak(text) {
  if (!window.speechSynthesis) return;
  if (text === lastSpokenText && Date.now() - lastSpokenAt < 3000) return;
  lastSpokenText = text; lastSpokenAt = Date.now();
  try { window.speechSynthesis.cancel(); } catch {}
  setTimeout(() => {
    if (!window.speechSynthesis) return;
    const chunks = chunkText(text, 180);
    speakChunk(chunks, 0);
  }, 120);
}
function speakChunk(chunks, idx) {
  if (!window.speechSynthesis) return;
  if (idx >= chunks.length) {
    isSpeaking = false;
    if (!isWaitingForAI) setState('idle');
    return;
  }
  const utter = new SpeechSynthesisUtterance(chunks[idx]);
  utter.rate = settings.ttsRate; utter.pitch = 1.0; utter.volume = 1.0; utter.lang = 'en-IN';
  if (idx === 0) { isSpeaking = true; setState('speaking'); }
  utter.onend = () => speakChunk(chunks, idx + 1);
  utter.onerror = () => speakChunk(chunks, idx + 1);
  try { window.speechSynthesis.speak(utter); } catch (e) { speakChunk(chunks, idx + 1); }
}

function playAudioFromBase64(base64) {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    if (currentAudio) { try { currentAudio.pause(); URL.revokeObjectURL(currentAudio.src); } catch {} }
    const thisAudio = new Audio(url);
    currentAudio = thisAudio;
    thisAudio.onended = () => { if (currentAudio !== thisAudio) return; isSpeaking = false; setState('idle'); URL.revokeObjectURL(url); currentAudio = null; };
    thisAudio.onerror = () => { if (currentAudio !== thisAudio) return; isSpeaking = false; setState('idle'); URL.revokeObjectURL(url); currentAudio = null; };
    isSpeaking = true;
    setState('speaking');
    thisAudio.play().catch(() => { if (currentAudio !== thisAudio) return; isSpeaking = false; setState('idle'); });
  } catch (e) { setState('idle'); }
}

/* ---------- GPS ---------- */
function startGPS(askNow) {
  if (!navigator.geolocation) { gps.status = 'unsupported'; renderGps(); return; }
  if (gps.watchId != null) { navigator.geolocation.clearWatch(gps.watchId); gps.watchId = null; }
  if (askNow) { gps.status = 'waiting'; renderGps(); }
  gps.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const c = pos.coords; const now = Date.now();
      if (!firstFixLogged) { firstFixLogged = true; }
      gps.status = 'active'; gps.lat = c.latitude; gps.lon = c.longitude;
      gps.accuracy = Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null;
      gps.heading = (Number.isFinite(c.heading) && c.heading >= 0 && c.heading <= 360) ? Math.round(c.heading) : null;
      gps.lastUpdate = now;
      fixHistory.push({ lat: c.latitude, lon: c.longitude, t: now });
      if (fixHistory.length > 8) fixHistory.shift();
      let rawSpeed = null;
      if (Number.isFinite(c.speed) && c.speed >= 0) rawSpeed = c.speed * 3.6;
      else if (fixHistory.length >= 3) {
        const first = fixHistory[0], last = fixHistory[fixHistory.length - 1];
        const dt = (last.t - first.t) / 1000;
        if (dt >= 2 && dt <= 20) rawSpeed = (haversineMeters(first.lat, first.lon, last.lat, last.lon) / dt) * 3.6;
      }
      if (rawSpeed != null) { smoothedSpeedKmh = smoothedSpeedKmh == null ? rawSpeed : smoothedSpeedKmh * 0.6 + rawSpeed * 0.4; if (smoothedSpeedKmh < 0.5) smoothedSpeedKmh = 0; }
      processTripFix(c.latitude, c.longitude, c.accuracy, now);
      renderGps(); renderTrip();
    },
    (err) => {
      gps.lastUpdate = null;
      if (err.code === err.PERMISSION_DENIED) gps.status = 'denied';
      else if (err.code === err.POSITION_UNAVAILABLE) gps.status = 'unavailable';
      else if (err.code === err.TIMEOUT) gps.status = 'timeout';
      else gps.status = 'unavailable';
      renderGps();
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
  );
}

function renderGps() {
  const ageMs = gps.lastUpdate ? (Date.now() - gps.lastUpdate) : null;
  const isStale = ageMs != null && ageMs > SPEED_STALE_MS;
  if (smoothedSpeedKmh == null || isStale) {
    if (speedValue) speedValue.textContent = '--';
    if (speedSource) speedSource.textContent = isStale ? 'STALE GPS' : 'GPS ka intezaar';
    document.documentElement.style.setProperty('--speed-pct', '0');
    document.documentElement.style.setProperty('--speed-color', 'var(--holo)');
    bodyEl.classList.add('gps-stale');
  } else {
    if (speedValue) speedValue.textContent = Math.round(smoothedSpeedKmh);
    if (speedSource) speedSource.textContent = 'GPS SPEED';
    const pct = Math.max(0, Math.min(1, smoothedSpeedKmh / 180));
    document.documentElement.style.setProperty('--speed-pct', String(pct));
    const sc = smoothedSpeedKmh >= 120 ? 'var(--red)' : smoothedSpeedKmh >= 90 ? 'var(--amber)' : 'var(--holo)';
    document.documentElement.style.setProperty('--speed-color', sc);
    bodyEl.classList.remove('gps-stale');
    bodyEl.classList.toggle('overspeed', smoothedSpeedKmh >= 120);

    if (smoothedSpeedKmh >= 110 && !overspeedAlerted) {
      overspeedAlerted = true;
      speak(`Sir, speed ${Math.round(smoothedSpeedKmh)} kilometers per hour. Please slow down.`);
      if (overspeedTimeout) clearTimeout(overspeedTimeout);
      overspeedTimeout = setTimeout(() => { overspeedAlerted = false; }, 30000);
    }
    if (smoothedSpeedKmh < 100) overspeedAlerted = false;
  }
  if (headingValue) {
    if (gps.heading == null || isStale) { headingValue.textContent = '--'; if (headingDir) headingDir.textContent = '—'; }
    else { headingValue.textContent = gps.heading + '°'; if (headingDir) headingDir.textContent = compass(gps.heading); }
  }
  if (accValue) accValue.textContent = gps.accuracy != null ? '±' + gps.accuracy + 'm' : '—';

  if (fuelValue) {
    const km = trip.distanceMeters / 1000;
    const liters = km / settings.fuelEfficiency;
    fuelValue.textContent = liters > 0 ? liters.toFixed(1) + 'L' : '—';
  }

  if (gpsPill) {
    const labels = { waiting: 'GPS WAIT', active: 'GPS OK', denied: 'NO GPS', unavailable: 'NO SIGNAL', timeout: 'TIMEOUT', unsupported: 'NO GPS' };
    gpsPill.querySelector('span').textContent = labels[gps.status] || 'GPS';
    gpsPill.classList.remove('wi-pill-w');
    if (gps.status !== 'active') gpsPill.classList.add('wi-pill-w');
  }
  if (navGpsStatus) {
    const labels = { waiting: 'Waiting', active: 'Active', denied: 'Denied', unavailable: 'No signal', timeout: 'Timed out', unsupported: 'Unsupported' };
    navGpsStatus.textContent = labels[gps.status] || gps.status;
  }
  if (navLat) navLat.textContent = gps.lat != null ? gps.lat.toFixed(5) : '—';
  if (navLon) navLon.textContent = gps.lon != null ? gps.lon.toFixed(5) : '—';
  if (navAcc) navAcc.textContent = gps.accuracy != null ? '±' + gps.accuracy + ' m' : '—';
}

setInterval(() => { if (gps.status === 'active') renderGps(); renderTrip(); }, 1000);
function compass(deg) { return ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg / 45) % 8]; }
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function renderGpsToggle() {
  if (gpsToggleDesc) gpsToggleDesc.textContent = settings.shareGps ? 'On · Tap to disable' : 'Off · Tap to enable';
  if (fuelToggleDesc) fuelToggleDesc.textContent = `${settings.fuelEfficiency} km/L · ${settings.fuelPrice} SAR/L`;
}

/* ---------- UI ACTIONS ---------- */
if (document.getElementById('widgetNav')) document.getElementById('widgetNav').addEventListener('click', () => showScreen('nav'));
if (document.getElementById('widgetWeather')) document.getElementById('widgetWeather').addEventListener('click', fetchWeather);
if (document.getElementById('widgetMedia')) document.getElementById('widgetMedia').addEventListener('click', () => showScreen('media'));
if (document.getElementById('widgetChat')) document.getElementById('widgetChat').addEventListener('click', () => showScreen('voice'));

if (navOpen) navOpen.addEventListener('click', () => {
  const dest = navDest.value.trim();
  const url = dest ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}` : `https://www.google.com/maps`;
  try { window.open(url, '_blank'); } catch {}
});
document.querySelectorAll('.wi-dest-btn[data-dest]').forEach(btn => {
  btn.addEventListener('click', () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(btn.dataset.dest)}`;
    try { window.open(url, '_blank'); } catch {}
  });
});
if (navRefreshGps) navRefreshGps.addEventListener('click', () => { addMessage('system', 'Refreshing GPS…'); startGPS(true); });

if (document.getElementById('toolWeather')) document.getElementById('toolWeather').addEventListener('click', fetchWeather);
if (document.getElementById('toolTrip')) document.getElementById('toolTrip').addEventListener('click', () => showScreen('trip'));
if (document.getElementById('toolMaint')) document.getElementById('toolMaint').addEventListener('click', () => showScreen('maint'));
if (document.getElementById('toolGps')) document.getElementById('toolGps').addEventListener('click', () => {
  settings.shareGps = !settings.shareGps;
  localStorage.setItem('wiji_shareGps', settings.shareGps ? '1' : '0');
  renderGpsToggle();
});
if (document.getElementById('toolFuel')) document.getElementById('toolFuel').addEventListener('click', () => showScreen('settings'));
if (document.getElementById('toolSos')) document.getElementById('toolSos').addEventListener('click', () => {
  if (confirm('EMERGENCY: Call 999 (Saudi Police) now?')) {
    window.location.href = 'tel:999';
  }
});
if (document.getElementById('toolObd')) document.getElementById('toolObd').addEventListener('click', () => showScreen('obd'));
if (document.getElementById('toolSettings')) document.getElementById('toolSettings').addEventListener('click', () => showScreen('settings'));
if (document.getElementById('toolClear')) document.getElementById('toolClear').addEventListener('click', () => {
  if (confirm('Clear all conversation history?')) { clearConversation(); showScreen('home'); }
});
if (document.getElementById('toolAbout')) document.getElementById('toolAbout').addEventListener('click', () => showScreen('about'));

/* ---------- SETTINGS UI ---------- */
function setupSettings() {
  if (rateRange) {
    rateRange.value = settings.ttsRate;
    if (rateValue) rateValue.textContent = settings.ttsRate.toFixed(1) + '×';
    rateRange.addEventListener('input', () => {
      settings.ttsRate = parseFloat(rateRange.value);
      if (rateValue) rateValue.textContent = settings.ttsRate.toFixed(1) + '×';
      saveSettings();
    });
  }
  if (fuelEfficiency) {
    fuelEfficiency.value = settings.fuelEfficiency;
    fuelEfficiency.addEventListener('change', () => {
      const v = parseFloat(fuelEfficiency.value);
      if (Number.isFinite(v) && v > 0) { settings.fuelEfficiency = v; saveSettings(); renderGpsToggle(); renderTrip(); }
    });
  }
  if (fuelPrice) {
    fuelPrice.value = settings.fuelPrice;
    fuelPrice.addEventListener('change', () => {
      const v = parseFloat(fuelPrice.value);
      if (Number.isFinite(v) && v >= 0) { settings.fuelPrice = v; saveSettings(); renderGpsToggle(); renderTrip(); }
    });
  }
}

async function checkBackend() {
  if (!aiBackendStatus) return;
  try {
    const r = await fetch(WORKER_URL.replace(/\/$/, '') + '/health', { method: 'GET' });
    if (r.ok) { const d = await r.json(); aiBackendStatus.textContent = d.status === 'ok' ? 'Online' : 'Unknown'; }
    else aiBackendStatus.textContent = 'Error ' + r.status;
  } catch { aiBackendStatus.textContent = 'Offline'; }
}

function addMessage(role, text, scroll = true) {
  if (!conversation) return;
  if (conversation.querySelector('.wi-conv-empty')) conversation.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'wi-msg ' + (role === 'user' ? 'wi-user' : role === 'system' ? 'wi-system' : 'wi-wiji');
  div.textContent = text;
  conversation.appendChild(div);
  if (scroll) conversation.scrollTop = conversation.scrollHeight;
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadTrip();
  loadMaintenance();
  updateTodayDate();
  loadHistory();
  setupSpeechRecognition();
  setupSettings();
  setupTripControls();
  setupMaintenance();
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(updateTodayDate, 60000);
  renderGpsToggle();
  renderTrip();
  renderGps();
  renderMaintenanceList();
  setState('idle');
  startGPS(true);
  checkBackend();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});