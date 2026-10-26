/* ============================================================
   WIJI — Stage 8.0 · Safety Features
   Crash, fatigue, driving score, SOS
   ============================================================ */

const Safety = {
  /* Driving score - 0-100 */
  drivingScore: 100,
  scoreHistory: [],
  lastScoreCalc: 0,

  /* Fatigue - driving time + time of day */
  fatigue: {
    driveStartTime: null,
    continuousDriveMs: 0,
    lastBreakTime: Date.now(),
    fatigueAlerted: false,
    maxContinuousMs: 2 * 60 * 60 * 1000   // 2 hours
  },

  /* Crash detection */
  crash: {
    lastAccelMagnitude: 0,
    crashDetected: false,
    crashTime: null,
    crashThreshold: 25,   // m/s² — sharp impact
    crashConfirmMs: 3000,
    alertTimeout: null
  },

  /* Speed violations */
  speed: {
    violations: 0,
    hardBrakes: 0,
    hardAccels: 0,
    lastSpeed: 0,
    lastSpeedTime: 0,
    overspeedLimit: 110
  },

  /* Initialize */
  init() {
    this.startFatigueMonitor();
    this.startCrashMonitor();
    this.startScoreCalc();
  },

  /* ----- Fatigue detection ----- */
  startFatigueMonitor() {
    setInterval(() => {
      const now = Date.now();
      const hour = new Date().getHours();

      // Night driving (10 PM - 6 AM) = higher fatigue risk
      const isNight = hour >= 22 || hour < 6;

      // Continuous driving check
      if (trip.active && trip.startTime) {
        this.fatigue.continuousDriveMs = now - trip.startTime;

        // Alert after max continuous driving
        if (this.fatigue.continuousDriveMs > this.fatigue.maxContinuousMs && !this.fatigue.fatigueAlerted) {
          this.fatigue.fatigueAlerted = true;
          const hours = Math.floor(this.fatigue.continuousDriveMs / (60 * 60 * 1000));
          const msg = `Sir, aap ${hours} ghante se continuously drive kar rahe hain. Please break lijiye, fatigue ho rahi hai.`;
          if (typeof addMessage === 'function') addMessage('wiji', msg);
          if (typeof speak === 'function') speak(msg);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
        }

        // Night driving warning
        if (isNight && this.fatigue.continuousDriveMs > 30 * 60 * 1000 && !this.fatigue.nightAlerted) {
          this.fatigue.nightAlerted = true;
          const msg = 'Sir, raat ka waqt hai. Dhyaan se drive kariye, aur jaldi break le lijiye.';
          if (typeof addMessage === 'function') addMessage('wiji', msg);
          if (typeof speak === 'function') speak(msg);
        }
      } else {
        this.fatigue.continuousDriveMs = 0;
        this.fatigue.fatigueAlerted = false;
        this.fatigue.nightAlerted = false;
        if (typeof trip !== 'undefined' && trip.active === false) {
          this.fatigue.lastBreakTime = now;
        }
      }
    }, 60000);   // every minute
  },

  /* ----- Crash detection ----- */
  startCrashMonitor() {
    setInterval(() => {
      if (!Hardware.motion.connected) return;
      const mag = Hardware.motion.data.magnitude;
      const lastMag = this.crash.lastAccelMagnitude;
      this.crash.lastAccelMagnitude = mag;

      // Sudden spike = crash indicator
      const delta = Math.abs(mag - lastMag);
      if (delta > this.crash.crashThreshold && !this.crash.crashDetected) {
        this.crash.crashDetected = true;
        this.crash.crashTime = Date.now();
        if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
        this.showCrashAlert();
      }
    }, 100);   // 100ms check
  },

  showCrashAlert() {
    if (typeof addMessage === 'function') {
      addMessage('system', '🚨 CRASH DETECTED — Emergency alert in 10 seconds. Tap SOS to call emergency.');
    }
    if (typeof speak === 'function') {
      speak('Crash detected. Calling emergency in 10 seconds. Say cancel or tap to cancel.');
    }
    // Show SOS overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(239,68,68,0.95);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 24px; color: #fff; text-align: center;
    `;
    overlay.innerHTML = `
      <div style="font-size: 64px; margin-bottom: 16px;">🚨</div>
      <div style="font-size: 28px; font-weight: 800; margin-bottom: 8px;">CRASH DETECTED</div>
      <div style="font-size: 16px; margin-bottom: 24px; opacity: 0.9;">Emergency call in <span id="crashCountdown">10</span>s</div>
      <div style="display: flex; gap: 12px;">
        <button id="crashCallBtn" style="padding: 16px 32px; border-radius: 12px; background: #fff; color: #dc2626; border: none; font-size: 18px; font-weight: 800; cursor: pointer;">
          CALL 999 NOW
        </button>
        <button id="crashCancelBtn" style="padding: 16px 32px; border-radius: 12px; background: rgba(255,255,255,0.2); color: #fff; border: 2px solid #fff; font-size: 18px; font-weight: 800; cursor: pointer;">
          CANCEL
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    let countdown = 10;
    const countdownEl = overlay.querySelector('#crashCountdown');
    const interval = setInterval(() => {
      countdown--;
      if (countdownEl) countdownEl.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(interval);
        window.location.href = 'tel:999';
        this.crash.crashDetected = false;
        overlay.remove();
      }
    }, 1000);

    overlay.querySelector('#crashCallBtn').addEventListener('click', () => {
      clearInterval(interval);
      window.location.href = 'tel:999';
      this.crash.crashDetected = false;
      overlay.remove();
    });

    overlay.querySelector('#crashCancelBtn').addEventListener('click', () => {
      clearInterval(interval);
      this.crash.crashDetected = false;
      overlay.remove();
      if (typeof addMessage === 'function') addMessage('system', 'Crash alert cancelled.');
    });
  },

  /* ----- Speed violation tracking ----- */
  recordSpeed(currentSpeed) {
    const now = Date.now();
    const dt = (now - this.speed.lastSpeedTime) / 1000;

    if (dt > 0 && dt < 5 && this.speed.lastSpeed > 0) {
      const accel = (currentSpeed - this.speed.lastSpeed) / dt;

      // Hard braking: deceleration > 5 m/s²
      if (accel < -5) {
        this.speed.hardBrakes++;
        this.drivingScore = Math.max(0, this.drivingScore - 2);
      }

      // Hard acceleration: > 4 m/s²
      if (accel > 4) {
        this.speed.hardAccels++;
        this.drivingScore = Math.max(0, this.drivingScore - 1);
      }

      // Overspeed
      if (currentSpeed > this.speed.overspeedLimit) {
        this.speed.violations++;
        this.drivingScore = Math.max(0, this.drivingScore - 1);
      }
    }

    this.speed.lastSpeed = currentSpeed;
    this.speed.lastSpeedTime = now;
  },

  /* ----- Driving score calculation ----- */
  startScoreCalc() {
    setInterval(() => {
      // Slow recovery towards 100 if no violations
      if (this.drivingScore < 100) {
        this.drivingScore = Math.min(100, this.drivingScore + 1);
      }
      const el = document.getElementById('scoreValue');
      if (el) {
        el.textContent = this.drivingScore;
        el.style.color = this.drivingScore >= 80 ? 'var(--green)'
                       : this.drivingScore >= 60 ? 'var(--amber)'
                       : 'var(--red)';
      }
    }, 30000);   // every 30s
  },

  /* ----- SOS manual button ----- */
  triggerSOS() {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
    const msg = 'Emergency SOS triggered. Calling 999.';
    if (typeof speak === 'function') speak(msg);
    setTimeout(() => { window.location.href = 'tel:999'; }, 1000);
  },

  /* ----- Reset score ----- */
  resetScore() {
    this.drivingScore = 100;
    this.speed.violations = 0;
    this.speed.hardBrakes = 0;
    this.speed.hardAccels = 0;
  }
};

/* Initialize when page loads */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof Hardware !== 'undefined') Hardware.init();
  setTimeout(() => Safety.init(), 2000);   // delay until after app init

  // Hook into GPS speed updates
  if (typeof smoothedSpeedKmh !== 'undefined') {
    setInterval(() => {
      if (typeof smoothedSpeedKmh === 'number') {
        Safety.recordSpeed(smoothedSpeedKmh);
      }
    }, 1000);
  }
});