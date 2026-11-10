/* ============================================================
   CALENDAR MODULE  —  PR.47
   Agenda: tira de la semana + el día elegido con sus clases ordenadas por hora
           ("Ahora" / "Próxima"), y "Mi entrenamiento".
   Vista Mes: para saltar a cualquier fecha (tocás un día y abre su agenda).
   Datos (sin cambios): fitpro_events_v2 = { "AAAA-MM-DD": { myTraining, classes: [...] } }
============================================================ */

const Calendar = (() => {

  const KEY_EV    = 'fitpro_events_v2';
  const KEY_USERS = 'fitpro_users';
  const DAYS      = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const DAYS_LONG = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MONTHS    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const CLASS_MIN = 60;                  // cuánto dura una clase (para "Ahora")

  let events  = {};
  let view    = 'agenda';                // 'agenda' | 'month'
  let cursor  = new Date();              // mes que muestra la vista Mes
  let selDate = null;                    // día elegido en la agenda
  let anim    = '';                      // animación al cambiar de día
  let U       = null;                    // usuarios leídos una vez por dibujo

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function loadEvents() { try { events = JSON.parse(localStorage.getItem(KEY_EV) || '{}') || {}; } catch (e) { events = {}; } }
  function saveEvents() { localStorage.setItem(KEY_EV, JSON.stringify(events)); }
  function getUsers()   { try { return JSON.parse(localStorage.getItem(KEY_USERS) || '[]'); } catch (e) { return []; } }
  const users           = () => (U || (U = getUsers()));
  function getPedro()   { return users().find(u => u.isTrainer) || null; }
  function getStudents(){ return users().filter(u => !u.isTrainer); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function dkey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function weekStart(d) { const dt = new Date(d); dt.setDate(dt.getDate() - dt.getDay()); return dt; }
  const todayKey = () => dkey(new Date());
  const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };

  /* Day data shape: { myTraining: {routineId, routineName} | null, classes: [...] } */
  function dayData(k) {
    const d = events[k];
    return d ? d : { myTraining: null, classes: [] };
  }
  function saveDay(k, data) { events[k] = data; saveEvents(); }

  /* ── Íconos ─────────────────────────────────────────────── */
  const ic = {
    edit:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`,
    eye:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    play:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 001.5.86l12.5-7.5a1 1 0 000-1.72L8.5 3.64A1 1 0 007 4.5z"/></svg>`,
    plus:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    swap:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>`,
    me:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="10.5" width="3" height="3" rx=".5"/><rect x="19" y="10.5" width="3" height="3" rx=".5"/><rect x="5" y="8.5" width="2" height="7" rx=".5"/><rect x="17" y="8.5" width="2" height="7" rx=".5"/><line x1="7" y1="12" x2="17" y2="12"/></svg>`,
    free:  `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 15.5l2 2 4-4"/></svg>`,
  };

  /* ── Break labels (mirrors users.js) ────────────────────── */
  const BREAK_LABELS = {
    rest: 'Descanso', warmup: 'Entrada en calor', 'active-pause': 'Pausa activa',
    'speed-run': 'Pasadas de Velocidad',
  };
  const BREAK_ICONS = {
    rest:           `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>`,
    warmup:         `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2c0 6-6 8-6 14a6 6 0 0012 0c0-6-6-8-6-14z"/></svg>`,
    'active-pause': `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    'speed-run':    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  };

  /* ── Datos "vivos" de una clase (nombre y rutina actuales, aunque se hayan renombrado) ── */
  function studentColor(userId) {
    const u = users().find(u => u.id === userId);
    return u?.color || '#5aabcc';
  }
  function findRoutine(routineId, owner) {
    if (!routineId) return null;
    const r = owner ? (owner.routines || []).find(x => x.id === routineId) : null;
    if (r) return r;
    if (typeof Users !== 'undefined' && Users.getRoutineById) return Users.getRoutineById(routineId) || null;
    for (const u of users()) { const x = (u.routines || []).find(y => y.id === routineId); if (x) return x; }
    return null;
  }
  function routineInfo(r, owner) {
    if (!r) return '';
    const items = r.items || (r.exercises || []).map(e => ({ ...e, type: 'exercise' }));
    const exN = items.filter(i => !i.type || i.type === 'exercise').length;
    const f = r.folder && owner ? (owner.folders || []).find(x => x.id === r.folder) : null;
    return [exN ? `${exN} ejercicio${exN !== 1 ? 's' : ''}` : 'Sin ejercicios', f ? f.name : ''].filter(Boolean).join(' · ');
  }
  function resolveClass(cl) {
    const st = users().find(u => u.id === cl.userId) || null;
    const r  = findRoutine(cl.routineId, st);
    return { st, r, name: st?.name || cl.userName || 'Alumno', color: st?.color || '#5aabcc',
             rname: r?.name || cl.routineName || 'Sin rutina', info: routineInfo(r, st) };
  }
  function sortedClasses(k) {
    return (dayData(k).classes || []).map((cl, i) => ({ cl, i, t: toMin(cl.time) }))
      .sort((a, b) => (a.t == null) - (b.t == null) || (a.t - b.t) || (a.i - b.i));
  }

  /* ── Dibujo general ─────────────────────────────────────── */
  function render() {
    loadEvents(); U = null;              // siempre se lee fresco de localStorage
    if (!selDate) selDate = todayKey();
    document.querySelectorAll('#section-calendar .view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'month') renderMonth(); else renderStrip();
    const ag = document.getElementById('day-agenda');
    if (view === 'agenda') { ag.classList.remove('hidden'); renderAgenda(selDate); }
    else { ag.classList.add('hidden'); ag.innerHTML = ''; }
    const tBtn = document.getElementById('cal-today');
    const now = new Date();
    const onToday = view === 'agenda' ? selDate === todayKey()
                                      : (cursor.getMonth() === now.getMonth() && cursor.getFullYear() === now.getFullYear());
    tBtn.classList.toggle('hidden', onToday);
    U = null;
  }

  function dotsFor(k, max) {
    const data = dayData(k);
    const cls = sortedClasses(k);
    let html = data.myTraining ? '<i class="cd cd-me"></i>' : '';
    cls.slice(0, max).forEach(x => { html += `<i class="cd" style="background:${studentColor(x.cl.userId)}"></i>`; });
    if (cls.length > max) html += `<em class="cd-more">+${cls.length - max}</em>`;
    return html;
  }

  /* Tira de la semana */
  function renderStrip() {
    const sel = parseKey(selDate), ws = weekStart(sel), we = addDays(ws, 6);
    document.getElementById('cal-title').textContent = ws.getMonth() === we.getMonth()
      ? `${MONTHS[ws.getMonth()]} ${ws.getFullYear()}`
      : `${MONTHS[ws.getMonth()].slice(0, 3)} — ${MONTHS[we.getMonth()].slice(0, 3)} ${we.getFullYear()}`;
    const tk = todayKey();
    let html = '<div class="wk-strip" id="wk-strip">';
    for (let i = 0; i < 7; i++) {
      const day = addDays(ws, i), k = dkey(day), data = dayData(k);
      const has = !!data.myTraining || (data.classes || []).length > 0;
      html += `<button class="wk-day${k === tk ? ' is-today' : ''}${k === selDate ? ' is-sel' : ''}${has ? ' has-ev' : ''}" data-key="${k}">
        <span class="wk-dn">${DAYS[day.getDay()]}</span>
        <span class="wk-num">${day.getDate()}</span>
        <span class="wk-dots">${dotsFor(k, 3)}</span>
      </button>`;
    }
    html += '</div>';
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = html;
    grid.querySelectorAll('.wk-day').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.key === selDate) return;
      anim = b.dataset.key > selDate ? 'ag-in-r' : 'ag-in-l';
      selDate = b.dataset.key; render();
    }));
    swipe(grid.querySelector('#wk-strip'), dir => shiftDays(7 * dir));
  }

  /* Vista mes */
  function renderMonth() {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    document.getElementById('cal-title').textContent = `${MONTHS[m]} ${y}`;
    const tk = todayKey();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInM  = new Date(y, m + 1, 0).getDate();
    let html = '<div class="month-grid">';
    DAYS.forEach(d => { html += `<div class="day-header">${d}</div>`; });
    for (let i = 0; i < firstDay; i++) html += '<div class="day-cell empty"></div>';
    for (let d = 1; d <= daysInM; d++) {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const n = (dayData(k).classes || []).length;
      const cls = ['day-cell', tk === k ? 'today' : '', selDate === k ? 'selected' : '', n ? 'has-cls' : ''].join(' ');
      html += `<div class="${cls}" data-key="${k}">
                 <div class="day-num">${d}</div>
                 <div class="day-dots">${dotsFor(k, 3)}</div>
               </div>`;
    }
    html += '</div><div class="month-hint">Tocá un día para ver su agenda</div>';
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = html;
    grid.querySelectorAll('.day-cell:not(.empty)').forEach(c => c.addEventListener('click', () => {
      selDate = c.dataset.key; view = 'agenda'; anim = 'ag-in-up'; render();
      document.getElementById('app-content').scrollTop = 0;
    }));
    swipe(grid.querySelector('.month-grid'), dir => { cursor.setMonth(cursor.getMonth() + dir); render(); });
  }

  /* ── Agenda del día ─────────────────────────────────────── */
  function dayTitle(k) {
    const tk = todayKey();
    if (k === tk) return 'Hoy';
    if (k === dkey(addDays(new Date(), 1))) return 'Mañana';
    if (k === dkey(addDays(new Date(), -1))) return 'Ayer';
    return DAYS_LONG[parseKey(k).getDay()];
  }
  function inLabel(mins) {
    if (mins < 60) return `en ${mins} min`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return `en ${h} h${m ? ' ' + String(m).padStart(2, '0') : ''}`;
  }

  function renderAgenda(k) {
    const box   = document.getElementById('day-agenda');
    const data  = dayData(k);
    const pedro = getPedro();
    const date  = parseKey(k);
    const dayOfW = date.getDay();
    const isToday = k === todayKey();
    const nowMin = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
    const cls = sortedClasses(k);

    /* estado de cada clase si es hoy: ya pasó / ahora / la próxima */
    let nextDone = false;
    const rows = cls.map(x => {
      let st = '', tag = '';
      if (isToday && x.t != null) {
        if (nowMin >= x.t + CLASS_MIN) st = 'past';
        else if (nowMin >= x.t) { st = 'now'; tag = 'Ahora'; }
        else if (!nextDone) { st = 'next'; tag = inLabel(x.t - nowMin); nextDone = true; }
      }
      return { ...x, st, tag, rc: resolveClass(x.cl) };
    });

    const times = cls.filter(x => x.t != null).map(x => x.cl.time);
    const head = `
      <div class="ag-head">
        <div class="ag-head-main">
          <div class="ag-kicker${isToday ? ' is-today' : ''}">${dayTitle(k)}</div>
          <div class="ag-date">${DAYS_LONG[dayOfW]} ${date.getDate()} de ${MONTHS[date.getMonth()].toLowerCase()}</div>
          ${times.length > 1 ? `<div class="ag-range">De ${times[0]} a ${times[times.length - 1]}</div>` : times.length ? `<div class="ag-range">A las ${times[0]}</div>` : ''}
        </div>
        <div class="ag-count${cls.length ? '' : ' is-zero'}"><b>${cls.length}</b><small>clase${cls.length !== 1 ? 's' : ''}</small></div>
      </div>`;

    /* habituales de este día que todavía no están agendados */
    const already = new Set(cls.map(x => x.cl.userId));
    const toSuggest = getStudents().filter(u => (u.schedule || []).includes(dayOfW) && !already.has(u.id));
    const suggested = toSuggest.length ? `
      <div class="ag-suggest">
        <span class="ag-suggest-label">Suelen venir este día</span>
        <div class="ag-suggest-chips">
        ${toSuggest.map(s => {
          const def = (s.classDefaults || []).find(d => d.day === dayOfW);
          return `<button class="ag-chip" data-uid="${s.id}" data-time="${esc(def?.time || '')}" data-rid="${esc(def?.routineId || '')}" style="--c:${s.color || '#5aabcc'}">
              ${ic.plus}<span>${esc(s.name)}</span>${def?.time ? `<small>${esc(def.time)}</small>` : ''}
            </button>`;
        }).join('')}
        </div>
      </div>` : '';

    const cards = rows.map(x => `
      <div class="ag-card${x.st ? ' is-' + x.st : ''}" style="--c:${x.rc.color}">
        <div class="ag-time">
          <b>${x.cl.time ? esc(x.cl.time) : '—'}</b>
          ${x.tag ? `<span class="ag-tag">${x.tag}</span>` : x.st === 'past' ? '<span class="ag-tag ag-tag--past">Hecha</span>' : ''}
        </div>
        <div class="ag-main">
          <button class="ag-body" data-act="view" data-i="${x.i}">
            <span class="ag-name">${esc(x.rc.name)}</span>
            <span class="ag-rout">${esc(x.rc.rname)}</span>
            ${x.rc.info ? `<span class="ag-info">${esc(x.rc.info)}</span>` : ''}
          </button>
          <div class="ag-actions">
            ${x.rc.r ? `<button class="ag-btn ag-btn--run" data-act="run" data-i="${x.i}">${ic.play}Cronometrar</button>` : ''}
            <span class="ag-sp"></span>
            ${x.rc.r ? `<button class="ag-ico" data-act="view" data-i="${x.i}" aria-label="Ver rutina">${ic.eye}</button>` : ''}
            <button class="ag-ico" data-act="edit" data-i="${x.i}" aria-label="Editar clase">${ic.edit}</button>
            <button class="ag-ico ag-ico--del" data-act="del" data-i="${x.i}" aria-label="Borrar clase">${ic.trash}</button>
          </div>
        </div>
      </div>`).join('');

    const empty = !cls.length ? `
      <div class="ag-free">
        <span class="ag-free-ico">${ic.free}</span>
        <b>Sin clases ${isToday ? 'hoy' : 'este día'}</b>
        <span>${toSuggest.length ? 'Tocá un alumno de arriba o agregá una clase.' : 'Agregá una clase con el botón de abajo.'}</span>
      </div>` : '';

    /* Mi entrenamiento */
    let mine = '';
    if (pedro) {
      const mt = data.myTraining;
      const r = mt ? findRoutine(mt.routineId, pedro) : null;
      mine = mt ? `
        <div class="ag-sec-label">Mi entrenamiento</div>
        <div class="ag-card ag-card--me">
          <div class="ag-time ag-time--me">${ic.me}</div>
          <div class="ag-main">
            <button class="ag-body" data-act="my-view">
              <span class="ag-name">${esc(r?.name || mt.routineName)}</span>
              ${r ? `<span class="ag-info">${esc(routineInfo(r, pedro))}</span>` : ''}
            </button>
            <div class="ag-actions">
              ${r ? `<button class="ag-btn ag-btn--run" data-act="my-run">${ic.play}Cronometrar</button>` : ''}
              <button class="ag-btn" data-act="my-change">${ic.swap}Cambiar</button>
              <span class="ag-sp"></span>
              <button class="ag-ico ag-ico--del" data-act="my-clear" aria-label="Quitar">${ic.trash}</button>
            </div>
          </div>
        </div>` : `
        <button class="ag-me-empty" data-act="my-change">${ic.me}<span>Asignar mi entrenamiento</span>${ic.plus}</button>`;
    }

    box.innerHTML = `<div class="ag-wrap ${anim}">
      ${head}
      ${suggested}
      <div class="ag-list">${cards}${empty}</div>
      <button class="btn btn-primary btn-full ag-add" data-act="add">${ic.plus} Agregar clase</button>
      ${mine}
    </div>`;
    anim = '';

    /* acciones */
    const getCl = i => dayData(k).classes[i];
    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const act = b.dataset.act, i = parseInt(b.dataset.i, 10);
      if (act === 'add') return openClassModal(k);
      if (act === 'edit') return openClassModal(k, getCl(i), i);
      if (act === 'del') {
        const d = dayData(k); const removed = d.classes.splice(i, 1)[0];
        saveDay(k, d); render();
        App.undoToast('Clase eliminada', () => {
          loadEvents(); const d2 = dayData(k); if (!d2.classes) d2.classes = [];
          d2.classes.splice(Math.min(i, d2.classes.length), 0, removed); saveDay(k, d2); render();
        });
        return;
      }
      if (act === 'view' || act === 'run') {
        const cl = getCl(i); if (!cl) return;
        const rc = resolveClass(cl); U = null;
        if (!rc.r) { openClassModal(k, cl, i); return; }
        if (act === 'run') return runRoutine(rc.r);
        return openRoutineView(rc.r, rc.color, rc.st?.name || null);
      }
      if (act === 'my-change') return openMyTrainingModal(k, getPedro());
      if (act === 'my-clear') {
        const d = dayData(k); const before = d.myTraining; d.myTraining = null;
        saveDay(k, d); render();
        App.undoToast('Entrenamiento quitado', () => { loadEvents(); const d2 = dayData(k); d2.myTraining = before; saveDay(k, d2); render(); });
        return;
      }
      if (act === 'my-view' || act === 'my-run') {
        const mt = dayData(k).myTraining; const p = getPedro();
        const r = mt ? findRoutine(mt.routineId, p) : null; U = null;
        if (!r) return;
        return act === 'my-run' ? runRoutine(r) : openRoutineView(r, 'var(--accent-d)', null);
      }
    }));
    box.querySelectorAll('.ag-chip').forEach(b => b.addEventListener('click', () => {
      openClassModal(k, { userId: b.dataset.uid, time: b.dataset.time || '', routineId: b.dataset.rid || null }, null);
    }));
    swipe(box.querySelector('.ag-head'), dir => shiftDays(dir));
  }

  function runRoutine(r) {
    if (typeof Users !== 'undefined' && Users.runRoutine) Users.runRoutine(r);
    else if (typeof Runner !== 'undefined') Runner.open(r, {});
  }

  /* deslizar el dedo a los costados */
  function swipe(el, cb) {
    if (!el) return;
    let x0 = null, y0 = 0;
    el.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
    el.addEventListener('touchend', e => {
      if (x0 == null) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
      if (Math.abs(dx) > 55 && Math.abs(dy) < 45) cb(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function shiftDays(n) {
    anim = n > 0 ? 'ag-in-r' : 'ag-in-l';
    selDate = dkey(addDays(parseKey(selDate || todayKey()), n));
    cursor = parseKey(selDate);
    render();
  }

  /* ── Modal: Mi entrenamiento ────────────────────────────── */
  function openMyTrainingModal(k, pedro) {
    if (!pedro) return;
    const routines = pedro.routines || [];
    if (!routines.length) { App.toast('Primero creá rutinas en tu perfil'); return; }
    const current = dayData(k).myTraining?.routineId;

    App.openModal('Mi entrenamiento', `
      <div class="form-group">
        <label>Elegí la rutina de este día</label>
        <select id="mt-routine" class="form-select">${routineOptions(pedro, current)}</select>
      </div>
      <div class="modal-footer">
        <button id="mt-cancel" class="btn btn-secondary">Cancelar</button>
        <button id="mt-save"   class="btn btn-primary">Guardar</button>
      </div>
    `);

    document.getElementById('mt-cancel').addEventListener('click', App.closeModal);
    document.getElementById('mt-save').addEventListener('click', () => {
      const routineId = document.getElementById('mt-routine').value;
      const routine   = routines.find(r => r.id === routineId);
      if (!routine) return;
      loadEvents();
      const d = dayData(k);
      d.myTraining = { routineId, routineName: routine.name };
      saveDay(k, d);
      App.closeModal(); render();
      App.toast('Entrenamiento asignado');
    });
  }

  /* ── Modal: Clase ───────────────────────────────────────── */
  /* rutinas agrupadas por carpeta, para encontrarlas rápido */
  function routineOptions(u, selRoutineId) {
    const rs = u?.routines || [];
    if (!rs.length) return '<option value="">Sin rutinas creadas</option>';
    const opt = r => `<option value="${esc(r.id)}" ${r.id === selRoutineId ? 'selected' : ''}>${esc(r.name)}</option>`;
    const fs = u.folders || [];
    if (!fs.length) return rs.map(opt).join('');
    const by = new Map(fs.map(f => [f.id, []])); const rest = [];
    rs.forEach(r => (by.get(r.folder) || rest).push(r));
    return fs.filter(f => by.get(f.id).length).map(f => `<optgroup label="${esc(f.name)}">${by.get(f.id).map(opt).join('')}</optgroup>`).join('')
      + (rest.length ? `<optgroup label="Otras">${rest.map(opt).join('')}</optgroup>` : '');
  }

  function openClassModal(k, ex = null, idx = null) {
    U = null;
    const students = getStudents();
    if (!students.length) { App.toast('No hay alumnos registrados'); return; }

    const dayOfW  = parseKey(k).getDay();
    const firstId = (ex?.userId && students.some(s => s.id === ex.userId)) ? ex.userId : students[0].id;
    const getDefault = userId => (students.find(s => s.id === userId)?.classDefaults || []).find(d => d.day === dayOfW) || null;

    const initDefault   = ex?.id ? null : getDefault(firstId);
    const initRoutineId = ex?.routineId || initDefault?.routineId || null;
    const initTime      = ex?.time      || initDefault?.time      || '';
    const stu = id => students.find(s => s.id === id);

    App.openModal(ex?.id ? 'Editar clase' : 'Nueva clase', `
      <div class="form-group">
        <label>Alumno</label>
        <select id="cl-student" class="form-select">
          ${students.map(s => `<option value="${esc(s.id)}" ${s.id === firstId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Rutina</label>
        <select id="cl-routine" class="form-select">${routineOptions(stu(firstId), initRoutineId)}</select>
      </div>
      <div class="form-group">
        <label>Horario</label>
        <input id="cl-time" class="form-input" type="time" value="${esc(initTime)}" />
      </div>
      <div class="modal-footer">
        <button id="cl-cancel" class="btn btn-secondary">Cancelar</button>
        <button id="cl-save"   class="btn btn-primary">Guardar</button>
      </div>
    `);

    document.getElementById('cl-student').addEventListener('change', e => {
      const def = getDefault(e.target.value);
      document.getElementById('cl-routine').innerHTML = routineOptions(stu(e.target.value), def?.routineId || null);
      if (def?.time) document.getElementById('cl-time').value = def.time;
    });

    document.getElementById('cl-cancel').addEventListener('click', App.closeModal);
    document.getElementById('cl-save').addEventListener('click', () => {
      const userId    = document.getElementById('cl-student').value;
      const routineId = document.getElementById('cl-routine').value || null;
      const time      = document.getElementById('cl-time').value;
      const student   = stu(userId);
      const routine   = routineId ? (student?.routines || []).find(r => r.id === routineId) : null;

      const cl = {
        id:          ex?.id || uid(),
        userId,
        userName:    student?.name || '',
        routineId:   routineId || null,
        routineName: routine?.name || 'Sin rutina',
        time
      };

      loadEvents();
      const d = dayData(k);
      if (!d.classes) d.classes = [];
      if (idx !== null && idx !== undefined && d.classes[idx]) d.classes[idx] = cl; else d.classes.push(cl);
      saveDay(k, d);
      App.closeModal(); render();
      App.toast(idx !== null && idx !== undefined ? 'Clase actualizada' : 'Clase agregada');
    });
  }

  /* ── Routine read-only view (from calendar) ─────────────── */
  function openRoutineView(routine, accentColor, studentName) {
    let items = routine.items;
    if (!items) items = (routine.exercises || []).map(e => ({ ...e, type: 'exercise' }));

    const col = routine.color || accentColor || 'var(--accent-d)';

    const itemsHTML = items.length ? items.map((item, idx) => {
      const num = `<div class="cal-routine-item-num">${idx + 1}</div>`;
      if (!item.type || item.type === 'exercise') {
        return num + `
          <div class="exercise-card" style="margin-bottom:8px">
            <div class="exercise-info">
              <div class="exercise-name">${esc(item.name)}</div>
              <div class="exercise-sets-label">Series × Reps</div>
              <div class="exercise-sets-reps" style="color:${col}">${esc(item.sets)} × ${esc(item.reps)}${item.dropset ? ' <span class="dropset-badge">+dropset</span>' : ''}</div>
              ${typeof Users !== 'undefined' && Users.exMetaHTML ? Users.exMetaHTML(item) : (item.note ? `<div class="exercise-note">${esc(item.note)}</div>` : '')}
            </div>
          </div>`;
      } else if (item.type === 'speed-run') {
        return num + `
          <div class="break-card speed-run-card" style="margin-bottom:8px">
            <div class="break-icon speed-run-icon">${BREAK_ICONS['speed-run']}</div>
            <div class="break-info">
              <span class="break-type-label">Pasadas de Velocidad</span>
              <span class="break-duration">${esc(item.series)} series &times; ${esc(item.distance)} ${esc(item.distUnit)}</span>
              <span class="break-note" style="display:block;margin-top:2px">Descanso: ${esc(item.rest)} ${esc(item.restUnit)}</span>
            </div>
          </div>`;
      }
      return num + `
          <div class="break-card" style="margin-bottom:8px">
            <div class="break-icon">${BREAK_ICONS[item.type] || ''}</div>
            <div class="break-info">
              <span class="break-type-label">${BREAK_LABELS[item.type] || esc(item.type)}</span>
              <span class="break-duration">${esc(item.duration)} ${item.unit === 'min' ? 'min' : 'seg'}</span>
              ${item.note ? `<span class="break-note">${esc(item.note)}</span>` : ''}
            </div>
          </div>`;
    }).join('')
    : `<p class="empty-events" style="padding:16px 0;font-size:.75rem">Sin ejercicios cargados</p>`;

    const exN = items.filter(i => !i.type || i.type === 'exercise').length;
    const brN = items.filter(i => i.type && i.type !== 'exercise').length;

    App.openModal(routine.name, `
      ${routine.description ? `<p class="cal-routine-desc" style="margin-bottom:14px">${esc(routine.description)}</p>` : ''}
      <div style="border-left:3px solid ${col};padding-left:10px;margin-bottom:16px">
        <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--text3)">
          ${studentName ? esc(studentName) + ' · ' : ''}${exN} ejercicio${exN !== 1 ? 's' : ''} · ${brN} pausa${brN !== 1 ? 's' : ''}
        </div>
      </div>
      ${exN ? `<button id="cal-run-btn" class="btn btn-accent btn-full" style="margin-bottom:16px">${ic.play} Cronometrar rutina</button>` : ''}
      ${itemsHTML}
      <button id="cal-pdf-btn" class="btn btn-secondary btn-full" style="margin-top:16px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Descargar PDF
      </button>
    `);

    document.getElementById('cal-run-btn')?.addEventListener('click', () => runRoutine(routine));
    document.getElementById('cal-pdf-btn')?.addEventListener('click', () => {
      if (typeof Users !== 'undefined') Users.downloadRoutinePDF(routine, studentName || null);
    });
  }

  /* ── Navegación ─────────────────────────────────────────── */
  function prev() {
    if (view === 'month') { cursor.setMonth(cursor.getMonth() - 1); render(); }
    else shiftDays(-7);
  }
  function next() {
    if (view === 'month') { cursor.setMonth(cursor.getMonth() + 1); render(); }
    else shiftDays(7);
  }
  function goToday() {
    const t = new Date();
    anim = selDate && selDate > todayKey() ? 'ag-in-l' : 'ag-in-r';
    selDate = dkey(t); cursor = new Date(t.getFullYear(), t.getMonth(), 1, 12);
    render();
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    loadEvents();
    selDate = todayKey();
    cursor  = parseKey(selDate);

    document.querySelectorAll('#section-calendar .view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (view === btn.dataset.view) return;
        view = btn.dataset.view;
        if (view === 'month') { const s = parseKey(selDate); cursor = new Date(s.getFullYear(), s.getMonth(), 1, 12); }
        render();
      });
    });

    document.getElementById('cal-prev').addEventListener('click', prev);
    document.getElementById('cal-next').addEventListener('click', next);
    document.getElementById('cal-today').addEventListener('click', goToday);
    // al volver a la app (por ejemplo al otro día) se actualiza "Hoy", "Ahora" y "Próxima"
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && document.getElementById('section-calendar')?.classList.contains('active')) render();
    });

    render();
  }

  /* Public reload — call after writing to fitpro_events_v2 from another module */
  function reload() { render(); }

  return { init, reload, _test: { sortedClasses, parseKey, dkey } };
})();
