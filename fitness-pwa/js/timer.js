/* ============================================================
   TIMER MODULE  —  PR.47
   Cronómetro: toggle play/pause, color inversion
   Timer: prep(azul) / ejercicio(verde) / descanso(rojo)
   + Tiempo total de circuito con countdown

   Mejoras: el timer usa la HORA REAL (no se atrasa ni se frena si la
   pantalla se apaga un rato), mantiene la pantalla encendida mientras
   corre, guarda la última configuración y tiene ajustes de sonido.
============================================================ */

const Timer = (() => {

  /* ─── Helpers ────────────────────────────────────────────── */
  function fmtStopwatch(ms) {
    const cs = Math.floor(ms / 10);
    const mm = Math.floor(cs / 6000);
    const ss = Math.floor((cs % 6000) / 100);
    const cc = cs % 100;
    return {
      main: `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`,
      ms:   `.${String(cc).padStart(2,'0')}`
    };
  }

  function fmtMS(sec) {
    sec = Math.max(0, Math.round(sec));
    return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
  }

  function el(id) { return document.getElementById(id); }

  function setBodyState(cls) {
    document.body.classList.remove('sw-running','it-prep','it-exercise','it-rest');
    if (cls) document.body.classList.add(cls);
  }

  /* ─── Preferencias (sonido, volumen, vibración) ──────────── */
  const PREF_KEY = 'fitpro_timer_prefs_v1';
  const CFG_KEY  = 'fitpro_timer_cfg_v1';
  const prefs = { sound: 'whistle', vol: 0.8, vibrate: true };
  function loadPrefs() { try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { /* sin almacenamiento */ } }
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ok */ } }

  /* ─── Pantalla siempre encendida mientras corre algo ─────── */
  let wakeLock = null;
  async function lockScreen() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (e) { wakeLock = null; }
  }
  function unlockScreen() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* ok */ } wakeLock = null; }
  let externalActive = false;                   // una rutina cronometrada (Runner) también necesita la pantalla
  const somethingRunning = () => swRunning || running || externalActive;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (somethingRunning()) lockScreen();      // el sistema la suelta al ir a segundo plano
    if (running) tick();                       // se pone al día con la hora real
  });

  /* ─── syncBodyState — tab-aware ─────────────────────────── */
  function syncBodyState() {
    const activeTab = document.querySelector('#section-timer .tab-btn.active')?.dataset.tab;
    if (!activeTab || activeTab === 'stopwatch') {
      setBodyState(swRunning ? 'sw-running' : null);
    } else {
      // interval tab
      if (running) {
        if      (phase === 'prep')     setBodyState('it-prep');
        else if (phase === 'exercise') setBodyState('it-exercise');
        else                           setBodyState('it-rest');
      } else {
        setBodyState(null);
      }
    }
  }

  /* ─── CRONÓMETRO ─────────────────────────────────────────── */
  let swElapsed    = 0;
  let swStart      = null;
  let swRaf        = null;
  let swRunning    = false;
  let laps         = [];
  let lastLapTime  = 0;

  function swTick() {
    swElapsed = Date.now() - swStart;
    const { main, ms } = fmtStopwatch(swElapsed);
    el('sw-main').textContent = main;
    el('sw-ms').textContent   = ms;
    swRaf = requestAnimationFrame(swTick);
  }

  function swSetIcon(running) {
    el('sw-icon-play').classList.toggle('hidden', running);
    el('sw-icon-pause').classList.toggle('hidden', !running);
  }

  /* LAP button label: LAP (running) | RESET (paused w/ time) | LAP disabled (at zero) */
  function swSetLapBtn() {
    const btn = el('sw-lap');
    if (!btn) return;
    if (swRunning) {
      btn.textContent = 'LAP';
      btn.disabled    = false;
    } else if (swElapsed > 0) {
      btn.textContent = 'RESET';
      btn.disabled    = false;
    } else {
      btn.textContent = 'LAP';
      btn.disabled    = true;
    }
  }

  function swLap() {
    const lapTime = swElapsed - lastLapTime;
    laps.push({ n: laps.length + 1, split: lapTime, total: swElapsed });
    lastLapTime = swElapsed;
    renderLaps();
  }

  function renderLaps() {
    const container = el('sw-laps');
    if (!laps.length) { container.innerHTML = ''; return; }
    // la vuelta más rápida y la más lenta se marcan (cuando hay 3 o más)
    const splits = laps.map(l => l.split);
    const best = Math.min(...splits), worst = Math.max(...splits);
    container.innerHTML = [...laps].reverse().map((lap, i) => {
      const { main: sm, ms: sms } = fmtStopwatch(lap.split);
      const { main: tm }          = fmtStopwatch(lap.total);
      const tag = laps.length >= 3 ? (lap.split === best ? ' lap-item--best' : lap.split === worst ? ' lap-item--worst' : '') : '';
      return `<div class="lap-item${i === 0 ? ' lap-item--latest' : ''}${tag}">
        <span class="lap-num">Lap ${lap.n}</span>
        <span class="lap-split">${sm}<span class="lap-split-ms">${sms}</span></span>
        <span class="lap-total">${tm}</span>
      </div>`;
    }).join('');
  }

  function swToggle() {
    unlockAudio(); // must be first — we're inside a tap gesture
    if (swRunning) {
      swRunning = false;
      cancelAnimationFrame(swRaf);
      setBodyState(null);
      swSetIcon(false);
      if (!somethingRunning()) unlockScreen();
    } else {
      swRunning = true;
      swStart   = Date.now() - swElapsed;
      swRaf     = requestAnimationFrame(swTick);
      setBodyState('sw-running');
      swSetIcon(true);
      lockScreen();
    }
    swSetLapBtn();
  }

  function swReset() {
    swRunning   = false;
    laps        = [];
    lastLapTime = 0;
    cancelAnimationFrame(swRaf);
    swElapsed = 0;
    el('sw-main').textContent = '00:00';
    el('sw-ms').textContent   = '.00';
    el('sw-laps').innerHTML   = '';
    setBodyState(null);
    swSetIcon(false);
    swSetLapBtn();
    if (!somethingRunning()) unlockScreen();
  }

  /* ─── INTERVAL TIMER ─────────────────────────────────────── */
  const CIRC = 2 * Math.PI * 115;

  let cfg          = {};
  let phase        = 'exercise';
  let curSet       = 1;
  let curRound     = 1;
  let remain       = 0;       // segundos que faltan de la fase (se calcula con la hora real)
  let total        = 0;       // duración de la fase en segundos
  let totalRemain  = 0;       // segundos que faltan del circuito completo
  let running      = false;
  let phaseEnd     = 0;       // hora (ms) en que termina la fase actual
  let circuitEnd   = 0;       // hora (ms) en que termina todo el circuito
  let pausedAt     = 0, pausedRemainMs = 0;
  let tickId       = null;
  let lastBeepSec  = -1;

  // ── Arc smooth animation via rAF ──────────────────────────
  let arcRaf = null;

  function setArc(r, t) {
    // Discrete set (used when paused / finished)
    const arc = el('progress-arc');
    if (!arc) return;
    arc.style.strokeDashoffset = CIRC * (1 - (t > 0 ? r / t : 0));
  }

  function startArcRaf() {
    stopArcRaf();
    const arc = el('progress-arc');
    (function frame() {
      if (!running || !arc) { arcRaf = null; return; }
      const fraction = Math.max(0, Math.min(1, (phaseEnd - Date.now()) / (total * 1000 || 1)));
      arc.style.strokeDashoffset = CIRC * (1 - fraction);
      arcRaf = requestAnimationFrame(frame);
    })();
  }

  function stopArcRaf() {
    if (arcRaf) { cancelAnimationFrame(arcRaf); arcRaf = null; }
  }

  function itSetIcon(isRunning) {
    el('it-icon-pause').classList.toggle('hidden', !isRunning);
    el('it-icon-play').classList.toggle('hidden',  isRunning);
  }

  function updateUI() {
    el('it-display').textContent    = fmtMS(remain);
    el('it-set').textContent        = `${curSet} / ${cfg.sets}`;
    el('it-round').textContent      = `${curRound} / ${cfg.rounds}`;
    el('it-total-time').textContent = fmtMS(totalRemain);

    const badge = el('phase-badge');
    if      (phase === 'prep')     badge.textContent = 'Preparación';
    else if (phase === 'exercise') badge.textContent = 'Ejercicio';
    else                           badge.textContent = 'Descanso';

    // Only apply body color when the user is actually looking at the interval timer.
    // If they're on another section (or the stopwatch tab), don't bleed colors.
    const onTimerSection = document.getElementById('section-timer')
                             ?.classList.contains('active');
    const onIntervalTab  = document.querySelector(
                             '#section-timer .tab-btn[data-tab="interval"]')
                             ?.classList.contains('active');
    if (onTimerSection && onIntervalTab) {
      if      (phase === 'prep')     setBodyState('it-prep');
      else if (phase === 'exercise') setBodyState('it-exercise');
      else                           setBodyState('it-rest');
    }

    // Arc is updated continuously by startArcRaf(); only set discretely when paused
    if (!running) setArc(remain, total);
  }

  function vibrate(p) { if (prefs.vibrate && navigator.vibrate) navigator.vibrate(p); }

  /* ─── Audio — shared context (iOS fix) ──────────────────── */
  // One persistent AudioContext, unlocked during a user-gesture handler.
  // Creating a new AudioContext per sound (old approach) fails on iOS because
  // each new context starts suspended and there is no gesture to resume it.
  let _ctx = null;

  function getCtx() {
    try {
      if (!_ctx || _ctx.state === 'closed') {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    } catch(e) {}
    return _ctx;
  }

  // Call this at the TOP of every user-gesture handler (button tap).
  // It creates + resumes the context while we're still inside the gesture.
  function unlockAudio() {
    try {
      const ctx = getCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch(e) {}
  }

  // Ruido blanco (el "aire" del soplido), se arma una vez
  let _noise = null;
  function noiseBuf(ctx) {
    if (_noise && _noise.sampleRate === ctx.sampleRate) return _noise;
    const len = Math.floor(ctx.sampleRate * 1.5), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (_noise = b);
  }

  // Silbato de entrenador (de bolita): tono agudo de ~3 kHz con el trino que hace la bolita
  // al girar (~30 cortes por segundo), un poco de aire y la subida/bajada del soplido.
  function whistle(ctx, startT, durMs, vol, pitch) {
    const t0 = ctx.currentTime + startT, d = Math.max(0.09, durMs / 1000), f = pitch || 2950, end = t0 + d;
    const out = ctx.createGain(); out.connect(ctx.destination);
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    out.gain.setValueAtTime(vol, end - 0.045);
    out.gain.exponentialRampToValueAtTime(0.0001, end);
    // trino de la bolita: la intensidad y la altura tiemblan juntas
    const trill = ctx.createGain(); trill.gain.setValueAtTime(0.58, t0); trill.connect(out);
    const lfo = ctx.createOscillator(); lfo.type = 'triangle';
    lfo.frequency.setValueAtTime(29, t0); lfo.frequency.linearRampToValueAtTime(35, end);
    const am = ctx.createGain(); am.gain.value = 0.42; lfo.connect(am); am.connect(trill.gain);     // 0,16 … 1
    const fm = ctx.createGain(); fm.gain.value = f * 0.028; lfo.connect(fm);
    const tone = (mul, amp) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f * mul * 0.9, t0);                     // arranca un poco más grave y sube
      o.frequency.exponentialRampToValueAtTime(f * mul, t0 + 0.04);
      o.frequency.setValueAtTime(f * mul, end - 0.04);
      o.frequency.exponentialRampToValueAtTime(f * mul * 0.96, end);     // al soltar, baja apenas
      const k = ctx.createGain(); k.gain.value = mul; fm.connect(k); k.connect(o.frequency);
      const g = ctx.createGain(); g.gain.value = amp; o.connect(g); g.connect(trill);
      o.start(t0); o.stop(end + 0.05);
    };
    tone(1, 0.62); tone(1.022, 0.12); tone(2, 0.07);                       // tono + un poco de aspereza + armónico
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx); n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 3.5;
    const ng = ctx.createGain(); ng.gain.value = 0.35; n.connect(bp); bp.connect(ng); ng.connect(trill);
    n.start(t0, Math.random()); n.stop(end + 0.05);
    lfo.start(t0); lfo.stop(end + 0.05);
  }

  // Beep limpio: un tono con ataque y caída suaves
  function beep(ctx, freq, startT, durMs, vol, type) {
    const t0 = ctx.currentTime + startT, d = durMs / 1000;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.setValueAtTime(vol, t0 + d * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    osc.start(t0); osc.stop(t0 + d + 0.05);
  }

  // Campana: varios armónicos que se apagan despacio
  function bell(ctx, freq, startT, vol, decay) {
    const t0 = ctx.currentTime + startT, d = decay || 1.3;
    [[1, 1], [2.76, 0.55], [5.4, 0.3], [8.93, 0.16]].forEach(([mul, amp]) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq * mul, t0);
      osc.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(vol * amp, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + d / (1 + mul * 0.18));
      osc.start(t0); osc.stop(t0 + d + 0.05);
    });
  }

  // Always resume before playing — ctx.resume() returns a Promise so we
  // wait for it before scheduling oscillators. This fixes iOS silence bug
  // where the context is technically unlocked but not yet 'running'.
  function play(fn) {
    try {
      if (prefs.sound === 'none') return;
      const ctx = getCtx();
      if (!ctx) return;
      ctx.resume().then(() => { try { fn(ctx, Math.max(0.05, Math.min(1, prefs.vol))); } catch(e) {} });
    } catch(e) {}
  }

  /* Cada juego de sonidos tiene tres: cuenta regresiva (3-2-1), cambio de fase y final */
  const SOUNDS = {
    whistle: {   // silbato de entrenador: "fit" en la cuenta, un pitazo al cambiar, "fit-fit-fiiiit" al final
      count:  (c, v) => whistle(c, 0, 120, 0.62 * v),
      change: (c, v) => whistle(c, 0, 560, 0.8 * v),
      finish: (c, v) => { whistle(c, 0, 170, 0.75 * v); whistle(c, 0.27, 170, 0.75 * v); whistle(c, 0.56, 1100, 0.85 * v); },
    },
    beep: {      // beep de gimnasio, grave y claro
      count:  (c, v) => beep(c, 880, 0, 110, 0.5 * v),
      change: (c, v) => beep(c, 1320, 0, 380, 0.55 * v),
      finish: (c, v) => { beep(c, 1047, 0, 160, 0.55 * v); beep(c, 1319, 0.2, 160, 0.55 * v); beep(c, 1568, 0.4, 600, 0.6 * v); },
    },
    bell: {      // campana, más suave
      count:  (c, v) => beep(c, 1500, 0, 45, 0.42 * v, 'triangle'),
      change: (c, v) => bell(c, 880, 0, 0.5 * v),
      finish: (c, v) => { bell(c, 660, 0, 0.5 * v, 1.6); bell(c, 880, 0.4, 0.5 * v, 1.6); bell(c, 1320, 0.8, 0.55 * v, 2.2); },
    },
  };
  function playSound(kind) {
    const set = SOUNDS[prefs.sound] || SOUNDS.whistle;
    play((ctx, v) => set[kind](ctx, v));
  }
  const countdownBeep = () => playSound('count');
  const changeBeep    = () => playSound('change');
  const finishBeep    = () => playSound('finish');

  /* ─── Fases: todo se calcula con la hora real ────────────── */
  const phaseSecs = ph => ph === 'prep' ? cfg.prepSec : ph === 'exercise' ? cfg.exSec : cfg.restSec;

  function enterPhase(ph, startAt) {
    phase = ph; total = phaseSecs(ph);
    phaseEnd = startAt + total * 1000;    // arranca donde terminó la anterior: sin deriva
    lastBeepSec = -1;
  }

  /* pasa a la fase que sigue; devuelve qué pasó: 'exercise' | 'rest' | 'set' | 'round' | 'done' */
  function advance() {
    const at = phaseEnd;
    if (phase === 'prep') { enterPhase('exercise', at); return 'exercise'; }
    if (phase === 'exercise' && cfg.restSec > 0) { enterPhase('rest', at); return 'rest'; }
    if (curSet < cfg.sets)        { curSet++; enterPhase('exercise', at); return 'set'; }
    if (curRound < cfg.rounds)    { curRound++; curSet = 1; enterPhase('exercise', at); return 'round'; }
    return 'done';
  }

  const VIBES = { exercise: [150], rest: [200, 80, 200], set: [100, 50, 100, 50, 220], round: [300, 100, 300] };

  function tick() {
    if (!running) return;
    const now = Date.now();
    let last = null, guard = 0;
    while (now >= phaseEnd && guard++ < 2000) {     // si la app estuvo dormida, avanza todas las fases que pasaron
      const late = now - phaseEnd;
      const r = advance();
      last = { r, late };
      if (r === 'done') break;
    }
    if (last && last.r === 'done') { finish(); return; }
    if (last && last.late < 1500) {                 // aviso solo si el cambio es de ahora (no uno viejo)
      changeBeep(); vibrate(VIBES[last.r] || [150]);
    }
    remain      = Math.max(0, Math.ceil((phaseEnd - now) / 1000));
    totalRemain = Math.max(0, Math.ceil((circuitEnd - now) / 1000));
    updateUI();
    if (last) startArcRaf();
    if (remain >= 1 && remain <= 3 && remain !== lastBeepSec) { lastBeepSec = remain; countdownBeep(); }
  }

  function startTicking() {
    if (tickId) clearInterval(tickId);
    tickId = setInterval(tick, 200);
  }
  function stopTicking() { if (tickId) clearInterval(tickId); tickId = null; }

  function finish() {
    running      = false;
    totalRemain  = 0;
    stopTicking();
    stopArcRaf();
    finishBeep();
    vibrate([500, 200, 500, 200, 500]);
    setBodyState(null);
    el('phase-badge').textContent       = '¡ COMPLETADO !';
    el('it-display').textContent        = '00:00';
    el('it-total-time').textContent     = '00:00';
    setArc(0, 1);
    itSetIcon(false);
    if (!somethingRunning()) unlockScreen();
  }

  /* ─── Configuración (presets, pasos +/−, total) ──────────── */
  const FIELDS = ['prep-sec', 'ex-sec', 'rest-sec', 'sets-count', 'rounds-count'];
  function readCfg() {
    const n = (id, min) => Math.max(min, parseInt(el(id).value || 0) || 0);
    return { prepSec: n('prep-sec', 0), exSec: n('ex-sec', 0), restSec: n('rest-sec', 0), sets: n('sets-count', 1), rounds: n('rounds-count', 1) };
  }
  function updateTotal() {
    const c = readCfg();
    el('cfg-total').textContent = fmtMS(c.prepSec + c.rounds * c.sets * (c.exSec + c.restSec));
  }
  function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(readCfg())); } catch (e) { /* ok */ } }
  function loadCfg() {
    try {
      const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
      if (c) { el('prep-sec').value = c.prepSec; el('ex-sec').value = c.exSec; el('rest-sec').value = c.restSec; el('sets-count').value = c.sets; el('rounds-count').value = c.rounds; }
    } catch (e) { /* ok */ }
    updateTotal();
  }

  function itStart() {
    unlockAudio(); // unlock while still inside the tap gesture
    const c = readCfg();
    if (c.exSec <= 0) { App.toast('Ingresá el tiempo de ejercicio'); return; }
    saveCfg();

    cfg      = c;
    curSet   = 1;
    curRound = 1;
    running  = true;

    const now = Date.now();
    circuitEnd = now + (c.prepSec + c.rounds * c.sets * (c.exSec + c.restSec)) * 1000;
    enterPhase(c.prepSec > 0 ? 'prep' : 'exercise', now);
    remain      = Math.ceil((phaseEnd - now) / 1000);
    totalRemain = Math.ceil((circuitEnd - now) / 1000);

    el('interval-config').classList.add('hidden');
    el('interval-running').classList.remove('hidden');
    itSetIcon(true);
    lockScreen();

    updateUI();
    startArcRaf();
    startTicking();
  }

  function itToggle() {
    unlockAudio(); // unlock while still inside the tap gesture
    if (running) {
      running = false;
      stopTicking();
      stopArcRaf();
      pausedAt = Date.now();
      pausedRemainMs = Math.max(0, phaseEnd - pausedAt);
      remain = Math.ceil(pausedRemainMs / 1000);
      setArc(pausedRemainMs / 1000, total);   // show exact position while paused
      itSetIcon(false);
    } else {
      const now = Date.now();
      phaseEnd   = now + pausedRemainMs;      // retoma justo donde estaba
      circuitEnd += now - pausedAt;
      running = true;
      itSetIcon(true);
      lockScreen();
      startArcRaf();
      startTicking();
    }
  }

  function itReset() {
    running      = false;
    totalRemain  = 0;
    stopTicking();
    stopArcRaf();
    setBodyState(null);
    el('interval-config').classList.remove('hidden');
    el('interval-running').classList.add('hidden');
    itSetIcon(false);
    if (!somethingRunning()) unlockScreen();
  }

  /* ─── Ajustes de sonido ──────────────────────────────────── */
  function openSettings() {
    const names = { whistle: 'Silbato', beep: 'Beep', bell: 'Campana', none: 'Sin sonido' };
    App.openModal('Sonido y vibración', `
      <div class="form-group">
        <label>Sonido</label>
        <div class="gen-chips" id="ts-sounds">
          ${Object.keys(names).map(k => `<button class="gen-chip${prefs.sound === k ? ' on' : ''}" data-s="${k}">${names[k]}</button>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label>Volumen</label>
        <input type="range" id="ts-vol" class="ts-range" min="10" max="100" step="5" value="${Math.round(prefs.vol * 100)}" />
      </div>
      <div class="form-group toggle-row">
        <label>Vibración</label>
        <label class="toggle-switch">
          <input type="checkbox" id="ts-vib"${prefs.vibrate ? ' checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="form-group">
        <label>Probar</label>
        <div class="gen-chips">
          <button class="gen-chip ghost" data-t="count">Cuenta 3·2·1</button>
          <button class="gen-chip ghost" data-t="change">Cambio</button>
          <button class="gen-chip ghost" data-t="finish">Final</button>
        </div>
      </div>
      <div class="modal-footer"><button id="ts-close" class="btn btn-primary">Listo</button></div>`);
    el('ts-sounds').addEventListener('click', e => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      prefs.sound = b.dataset.s; savePrefs();
      el('ts-sounds').querySelectorAll('.gen-chip').forEach(x => x.classList.toggle('on', x === b));
      unlockAudio(); playSound('change');
    });
    el('ts-vol').addEventListener('input', e => { prefs.vol = (+e.target.value) / 100; savePrefs(); });
    el('ts-vol').addEventListener('change', () => { unlockAudio(); playSound('count'); });
    el('ts-vib').addEventListener('change', e => { prefs.vibrate = e.target.checked; savePrefs(); if (prefs.vibrate) vibrate([120]); });
    document.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { unlockAudio(); playSound(b.dataset.t); }));
    el('ts-close').addEventListener('click', App.closeModal);
  }

  /* ─── Tabs ───────────────────────────────────────────────── */
  function initTabs() {
    document.querySelectorAll('#section-timer .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#section-timer .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#section-timer .tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        syncBodyState(); // ← fix tab-switching color bug
      });
    });
  }

  /* ─── Init ───────────────────────────────────────────────── */
  /* El número del timer se agranda o achica junto con el círculo: así el aro nunca lo pisa */
  function fitRingText() {
    const ring = document.querySelector('#interval-running .progress-ring-container');
    if (!ring) return;
    const set = () => { const w = ring.getBoundingClientRect().width; if (w > 0) ring.style.setProperty('--ring', Math.round(w) + 'px'); };
    if (window.ResizeObserver) new ResizeObserver(set).observe(ring);
    window.addEventListener('resize', set);
    set();
  }

  function init() {
    loadPrefs();
    initTabs();
    fitRingText();
    el('sw-toggle').addEventListener('click', swToggle);
    el('sw-lap').addEventListener('click', () => {
      if (swRunning)       swLap();
      else if (swElapsed > 0) swReset();
    });
    el('interval-go').addEventListener('click', itStart);
    el('it-pause').addEventListener('click',   itToggle);
    el('it-reset').addEventListener('click',   itReset);
    el('timer-settings-btn').addEventListener('click', openSettings);

    // presets, botones +/− y duración total
    FIELDS.forEach(id => el(id).addEventListener('input', updateTotal));
    document.querySelectorAll('.step-btn').forEach(b => b.addEventListener('click', () => {
      const inp = el(b.dataset.for), min = (inp.getAttribute('min') | 0);
      inp.value = Math.max(min, (parseInt(inp.value) || 0) + (+b.dataset.d));
      updateTotal();
    }));
    document.querySelectorAll('.preset-chip').forEach(b => b.addEventListener('click', () => {
      const [p, e, r, s, ro] = b.dataset.p.split(',');
      el('prep-sec').value = p; el('ex-sec').value = e; el('rest-sec').value = r; el('sets-count').value = s; el('rounds-count').value = ro;
      document.querySelectorAll('.preset-chip').forEach(x => x.classList.toggle('on', x === b));
      updateTotal();
    }));
    loadCfg();
  }

  /* Lo comparte con la rutina cronometrada (Runner): mismos sonidos, vibración y pantalla encendida */
  const shared = {
    unlockAudio, playSound, vibrate, fmtMS, openSettings,
    setActive: on => { externalActive = !!on; if (on) lockScreen(); else if (!somethingRunning()) unlockScreen(); },
  };

  return { init, syncBodyState, shared };
})();
