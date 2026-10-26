/* ============================================================
   WIJI — Stage 8.0 · Hardware Abstraction Layer
   OBD-II ready (mock now, real adapter later)
   ============================================================ */

/* ---------- HARDWARE ABSTRACTION ---------- */
const Hardware = {
  /* GPS - always available (browser API) */
  gps: {
    available: true,
    connected: false,
    name: 'GPS (Browser)',
    data: { lat: null, lon: null, speed: null, heading: null, accuracy: null, lastUpdate: null }
  },

  /* OBD-II - Bluetooth ELM327 adapter (future) */
  obd: {
    available: 'bluetooth' in navigator,
    connected: false,
    name: 'OBD-II (ELM327)',
    device: null,
    characteristic: null,
    data: {
      rpm: null,
      coolantTemp: null,
      fuelLevel: null,
      batteryVoltage: null,
      engineLoad: null,
      intakeTemp: null,
      throttlePos: null,
      errorCodes: []
    },
    mockMode: true,   // true = fake data, false = real adapter
    mockInterval: null
  },

  /* TPMS - tire pressure (future) */
  tpms: {
    available: false,
    connected: false,
    name: 'TPMS',
    data: { fl: null, fr: null, rl: null, rr: null }
  },

  /* Phone motion - accelerometer (available) */
  motion: {
    available: 'DeviceMotionEvent' in window,
    connected: false,
    name: 'Device Motion',
    data: { ax: 0, ay: 0, az: 0, magnitude: 0, lastUpdate: null },
    threshold: 15   // m/s² crash threshold
  },

  /* Phone battery - available */
  battery: {
    available: 'getBattery' in navigator,
    connected: false,
    name: 'Battery',
    data: { level: 1, charging: true }
  },

  /* Start all available hardware */
  async init() {
    this.initMotion();
    await this.initBattery();
    this.initOBDMock();
  },

  /* ----- Motion (accelerometer) ----- */
  initMotion() {
    if (!this.motion.available) return;
    try {
      window.addEventListener('devicemotion', (e) => {
        const a = e.accelerationIncludingGravity;
        if (!a) return;
        this.motion.data.ax = a.x || 0;
        this.motion.data.ay = a.y || 0;
        this.motion.data.az = a.z || 0;
        this.motion.data.magnitude = Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z);
        this.motion.data.lastUpdate = Date.now();
        this.motion.connected = true;
      });
    } catch (e) { console.warn('Motion init failed:', e); }
  },

  /* ----- Battery ----- */
  async initBattery() {
    if (!this.battery.available) return;
    try {
      const b = await navigator.getBattery();
      const update = () => {
        this.battery.data.level = b.level;
        this.battery.data.charging = b.charging;
        this.battery.connected = true;
      };
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
    } catch (e) { console.warn('Battery init failed:', e); }
  },

  /* ----- OBD-II Mock (fake data for demo) ----- */
  initOBDMock() {
    if (this.obd.mockInterval) clearInterval(this.obd.mockInterval);
    this.obd.mockInterval = setInterval(() => {
      if (!this.obd.mockMode) return;
      const speed = (typeof smoothedSpeedKmh === 'number' ? smoothedSpeedKmh : 0);
      // RPM: idle 800 + speed*30 + random
      this.obd.data.rpm = Math.round(800 + speed * 30 + (Math.random() * 200 - 100));
      // Coolant temp: 85-95°C
      this.obd.data.coolantTemp = Math.round(88 + Math.random() * 6);
      // Fuel level: 0-100% (fake — starts at 75%)
      if (this.obd.data.fuelLevel == null) this.obd.data.fuelLevel = 75;
      // Fuel drains slowly based on speed
      if (speed > 5) this.obd.data.fuelLevel = Math.max(0, this.obd.data.fuelLevel - speed * 0.0001);
      // Battery: 13.5-14.5V (engine running)
      this.obd.data.batteryVoltage = parseFloat((13.8 + (Math.random() * 0.6 - 0.3)).toFixed(1));
      // Engine load: 20-80%
      this.obd.data.engineLoad = Math.round(20 + (speed / 180) * 60 + Math.random() * 10);
      // Intake temp
      this.obd.data.intakeTemp = Math.round(35 + Math.random() * 10);
      // Throttle position
      this.obd.data.throttlePos = Math.round(Math.min(100, speed * 0.5 + Math.random() * 10));
      this.obd.connected = true;
    }, 1000);
  },

  /* ----- OBD-II Real Connection (future) ----- */
  async connectOBD() {
    if (!this.obd.available) {
      alert('Web Bluetooth not supported on this browser. Use Chrome on Android/PC.');
      return false;
    }
    try {
      // Request ELM327 device
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'OBD' },
          { namePrefix: 'ELM' },
          { namePrefix: 'Vgate' },
          { namePrefix: 'KONNWEI' },
          { namePrefix: 'V-Link' }
        ],
        optionalServices: [
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '000018f0-0000-1000-8000-00805f9b34fb',
          '0000fff0-0000-1000-8000-00805f9b34fb'
        ]
      });
      this.obd.device = device;
      const server = await device.gatt.connect();
      // Try common OBD services
      const services = [
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000fff0-0000-1000-8000-00805f9b34fb'
      ];
      let characteristic = null;
      for (const s of services) {
        try {
          const service = await server.getPrimaryService(s);
          const chars = await service.getCharacteristics();
          if (chars && chars.length > 0) {
            characteristic = chars[0];
            break;
          }
        } catch {}
      }
      if (!characteristic) throw new Error('No OBD service found');
      this.obd.characteristic = characteristic;
      this.obd.mockMode = false;
      this.obd.connected = true;
      if (this.obd.mockInterval) { clearInterval(this.obd.mockInterval); this.obd.mockInterval = null; }
      // Start polling real data
      this.startOBDPolling();
      return true;
    } catch (e) {
      console.error('OBD connect failed:', e);
      return false;
    }
  },

  /* ----- OBD-II Polling (real adapter) ----- */
  startOBDPolling() {
    if (!this.obd.characteristic) return;
    const writeCmd = async (cmd) => {
      const enc = new TextEncoder();
      await this.obd.characteristic.writeValue(enc.encode(cmd + '\r'));
      await new Promise(r => setTimeout(r, 100));
      const val = await this.obd.characteristic.readValue();
      return new TextDecoder().decode(val);
    };
    const parseHex = (resp, bytes = 2) => {
      // ELM327 response format: "41 0C 1A F8"
      const match = resp.match(/41\s+[0-9A-F]{2}\s+([0-9A-F ]+)/i);
      if (!match) return null;
      const hex = match[1].replace(/\s+/g, '');
      return parseInt(hex.substring(0, bytes * 2), 16);
    };
    setInterval(async () => {
      if (!this.obd.connected || this.obd.mockMode) return;
      try {
        // RPM: 010C
        const rpmResp = await writeCmd('010C');
        const rpmRaw = parseHex(rpmResp, 2);
        if (rpmRaw != null) this.obd.data.rpm = Math.round(rpmRaw / 4);

        // Coolant temp: 0105
        const coolResp = await writeCmd('0105');
        const coolRaw = parseHex(coolResp, 1);
        if (coolRaw != null) this.obd.data.coolantTemp = coolRaw - 40;

        // Fuel level: 012F
        const fuelResp = await writeCmd('012F');
        const fuelRaw = parseHex(fuelResp, 1);
        if (fuelRaw != null) this.obd.data.fuelLevel = Math.round(fuelRaw * 100 / 255);

        // Battery voltage: 0142 (control module voltage)
        const battResp = await writeCmd('0142');
        const battRaw = parseHex(battResp, 2);
        if (battRaw != null) this.obd.data.batteryVoltage = parseFloat((battRaw / 1000).toFixed(1));

        // Engine load: 0104
        const loadResp = await writeCmd('0104');
        const loadRaw = parseHex(loadResp, 1);
        if (loadRaw != null) this.obd.data.engineLoad = Math.round(loadRaw * 100 / 255);

        // Intake temp: 010F
        const intakeResp = await writeCmd('010F');
        const intakeRaw = parseHex(intakeResp, 1);
        if (intakeRaw != null) this.obd.data.intakeTemp = intakeRaw - 40;

        // Throttle: 0111
        const thrResp = await writeCmd('0111');
        const thrRaw = parseHex(thrResp, 1);
        if (thrRaw != null) this.obd.data.throttlePos = Math.round(thrRaw * 100 / 255);

        // Error codes: 03
        const errResp = await writeCmd('03');
        const errMatch = errResp.match(/43\s+([0-9A-F ]+)/i);
        if (errMatch) {
          const codes = errMatch[1].trim().split(/\s+/).filter(c => c.length === 4);
          this.obd.data.errorCodes = codes.map(c => 'P' + c);
        }
      } catch (e) {
        console.warn('OBD poll error:', e);
      }
    }, 2000);
  },

  /* Disconnect */
  disconnectOBD() {
    if (this.obd.device) {
      try { this.obd.device.gatt.disconnect(); } catch {}
    }
    this.obd.connected = false;
    this.obd.mockMode = true;
    this.initOBDMock();
  }
};