/* ============================================================
   CALENDAR MODULE  —  pr.soda
   Eventos: "Mi entrenamiento" (rutina de Pedro) +
            "Clases a alumnos" (con horario, rutina y alumno)
============================================================ */

const Calendar = (() => {

  const KEY_EV    = 'fitpro_events_v2';
  const KEY_USERS = 'fitpro_users';
  const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  let events  = {};
  let view    = 'month';
  let cursor  = new Date();
  let selDate = null;

  function loadEvents() { events = JSON.parse(localStorage.getItem(KEY_EV) || '{}'); }
  function saveEvents() { localStorage.setItem(KEY_EV, JSON.stringify(events)); }
  function getUsers()   { return JSON.parse(localStorage.getItem(KEY_USERS) || '[]'); }
  function getPedro()   { return getUsers().find(u => u.isTrainer) || null; }
  function getStudents(){ return getUsers().filter(u => !u.isTrainer); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

  function dkey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  /* Day data shape: { myTraining: {routineId, routineName} | null, classes: [...] } */
  function dayData(k) {
    const d = events[k];
    return d ? d : { myTraining: null, classes: [] };
  }
  function saveDay(k, data) { events[k] = data; saveEvents(); }

  /* ── SVG icons ──────────────────────────────────────────── */
  const ic = {
    edit:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    trash:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`,
    dumbbell: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="10.5" width="3" height="3" rx=".5"/><rect x="19" y="10.5" width="3" height="3" rx=".5"/><rect x="5" y="8.5" width="2" height="7" rx=".5"/><rect x="17" y="8.5" width="2" height="7" rx=".5"/><line x1="7" y1="12" x2="17" y2="12"/></svg>`,
    eye:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
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

  /* ── Render calendar ────────────────────────────────────── */
  function render() {
    loadEvents(); // always read fresh from localStorage
    view === 'month' ? renderMonth() : renderWeek();
  }

  function renderMonth() {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    document.getElementById('cal-title').textContent =
      `${MONTHS[m].slice(0,3).toUpperCase()} ${y}`;

    const today    = dkey(new Date());
    const firstDay = new Date(y, m, 1).getDay();
    const daysInM  = new Date(y, m+1, 0).getDate();

    let html = '<div class="month-grid">';
    DAYS.forEach(d => { html += `<div class="day-header">${d}</div>`; });
    for (let i = 0; i < firstDay; i++) html += '<div class="day-cell empty"></div>';

    for (let d = 1; d <= daysInM; d++) {
      const k    = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const data = dayData(k);
      let dots = '';
      if (data.myTraining)
        dots += `<span class="dot dot-personal"></span>`;
      (data.classes || []).slice(0,3).forEach(() => {
        dots += `<span class="dot dot-class"></span>`;
      });
      const cls = ['day-cell', today===k?'today':'', selDate===k?'selected':''].join(' ');
      html += `<div class="${cls}" data-key="${k}">
                 <div class="day-num">${d}</div>
                 <div class="day-dots">${dots}</div>
               </div>`;
    }
    html += '</div>';
    document.getElementById('calendar-grid').innerHTML = html;
    document.querySelectorAll('.day-cell:not(.empty)').forEach(c =>
      c.addEventListener('click', () => selectDay(c.dataset.key))
    );
  }

  function renderWeek() {
    const ws = weekStart(cursor);
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    const fmt = d => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3).toUpperCase()}`;
    document.getElementById('cal-title').textContent = `${fmt(ws)} — ${fmt(we)}`;

    const today = dkey(new Date());
    let html = '<div class="week-grid">';
    for (let i = 0; i < 7; i++) {
      const day  = new Date(ws); day.setDate(ws.getDate() + i);
      const k    = dkey(day);
      const data = dayData(k);

      let dots = '';
      if (data.myTraining) dots += `<span class="dot dot-personal"></span>`;
      (data.classes||[]).forEach(() => { dots += `<span class="dot dot-class"></span>`; });

      const parts = [];
      if (data.myTraining) parts.push(`Yo: ${data.myTraining.routineName}`);
      (data.classes||[]).forEach(c =>
        parts.push(`${c.userName}${c.time ? ' ' + c.time : ''}`)
      );

      html += `<div class="week-day-row ${today===k?'today':''}" data-key="${k}">
                 <div class="week-day-info">
                   <div class="week-day-name">${DAYS[day.getDay()]}</div>
                   <div class="week-day-num">${day.getDate()}</div>
                   ${parts.length ? `<div class="week-events">${parts.join(' · ')}</div>` : ''}
                 </div>
                 <div class="week-dots">${dots}</div>
               </div>`;
    }
    html += '</div>';
    document.getElementById('calendar-grid').innerHTML = html;
    document.querySelectorAll('.week-day-row').forEach(r =>
      r.addEventListener('click', () => selectDay(r.dataset.key))
    );
  }

  function weekStart(d) {
    const dt = new Date(d);
    dt.setDate(dt.getDate() - dt.getDay());
    return dt;
  }

  /* ── Day detail ─────────────────────────────────────────── */
  function selectDay(k) {
    selDate = k;
    render();
    const [y, m, d] = k.split('-');
    document.getElementById('day-detail-title').textContent =
      `${DAYS[new Date(k+'T12:00').getDay()].toUpperCase()}  ${parseInt(d)} ${MONTHS[parseInt(m)-1].slice(0,3).toUpperCase()} ${y}`;
    document.getElementById('day-detail').classList.remove('hidden');
    document.getElementById('add-event-btn').classList.add('hidden'); // reemplazado por botones inline
    renderDayDetail(k);
  }

  function renderDayDetail(k) {
    const list    = document.getElementById('day-events-list');
    const data    = dayData(k);
    const pedro   = getPedro();
    const dayOfW  = new Date(k + 'T12:00').getDay();
    const suggested = getStudents().filter(u => (u.schedule||[]).includes(dayOfW));

    /* ── Sección: Mi entrenamiento ── */
    let mySection = '';
    if (pedro) {
      const mt       = data.myTraining;
      const routines = pedro.routines || [];
      mySection = `
        <div class="cal-section">
          <div class="cal-section-head">
            <span class="cal-section-label">Mi entrenamiento</span>
            <button class="cal-section-btn" id="btn-my-training">${mt ? 'Cambiar' : 'Asignar'}</button>
          </div>
          ${mt
            ? `<div class="cal-my-training-card">
                <button class="cal-tag cal-tag--green" id="btn-view-my-rout" style="cursor:pointer;border:none;font-family:inherit">${ic.dumbbell} ${mt.routineName}</button>
                <button class="icon-btn cal-clear-training" id="btn-clear-training" title="Quitar">${ic.trash}</button>
               </div>`
            : `<p class="empty-events" style="padding:8px 0;font-size:.7rem">${
                routines.length ? 'Sin rutina asignada para hoy' : 'Creá rutinas en tu perfil primero'
              }</p>`
          }
        </div>`;
    }

    /* ── Sección: Clases ── */
    const classes = data.classes || [];
    const classItems = classes.map((cl, i) => `
      <div class="cal-class-item">
        <div class="cal-class-dot" style="background:${studentColor(cl.userId)}"></div>
        <div class="cal-class-info">
          <div class="cal-class-name">${cl.userName}</div>
          <div class="cal-class-meta">${cl.routineName}${cl.time ? ' · ' + cl.time : ''}</div>
        </div>
        <div class="cal-class-actions">
          ${cl.routineId ? `<button class="icon-btn cl-view" data-i="${i}" title="Ver rutina">${ic.eye}</button>` : ''}
          <button class="icon-btn cl-edit" data-i="${i}">${ic.edit}</button>
          <button class="icon-btn cl-del"  data-i="${i}">${ic.trash}</button>
        </div>
      </div>`).join('');

    // Show quick-add chips only for students not already in today's class list
    const alreadyAdded = new Set(classes.map(c => c.userId));
    const toSuggest    = suggested.filter(s => !alreadyAdded.has(s.id));
    const suggestedHTML = toSuggest.length ? `
      <div class="cal-suggested">
        <span class="cal-suggested-label">Agregar habituales:</span>
        ${toSuggest.map(s => {
          const def = (s.classDefaults||[]).find(d => d.day === dayOfW);
          return `<button class="cal-tag cal-suggest-add"
                    data-uid="${s.id}"
                    data-time="${def?.time||''}"
                    data-rid="${def?.routineId||''}"
                    style="background:${s.color||'var(--bg3)'}22;color:${s.color||'var(--text2)'};border:1px solid ${s.color||'var(--bg3)'}44">
                    ${s.name}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>`;
        }).join('')}
      </div>` : '';

    const classSection = `
      <div class="cal-section">
        <div class="cal-section-head">
          <span class="cal-section-label">Clases</span>
          <button class="cal-section-btn" id="btn-add-class">+ Agregar</button>
        </div>
        ${suggestedHTML}
        ${classItems || `<p class="empty-events" style="padding:8px 0;font-size:.7rem">Sin clases agendadas</p>`}
      </div>`;

    list.innerHTML = mySection + classSection;

    /* ── Event listeners ── */
    if (pedro) {
      document.getElementById('btn-my-training')?.addEventListener('click',
        () => openMyTrainingModal(k, pedro));
      document.getElementById('btn-clear-training')?.addEventListener('click', () => {
        const d = dayData(k); d.myTraining = null;
        saveDay(k, d); render(); renderDayDetail(k);
        App.toast('Entrenamiento removido');
      });
      // View my routine detail
      document.getElementById('btn-view-my-rout')?.addEventListener('click', () => {
        const mt = dayData(k).myTraining;
        if (!mt?.routineId) return;
        const rout = typeof Users !== 'undefined'
          ? Users.getRoutineById(mt.routineId)
          : (pedro.routines || []).find(r => r.id === mt.routineId);
        if (rout) openRoutineView(rout, studentColor(null), null);
      });
    }

    document.getElementById('btn-add-class')?.addEventListener('click',
      () => openClassModal(k));

    list.querySelectorAll('.cl-del').forEach(b => {
      b.addEventListener('click', () => {
        const d = dayData(k);
        d.classes.splice(parseInt(b.dataset.i), 1);
        saveDay(k, d); render(); renderDayDetail(k);
        App.toast('Clase eliminada');
      });
    });
    list.querySelectorAll('.cl-edit').forEach(b => {
      b.addEventListener('click', () => {
        const d = dayData(k);
        openClassModal(k, d.classes[parseInt(b.dataset.i)], parseInt(b.dataset.i));
      });
    });
    // View student routine detail
    list.querySelectorAll('.cl-view').forEach(b => {
      b.addEventListener('click', () => {
        const cl = dayData(k).classes[parseInt(b.dataset.i)];
        if (!cl?.routineId) return;
        const allUsers = getUsers();
        const student  = allUsers.find(u => u.id === cl.userId);
        const rout = typeof Users !== 'undefined'
          ? Users.getRoutineById(cl.routineId)
          : (student?.routines || []).find(r => r.id === cl.routineId);
        if (rout) openRoutineView(rout, studentColor(cl.userId), student?.name || null);
      });
    });

    // Quick-add chips: tap to open class modal pre-filled for that student
    list.querySelectorAll('.cal-suggest-add').forEach(b => {
      b.addEventListener('click', () => {
        openClassModal(k, {
          userId:    b.dataset.uid,
          time:      b.dataset.time || '',
          routineId: b.dataset.rid  || null
        }, null);
      });
    });
  }

  function studentColor(userId) {
    const u = getUsers().find(u => u.id === userId);
    return u?.color || '#5aabcc';
  }

  function closeDetail() {
    selDate = null;
    document.getElementById('day-detail').classList.add('hidden');
    document.getElementById('add-event-btn').classList.remove('hidden');
    render();
  }

  /* ── Modal: Mi entrenamiento ────────────────────────────── */
  function openMyTrainingModal(k, pedro) {
    const routines = pedro.routines || [];
    if (!routines.length) {
      App.toast('Primero creá rutinas en tu perfil'); return;
    }
    const current = dayData(k).myTraining?.routineId;

    App.openModal('Mi entrenamiento', `
      <div class="form-group">
        <label>Elegí la rutina de hoy</label>
        <select id="mt-routine" class="form-select">
          ${routines.map(r =>
            `<option value="${r.id}" ${r.id===current?'selected':''}>${r.name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="modal-footer">
        <button id="mt-cancel" class="btn btn-secondary">Cancelar</button>
        <button id="mt-save"   class="btn btn-primary">Guardar</button>
      </div>
    `);

    document.getElementById('mt-cancel').addEventListener('click', App.closeModal);
    document.getElementById('mt-save').addEventListener('click', () => {
      const routineId   = document.getElementById('mt-routine').value;
      const routine     = routines.find(r => r.id === routineId);
      const d = dayData(k);
      d.myTraining = { routineId, routineName: routine.name };
      saveDay(k, d);
      App.closeModal(); render(); renderDayDetail(k);
      App.toast('Entrenamiento asignado');
    });
  }

  /* ── Modal: Clase ───────────────────────────────────────── */
  function buildRoutineOpts(students, userId, selRoutineId) {
    const u  = students.find(s => s.id === userId);
    const rs = u?.routines || [];
    if (!rs.length) return '<option value="">Sin rutinas creadas</option>';
    return rs.map(r =>
      `<option value="${r.id}" ${r.id===selRoutineId?'selected':''}>${r.name}</option>`
    ).join('');
  }

  function openClassModal(k, ex = null, idx = null) {
    const students = getStudents();
    if (!students.length) { App.toast('No hay alumnos registrados'); return; }

    const dayOfW  = new Date(k + 'T12:00').getDay();
    const firstId = ex?.userId || students[0].id;

    // Pre-fill con horario habitual del alumno si existe
    function getDefault(userId) {
      const u = students.find(s => s.id === userId);
      return (u?.classDefaults || []).find(d => d.day === dayOfW) || null;
    }

    const initDefault = ex ? null : getDefault(firstId);
    const initRoutineId = ex?.routineId || initDefault?.routineId || null;
    const initTime      = ex?.time      || initDefault?.time      || '';

    App.openModal(ex?.id ? 'Editar clase' : 'Nueva clase', `
      <div class="form-group">
        <label>Alumno</label>
        <select id="cl-student" class="form-select">
          ${students.map(s =>
            `<option value="${s.id}" ${s.id===firstId?'selected':''}>${s.name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Rutina</label>
        <select id="cl-routine" class="form-select">
          ${buildRoutineOpts(students, firstId, initRoutineId)}
        </select>
      </div>
      <div class="form-group">
        <label>Horario</label>
        <input id="cl-time" class="form-input" type="time" value="${initTime}" />
      </div>
      <div class="modal-footer">
        <button id="cl-cancel" class="btn btn-secondary">Cancelar</button>
        <button id="cl-save"   class="btn btn-primary">Guardar</button>
      </div>
    `);

    document.getElementById('cl-student').addEventListener('change', e => {
      const def = getDefault(e.target.value);
      document.getElementById('cl-routine').innerHTML =
        buildRoutineOpts(students, e.target.value, def?.routineId || null);
      if (def?.time) document.getElementById('cl-time').value = def.time;
    });

    document.getElementById('cl-cancel').addEventListener('click', App.closeModal);
    document.getElementById('cl-save').addEventListener('click', () => {
      const userId    = document.getElementById('cl-student').value;
      const routineId = document.getElementById('cl-routine').value || null;
      const time      = document.getElementById('cl-time').value;
      const student   = students.find(s => s.id === userId);
      const routine   = routineId ? (student?.routines||[]).find(r => r.id === routineId) : null;

      const cl = {
        id:          ex?.id || uid(),
        userId,
        userName:    student?.name || '',
        routineId:   routineId || null,
        routineName: routine?.name || 'Sin rutina',
        time
      };

      const d = dayData(k);
      if (!d.classes) d.classes = [];
      if (idx !== null) d.classes[idx] = cl; else d.classes.push(cl);
      saveDay(k, d);
      App.closeModal(); render(); renderDayDetail(k);
      App.toast(idx !== null ? 'Clase actualizada' : 'Clase agregada');
    });
  }

  /* ── Routine read-only view (from calendar) ─────────────── */
  function openRoutineView(routine, accentColor, studentName) {
    // Get items, migrating old exercises arrays
    let items = routine.items;
    if (!items) items = (routine.exercises || []).map(e => ({ ...e, type: 'exercise' }));

    const col = routine.color || accentColor || 'var(--accent-d)';

    const itemsHTML = items.length ? items.map((item, idx) => {
      const num = `<div class="cal-routine-item-num">${idx + 1}</div>`;
      if (!item.type || item.type === 'exercise') {
        return num + `
          <div class="exercise-card" style="margin-bottom:8px">
            <div class="exercise-info">
              <div class="exercise-name">${item.name}</div>
              <div class="exercise-sets-label">Series × Reps</div>
              <div class="exercise-sets-reps" style="color:${col}">${item.sets} × ${item.reps}${item.dropset ? ' <span class="dropset-badge">+dropset</span>' : ''}</div>
              ${item.note ? `<div class="exercise-note">${item.note}</div>` : ''}
            </div>
          </div>`;
      } else if (item.type === 'speed-run') {
        return num + `
          <div class="break-card speed-run-card" style="margin-bottom:8px">
            <div class="break-icon speed-run-icon">${BREAK_ICONS['speed-run']}</div>
            <div class="break-info">
              <span class="break-type-label">Pasadas de Velocidad</span>
              <span class="break-duration">${item.series} series &times; ${item.distance} ${item.distUnit}</span>
              <span class="break-note" style="display:block;margin-top:2px">Descanso: ${item.rest} ${item.restUnit}</span>
            </div>
          </div>`;
      } else {
        return num + `
          <div class="break-card" style="margin-bottom:8px">
            <div class="break-icon">${BREAK_ICONS[item.type] || ''}</div>
            <div class="break-info">
              <span class="break-type-label">${BREAK_LABELS[item.type] || item.type}</span>
              <span class="break-duration">${item.duration} ${item.unit === 'min' ? 'min' : 'seg'}</span>
              ${item.note ? `<span class="break-note">${item.note}</span>` : ''}
            </div>
          </div>`;
      }
    }).join('')
    : `<p class="empty-events" style="padding:16px 0;font-size:.75rem">Sin ejercicios cargados</p>`;

    const exN = items.filter(i => !i.type || i.type === 'exercise').length;
    const brN = items.filter(i => i.type && i.type !== 'exercise').length;

    App.openModal(routine.name, `
      ${routine.description
        ? `<p class="cal-routine-desc" style="margin-bottom:14px">${routine.description}</p>`
        : ''}
      <div style="border-left:3px solid ${col};padding-left:10px;margin-bottom:16px">
        <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--text3)">
          ${exN} ejercicio${exN !== 1 ? 's' : ''} · ${brN} pausa${brN !== 1 ? 's' : ''}
        </div>
      </div>
      ${itemsHTML}
      <button id="cal-pdf-btn" class="btn btn-secondary btn-full" style="margin-top:16px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Descargar PDF
      </button>
    `);

    document.getElementById('cal-pdf-btn')?.addEventListener('click', () => {
      if (typeof Users !== 'undefined') Users.downloadRoutinePDF(routine, studentName || null);
    });
  }

  /* ── Navigation ─────────────────────────────────────────── */
  function prev() {
    if (view === 'month') cursor.setMonth(cursor.getMonth() - 1);
    else cursor.setDate(cursor.getDate() - 7);
    closeDetail();
  }
  function next() {
    if (view === 'month') cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 7);
    closeDetail();
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    loadEvents();

    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        view = btn.dataset.view;
        closeDetail();
      });
    });

    document.getElementById('cal-prev').addEventListener('click', prev);
    document.getElementById('cal-next').addEventListener('click', next);
    document.getElementById('day-detail-close').addEventListener('click', closeDetail);

    render();
  }

  /* Public reload — call after writing to fitpro_events_v2 from another module */
  function reload() {
    loadEvents();
    render();
    if (selDate) renderDayDetail(selDate);
  }

  return { init, reload };
})();
