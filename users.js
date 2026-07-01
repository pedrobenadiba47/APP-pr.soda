/* ============================================================
   USERS & ROUTINES MODULE  -  PR.47
============================================================ */

const Users = (() => {

  const KEY = 'fitpro_users';
  let users   = [];
  let curUser = null;
  let curRout = null;

  function load() { users = JSON.parse(localStorage.getItem(KEY) || '[]'); }
  function save() { localStorage.setItem(KEY, JSON.stringify(users)); }
  function uid()  { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

  /* -- One-time cleanup: strip all stored photos from localStorage --
     Photos (base64 strings) were the main cause of freezing:
     large JSON serialization on every save/load.
     This runs once, deletes all photo fields, and saves.        */
  const CLEAN_KEY = 'fitpro_photos_removed_v1';
  function cleanupPhotos() {
    if (localStorage.getItem(CLEAN_KEY)) return;
    let changed = false;
    for (const u of users) {
      if (u.photo) { delete u.photo; changed = true; }
      for (const rout of (u.routines || [])) {
        for (const item of (rout.items || rout.exercises || [])) {
          if (item.photo) { delete item.photo; changed = true; }
        }
      }
    }
    if (changed) save();
    localStorage.setItem(CLEAN_KEY, '1');
  }

  /* ── Export / Import de rutinas (sin fotos) ────────────────────
     Permite respaldar y transferir solo las rutinas (entrenador +
     alumnos) entre instalaciones de la app, sin tocar fotos,
     calendario ni configuración.                                 */
  function stripRoutineItems(routines) {
    return (routines || []).map(r => {
      const clone = JSON.parse(JSON.stringify(r));
      for (const item of (clone.items || clone.exercises || [])) {
        delete item.photo;
      }
      return clone;
    });
  }

  function exportRoutines() {
    const data = {
      exportedAt: new Date().toISOString(),
      users: users.map(u => ({
        name: u.name,
        isTrainer: !!u.isTrainer,
        color: u.color,
        routines: stripRoutineItems(u.routines)
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `pr47-rutinas-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    App.toast('Rutinas exportadas');
  }

  function importRoutinesFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const imported = Array.isArray(data) ? data : (data.users || []);
        let routinesAdded = 0, newUsers = 0;

        for (const iu of imported) {
          if (!iu || !iu.name) continue;
          const importedRoutines = stripRoutineItems(iu.routines);

          let target = users.find(u =>
            u.name.trim().toLowerCase() === iu.name.trim().toLowerCase());

          if (!target) {
            target = {
              id: uid(),
              name: iu.name,
              isTrainer: !!iu.isTrainer,
              color: iu.color || PALETTE[users.length % PALETTE.length],
              routines: []
            };
            users.push(target);
            newUsers++;
          }

          target.routines = target.routines || [];
          const existingIds = new Set(target.routines.map(r => r.id));
          for (const r of importedRoutines) {
            const rout = existingIds.has(r.id) ? { ...r, id: uid() } : r;
            target.routines.push(rout);
            existingIds.add(rout.id);
            routinesAdded++;
          }
        }

        save();
        renderUsers();
        App.toast(`Importadas ${routinesAdded} rutina(s)${newUsers ? ` · ${newUsers} usuario(s) nuevo(s)` : ''}`);
      } catch (e) {
        App.toast('No se pudo leer el archivo');
      }
    };
    reader.readAsText(file);
  }

  function initials(name) {
    return (name||'?').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
  }

  /* â”€â”€ Color palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const PALETTE = [
    '#28D2DB', // celeste eléctrico (default)
    '#5aabcc', // azul cielo
    '#e67e22', // naranja
    '#e74c3c', // rojo
    '#9b59b6', // violeta
    '#2ecc71', // verde esmeralda
    '#f1c40f', // amarillo
    '#1abc9c', // turquesa
    '#e91e63', // rosa
    '#607d8b', // gris azulado
  ];

  /* â”€â”€ SVG icon helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const ic = {
    dumbbell: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="10.5" width="3" height="3" rx=".5"/><rect x="19" y="10.5" width="3" height="3" rx=".5"/><rect x="5" y="8.5" width="2" height="7" rx=".5"/><rect x="17" y="8.5" width="2" height="7" rx=".5"/><line x1="7" y1="12" x2="17" y2="12"/></svg>`,
    clipboard:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,
    person:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20v-2a4 4 0 014-4h8a4 4 0 014 4v2"/></svg>`,
    edit:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    trash:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`,
    chevron:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    back:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>`,
    copy:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
  };

  /* â”€â”€ Seed inicial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const SEED_KEY = 'fitpro_seeded_v1';
  const SEED_USERS = [
    { name: 'Pedro Benadiba', isTrainer: true,  color: '#28D2DB', schedule: []    },
    { name: 'Juan',           isTrainer: false, color: '#5aabcc', schedule: [2]   }, // Mar
    { name: 'Ines',           isTrainer: false, color: '#e91e63', schedule: [2,4] }, // Mar, Jue
    { name: 'Elo',            isTrainer: false, color: '#e67e22', schedule: [1,4] }, // Lun, Jue
    { name: 'Marat',          isTrainer: false, color: '#9b59b6', schedule: [4]   }, // Jue
  ];

  function seedIfNeeded() {
    if (localStorage.getItem(SEED_KEY)) return;
    SEED_USERS.forEach(su => {
      const exists = users.find(u => u.name.toUpperCase() === su.name.toUpperCase());
      if (exists) {
        // Migrar campos faltantes sin perder datos
        if (su.isTrainer) exists.isTrainer = true;
        if (!exists.schedule) exists.schedule = su.schedule;
        if (!exists.color) exists.color = su.color;
      } else {
        users.push({ id: uid(), photo: null, routines: [], ...su });
      }
    });
    save();
    localStorage.setItem(SEED_KEY, '1');
  }

  /* â”€â”€ View control â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function showView(id) {
    ['users-list-view','user-detail-view','routine-detail-view']
      .forEach(v => document.getElementById(v).classList.toggle('hidden', v !== id));
    // FAB only visible on users list view
    document.getElementById('add-user-btn').classList.toggle('hidden', id !== 'users-list-view');
  }

  /* â”€â”€ Color stripe helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function colorStripe(color) {
    if (!color) return '';
    return `<div class="user-card-color-stripe" style="background:${color}"></div>`;
  }

  /* â”€â”€ Users list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function renderUsers() {
    const grid = document.getElementById('users-grid');
    if (!users.length) {
      grid.innerHTML = `<div class="empty-state">
        <div class="empty-icon">${ic.person}</div>
        <p>Sin usuarios.<br><strong>Tocá + para agregar</strong></p>
      </div>`;
      return;
    }

    const pedro   = users.find(u => u.isTrainer);
    const students = users.filter(u => !u.isTrainer);

    function cardHTML(u, isTrainer = false) {
      const color = u.color || (isTrainer ? 'var(--accent-d)' : 'var(--bg3)');
      const meta = u.description || (isTrainer
        ? 'Entrenador personal'
        : (() => {
            const parts = [];
            const rc = (u.routines||[]).length;
            if (rc) parts.push(`${rc} rutina${rc > 1 ? 's' : ''}`);
            const ds = (u.schedule||[]).map(d => DAY_NAMES[d]).join(', ');
            if (ds) parts.push(ds);
            return parts.join(' · ') || 'Sin horario';
          })());
      return `
        <div class="user-card${isTrainer ? ' user-card--trainer' : ''}" data-id="${u.id}"
             ${isTrainer ? '' : `style="border-left-color:${color}"`}>
          <div class="avatar${isTrainer ? ' avatar--lg' : ''}" style="border-color:${color}">
            ${initials(u.name)}
          </div>
          <div class="user-card-info">
            ${isTrainer ? `<div class="trainer-card-label">Mi perfil</div>` : ''}
            <div class="user-card-name">${u.name}</div>
            <div class="user-card-meta">${meta}</div>
          </div>
        </div>`;
    }

    grid.innerHTML = `
      ${pedro ? cardHTML(pedro, true) : ''}
      ${students.length
        ? `<div class="users-section-label">Alumnos</div>${students.map(u => cardHTML(u)).join('')}`
        : ''}
    `;
    grid.querySelectorAll('.user-card').forEach(c =>
      c.addEventListener('click', () => openUser(c.dataset.id))
    );
  }

  /* â”€â”€ Color picker HTML â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function colorPickerHTML(selectedColor) {
    return `
      <div class="form-group color-picker-wrap">
        <label>Color</label>
        <div class="color-options" id="u-color-opts">
          ${PALETTE.map(c => `
            <div class="color-opt${c === (selectedColor || PALETTE[0]) ? ' selected' : ''}"
                 data-color="${c}"
                 style="background:${c}"
                 title="${c}"></div>
          `).join('')}
        </div>
      </div>`;
  }

  /* â”€â”€ User modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function openUserModal(ex = null) {
    const currentColor = ex?.color || PALETTE[0];
    App.openModal(ex ? 'Editar usuario' : 'Nuevo usuario', `
      <div class="form-group">
        <label>Nombre completo</label>
        <input id="u-name" class="form-input" placeholder="Nombre" value="${ex?.name||''}" />
      </div>
      <div class="form-group">
        <label>Descripción <span style="font-size:.65em;color:var(--text3);font-weight:400">(aparece debajo del nombre)</span></label>
        <input id="u-desc" class="form-input" placeholder="Ej: Entrenador personal" value="${ex?.description||''}" />
      </div>
      ${colorPickerHTML(currentColor)}
      <div class="modal-footer">
        <button id="u-cancel" class="btn btn-secondary">Cancelar</button>
        <button id="u-save"   class="btn btn-primary">Guardar</button>
      </div>
    `);

    let selectedColor = currentColor;

    document.getElementById('u-color-opts').addEventListener('click', e => {
      const opt = e.target.closest('.color-opt');
      if (!opt) return;
      document.querySelectorAll('#u-color-opts .color-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedColor = opt.dataset.color;
    });

    document.getElementById('u-cancel').addEventListener('click', App.closeModal);
    document.getElementById('u-save').addEventListener('click', () => {
      const name = document.getElementById('u-name').value.trim();
      const desc = document.getElementById('u-desc').value.trim();
      if (!name) { App.toast('Ingresá un nombre'); return; }
      if (ex) { ex.name = name; ex.description = desc; ex.color = selectedColor; }
      else users.push({ id: uid(), name, description: desc, color: selectedColor, routines: [], isTrainer: false });
      save(); App.closeModal(); renderUsers();
      App.toast(ex ? 'Usuario actualizado' : 'Usuario creado');
      if (ex && curUser?.id === ex.id) {
        document.getElementById('user-detail-name').textContent = ex.name;
        document.getElementById('user-avatar-large').textContent = initials(ex.name);
      }
    });
  }

  /* â”€â”€ User detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  function openUser(id) {
    curUser = users.find(u => u.id === id);
    if (!curUser) return;
    const av = document.getElementById('user-avatar-large');
    av.textContent = initials(curUser.name);
    document.getElementById('user-detail-name').textContent = curUser.name;
    renderRoutines();
    if (!curUser.isTrainer) renderScheduleDefaults();
    showView('user-detail-view');
    App.setTitle(curUser.name);
  }

  /* â”€â”€ Horarios habituales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function renderScheduleDefaults() {
    // Inject schedule section after routines-list if not present
    let section = document.getElementById('schedule-section');
    if (!section) {
      section = document.createElement('div');
      section.id = 'schedule-section';
      section.className = 'schedule-section';
      document.getElementById('routines-list').insertAdjacentElement('afterend', section);
    }

    const defaults = curUser.classDefaults || [];
    const days     = curUser.schedule      || [];

    section.innerHTML = `
      <div class="schedule-header">
        <h3>Horarios habituales</h3>
        <button id="add-schedule-btn" class="btn btn-primary btn-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Agregar
        </button>
      </div>
      ${defaults.length
        ? defaults.map((d, i) => `
          <div class="schedule-item">
            <div class="schedule-day-badge">${DAY_NAMES[d.day]}</div>
            <div class="schedule-info">
              <div class="schedule-routine">${d.routineName || 'Sin rutina'}</div>
              <div class="schedule-time">${d.time || 'Sin horario'}</div>
            </div>
            <div class="schedule-actions">
              <button class="icon-btn sch-edit" data-i="${i}">${ic.edit}</button>
              <button class="icon-btn sch-del"  data-i="${i}">${ic.trash}</button>
            </div>
          </div>`).join('')
        : `<p class="empty-events" style="padding:10px 0 4px;font-size:.7rem">Sin horarios configurados</p>`
      }`;

    document.getElementById('add-schedule-btn').addEventListener('click',
      () => openScheduleModal());

    section.querySelectorAll('.sch-edit').forEach(b =>
      b.addEventListener('click', () =>
        openScheduleModal(curUser.classDefaults[parseInt(b.dataset.i)], parseInt(b.dataset.i)))
    );
    section.querySelectorAll('.sch-del').forEach(b =>
      b.addEventListener('click', () => {
        curUser.classDefaults.splice(parseInt(b.dataset.i), 1);
        save(); renderScheduleDefaults();
        App.toast('Horario eliminado');
      })
    );
  }

  function openScheduleModal(ex = null, idx = null) {
    const routines = curUser.routines || [];
    const days     = curUser.schedule || [];
    const allDays  = [0,1,2,3,4,5,6];

    App.openModal(ex ? 'Editar horario' : 'Nuevo horario', `
      <div class="form-group">
        <label>Día</label>
        <select id="sch-day" class="form-select">
          ${allDays.map(d =>
            `<option value="${d}" ${ex?.day===d?'selected':''}>${DAY_NAMES[d]}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Rutina</label>
        <select id="sch-routine" class="form-select">
          <option value="">Sin rutina</option>
          ${routines.map(r =>
            `<option value="${r.id}" ${ex?.routineId===r.id?'selected':''}>${r.name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Horario</label>
        <input id="sch-time" class="form-input" type="time" value="${ex?.time||''}" />
      </div>
      <div class="modal-footer">
        <button id="sch-cancel" class="btn btn-secondary">Cancelar</button>
        <button id="sch-save"   class="btn btn-primary">Guardar</button>
      </div>
    `);

    document.getElementById('sch-cancel').addEventListener('click', App.closeModal);
    document.getElementById('sch-save').addEventListener('click', () => {
      const day       = parseInt(document.getElementById('sch-day').value);
      const routineId = document.getElementById('sch-routine').value || null;
      const time      = document.getElementById('sch-time').value;
      const routine   = routineId ? routines.find(r => r.id === routineId) : null;

      const entry = {
        day,
        routineId:   routineId || null,
        routineName: routine?.name || '',
        time
      };

      if (!curUser.classDefaults) curUser.classDefaults = [];
      if (idx !== null) curUser.classDefaults[idx] = entry;
      else curUser.classDefaults.push(entry);

      // También actualizar schedule (días de la semana del alumno)
      if (!curUser.schedule) curUser.schedule = [];
      if (!curUser.schedule.includes(day)) {
        curUser.schedule.push(day);
        curUser.schedule.sort();
      }

      save(); App.closeModal(); renderScheduleDefaults();
      App.toast(idx !== null ? 'Horario actualizado' : 'Horario agregado');
    });
  }

  function deleteUserModal() {
    App.openModal('Eliminar usuario', `
      <p style="color:var(--text2);margin-bottom:20px;line-height:1.6;font-size:.9rem">
        ¿Eliminar a <strong>${curUser.name}</strong> y todas sus rutinas?
      </p>
      <div class="modal-footer">
        <button id="du-no"  class="btn btn-secondary">Cancelar</button>
        <button id="du-yes" class="btn btn-danger">Eliminar</button>
      </div>
    `);
    document.getElementById('du-no').addEventListener('click', App.closeModal);
    document.getElementById('du-yes').addEventListener('click', () => {
      users = users.filter(u => u.id !== curUser.id);
      curUser = null; save(); App.closeModal();
      showView('users-list-view'); renderUsers();
      App.setTitle('Usuarios'); App.toast('Usuario eliminado');
    });
  }

  /* â”€â”€ Routines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function renderRoutines() {
    const list = document.getElementById('routines-list');
    const rs   = curUser.routines || [];
    if (!rs.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">${ic.clipboard}</div>
        <p>Sin rutinas.<br><strong>Tocá + Nueva para crear</strong></p>
      </div>`;
      return;
    }
    list.innerHTML = rs.map(r => {
      const col = r.color || 'var(--bg3)';
      const exCount = (r.exercises||[]).length;
      return `
      <div class="routine-card" data-id="${r.id}" style="border-left-color:${col}">
        <div class="routine-icon" style="background:${col}20;color:${col}">${ic.dumbbell}</div>
        <div class="routine-info">
          <div class="routine-name">${r.name}</div>
          <div class="routine-count">${r.description ? r.description + ' · ' : ''}${exCount} ejercicio${exCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="rout-actions">
          <button class="icon-btn rout-copy" data-id="${r.id}" title="Duplicar">${ic.copy}</button>
          <button class="icon-btn rout-edit" data-id="${r.id}" title="Editar">${ic.edit}</button>
          <button class="icon-btn rout-del"  data-id="${r.id}" title="Eliminar">${ic.trash}</button>
        </div>
        <div class="routine-arrow">${ic.chevron}</div>
      </div>`;
    }).join('');

    list.querySelectorAll('.routine-card').forEach(c => {
      c.addEventListener('click', e => {
        if (e.target.closest('.rout-copy,.rout-edit,.rout-del')) return;
        openRoutine(c.dataset.id);
      });
    });
    list.querySelectorAll('.rout-copy').forEach(b =>
      b.addEventListener('click', e => { e.stopPropagation(); duplicateRoutine(rs.find(r=>r.id===b.dataset.id)); })
    );
    list.querySelectorAll('.rout-edit').forEach(b =>
      b.addEventListener('click', e => { e.stopPropagation(); openRoutineModal(rs.find(r=>r.id===b.dataset.id)); })
    );
    list.querySelectorAll('.rout-del').forEach(b =>
      b.addEventListener('click', e => {
        e.stopPropagation();
        curUser.routines = curUser.routines.filter(r => r.id !== b.dataset.id);
        save(); renderRoutines(); App.toast('Rutina eliminada');
      })
    );
  }

  const ROUT_PALETTE = [
    '#28D2DB','#5aabcc','#e67e22','#e74c3c',
    '#9b59b6','#2ecc71','#f1c40f','#1abc9c','#e91e63','#607d8b',
  ];

  function routColorPickerHTML(selected) {
    const col = selected || ROUT_PALETTE[0];
    return `
      <div class="form-group color-picker-wrap">
        <label>Color</label>
        <div class="color-options" id="r-color-opts">
          ${ROUT_PALETTE.map(c => `
            <div class="color-opt${c === col ? ' selected' : ''}"
                 data-color="${c}" style="background:${c}"></div>
          `).join('')}
        </div>
      </div>`;
  }

  /* â”€â”€ Duplicate routine (same user) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function duplicateRoutine(rout) {
    if (!rout) return;
    const copy      = JSON.parse(JSON.stringify(rout));
    copy.id         = uid();
    copy.name       = rout.name + ' (copia)';
    // Regenerate item IDs so they're unique
    (copy.items     || []).forEach(item => { item.id = uid(); });
    (copy.exercises || []).forEach(ex   => { ex.id   = uid(); });
    if (!curUser.routines) curUser.routines = [];
    curUser.routines.push(copy);
    save(); renderRoutines();
    App.toast(`"${rout.name}" duplicada`);
  }

  /* â”€â”€ Copy routine from any user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function openCopyFromModal() {
    // Gather all routines across all users
    const groups = users
      .filter(u => (u.routines || []).length > 0)
      .map(u => ({ user: u, routines: u.routines }));

    if (!groups.length) { App.toast('No hay rutinas para copiar'); return; }

    App.openModal('Copiar rutina de...', `
      <p style="font-size:.8rem;color:var(--text3);margin-bottom:16px;line-height:1.5">
        Elegí una rutina base. Se copiará a <strong>${curUser.name}</strong> y podrás modificarla libremente.
      </p>
      ${groups.map(({ user: u, routines }) => `
        <div class="copy-user-group">
          <div class="copy-user-label">
            ${u.name}${u.id === curUser.id ? ' · este usuario' : ''}
          </div>
          ${routines.map(r => {
            const col   = r.color || 'var(--bg3)';
            const items = r.items || r.exercises || [];
            const exN   = items.filter(i => !i.type || i.type === 'exercise').length;
            const brN   = items.filter(i => i.type && i.type !== 'exercise').length;
            const meta  = [
              r.description,
              exN ? `${exN} ejercicio${exN !== 1 ? 's' : ''}` : '',
              brN ? `${brN} pausa${brN !== 1 ? 's' : ''}` : '',
            ].filter(Boolean).join(' · ');
            return `
              <div class="copy-rout-item" data-user-id="${u.id}" data-rout-id="${r.id}"
                   style="border-left-color:${col}">
                <div class="copy-rout-name">${r.name}</div>
                ${meta ? `<div class="copy-rout-meta">${meta}</div>` : ''}
              </div>`;
          }).join('')}
        </div>`).join('')}
      <div class="modal-footer">
        <button id="cfrom-cancel" class="btn btn-secondary">Cancelar</button>
      </div>
    `);

    document.getElementById('cfrom-cancel').addEventListener('click', App.closeModal);

    document.querySelectorAll('.copy-rout-item').forEach(el => {
      el.addEventListener('click', () => {
        const srcUser = users.find(u => u.id === el.dataset.userId);
        const srcRout = (srcUser?.routines || []).find(r => r.id === el.dataset.routId);
        if (!srcRout) return;

        const copy      = JSON.parse(JSON.stringify(srcRout));
        copy.id         = uid();
        copy.name       = srcRout.name + ' (copia)';
        (copy.items     || []).forEach(item => { item.id = uid(); });
        (copy.exercises || []).forEach(ex   => { ex.id   = uid(); });

        if (!curUser.routines) curUser.routines = [];
        curUser.routines.push(copy);
        save(); App.closeModal(); renderRoutines();
        App.toast(`"${srcRout.name}" copiada de ${srcUser.name}`);
      });
    });
  }

  function openRoutineModal(ex = null) {
    App.openModal(ex ? 'Editar rutina' : 'Nueva rutina', `
      <div class="form-group">
        <label>Nombre de la rutina</label>
        <input id="r-name" class="form-input" placeholder="Ej: Tren superior" value="${ex?.name||''}" />
      </div>
      <div class="form-group">
        <label>Descripción <span style="font-size:.65em;color:var(--text3);font-weight:400">(opcional)</span></label>
        <input id="r-desc" class="form-input" placeholder="Ej: Fuerza + hipertrofia" value="${ex?.description||''}" />
      </div>
      ${routColorPickerHTML(ex?.color)}
      <div class="modal-footer">
        <button id="r-cancel" class="btn btn-secondary">Cancelar</button>
        <button id="r-save"   class="btn btn-primary">Guardar</button>
      </div>
    `);

    let selectedColor = ex?.color || ROUT_PALETTE[0];
    document.getElementById('r-color-opts').addEventListener('click', e => {
      const opt = e.target.closest('.color-opt');
      if (!opt) return;
      document.querySelectorAll('#r-color-opts .color-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedColor = opt.dataset.color;
    });

    document.getElementById('r-cancel').addEventListener('click', App.closeModal);
    document.getElementById('r-save').addEventListener('click', () => {
      const name = document.getElementById('r-name').value.trim();
      const desc = document.getElementById('r-desc').value.trim();
      if (!name) { App.toast('Ingresá un nombre'); return; }
      if (ex) { ex.name = name; ex.description = desc; ex.color = selectedColor; }
      else {
        if (!curUser.routines) curUser.routines = [];
        curUser.routines.push({ id: uid(), name, description: desc, color: selectedColor, exercises: [] });
      }
      save(); App.closeModal(); renderRoutines();
      App.toast(ex ? 'Rutina actualizada' : 'Rutina creada');
    });
  }

  /* â”€â”€ Routine detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function openRoutine(id) {
    curRout = curUser.routines.find(r => r.id === id);
    if (!curRout) return;

    // Name
    document.getElementById('routine-detail-name').textContent = curRout.name;

    // Color accent on header bar
    const headerBar = document.querySelector('.routine-header-bar');
    if (headerBar) headerBar.style.borderLeft = curRout.color
      ? `4px solid ${curRout.color}` : '';

    // Description chip below the header bar
    let descEl = document.getElementById('routine-desc-chip');
    if (!descEl) {
      descEl = document.createElement('p');
      descEl.id = 'routine-desc-chip';
      descEl.style.cssText = 'font-size:.72rem;color:var(--text3);margin:-8px 0 14px;letter-spacing:.3px;';
      headerBar?.insertAdjacentElement('afterend', descEl);
    }
    descEl.textContent = curRout.description || '';
    descEl.style.display = curRout.description ? '' : 'none';

    // Show assign-to-calendar button only for the trainer (Pedro)
    const assignBtn = document.getElementById('assign-to-cal-btn');
    if (assignBtn) assignBtn.classList.toggle('hidden', !curUser.isTrainer);

    renderItems();
    showView('routine-detail-view');
    App.setTitle(curRout.name);
  }

  /* â”€â”€ Item model (exercises + breaks in order) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const BREAK_LABELS = {
    rest:           'Descanso',
    warmup:         'Entrada en calor',
    'active-pause': 'Pausa activa',
    'speed-run':    'Pasadas de Velocidad',
  };
  const BREAK_ICONS = {
    rest:           `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>`,
    warmup:         `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2c0 6-6 8-6 14a6 6 0 0012 0c0-6-6-8-6-14z"/></svg>`,
    'active-pause': `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    'speed-run':    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  };

  // Returns the unified items array, migrating old `exercises` arrays on the fly
  function getItems(rout) {
    if (!rout) return [];
    if (!rout.items) {
      rout.items = (rout.exercises || []).map(e => ({ ...e, type: 'exercise' }));
      save(); // persist migration
    }
    return rout.items;
  }

  /* â”€â”€ Drag handle SVG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const DRAG_HANDLE = `<div class="drag-handle" data-drag-handle>
    <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor">
      <circle cx="3" cy="3"  r="1.6"/><circle cx="9" cy="3"  r="1.6"/>
      <circle cx="3" cy="9"  r="1.6"/><circle cx="9" cy="9"  r="1.6"/>
      <circle cx="3" cy="15" r="1.6"/><circle cx="9" cy="15" r="1.6"/>
    </svg>
  </div>`;

  /* â”€â”€ Exercises / breaks render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function renderItems() {
    const list  = document.getElementById('exercises-list');
    const items = getItems(curRout);
    if (!items.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">${ic.dumbbell}</div>
        <p>Sin ejercicios.<br><strong>Tocá los botones de abajo para agregar</strong></p>
      </div>`;
      return;
    }

    list.innerHTML = items.map((item, i) => {
      if (!item.type || item.type === 'exercise') {
        return `
          <div class="exercise-card" data-item-idx="${i}">
            ${DRAG_HANDLE}
            <div class="exercise-info">
              <div class="exercise-name">${item.name}</div>
              <div class="exercise-sets-label">Series &times; Reps</div>
              <div class="exercise-sets-reps">${item.sets} &times; ${item.reps}${item.dropset ? ' <span class="dropset-badge">+dropset</span>' : ''}</div>
              ${item.note ? `<div class="exercise-note">${item.note}</div>` : ''}
            </div>
            <div class="exercise-actions">
              <button class="icon-btn item-copy" data-i="${i}" title="Duplicar">${ic.copy}</button>
              <button class="icon-btn item-edit" data-i="${i}" title="Editar">${ic.edit}</button>
              <button class="icon-btn item-del"  data-i="${i}" title="Eliminar">${ic.trash}</button>
            </div>
          </div>`;
      } else if (item.type === 'speed-run') {
        return `
          <div class="break-card speed-run-card" data-item-idx="${i}">
            ${DRAG_HANDLE}
            <div class="break-icon speed-run-icon">${BREAK_ICONS['speed-run']}</div>
            <div class="break-info">
              <span class="break-type-label">Pasadas de Velocidad</span>
              <span class="break-duration">${item.series} series &times; ${item.distance} ${item.distUnit}</span>
              <span class="break-note" style="display:block;margin-top:2px">Descanso: ${item.rest} ${item.restUnit}</span>
            </div>
            <div class="exercise-actions" style="flex-shrink:0">
              <button class="icon-btn item-copy"       data-i="${i}" title="Duplicar">${ic.copy}</button>
              <button class="icon-btn item-edit-speed" data-i="${i}" title="Editar">${ic.edit}</button>
              <button class="icon-btn item-del"        data-i="${i}" title="Eliminar">${ic.trash}</button>
            </div>
          </div>`;
      } else {
        return `
          <div class="break-card" data-item-idx="${i}">
            ${DRAG_HANDLE}
            <div class="break-icon">${BREAK_ICONS[item.type] || ''}</div>
            <div class="break-info">
              <span class="break-type-label">${BREAK_LABELS[item.type] || item.type}</span>
              <span class="break-duration">${item.duration} ${item.unit === 'min' ? 'min' : 'seg'}</span>
              ${item.note ? `<span class="break-note">${item.note}</span>` : ''}
            </div>
            <button class="icon-btn item-del" data-i="${i}" style="margin-left:auto">${ic.trash}</button>
          </div>`;
      }
    }).join('');

    list.querySelectorAll('.item-copy').forEach(b =>
      b.addEventListener('click', () => {
        const items = getItems(curRout);
        const orig  = items[parseInt(b.dataset.i)];
        if (!orig) return;
        const copy  = JSON.parse(JSON.stringify(orig));
        copy.id     = uid();
        items.splice(parseInt(b.dataset.i) + 1, 0, copy);
        save(); renderItems(); App.toast('Duplicado');
      })
    );
    list.querySelectorAll('.item-del').forEach(b =>
      b.addEventListener('click', () => {
        getItems(curRout).splice(parseInt(b.dataset.i), 1);
        save(); renderItems(); App.toast('Eliminado');
      })
    );
    list.querySelectorAll('.item-edit').forEach(b =>
      b.addEventListener('click', () =>
        openExerciseModal(getItems(curRout)[parseInt(b.dataset.i)], parseInt(b.dataset.i))
      )
    );
    list.querySelectorAll('.item-edit-speed').forEach(b =>
      b.addEventListener('click', () =>
        openSpeedRunModal(getItems(curRout)[parseInt(b.dataset.i)], parseInt(b.dataset.i))
      )
    );

    initDragSort();
  }

  /* â”€â”€ Drag-to-reorder (touch) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  // IMPORTANT: listeners are attached to each handle element individually,
  // NOT to the list container. The container (listEl) persists across renders
  // while handles are recreated, so attaching to the container would
  // accumulate { passive:false } listeners and freeze the whole app.
  function initDragSort() {
    const listEl = document.getElementById('exercises-list');
    if (!listEl || getItems(curRout).length < 2) return;

    let dragIdx   = -1;
    let ghost     = null;
    let originTop = 0;
    let startY    = 0;
    let lastY     = 0;

    function cards() { return [...listEl.querySelectorAll('[data-item-idx]')]; }

    // Returns insertion index in the post-removal array
    function insertPos(clientY) {
      let pos = 0;
      for (const c of cards()) {
        if (parseInt(c.dataset.itemIdx) === dragIdx) continue;
        const mid = c.getBoundingClientRect().top + c.offsetHeight / 2;
        if (clientY < mid) return pos;
        pos++;
      }
      return pos;
    }

    function clearIndicators() {
      cards().forEach(c => c.classList.remove('drop-above', 'drop-below'));
    }

    function showIndicator(pos) {
      clearIndicators();
      let p = 0;
      for (const c of cards()) {
        if (parseInt(c.dataset.itemIdx) === dragIdx) continue;
        if (p === pos) { c.classList.add('drop-above'); return; }
        p++;
      }
      const rest = cards().filter(c => parseInt(c.dataset.itemIdx) !== dragIdx);
      if (rest.length) rest[rest.length - 1].classList.add('drop-below');
    }

    function onMove(e) {
      if (dragIdx < 0 || !ghost) return;
      e.preventDefault();
      lastY = e.touches[0].clientY;
      ghost.style.top = (originTop + lastY - startY) + 'px';
      showIndicator(insertPos(lastY));
    }

    function onEnd() {
      document.removeEventListener('touchmove',   onMove);
      document.removeEventListener('touchend',    onEnd);
      document.removeEventListener('touchcancel', onEnd);
      ghost?.remove(); ghost = null;
      clearIndicators();
      if (dragIdx < 0) return;

      const iPos    = insertPos(lastY);
      const fromIdx = dragIdx;
      dragIdx = -1;

      const arr = getItems(curRout);
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(iPos, 0, moved);
      save();

      const content = document.getElementById('app-content');
      const st = content?.scrollTop || 0;
      renderItems();
      if (content) content.scrollTop = st;
    }

    // Attach touchstart only to the handle elements - they are recreated
    // on each renderItems() call so there is no listener accumulation.
    listEl.querySelectorAll('[data-drag-handle]').forEach(handle => {
      handle.addEventListener('touchstart', e => {
        e.preventDefault(); // prevent scroll when touching the handle
        const card = handle.closest('[data-item-idx]');
        if (!card) return;

        dragIdx   = parseInt(card.dataset.itemIdx);
        startY    = e.touches[0].clientY;
        lastY     = startY;
        const rect = card.getBoundingClientRect();
        originTop  = rect.top;

        ghost = card.cloneNode(true);
        Object.assign(ghost.style, {
          position: 'fixed', left: rect.left + 'px', top: rect.top + 'px',
          width: rect.width + 'px', margin: '0', zIndex: '999',
          opacity: '0.95', boxShadow: '0 10px 36px rgba(0,0,0,.25)',
          transform: 'scale(1.02)', pointerEvents: 'none',
          borderRadius: getComputedStyle(card).borderRadius,
        });
        document.body.appendChild(ghost);
        card.classList.add('item-dragging');

        // These ARE added to document but only during an active drag,
        // and are always removed in onEnd / onEnd-via-cancel.
        document.addEventListener('touchmove',   onMove, { passive: false });
        document.addEventListener('touchend',    onEnd);
        document.addEventListener('touchcancel', onEnd);
      }, { passive: false });
    });
  }

  /* â”€â”€ Exercise library (quick-add) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const EXERCISE_LIBRARY = [
    // Piernas
    { cat:'piernas', name:'Sentadilla con barra',        sets:4, reps:8,  note:'' },
    { cat:'piernas', name:'Sentadilla frontal',          sets:4, reps:8,  note:'' },
    { cat:'piernas', name:'Sentadilla goblet',           sets:3, reps:12, note:'' },
    { cat:'piernas', name:'Prensa de piernas',           sets:4, reps:10, note:'' },
    { cat:'piernas', name:'Extensión de cuádriceps',     sets:3, reps:12, note:'' },
    { cat:'piernas', name:'Curl femoral acostado',       sets:3, reps:12, note:'' },
    { cat:'piernas', name:'Peso muerto rumano',          sets:4, reps:8,  note:'' },
    { cat:'piernas', name:'Zancadas caminando',          sets:3, reps:10, note:'Por pierna' },
    { cat:'piernas', name:'Zancadas con mancuernas',     sets:3, reps:10, note:'Por pierna' },
    { cat:'piernas', name:'Elevación de gemelos',        sets:4, reps:15, note:'' },
    { cat:'piernas', name:'Hack squat',                  sets:4, reps:10, note:'' },
    // Glúteos
    { cat:'gluteos', name:'Hip thrust con barra',        sets:4, reps:10, note:'' },
    { cat:'gluteos', name:'Sentadilla sumo',             sets:4, reps:10, note:'' },
    { cat:'gluteos', name:'Patada de glúteo en polea',   sets:3, reps:15, note:'Por pierna' },
    { cat:'gluteos', name:'Puente de glúteo',            sets:3, reps:15, note:'' },
    { cat:'gluteos', name:'Abducción en máquina',        sets:3, reps:15, note:'' },
    { cat:'gluteos', name:'Buenos días',                 sets:3, reps:12, note:'' },
    // Pecho
    { cat:'pecho',   name:'Press de banca plano',        sets:4, reps:8,  note:'' },
    { cat:'pecho',   name:'Press inclinado con barra',   sets:4, reps:8,  note:'' },
    { cat:'pecho',   name:'Press inclinado mancuernas',  sets:4, reps:10, note:'' },
    { cat:'pecho',   name:'Aperturas con mancuernas',    sets:3, reps:12, note:'' },
    { cat:'pecho',   name:'Aperturas en polea',          sets:3, reps:12, note:'' },
    { cat:'pecho',   name:'Fondos en paralelas',         sets:3, reps:10, note:'' },
    { cat:'pecho',   name:'Pullover con mancuerna',      sets:3, reps:12, note:'' },
    // Espalda
    { cat:'espalda', name:'Dominadas',                   sets:4, reps:6,  note:'' },
    { cat:'espalda', name:'Jalón al pecho agarre ancho', sets:4, reps:10, note:'' },
    { cat:'espalda', name:'Jalón agarre cerrado',        sets:4, reps:10, note:'' },
    { cat:'espalda', name:'Remo con barra',              sets:4, reps:8,  note:'' },
    { cat:'espalda', name:'Remo con mancuerna',          sets:3, reps:10, note:'Por brazo' },
    { cat:'espalda', name:'Remo en polea baja',          sets:3, reps:12, note:'' },
    { cat:'espalda', name:'Peso muerto convencional',    sets:4, reps:5,  note:'' },
    { cat:'espalda', name:'Hiperextensiones',            sets:3, reps:15, note:'' },
    // Hombros
    { cat:'hombros', name:'Press militar con barra',     sets:4, reps:8,  note:'' },
    { cat:'hombros', name:'Press Arnold',                sets:3, reps:10, note:'' },
    { cat:'hombros', name:'Press con mancuernas',        sets:4, reps:10, note:'' },
    { cat:'hombros', name:'Elevaciones laterales',       sets:4, reps:12, note:'' },
    { cat:'hombros', name:'Elevaciones frontales',       sets:3, reps:12, note:'' },
    { cat:'hombros', name:'Vuelos posteriores',          sets:3, reps:15, note:'' },
    { cat:'hombros', name:'Face pull',                   sets:3, reps:15, note:'' },
    // Bíceps
    { cat:'bicep',   name:'Curl con barra',              sets:4, reps:10, note:'' },
    { cat:'bicep',   name:'Curl con mancuernas',         sets:3, reps:12, note:'' },
    { cat:'bicep',   name:'Curl martillo',               sets:3, reps:12, note:'' },
    { cat:'bicep',   name:'Curl en polea baja',          sets:3, reps:15, note:'' },
    { cat:'bicep',   name:'Curl concentrado',            sets:3, reps:12, note:'Por brazo' },
    { cat:'bicep',   name:'Curl predicador',             sets:3, reps:10, note:'' },
    // Tríceps
    { cat:'tricep',  name:'Press francés',               sets:4, reps:10, note:'' },
    { cat:'tricep',  name:'Extensión en polea alta',     sets:4, reps:12, note:'' },
    { cat:'tricep',  name:'Patada de tríceps',           sets:3, reps:12, note:'Por brazo' },
    { cat:'tricep',  name:'Dips en banco',               sets:3, reps:12, note:'' },
    { cat:'tricep',  name:'Press cerrado',               sets:4, reps:8,  note:'' },
    { cat:'tricep',  name:'Extensión por encima cabeza', sets:3, reps:12, note:'' },
    // Core
    { cat:'core',    name:'Plancha',                     sets:3, reps:30, note:'Segundos' },
    { cat:'core',    name:'Crunch abdominal',            sets:3, reps:15, note:'' },
    { cat:'core',    name:'Elevaciones de piernas',      sets:3, reps:15, note:'' },
    { cat:'core',    name:'Russian twist',               sets:3, reps:20, note:'' },
    { cat:'core',    name:'Rueda abdominal',             sets:3, reps:10, note:'' },
    { cat:'core',    name:'Crunches en polea',           sets:3, reps:15, note:'' },
    { cat:'core',    name:'Montañista',                  sets:3, reps:20, note:'Por pierna' },
  ];
  const LIB_CATS = {
    piernas:'Piernas', gluteos:'Glúteos', pecho:'Pecho', espalda:'Espalda',
    hombros:'Hombros', bicep:'Bíceps',    tricep:'Tríceps', core:'Core',
  };

  function openQuickAddModal() {
    let activeCat = 'all';
    let searchQ   = '';
    let added     = 0;

    function getFiltered() {
      return EXERCISE_LIBRARY.filter(ex =>
        (activeCat === 'all' || ex.cat === activeCat) &&
        (!searchQ || ex.name.toLowerCase().includes(searchQ.toLowerCase()))
      );
    }

    function buildList() {
      const list = getFiltered();
      if (!list.length) return `<div class="qlib-empty">Sin resultados para "${searchQ}"</div>`;
      return list.map((ex, _i) => {
        const idx = EXERCISE_LIBRARY.indexOf(ex);
        return `
          <div class="qlib-item">
            <div class="qlib-info">
              <div class="qlib-name">${ex.name}</div>
              <div class="qlib-meta">${ex.sets} series &times; ${ex.reps} reps${ex.note ? ' · ' + ex.note : ''}</div>
            </div>
            <button class="qlib-add-btn" data-idx="${idx}" aria-label="Agregar ${ex.name}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>`;
      }).join('');
    }

    function buildCats() {
      return [['all','Todos'], ...Object.entries(LIB_CATS)].map(([k,v]) =>
        `<button class="qlib-cat${activeCat===k?' active':''}" data-cat="${k}">${v}</button>`
      ).join('');
    }

    function renderAll() {
      const mb = document.getElementById('modal-body');
      if (!mb) return;
      mb.innerHTML = `
        <div class="qlib-top">
          <input id="qlib-search" class="form-input" placeholder="Buscar ejercicio..." value="${searchQ.replace(/"/g,'&quot;')}" />
          <div id="qlib-cats" class="qlib-cats">${buildCats()}</div>
        </div>
        <div id="qlib-list" class="qlib-list">${buildList()}</div>
        <div class="modal-footer" style="margin-top:12px">
          <button id="qlib-manual" class="btn btn-secondary">Manual</button>
          <button id="qlib-done"   class="btn btn-primary">Listo${added > 0 ? ' (' + added + ')' : ''}</button>
        </div>`;
      bindAll();
    }

    function bindAll() {
      const searchEl = document.getElementById('qlib-search');
      if (searchEl) {
        searchEl.addEventListener('input', () => { searchQ = searchEl.value; renderList(); });
        // Focus search after render (small delay for iOS)
        setTimeout(() => searchEl.focus(), 80);
      }
      document.getElementById('qlib-cats').addEventListener('click', e => {
        const b = e.target.closest('.qlib-cat');
        if (!b) return;
        activeCat = b.dataset.cat;
        renderCatsAndList();
      });
      bindListEvents();
      document.getElementById('qlib-done').addEventListener('click', () => {
        App.closeModal(); renderItems();
      });
      document.getElementById('qlib-manual').addEventListener('click', () => {
        App.closeModal(); openExerciseModal();
      });
    }

    function renderList() {
      const el = document.getElementById('qlib-list');
      if (el) { el.innerHTML = buildList(); bindListEvents(); }
    }

    function renderCatsAndList() {
      const catsEl = document.getElementById('qlib-cats');
      if (catsEl) catsEl.innerHTML = buildCats();
      // NOTE: no re-binding here — the listener lives on the persistent
      // catsEl element, already added once in bindAll(). Adding it again
      // on every call would accumulate { passive:false }-style handlers
      // and cause exponential slowdown / freeze.
      renderList();
    }

    function bindListEvents() {
      document.querySelectorAll('.qlib-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const ex = EXERCISE_LIBRARY[parseInt(btn.dataset.idx)];
          if (!ex) return;
          getItems(curRout).push({
            id: uid(), type: 'exercise',
            name: ex.name, sets: ex.sets, reps: ex.reps,
            note: ex.note || '', dropset: false,
          });
          save();
          added++;
          // Flash the button green
          btn.classList.add('qlib-added');
          btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
          setTimeout(() => {
            btn.classList.remove('qlib-added');
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
          }, 700);
          // Update Listo button
          const done = document.getElementById('qlib-done');
          if (done) done.textContent = `Listo (${added})`;
        });
      });
    }

    App.openModal('Agregar ejercicio', '');
    renderAll();
  }

  /* â”€â”€ PDF export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  // Logo PR.47 (PNG, embedded as data URI so it works in the standalone print document too)
  const PDF_LOGO_SVG = `<img alt="PR.47" style="width:140px;height:auto;flex-shrink:0" src="data:image/png;base64,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" />`;

  function downloadRoutinePDF(rout, studentName) {
    const items = (() => {
      let it = rout.items;
      if (!it) it = (rout.exercises || []).map(e => ({ ...e, type: 'exercise' }));
      return it;
    })();
    const col         = rout.color || '#28D2DB';
    const trainerName = (users.find(u => u.isTrainer) || {}).name || 'Pedro Benadiba';
    const BL = { rest:'Descanso', warmup:'Entrada en calor', 'active-pause':'Pausa activa' };
    const dateStr = new Date().toLocaleDateString('es-AR', {day:'2-digit', month:'long', year:'numeric'});
    // SVG logo URL: absolute so funciona dentro del blob HTML al imprimir
    const logoUrl = window.location.href.match(/^.*\//)[0] + 'icons/SVG/Recurso%207.svg';

    function buildItemsHTML(forScreen) {
      return items.map((item, idx) => {
        if (!item.type || item.type === 'exercise') {
          const dropsetBadge = item.dropset
            ? (forScreen
                ? ' <span style="font-size:8px;font-weight:800;border:1.5px solid currentColor;border-radius:3px;padding:1px 4px;margin-left:5px;vertical-align:middle;text-transform:uppercase">+dropset</span>'
                : ` <span style="font-size:9px;font-weight:800;color:#fff;background:#333;border-radius:3px;padding:2px 5px;margin-left:6px;vertical-align:middle;text-transform:uppercase">+dropset</span>`)
            : '';
          return `
            <div class="${forScreen ? 'pdf-card' : 'pc'}" style="${forScreen ? `border-left-color:${col}` : `border-left:5px solid ${col};margin-bottom:12px;padding:14px 16px;border-radius:0 8px 8px 0;background:#f5f5f5;page-break-inside:avoid`}">
              <div ${forScreen ? 'class="pdf-info"' : ''}>
                <div style="${forScreen ? '' : 'font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:4px'}">Ejercicio ${idx + 1}</div>
                <div ${forScreen ? 'class="pdf-name"' : 'style="font-size:15px;font-weight:800;color:#111;margin-bottom:6px"'}>${item.name}</div>
                <div ${forScreen ? `class="pdf-sets" style="color:${col}"` : 'style="font-size:22px;font-weight:900;letter-spacing:-1px;line-height:1;color:#111"'}>${item.sets} &times; ${item.reps}${dropsetBadge}</div>
                ${item.note ? `<div ${forScreen ? 'class="pdf-note"' : 'style="font-size:11px;color:#555;margin-top:6px;padding-top:6px;border-top:1px solid #ddd"'}>${item.note}</div>` : ''}
              </div>
            </div>`;
        } else if (item.type === 'speed-run') {
          return `
            <div ${forScreen ? 'class="pdf-break"' : 'style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;padding:10px 14px;border-radius:7px;border:1.5px solid #999;page-break-inside:avoid"'}>
              <span ${forScreen ? 'class="pdf-br-label"' : 'style="font-size:12px;font-weight:700;color:#222"'}>Pasadas de Velocidad</span>
              <span ${forScreen ? 'class="pdf-br-dur"' : 'style="font-size:12px;font-weight:600;color:#444;margin-left:auto"'}>${item.series} series &times; ${item.distance} ${item.distUnit}</span>
              <span ${forScreen ? 'class="pdf-br-dur"' : 'style="font-size:11px;color:#555"'}>Descanso: ${item.rest} ${item.restUnit}</span>
            </div>`;
        } else {
          return `
            <div ${forScreen ? 'class="pdf-break"' : 'style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;padding:10px 14px;border-radius:7px;border:1.5px dashed #bbb;page-break-inside:avoid"'}>
              <span ${forScreen ? 'class="pdf-br-label"' : 'style="font-size:12px;font-weight:700;color:#222"'}>${BL[item.type] || item.type}</span>
              <span ${forScreen ? 'class="pdf-br-dur"' : 'style="font-size:12px;font-weight:600;color:#444;margin-left:auto"'}>${item.duration} ${item.unit === 'min' ? 'min' : 'seg'}</span>
              ${item.note ? `<div ${forScreen ? 'class="pdf-br-note"' : 'style="font-size:11px;color:#555;width:100%;margin-top:2px"'}>${item.note}</div>` : ''}
            </div>`;
        }
      }).join('');
    }

    function headerHTML(forScreen) {
      const logo = forScreen
        ? PDF_LOGO_SVG
        : `<img src="${logoUrl}" alt="PR.47" style="height:44px;width:auto;flex-shrink:0;display:block" />`;
      return `
        <div ${forScreen ? `class="pdf-header" style="border-bottom-color:${col}"` : `style="display:flex;align-items:center;gap:20px;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid ${col}"`}>
          ${logo}
          <div ${forScreen ? 'class="pdf-ht"' : 'style="flex:1;min-width:0"'}>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${forScreen ? '#aaa' : '#888'};margin-bottom:3px">Entrenador personal</div>
            <div style="font-size:${forScreen ? 22 : 20}px;font-weight:900;letter-spacing:-1px;color:#111">${trainerName}</div>
            <div style="font-size:14px;font-weight:700;color:${forScreen ? col : '#333'};margin-top:4px">${rout.name}</div>
            ${rout.description ? `<div style="font-size:11px;color:${forScreen ? '#aaa' : '#666'};margin-top:2px">${rout.description}</div>` : ''}
            ${studentName ? `<div style="display:inline-block;font-size:9px;font-weight:700;color:${forScreen ? col : '#fff'};background:${forScreen ? col + '18' : col};border:1px solid ${forScreen ? col + '55' : col};border-radius:4px;padding:2px 8px;margin-top:5px;text-transform:uppercase;letter-spacing:.5px">Para: ${studentName}</div>` : ''}
          </div>
        </div>`;
    }

    // â”€â”€ Build in-app preview overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const overlay = document.createElement('div');
    overlay.className = 'pdf-view-overlay';
    overlay.innerHTML = `
      <div class="pdf-view-header">
        <span class="pdf-view-title">Vista previa</span>
        <div class="pdf-view-actions">
          <button id="pv-share" class="btn btn-primary btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
            Guardar PDF
          </button>
          <button id="pv-close" class="btn btn-secondary btn-sm">Cerrar</button>
        </div>
      </div>
      <div class="pdf-view-body">
        ${headerHTML(true)}
        ${buildItemsHTML(true) || '<p style="color:#aaa">Sin ejercicios</p>'}
        <div class="pdf-foot">${trainerName} · ${dateStr}</div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('pv-close').addEventListener('click', () => overlay.remove());

    document.getElementById('pv-share').addEventListener('click', () => {
      const printHtml = '<!DOCTYPE html><html lang=”es”><head>' +
        '<meta charset=”UTF-8”>' +
        '<meta name=”viewport” content=”width=device-width,initial-scale=1”>' +
        '<title>' + rout.name + ' — PR.47</title>' +
        '<style>' +
        '*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
        'body{font-family:system-ui,-apple-system,Helvetica,Arial,sans-serif;background:#fff;color:#111;padding:30px 34px;max-width:680px;margin:0 auto}' +
        'img{display:block;max-width:100%;height:auto}' +
        '.pc{margin-bottom:12px}' +
        '@media print{' +
          'body{padding:0;max-width:none}' +
          '@page{size:A4 portrait;margin:15mm 18mm}' +
          '.pc{page-break-inside:avoid;break-inside:avoid}' +
        '}' +
        '</style></head><body>' +
        headerHTML(false) +
        (buildItemsHTML(false) || '<p style=”color:#888;font-size:13px;margin-top:16px”>Sin ejercicios</p>') +
        '<div style=”margin-top:36px;padding-top:12px;border-top:1px solid #ccc;font-size:9px;color:#888;text-align:center;text-transform:uppercase;letter-spacing:1.5px”>' + trainerName + ' · ' + dateStr + ' · PR.47</div>' +
        '<script>window.addEventListener(“load”,function(){var imgs=document.images,n=imgs.length,done=0;function go(){setTimeout(function(){window.print();},600);}if(!n){go();return;}for(var i=0;i<n;i++){if(imgs[i].complete){if(++done===n)go();}else{imgs[i].onload=imgs[i].onerror=function(){if(++done===n)go();};}}});<\/script>' +
        '</body></html>';

      const blob = new Blob([printHtml], { type: 'text/html; charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, '_blank');
      if (!win) App.toast('Permití ventanas emergentes para guardar como PDF');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }

  /* â”€â”€ Break modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function openBreakModal() {
    App.openModal('Agregar pausa', `
      <div class="form-group">
        <label>Tipo</label>
        <select id="br-type" class="form-select">
          <option value="rest">Descanso</option>
          <option value="warmup">Entrada en calor</option>
          <option value="active-pause">Pausa activa</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Duración</label>
          <input id="br-dur" class="form-input" type="number" min="1" value="30" />
        </div>
        <div class="form-group">
          <label>Unidad</label>
          <select id="br-unit" class="form-select">
            <option value="sec">Segundos</option>
            <option value="min">Minutos</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Aclaración <span style="font-size:.65em;color:var(--text3);font-weight:400">(opcional)</span></label>
        <input id="br-note" class="form-input" placeholder="Ej: entre series" />
      </div>
      <div class="modal-footer">
        <button id="br-cancel" class="btn btn-secondary">Cancelar</button>
        <button id="br-save"   class="btn btn-primary">Agregar</button>
      </div>
    `);
    document.getElementById('br-cancel').addEventListener('click', App.closeModal);
    document.getElementById('br-save').addEventListener('click', () => {
      const type     = document.getElementById('br-type').value;
      const duration = parseInt(document.getElementById('br-dur').value)  || 30;
      const unit     = document.getElementById('br-unit').value;
      const note     = document.getElementById('br-note').value.trim();
      getItems(curRout).push({ id: uid(), type, duration, unit, note });
      save(); App.closeModal(); renderItems();
      App.toast('Pausa agregada');
    });
  }

  /* ── Pasadas de Velocidad modal ─────────────────────────── */
  function openSpeedRunModal(item = null, idx = null) {
    App.openModal(item ? 'Editar Pasadas de Velocidad' : 'Pasadas de Velocidad', `
      <div class="form-group">
        <label>Series</label>
        <input id="sr-series" class="form-input" type="number" min="1" value="${item?.series || 4}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Distancia / Tiempo</label>
          <input id="sr-dist" class="form-input" type="number" min="1" value="${item?.distance || 100}" />
        </div>
        <div class="form-group">
          <label>Unidad</label>
          <select id="sr-distunit" class="form-select">
            <option value="metros"   ${(item?.distUnit||'metros')==='metros'  ?'selected':''}>Metros</option>
            <option value="segundos" ${item?.distUnit==='segundos'?'selected':''}>Segundos</option>
            <option value="minutos"  ${item?.distUnit==='minutos' ?'selected':''}>Minutos</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Descanso entre series</label>
          <input id="sr-rest" class="form-input" type="number" min="0" value="${item?.rest ?? 60}" />
        </div>
        <div class="form-group">
          <label>Unidad</label>
          <select id="sr-restunit" class="form-select">
            <option value="segundos" ${(item?.restUnit||'segundos')==='segundos'?'selected':''}>Segundos</option>
            <option value="minutos"  ${item?.restUnit==='minutos' ?'selected':''}>Minutos</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button id="sr-cancel" class="btn btn-secondary">Cancelar</button>
        <button id="sr-save"   class="btn btn-primary">${item ? 'Guardar' : 'Agregar'}</button>
      </div>
    `);
    document.getElementById('sr-cancel').addEventListener('click', App.closeModal);
    document.getElementById('sr-save').addEventListener('click', () => {
      const series   = parseInt(document.getElementById('sr-series').value)  || 4;
      const distance = parseInt(document.getElementById('sr-dist').value)    || 100;
      const distUnit = document.getElementById('sr-distunit').value;
      const rest     = parseInt(document.getElementById('sr-rest').value)    || 60;
      const restUnit = document.getElementById('sr-restunit').value;
      const obj = { id: item?.id || uid(), type: 'speed-run', series, distance, distUnit, rest, restUnit };
      const items = getItems(curRout);
      if (idx !== null) items[idx] = obj; else items.push(obj);
      save(); App.closeModal(); renderItems();
      App.toast(idx !== null ? 'Pasadas actualizadas' : 'Pasadas de Velocidad agregadas');
    });
  }

  function openExerciseModal(ex = null, idx = null) {
    App.openModal(ex ? 'Editar ejercicio' : 'Nuevo ejercicio', `
      <div class="form-group">
        <label>Nombre</label>
        <input id="ex-name" class="form-input" placeholder="Ej: Sentadilla con barra" value="${ex?.name||''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Series</label>
          <input id="ex-sets" class="form-input" type="text" inputmode="text" placeholder="Ej: 4" value="${ex?.sets||3}" />
        </div>
        <div class="form-group">
          <label>Repeticiones</label>
          <input id="ex-reps" class="form-input" type="text" inputmode="text" placeholder="Ej: 8-12" value="${ex?.reps||10}" />
        </div>
      </div>
      <div class="form-group">
        <label>Nota (opcional)</label>
        <input id="ex-note" class="form-input" placeholder="Ej: Peso 60 kg" value="${ex?.note||''}" />
      </div>
      <div class="form-group toggle-row">
        <label>Dropset</label>
        <label class="toggle-switch">
          <input type="checkbox" id="ex-dropset"${ex?.dropset ? ' checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="modal-footer">
        <button id="ex-cancel" class="btn btn-secondary">Cancelar</button>
        <button id="ex-save"   class="btn btn-primary">Guardar</button>
      </div>
    `);

    document.getElementById('ex-cancel').addEventListener('click', App.closeModal);
    document.getElementById('ex-save').addEventListener('click', () => {
      const name = document.getElementById('ex-name').value.trim();
      if (!name) { App.toast('Ingresá el nombre'); return; }
      const obj = {
        id:      ex?.id || uid(),
        type:    'exercise',
        name,
        sets:    document.getElementById('ex-sets').value.trim() || '3',
        reps:    document.getElementById('ex-reps').value.trim() || '10',
        note:    document.getElementById('ex-note').value.trim(),
        dropset: document.getElementById('ex-dropset').checked,
      };
      const items = getItems(curRout);
      if (idx !== null) items[idx] = obj; else items.push(obj);
      save(); App.closeModal(); renderItems();
      App.toast(idx !== null ? 'Ejercicio actualizado' : 'Ejercicio agregado');
    });
  }

  /* â”€â”€ Assign routine to calendar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function openAssignToCalModal(routine) {
    const WDAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const today = new Date(); today.setHours(0,0,0,0);
    const defaultDay = today.getDay(); // pre-select today's weekday
    App.openModal('Asignar al calendario', `
      <p style="color:var(--text2);font-size:.85rem;margin-bottom:16px;line-height:1.5">
        Asignar <strong>${routine.name}</strong> a todos los días elegidos,
        desde hoy hasta fin del próximo año.
      </p>
      <div class="form-group">
        <label>Día de la semana</label>
        <select id="asgn-day" class="form-select">
          ${WDAYS.map((d, i) =>
            `<option value="${i}"${i === defaultDay ? ' selected' : ''}>${d}</option>`
          ).join('')}
        </select>
      </div>
      <div class="modal-footer">
        <button id="asgn-cancel" class="btn btn-secondary">Cancelar</button>
        <button id="asgn-save"   class="btn btn-primary">Asignar</button>
      </div>
    `);

    document.getElementById('asgn-cancel').addEventListener('click', App.closeModal);
    document.getElementById('asgn-save').addEventListener('click', () => {
      const dayOfW  = parseInt(document.getElementById('asgn-day').value);
      const events  = JSON.parse(localStorage.getItem('fitpro_events_v2') || '{}');
      const start   = new Date(today);
      const end     = new Date(today.getFullYear() + 1, 11, 31);

      // Advance to first matching weekday >= today
      while (start.getDay() !== dayOfW) start.setDate(start.getDate() + 1);

      let count = 0;
      const cur = new Date(start);
      while (cur <= end) {
        const k = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
        const day = events[k] || { myTraining: null, classes: [] };
        day.myTraining = { routineId: routine.id, routineName: routine.name };
        events[k] = day;
        cur.setDate(cur.getDate() + 7);
        count++;
      }
      localStorage.setItem('fitpro_events_v2', JSON.stringify(events));
      App.closeModal();
      App.toast(`Asignado: ${count} ${WDAYS[dayOfW].toLowerCase()}s`);
    });
  }

  /* â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function init() {
    load();
    seedIfNeeded();
    cleanupPhotos(); // one-time: strip stored photos to free localStorage

    // FAB (lives outside scroll container)
    document.getElementById('add-user-btn').addEventListener('click', () => openUserModal());

    document.getElementById('export-routines-btn').addEventListener('click', exportRoutines);
    document.getElementById('import-routines-btn').addEventListener('click', () => {
      document.getElementById('import-routines-input').click();
    });
    document.getElementById('import-routines-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) importRoutinesFile(file);
      e.target.value = '';
    });

    document.getElementById('back-to-users').addEventListener('click', () => {
      curUser = null;
      showView('users-list-view');
      renderUsers();
      App.setTitle('Usuarios');
    });

    document.getElementById('edit-user-btn').addEventListener('click', () => {
      if (curUser) openUserModal(curUser);
    });
    document.getElementById('delete-user-btn').addEventListener('click', () => {
      if (curUser) deleteUserModal();
    });

    document.getElementById('add-routine-btn').addEventListener('click', () => openRoutineModal());
    document.getElementById('copy-routine-btn').addEventListener('click', () => {
      if (curUser) openCopyFromModal();
    });

    document.getElementById('edit-routine-btn').addEventListener('click', () => {
      if (curRout) openRoutineModal(curRout);
    });

    document.getElementById('back-to-user').addEventListener('click', () => {
      curRout = null;
      showView('user-detail-view');
      renderRoutines();
      App.setTitle(curUser?.name || 'Usuario');
    });

    document.getElementById('add-exercise-btn').addEventListener('click', () => openQuickAddModal());
    document.getElementById('add-break-btn').addEventListener('click', () => openBreakModal());
    document.getElementById('add-speed-btn').addEventListener('click', () => openSpeedRunModal());
    document.getElementById('pdf-routine-btn').addEventListener('click', () => {
      if (!curRout) return;
      downloadRoutinePDF(curRout, curUser?.isTrainer ? null : curUser?.name);
    });

    document.getElementById('assign-to-cal-btn').addEventListener('click', () => {
      if (curRout) openAssignToCalModal(curRout);
    });

    renderUsers();
  }

  /* Public: find any user's routine by id - used by Calendar */
  function getRoutineById(routineId) {
    for (const u of users) {
      const r = (u.routines || []).find(r => r.id === routineId);
      if (r) return r;
    }
    return null;
  }

  return { init, getRoutineById, downloadRoutinePDF };
})();
