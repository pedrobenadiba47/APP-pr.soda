/* ============================================================
   RUNNER MODULE  -  PR.47
   "Cronometrar rutina" (opcional): recorre una rutina paso a paso.
   - Ejercicios: vos marcás cada serie con "Listo", o van por tiempo.
     Si las repeticiones ya son tiempo ("30s", "1 min", plancha "Segundos"), ese tiempo corre solo.
   - Descansos, pausas activas, entrada en calor y pasadas: corren solos, con aviso sonoro.
   - Usa la hora real (no se atrasa con la pantalla bloqueada) y mantiene la pantalla encendida.
   No toca la rutina: es solo una forma de hacerla.
============================================================ */

const Runner = (() => {

  const CFG_KEY = 'fitpro_runner_cfg_v1';
  const isEx = it => !it.type || it.type === 'exercise';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = () => (typeof Timer !== 'undefined' && Timer.shared) ? Timer.shared : null;
  const fmt = sec => { sec = Math.max(0, Math.round(sec)); return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; };
  const LABEL = { work: 'Ejercicio', setrest: 'Descanso', rest: 'Descanso', warmup: 'Entrada en calor', 'active-pause': 'Pausa activa', speed: 'Pasada', speedrest: 'Descanso' };
  const THEME = { work: 'go', speed: 'go', setrest: 'rest', rest: 'rest', speedrest: 'rest', warmup: 'warm', 'active-pause': 'warm' };

  function loadCfg() {
    const d = { mode: 'manual', workSec: 40, setRest: 0 };
    try { return Object.assign(d, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); } catch (e) { return d; }
  }
  function saveCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) { /* ok */ } }

  /* ── 1) La rutina convertida en pasos ───────────────────── */
  const firstNum = v => { const m = String(v == null ? '' : v).match(/\d+/); return m ? parseInt(m[0]) : 0; };
  const unitSecs = (v, u) => { v = parseFloat(v) || 0; u = String(u || '').toLowerCase(); return /^min/.test(u) ? v * 60 : /^m/.test(u) ? null : v; };

  function exerciseSecs(it) {                       // ¿las repeticiones son tiempo? (plancha 30s, 1 min, "Segundos")
    try {
      const ri = Generator._core.repInfo(it.reps);
      if (ri.time != null) return Math.round(ri.time);
      const wt = Generator.weightOf(it);
      if (/segundo/i.test(wt.tech + ' ' + (it.note || '')) && ri.reps) return Math.round(ri.reps);
    } catch (e) { /* sin Generator: manual */ }
    return null;
  }

  function buildSteps(items, cfg) {
    const steps = [];
    items.forEach((it, idx) => {
      if (isEx(it)) {
        const sets = Math.max(1, Math.min(20, firstNum(it.sets) || 1));
        const own = exerciseSecs(it);
        const wt = (typeof Generator !== 'undefined') ? Generator.weightOf(it) : { weight: '', tech: it.note || '' };
        for (let s = 1; s <= sets; s++) {
          steps.push({ kind: 'work', secs: own || (cfg.mode === 'timed' ? cfg.workSec : null), idx,
                       title: it.name, sub: `${it.reps}${!own && /^[\d\s\-\/x,.]+$/i.test(String(it.reps)) ? ' reps' : ''}${it.dropset ? ' + dropset' : ''}`,
                       weight: wt.weight, tech: wt.tech, setNo: s, setsTotal: sets });
          if (s < sets && cfg.setRest > 0) steps.push({ kind: 'setrest', secs: cfg.setRest, idx, title: 'Descanso entre series', sub: `Sigue la serie ${s + 1} de ${sets}`, setNo: s, setsTotal: sets });
        }
      } else if (it.type === 'speed-run') {
        const n = Math.max(1, Math.min(40, parseInt(it.series) || 1));
        const w = unitSecs(it.distance, it.distUnit), r = unitSecs(it.rest, it.restUnit) || 0;
        for (let s = 1; s <= n; s++) {
          steps.push({ kind: 'speed', secs: w, idx, title: `Pasada ${s} de ${n}`, sub: `${it.distance} ${it.distUnit}`, setNo: s, setsTotal: n });
          if (s < n && r > 0) steps.push({ kind: 'speedrest', secs: r, idx, title: 'Descanso', sub: `Sigue la pasada ${s + 1} de ${n}`, setNo: s, setsTotal: n });
        }
      } else {
        const secs = Math.round((parseFloat(it.duration) || 0) * (it.unit === 'min' ? 60 : 1));
        if (secs > 0) steps.push({ kind: it.type, secs, idx, title: LABEL[it.type] || 'Pausa', sub: it.note || '' });
      }
    });
    return steps;
  }

  /* ── 2) Pantalla de inicio (cómo cronometrar) ───────────── */
  function open(routine, opts) {
    opts = opts || {};
    const items = routine.items || (routine.exercises || []).map(e => Object.assign({ type: 'exercise' }, e));
    if (!items.length) { App.toast('La rutina no tiene ejercicios'); return; }
    const cfg = loadCfg();
    const REST = [0, 15, 30, 45, 60, 90];
    const draw = () => {
      const steps = buildSteps(items, cfg);
      const timed = steps.reduce((s, x) => s + (x.secs || 0), 0);
      const manual = steps.filter(x => !x.secs).length;
      App.openModal('Cronometrar rutina', `
        <div class="run-sheet">
          <div class="run-sheet-name">${esc(routine.name)}</div>
          <div class="form-group">
            <label>Los ejercicios</label>
            <div class="gen-seg" id="rs-mode">
              <button class="${cfg.mode === 'manual' ? 'on' : ''}" data-m="manual">Marco cada serie</button>
              <button class="${cfg.mode === 'timed' ? 'on' : ''}" data-m="timed">Van por tiempo</button>
            </div>
            <div class="gen-hint" style="margin-top:7px">${cfg.mode === 'manual'
              ? 'Tocás “Listo” al terminar cada serie. Los descansos, pausas y pasadas corren solos.'
              : 'Cada serie dura el tiempo que elijas. Si un ejercicio ya está en segundos (plancha 30s), usa ese.'}</div>
          </div>
          ${cfg.mode === 'timed' ? `
          <div class="form-group">
            <label>Segundos por serie</label>
            <div class="gen-step run-step"><button data-ws="-5">−</button><b>${cfg.workSec}</b><button data-ws="5">+</button></div>
          </div>` : ''}
          <div class="form-group">
            <label>Descanso entre series de un mismo ejercicio</label>
            <div class="gen-chips" id="rs-rest">${REST.map(v => `<button class="gen-chip${cfg.setRest === v ? ' on' : ''}" data-r="${v}">${v ? v + ' s' : 'Sin descanso'}</button>`).join('')}</div>
          </div>
          <div class="timer-total"><span>${manual ? 'Descansos y pausas' : 'Duración total'}</span><b>${fmt(timed)}</b></div>
          ${manual ? `<div class="gen-hint" style="margin:6px 2px 0">+ lo que tarden las ${manual} series que marcás vos con “Listo”.</div>` : ''}
          <div class="modal-footer">
            <button class="btn btn-secondary" id="rs-cancel">Cancelar</button>
            <button class="btn btn-accent" id="rs-go">Empezar</button>
          </div>
        </div>`);
      const root = document.getElementById('modal-body');
      root.querySelectorAll('#rs-mode button').forEach(b => b.addEventListener('click', () => { cfg.mode = b.dataset.m; draw(); }));
      root.querySelectorAll('[data-ws]').forEach(b => b.addEventListener('click', () => { cfg.workSec = Math.max(10, Math.min(300, cfg.workSec + (+b.dataset.ws))); draw(); }));
      root.querySelectorAll('#rs-rest [data-r]').forEach(b => b.addEventListener('click', () => { cfg.setRest = +b.dataset.r; draw(); }));
      document.getElementById('rs-cancel').addEventListener('click', App.closeModal);
      document.getElementById('rs-go').addEventListener('click', () => {
        const t = T(); if (t) t.unlockAudio();          // dentro del toque: habilita el sonido en iPhone
        saveCfg(cfg); App.closeModal();
        start(routine, buildSteps(items, cfg), opts);
      });
    };
    draw();
  }

  /* ── 3) Recorrido ───────────────────────────────────────── */
  let S = null;

  function start(routine, steps, opts) {
    if (!steps.length) { App.toast('No hay nada para cronometrar'); return; }
    close(true);
    const ov = document.createElement('div');
    ov.className = 'run-overlay';
    ov.innerHTML = `
      <div class="run-top">
        <button class="run-icon" data-a="exit" aria-label="Salir">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="run-head"><b>${esc(routine.name)}</b><small id="run-meta"></small></div>
        <button class="run-icon" data-a="sound" aria-label="Sonido">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 010 7"/></svg>
        </button>
      </div>
      <div class="run-progress"><span id="run-bar"></span></div>
      <div class="run-body" id="run-body"></div>
      <div class="run-next" id="run-next"></div>
      <div class="run-controls" id="run-controls"></div>`;
    document.body.appendChild(ov);
    S = { routine, steps, opts, ov, i: 0, paused: false, phaseEnd: 0, pausedLeft: 0, startedAt: Date.now(), pausedMs: 0, pausedAt: 0, lastBeep: -1, done: false, exitArmed: 0 };
    ov.addEventListener('click', onClick);
    const t = T(); if (t) t.setActive(true);
    S.tick = setInterval(tick, 200);
    go(0, true);
  }

  function cur() { return S && S.steps[S.i]; }

  function go(i, silent) {
    if (!S) return;
    if (i >= S.steps.length) return finish();
    S.i = Math.max(0, i);
    const st = cur();
    S.paused = false; S.lastBeep = -1;
    if (st.secs) S.phaseEnd = Date.now() + st.secs * 1000;
    if (!silent) { const t = T(); if (t) { t.playSound('change'); t.vibrate([150]); } }
    render();
  }

  function tick() {
    if (!S || S.done || S.paused) return;
    let st = cur();
    if (!st || !st.secs) { renderMeta(); return; }
    const now = Date.now();
    let advanced = false, late = 0;
    while (st && st.secs && now >= S.phaseEnd) {             // si la app estuvo dormida, avanza lo que pasó
      late = now - S.phaseEnd;
      const end = S.phaseEnd;
      S.i++; st = cur(); advanced = true;
      if (!st) return finish();
      S.lastBeep = -1;
      if (st.secs) S.phaseEnd = end + st.secs * 1000; else break;
    }
    if (advanced) {
      if (late < 1500) { const t = T(); if (t) { t.playSound('change'); t.vibrate([150]); } }
      render(); return;
    }
    const left = paint(S.phaseEnd - now, st);
    if (left >= 1 && left <= 3 && left !== S.lastBeep) { S.lastBeep = left; const t = T(); if (t) t.playSound('count'); }
    renderMeta();
  }

  const RING = 2 * Math.PI * 110;

  /* reloj y aro según lo que falta (en ms) */
  function paint(leftMs, st) {
    leftMs = Math.max(0, leftMs);
    const left = Math.ceil(leftMs / 1000);
    const c = document.getElementById('run-clock'); if (c) c.textContent = fmt(left);
    const ring = document.getElementById('run-ring');
    if (ring) ring.style.strokeDashoffset = RING * (1 - Math.max(0, Math.min(1, leftMs / (st.secs * 1000))));
    return left;
  }

  function nextLabel() {
    const n = S.steps[S.i + 1];
    if (!n) return 'Último paso';
    const what = n.kind === 'work' ? `${n.title}${n.setsTotal > 1 ? ` · serie ${n.setNo}/${n.setsTotal}` : ''}` : `${LABEL[n.kind] || n.title}${n.secs ? ' ' + fmt(n.secs) : ''}`;
    return 'Sigue: ' + what;
  }

  function renderMeta() {
    if (!S) return;
    const items = S.routine.items || [];
    const exN = items.filter(isEx).length;
    const st = cur();
    const exPos = st ? items.slice(0, st.idx + 1).filter(isEx).length : exN;
    const elapsed = (Date.now() - S.startedAt - S.pausedMs - (S.paused && S.pausedAt ? Date.now() - S.pausedAt : 0)) / 1000;
    const m = document.getElementById('run-meta');
    if (m) m.textContent = S.done ? `Terminada · ${fmt(elapsed)}` : `Ejercicio ${Math.max(1, exPos)} de ${exN} · ${fmt(elapsed)}`;
    const bar = document.getElementById('run-bar');
    if (bar) bar.style.width = (S.done ? 100 : Math.round(100 * S.i / S.steps.length)) + '%';
  }

  function render() {
    if (!S) return;
    const st = cur();
    S.ov.className = 'run-overlay run--' + (S.done ? 'done' : (THEME[st.kind] || 'go')) + (S.under ? ' run--under' : '') + (S.paused ? ' run--paused' : '');
    const body = document.getElementById('run-body');
    const resting = st.kind === 'setrest' || st.kind === 'speedrest';       // en el descanso, la serie que pasó ya cuenta como hecha
    const dots = st.setsTotal > 1 ? `<div class="run-dots">${Array.from({ length: st.setsTotal }, (_, k) => `<i class="${k + 1 < st.setNo || (resting && k + 1 === st.setNo) ? 'ok' : k + 1 === st.setNo ? 'now' : ''}"></i>`).join('')}</div>` : '';
    const clock = st.secs
      ? `<div class="run-ringwrap"><svg viewBox="0 0 240 240" class="run-ring"><circle cx="120" cy="120" r="110" class="run-ring-bg"/><circle id="run-ring" cx="120" cy="120" r="110" class="run-ring-fill" style="stroke-dasharray:${RING};stroke-dashoffset:0"/></svg><div id="run-clock" class="run-clock">${fmt(st.secs)}</div></div>`
      : `<div class="run-manual"><span>${st.kind === 'speed' ? 'Pasada' : 'Serie'}</span><b>${st.setNo || 1}<small> / ${st.setsTotal || 1}</small></b></div>`;
    body.innerHTML = `
      <div class="run-phase">${esc(LABEL[st.kind] || '')}${st.kind === 'work' && st.setsTotal > 1 && st.secs ? ` · serie ${st.setNo}/${st.setsTotal}` : ''}</div>
      ${clock}
      <div class="run-name">${esc(st.title)}</div>
      ${st.sub ? `<div class="run-sub">${esc(st.sub)}</div>` : ''}
      ${st.weight || st.tech ? `<div class="run-meta-row">${st.weight ? `<span class="run-weight">${esc(st.weight)}</span>` : ''}${st.tech ? `<span class="run-tech">${esc(st.tech)}</span>` : ''}</div>` : ''}
      ${dots}`;
    document.getElementById('run-next').textContent = nextLabel();
    const main = st.secs
      ? `<button class="run-main" data-a="pause" aria-label="Pausa">${S.paused
          ? '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>'
          : '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'}</button>`
      : `<button class="run-main run-main--done" data-a="done">Listo</button>`;
    document.getElementById('run-controls').innerHTML = `
      <button class="run-side" data-a="prev" aria-label="Anterior"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      ${main}
      <button class="run-side" data-a="next" aria-label="Saltear"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></button>`;
    renderMeta();
    if (st.secs && S.paused) paint(S.pausedLeft, st);
    else tick();
  }

  function finish() {
    if (!S) return;
    S.done = true; S.i = S.steps.length - 1;
    const t = T(); if (t) { t.playSound('finish'); t.vibrate([400, 150, 400]); }
    S.ov.className = 'run-overlay run--done' + (S.under ? ' run--under' : '');
    const elapsed = (Date.now() - S.startedAt - S.pausedMs) / 1000;
    document.getElementById('run-body').innerHTML = `
      <div class="run-phase">¡Rutina completa!</div>
      <div class="run-done-time">${fmt(elapsed)}</div>
      <div class="run-sub">Tiempo total</div>`;
    document.getElementById('run-next').textContent = '';
    document.getElementById('run-controls').innerHTML = `
      ${S.opts.onWeights ? '<button class="btn btn-secondary" data-a="weights">Actualizar pesos</button>' : ''}
      <button class="btn btn-primary" data-a="close">Cerrar</button>`;
    renderMeta();
    if (t) t.setActive(false);
  }

  function togglePause() {
    const st = cur(); if (!st || !st.secs) return;
    const t = T(); if (t) t.unlockAudio();
    if (!S.paused) { S.paused = true; S.pausedAt = Date.now(); S.pausedLeft = Math.max(0, S.phaseEnd - S.pausedAt); }
    else { const now = Date.now(); S.pausedMs += now - S.pausedAt; S.phaseEnd = now + S.pausedLeft; S.paused = false; S.pausedAt = 0; }
    render();
  }

  function onClick(e) {
    const b = e.target.closest('[data-a]'); if (!b || !S) return;
    const a = b.dataset.a, t = T();
    if (t) t.unlockAudio();
    if (a === 'exit') {
      if (S.done || Date.now() - S.exitArmed < 2500) return close();
      S.exitArmed = Date.now(); App.toast('Tocá la ✕ otra vez para salir'); return;
    }
    if (a === 'sound') { if (t && t.openSettings) { S.under = true; S.ov.classList.add('run--under'); t.openSettings(); watchModal(); } return; }
    if (a === 'pause') return togglePause();
    if (a === 'done') return go(S.i + 1);
    if (a === 'next') return go(S.i + 1);
    if (a === 'prev') return go(S.i - 1, true);
    if (a === 'close') return close();
    if (a === 'weights') { const cb = S.opts.onWeights; close(); cb && cb(); }
  }

  /* los ajustes de sonido se abren arriba; al cerrarlos vuelve la rutina */
  function watchModal() {
    const ov = document.getElementById('modal-overlay');
    const iv = setInterval(() => { if (!S) return clearInterval(iv); if (ov.classList.contains('hidden')) { S.under = false; S.ov.classList.remove('run--under'); clearInterval(iv); } }, 300);
  }

  function close(silent) {
    if (!S) return;
    clearInterval(S.tick);
    S.ov.remove();
    S = null;
    const t = T(); if (t) t.setActive(false);
  }

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S) tick(); });

  return { open, buildSteps, isOpen: () => !!S, _state: () => S };
})();
