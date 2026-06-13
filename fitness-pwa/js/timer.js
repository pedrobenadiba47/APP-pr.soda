/* ============================================================
   TIMER MODULE  —  PR.47
   Cronómetro: toggle play/pause, color inversion
   Timer: prep(azul) / ejercicio(verde) / descanso(rojo)
   + Tiempo total de circuito con countdown
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
    return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
  }

  function el(id) { return document.getElementById(id); }

  function setBodyState(cls) {
    document.body.classList.remove('sw-running','it-prep','it-exercise','it-rest');
    if (cls) document.body.classList.add(cls);
  }

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
    container.innerHTML = [...laps].reverse().map((lap, i) => {
      const { main: sm, ms: sms } = fmtStopwatch(lap.split);
      const { main: tm }          = fmtStopwatch(lap.total);
      return `<div class="lap-item${i === 0 ? ' lap-item--latest' : ''}">
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
    } else {
      swRunning = true;
      swStart   = Date.now() - swElapsed;
      swRaf     = requestAnimationFrame(swTick);
      setBodyState('sw-running');
      swSetIcon(true);
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
  }

  /* ─── INTERVAL TIMER ─────────────────────────────────────── */
  const CIRC = 2 * Math.PI * 115;

  let cfg          = {};
  let phase        = 'exercise';
  let curSet       = 1;
  let curRound     = 1;
  let remain       = 0;
  let total        = 0;
  let totalCircuit = 0;   // duración total del circuito en segundos
  let totalRemain  = 0;   // segundos restantes del circuito completo
  let running      = false;
  let tickId       = null;

  // ── Arc smooth animation via rAF ──────────────────────────
  let arcRaf         = null;
  let arcPhaseStart  = 0;   // Date.now() when the current phase began
  let arcPhaseTotalMs = 0;  // total duration of the current phase in ms

  function setArc(r, t) {
    // Discrete set (used when paused / finished)
    const arc = el('progress-arc');
    if (!arc) return;
    arc.style.strokeDashoffset = CIRC * (1 - (t > 0 ? r / t : 0));
  }

  function startArcRaf(totalSec, elapsedSec = 0) {
    stopArcRaf();
    arcPhaseTotalMs = totalSec * 1000;
    arcPhaseStart   = Date.now() - elapsedSec * 1000;
    const arc = el('progress-arc');
    (function frame() {
      if (!running || !arc) { arcRaf = null; return; }
      const elapsed  = Date.now() - arcPhaseStart;
      const fraction = Math.max(0, 1 - elapsed / arcPhaseTotalMs);
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

  function vibrate(p) { if (navigator.vibrate) navigator.vibrate(p); }

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

  // Schedule one whistle-like tone: sine sweep f0→f1, starting at startT seconds
  function whistle(ctx, f0, f1, startT, durMs, vol) {
    const t0   = ctx.currentTime + startT;
    const durS = durMs / 1000;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.linearRampToValueAtTime(f1, t0 + durS * 0.75);
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.010);
    gain.gain.setValueAtTime(vol, t0 + durS * 0.65);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + durS);
    osc.start(t0);
    osc.stop(t0 + durS + 0.05);
  }

  // Always resume before playing — ctx.resume() returns a Promise so we
  // wait for it before scheduling oscillators. This fixes iOS silence bug
  // where the context is technically unlocked but not yet 'running'.
  function play(fn) {
    try {
      const ctx = getCtx();
      if (!ctx) return;
      ctx.resume().then(() => { try { fn(ctx); } catch(e) {} });
    } catch(e) {}
  }

  /* Short high whistle tweet — fires at 3, 2, 1 seconds remaining */
  function countdownBeep() {
    play(ctx => whistle(ctx, 1760, 1920, 0, 80, 0.55));
  }

  /* Double referee whistle — phase change (second hits 0) */
  function changeBeep() {
    play(ctx => {
      whistle(ctx, 1800, 2050, 0,    130, 0.58);
      whistle(ctx, 1800, 2050, 0.22, 130, 0.58);
    });
  }

  /* Three whistle blasts — circuit complete (tweet · tweet · TWEETTT) */
  function finishBeep() {
    play(ctx => {
      whistle(ctx, 1800, 2100, 0,    150, 0.62);
      whistle(ctx, 1800, 2100, 0.27, 150, 0.62);
      whistle(ctx, 1700, 2350, 0.58, 600, 0.68);
    });
  }

  function startExercise() {
    phase  = 'exercise';
    remain = cfg.exSec;
    total  = cfg.exSec;
    vibrate([150]);
    updateUI();
    if (running) { startArcRaf(total); tick(); }
  }

  function nextPhase() {
    if (phase === 'prep') {
      changeBeep();
      startExercise();
      return;
    }
    if (phase === 'exercise') {
      vibrate([200, 80, 200]);
      changeBeep();
      if (cfg.restSec > 0) {
        phase  = 'rest';
        remain = cfg.restSec;
        total  = cfg.restSec;
        updateUI();
        if (running) { startArcRaf(total); tick(); }
      } else {
        advanceSet();
      }
    } else {
      changeBeep();
      advanceSet();
    }
  }

  function advanceSet() {
    if (curSet < cfg.sets) {
      curSet++;
      vibrate([100, 50, 100, 50, 220]);
    } else if (curRound < cfg.rounds) {
      curRound++;
      curSet = 1;
      vibrate([300, 100, 300]);
    } else {
      finish();
      return;
    }
    phase  = 'exercise';
    remain = cfg.exSec;
    total  = cfg.exSec;
    updateUI();
    if (running) { startArcRaf(total); tick(); }
  }

  function finish() {
    running      = false;
    totalRemain  = 0;
    stopArcRaf();
    finishBeep();
    vibrate([500, 200, 500, 200, 500]);
    setBodyState(null);
    el('phase-badge').textContent       = '¡ COMPLETADO !';
    el('it-display').textContent        = '00:00';
    el('it-total-time').textContent     = '00:00';
    setArc(0, 1);
    itSetIcon(false);
  }

  function tick() {
    if (tickId) clearTimeout(tickId);
    tickId = setTimeout(() => {
      if (!running) return;
      remain--;
      if (totalRemain > 0) totalRemain--;
      updateUI();
      if (remain <= 0) {
        nextPhase();
      } else {
        if (remain <= 3) countdownBeep();
        tick();
      }
    }, 1000);
  }

  function itStart() {
    unlockAudio(); // unlock while still inside the tap gesture
    const prepSec  = Math.max(0, parseInt(el('prep-sec').value  || 0));
    const exSec    = parseInt(el('ex-sec').value   || 0);
    const restSec  = parseInt(el('rest-sec').value || 0);
    const sets     = Math.max(1, parseInt(el('sets-count').value   || 1));
    const rounds   = Math.max(1, parseInt(el('rounds-count').value || 1));

    if (exSec <= 0) { App.toast('Ingresá el tiempo de ejercicio'); return; }

    cfg      = { prepSec, exSec, restSec, sets, rounds };
    curSet   = 1;
    curRound = 1;
    running  = true;

    // Calcular tiempo total del circuito
    totalCircuit = prepSec + rounds * sets * (exSec + restSec);
    totalRemain  = totalCircuit;

    el('interval-config').classList.add('hidden');
    el('interval-running').classList.remove('hidden');
    itSetIcon(true);

    if (prepSec > 0) {
      phase  = 'prep';
      remain = prepSec;
      total  = prepSec;
    } else {
      phase  = 'exercise';
      remain = exSec;
      total  = exSec;
    }

    updateUI();
    startArcRaf(total);
    tick();
  }

  function itToggle() {
    unlockAudio(); // unlock while still inside the tap gesture
    if (running) {
      running = false;
      if (tickId) clearTimeout(tickId);
      stopArcRaf();
      setArc(remain, total); // show exact position while paused
      itSetIcon(false);
    } else {
      running = true;
      itSetIcon(true);
      // Resume arc from current position (remain seconds left in phase of total)
      startArcRaf(total, total - remain);
      tick();
    }
  }

  function itReset() {
    running      = false;
    totalRemain  = 0;
    if (tickId) clearTimeout(tickId);
    stopArcRaf();
    setBodyState(null);
    el('interval-config').classList.remove('hidden');
    el('interval-running').classList.add('hidden');
    itSetIcon(false);
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
  function init() {
    initTabs();
    el('sw-toggle').addEventListener('click', swToggle);
    el('sw-lap').addEventListener('click', () => {
      if (swRunning)       swLap();
      else if (swElapsed > 0) swReset();
    });
    el('interval-go').addEventListener('click', itStart);
    el('it-pause').addEventListener('click',   itToggle);
    el('it-reset').addEventListener('click',   itReset);
  }

  return { init, syncBodyState };
})();
