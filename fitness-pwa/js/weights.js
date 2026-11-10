/* ============================================================
   WEIGHTS TABLE MODULE  -  PR.47
   "Tabla de pesos" de cada alumno: el peso más reciente de cada ejercicio, agrupado por músculo.
   Se arma sola a partir de todas las rutinas del alumno, así que cuando se actualiza un peso
   en cualquier rutina, la tabla ya lo muestra. Se puede bajar como PDF o compartir como texto.
============================================================ */

const WeightsTable = (() => {

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ORDER = ['pecho', 'espalda', 'hombros', 'bicep', 'tricep', 'piernas', 'gluteos', 'core', 'cardio'];
  const LABEL = { pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros', bicep: 'Bíceps', tricep: 'Tríceps',
                  piernas: 'Piernas', gluteos: 'Glúteos', core: 'Abdominales', cardio: 'Funcional / cardio', otros: 'Otros' };
  // de qué músculo es "principal" un ejercicio combinado ("estocada + press de hombro" -> piernas)
  const PRIORITY = ['piernas', 'gluteos', 'pecho', 'espalda', 'hombros', 'bicep', 'tricep', 'core', 'cardio'];
  const NO_WEIGHT = /^(sin\s+(o\s+poco\s+)?peso|poco\s+peso|peso\s+corporal|barra(\s+w)?\s*\(?\s*sin\s+peso\s*\)?)$/i;
  const SOLO = /^\s*(\d+(?:[.,]\d+)?)\s*(kgs?|k|lbs?|lad(?:rillos?)?)\b/i;

  const dmy = ms => { if (!ms) return ''; const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`; };
  const num = s => {
    s = String(s || '').trim();
    const m = s.match(SOLO);
    if (!m || /[+\/>]/.test(s)) return null;           // pesos compuestos ("41kg + 2kg", "10/15kg") no se comparan
    return { v: parseFloat(m[1].replace(',', '.')), u: m[2].toLowerCase().replace(/^k$|^kgs$/, 'kg').replace(/^lad.*/, 'lad'),
             q: s.slice(m[0].length).replace(/[\s?.]/g, '').toLowerCase() };   // "p/lado", "manc."…
  };

  function trend(prev, cur) {                        // ▲ si subió, ▼ si bajó: solo si es la misma unidad y la misma forma de contarlo
    const a = num(prev), b = num(cur);
    if (!a || !b || a.u !== b.u || a.q !== b.q || a.v === b.v) return '';
    return b.v > a.v ? 'up' : 'down';
  }
  function primary(groups) {
    for (const g of PRIORITY) if (groups.includes(g)) return g;
    return groups[0] || 'otros';
  }

  /* ── Datos: { sections: [{ key, label, rows: [...] }], hidden } ── */
  function build(user, opts) {
    opts = opts || {};
    const an = Generator.analyze(user);
    const by = {}; let hidden = 0;
    const removedKeys = new Set(user.weightHidden || []);   // los que el profe quitó de la tabla
    const removed = [];
    an.bank.forEach(b => {
      if (removedKeys.has(b.key)) { removed.push({ key: b.key, name: b.name, weight: b.weight || '' }); return; }
      if (!b.weight || NO_WEIGHT.test(b.weight.trim())) {
        if (!opts.showNoWeight) { hidden++; return; }
        if (!b.weight) {                       // nunca se le anotó peso: se muestra para poder cargarlo desde la tabla
          (by[primary(b.groups)] = by[primary(b.groups)] || []).push({ key: b.key, name: b.name, weight: '—', tech: b.tech || '', at: 0,
            prev: '', trend: '', history: [], count: b.count, empty: true, merged: mergedOf(b) });
          return;
        }
      }
      const g = primary(b.groups);
      const h = b.history || [];
      const prev = h.length > 1 ? h[h.length - 2].weight : '';
      (by[g] = by[g] || []).push({
        key: b.key, name: b.name, weight: b.weight, tech: b.tech || '', at: b.weightAt || 0,
        prev, trend: trend(prev, b.weight), history: h.slice().reverse(), count: b.count, merged: mergedOf(b),
      });
    });
    const sections = ORDER.concat('otros').filter(g => by[g] && by[g].length).map(g => ({
      key: g, label: LABEL[g], rows: by[g].sort((x, y) => x.name.localeCompare(y.name, 'es', { sensitivity: 'base' })),
    }));
    removed.sort((x, y) => x.name.localeCompare(y.name, 'es', { sensitivity: 'base' }));
    return { sections, hidden, removed, total: sections.reduce((s, x) => s + x.rows.length, 0), name: user.name };
  }
  // otros nombres que se juntaron en este renglón
  const mergedOf = b => b.aliases ? [...b.aliases].map(([key, name]) => ({ key, name })) : [];

  /* ── Texto para mandar por WhatsApp ─────────────────────── */
  function asText(user) {
    const t = build(user);
    const lines = [`Mis pesos — ${user.name}`, `Actualizado: ${dmy(Date.now())}`, ''];
    t.sections.forEach(s => {
      lines.push(s.label.toUpperCase());
      s.rows.forEach(r => lines.push(`• ${r.name}: ${r.weight}${r.tech ? ' (' + r.tech + ')' : ''}`));
      lines.push('');
    });
    lines.push('PR.47 · Pedro Benadiba');
    return lines.join('\n');
  }

  /* ── Documento (vista previa y PDF) ─────────────────────── */
  const logoUrl = () => window.location.href.match(/^.*\//)[0] + 'icons/SVG/Recurso%207.svg';

  function docHTML(user, t, trainerName) {
    const acc = '#1AA8B0';
    const sec = t.sections.map(s => `
      <div style="margin-top:20px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:8px;border-bottom:2px solid ${acc};padding-bottom:5px;margin-bottom:2px">
          <span style="font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#111">${esc(s.label)}</span>
          <span style="font-size:10px;color:#888;font-weight:600">${s.rows.length}</span>
        </div>
        ${s.rows.map(r => `
          <div style="display:flex;align-items:baseline;gap:10px;padding:8px 0;border-bottom:1px solid #e6e6e6;page-break-inside:avoid">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700;color:#111;line-height:1.25">${esc(r.name)}</div>
              ${r.tech ? `<div style="font-size:10.5px;color:#666;margin-top:2px;line-height:1.3">${esc(r.tech)}</div>` : ''}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:15px;font-weight:900;color:#111;letter-spacing:-.3px">${esc(r.weight)}${r.trend === 'up' ? ' <span style="color:#1a9a4a;font-size:12px">▲</span>' : r.trend === 'down' ? ' <span style="color:#c0392b;font-size:12px">▼</span>' : ''}</div>
              <div style="font-size:9px;color:#999;margin-top:1px">${r.at ? 'desde ' + dmy(r.at) : ''}</div>
            </div>
          </div>`).join('')}
      </div>`).join('');
    return `
      <div style="display:flex;align-items:center;gap:20px;margin-bottom:6px;padding-bottom:18px;border-bottom:3px solid ${acc}">
        <img src="${logoUrl()}" alt="PR.47" style="height:40px;width:auto;flex-shrink:0;display:block" />
        <div style="flex:1;min-width:0">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:3px">Tabla de pesos</div>
          <div style="font-size:21px;font-weight:900;letter-spacing:-1px;color:#111">${esc(user.name)}</div>
          <div style="font-size:11px;color:#666;margin-top:3px">Actualizada el ${dmy(Date.now())} · ${t.total} ejercicios</div>
        </div>
      </div>
      ${sec || '<p style="color:#888;font-size:13px;margin-top:20px">Todavía no hay pesos cargados.</p>'}
      <div style="margin-top:30px;padding-top:12px;border-top:1px solid #ddd;font-size:9px;color:#888;text-align:center;text-transform:uppercase;letter-spacing:1.5px">${esc(trainerName)} · PR.47</div>`;
  }

  function trainerOf() { try { return (JSON.parse(localStorage.getItem('fitpro_users') || '[]').find(u => u.isTrainer) || {}).name || 'Pedro Benadiba'; } catch (e) { return 'Pedro Benadiba'; } }

  function openPreview(user) {
    const t = build(user), trainer = trainerOf();
    const overlay = document.createElement('div');
    overlay.className = 'pdf-view-overlay';
    overlay.innerHTML = `
      <div class="pdf-view-header">
        <span class="pdf-view-title">Vista previa</span>
        <div class="pdf-view-actions">
          <button id="wt-pdf" class="btn btn-primary btn-sm">Guardar PDF</button>
          <button id="wt-close" class="btn btn-secondary btn-sm">Cerrar</button>
        </div>
      </div>
      <div class="pdf-view-body" style="background:#fff;border-radius:10px;margin-top:14px;margin-bottom:24px;color:#111">${docHTML(user, t, trainer)}</div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#wt-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#wt-pdf').addEventListener('click', () => {
      const html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Pesos ' + esc(user.name) + ' — PR.47</title><style>' +
        '*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
        'body{font-family:system-ui,-apple-system,Helvetica,Arial,sans-serif;background:#fff;color:#111;padding:30px 34px;max-width:680px;margin:0 auto}' +
        'img{display:block;max-width:100%;height:auto}' +
        '@media print{body{padding:0;max-width:none}@page{size:A4 portrait;margin:15mm 18mm}}' +
        '</style></head><body>' + docHTML(user, t, trainer) +
        '<script>window.addEventListener("load",function(){var imgs=document.images,n=imgs.length,done=0;function go(){setTimeout(function(){window.print();},600);}if(!n){go();return;}for(var i=0;i<n;i++){if(imgs[i].complete){if(++done===n)go();}else{imgs[i].onload=imgs[i].onerror=function(){if(++done===n)go();};}}});<\/script>' +
        '</body></html>';
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html; charset=utf-8' }));
      const win = window.open(url, '_blank');
      if (!win) App.toast('Permití ventanas emergentes para guardar como PDF');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }

  async function shareText(user) {
    const text = asText(user);
    if (navigator.share) {
      try { await navigator.share({ title: `Pesos de ${user.name}`, text }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); App.toast('Copiado: pegalo en WhatsApp'); }
    catch (e) { App.toast('No se pudo compartir'); }
  }

  /* ── Pantalla de la tabla (dentro de la app) ────────────── */
  let cur = null;          // { user, onBack, q, showNoWeight }

  function rowHTML(r) {
    const tr = r.trend === 'up' ? '<span class="wt-trend up" title="Subió">▲</span>' : r.trend === 'down' ? '<span class="wt-trend down" title="Bajó">▼</span>' : '';
    return `<button class="wt-row${r.empty ? ' wt-row--empty' : ''}" data-key="${esc(r.key)}">
      <div class="wt-info">
        <div class="wt-name">${esc(r.name)}</div>
        ${r.tech ? `<div class="wt-tech">${esc(r.tech)}</div>` : ''}
        <div class="wt-meta">${[r.at ? 'Desde ' + dmy(r.at) : '', r.prev ? `antes ${esc(r.prev)}` : '', r.merged && r.merged.length ? `juntado con ${r.merged.length} nombre${r.merged.length > 1 ? 's' : ''} más` : ''].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="wt-weight">${esc(r.weight)}${tr}</div>
    </button>`;
  }

  function render() {
    const root = document.getElementById('weights-view');
    const t = build(cur.user, { showNoWeight: cur.showNoWeight });
    const q = cur.q.trim().toLowerCase();
    const secs = t.sections.map(s => ({ ...s, rows: s.rows.filter(r => !q || r.name.toLowerCase().includes(q) || r.weight.toLowerCase().includes(q)) })).filter(s => s.rows.length);
    root.innerHTML = `
      <button class="back-btn-standalone" id="wt-back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        Volver
      </button>
      <div class="wt-head">
        <div>
          <div class="wt-title">Tabla de pesos</div>
          <div class="wt-sub">${esc(cur.user.name)} · ${t.total} ejercicios</div>
        </div>
      </div>
      <div class="wt-actions">
        <button class="btn btn-accent btn-sm" id="wt-open-pdf">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descargar PDF
        </button>
        <button class="btn btn-secondary btn-sm" id="wt-share">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>
          WhatsApp
        </button>
      </div>
      <input id="wt-search" class="form-input wt-search" placeholder="Buscar ejercicio…" value="${esc(cur.q)}" autocomplete="off" />
      <div class="wt-note">Tocá un ejercicio para cambiarle el peso. También se actualiza sola cuando cambiás un peso en una rutina.</div>
      ${secs.map(s => `
        <div class="wt-section">
          <div class="wt-sec-head"><span>${esc(s.label)}</span><small>${s.rows.length}</small></div>
          ${s.rows.map(rowHTML).join('')}
        </div>`).join('') || `<div class="empty-state"><p>${q ? 'Ningún ejercicio coincide.' : 'Todavía no hay pesos cargados.<br><strong>Anotalos en cada ejercicio.</strong>'}</p></div>`}
      ${t.hidden || cur.showNoWeight ? `<button class="wt-toggle" id="wt-nw">${cur.showNoWeight ? 'Ocultar los ejercicios sin peso' : `Mostrar ${t.hidden} ejercicio${t.hidden > 1 ? 's' : ''} sin peso`}</button>` : ''}
      ${t.removed.length ? `<button class="wt-toggle" id="wt-rm">${cur.showRemoved ? 'Ocultar los quitados' : `Quitados de la tabla (${t.removed.length})`}</button>
        ${cur.showRemoved ? `<div class="wt-removed">${t.removed.map(r => `
          <div class="wt-rm-row">
            <div class="wt-info"><div class="wt-name">${esc(r.name)}</div>${r.weight ? `<div class="wt-meta">${esc(r.weight)}</div>` : ''}</div>
            <button class="btn btn-secondary btn-sm" data-restore="${esc(r.key)}">Volver a mostrar</button>
          </div>`).join('')}</div>` : ''}` : ''}`;

    root.querySelector('#wt-back').addEventListener('click', () => { const cb = cur.onBack; cur = null; cb && cb(); });
    root.querySelector('#wt-open-pdf').addEventListener('click', () => openPreview(cur.user));
    root.querySelector('#wt-share').addEventListener('click', () => shareText(cur.user));
    const s = root.querySelector('#wt-search');
    s.addEventListener('input', () => { cur.q = s.value; const pos = s.selectionStart; render(); const n = document.getElementById('wt-search'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ok */ } });
    const nw = root.querySelector('#wt-nw'); if (nw) nw.addEventListener('click', () => { cur.showNoWeight = !cur.showNoWeight; render(); });
    const rm = root.querySelector('#wt-rm'); if (rm) rm.addEventListener('click', () => { cur.showRemoved = !cur.showRemoved; render(); });
    root.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => {
      const u = cur.user, k = b.dataset.restore;
      u.weightHidden = (u.weightHidden || []).filter(x => x !== k);
      saveCur(); render(); App.toast('Vuelve a estar en la tabla');
    }));
    root.querySelectorAll('.wt-row').forEach(b => b.addEventListener('click', () => openHistory(t, b.dataset.key)));
  }

  /* suma o resta al número del peso sin tocar la unidad ni lo que dice después ("12 kg p/lado" -> "14,5 kg p/lado") */
  function bump(text, delta) {
    const s = String(text || '').trim();
    const m = s.match(/^(\d+(?:[.,]\d+)?)/);
    if (!m) return s;
    const comma = m[1].includes(',');
    let v = Math.max(0, Math.round((parseFloat(m[1].replace(',', '.')) + delta) * 100) / 100);
    let out = String(v); if (comma || /\.\d/.test(out)) out = out.replace('.', ',');
    return out + s.slice(m[1].length);
  }

  function openHistory(t, key) {
    let row = null; t.sections.forEach(s => s.rows.forEach(r => { if (r.key === key) row = r; }));
    if (!row) return;
    const hasW = !!row.weight && row.weight !== '—';
    const canBump = hasW && /^\d/.test(row.weight);
    App.openModal(row.name, `
      <div class="wt-hist-now">${hasW ? esc(row.weight) : '<span style="opacity:.45">Sin peso</span>'}</div>
      ${row.tech ? `<div class="wt-tech" style="margin-bottom:14px">${esc(row.tech)}</div>` : ''}
      <div class="wt-edit">
        <label class="wt-edit-label" for="wt-new-w">Cambiar el peso</label>
        <div class="wt-edit-row">
          ${canBump ? '<button type="button" class="wt-bump" data-d="-2.5">−2,5</button><button type="button" class="wt-bump" data-d="-1">−1</button>' : ''}
          <input id="wt-new-w" class="form-input wt-edit-input" value="${hasW ? esc(row.weight) : ''}" placeholder="Ej: 12 kg p/lado" autocomplete="off" />
          ${canBump ? '<button type="button" class="wt-bump" data-d="1">+1</button><button type="button" class="wt-bump" data-d="2.5">+2,5</button>' : ''}
        </div>
        <label class="wt-edit-label" for="wt-new-t">Nota técnica <small>(opcional)</small></label>
        <input id="wt-new-t" class="form-input" value="${esc(row.tech)}" placeholder="Ej: bajar lento, codos pegados" autocomplete="off" />
        <div class="wt-edit-hint">Queda como el último peso: lo ves acá, en el PDF y en las rutinas nuevas que generes o dupliques.</div>
      </div>
      <div class="wt-org">
        <div class="wt-edit-label">¿Está repetido o sobra?</div>
        ${row.merged.length ? `<div class="wt-merged">${row.merged.map(m => `
          <div class="wt-merged-row"><span>Incluye también <b>${esc(m.name)}</b></span><button type="button" class="wt-link" data-unmerge="${esc(m.key)}">Separar</button></div>`).join('')}</div>` : ''}
        <div class="wt-org-btns">
          <button type="button" class="btn btn-secondary btn-sm" id="wt-merge">Es el mismo que otro…</button>
          <button type="button" class="btn btn-danger btn-sm" id="wt-hide">Quitar de la tabla</button>
        </div>
        <div class="wt-edit-hint">Solo ordena la tabla y el PDF. Tus rutinas no cambian.</div>
      </div>
      ${row.history.length ? `<div class="wt-hist-label">Cómo fue cambiando</div>
      ${row.history.map((h, i) => `<div class="wt-hist-row${i === 0 ? ' now' : ''}"><span>${h.at ? dmy(h.at) : '—'}${h.manual ? ' <em class="wt-hist-tag">tabla</em>' : ''}</span><b>${esc(h.weight)}</b></div>`).join('')}` : ''}
      <div class="modal-footer">
        <button class="btn btn-secondary" id="wt-hist-close">Cerrar</button>
        <button class="btn btn-primary" id="wt-hist-save">Guardar</button>
      </div>`);
    const wIn = document.getElementById('wt-new-w'), tIn = document.getElementById('wt-new-t');
    document.querySelectorAll('.wt-bump').forEach(b => b.addEventListener('click', () => { wIn.value = bump(wIn.value || row.weight, parseFloat(b.dataset.d)); }));
    document.getElementById('wt-hist-close').addEventListener('click', App.closeModal);
    document.getElementById('wt-merge').addEventListener('click', () => openMergePicker(row));
    document.getElementById('wt-hide').addEventListener('click', () => {
      const u = cur.user;
      u.weightHidden = (u.weightHidden || []).filter(k => k !== row.key).concat(row.key);
      saveCur(); App.closeModal(); render();
      App.undoToast(`Quitado: ${row.name}`, () => {
        u.weightHidden = (u.weightHidden || []).filter(k => k !== row.key);
        saveCur(); if (cur) render();
      });
    });
    document.querySelectorAll('[data-unmerge]').forEach(b => b.addEventListener('click', () => {
      const u = cur.user, k = b.dataset.unmerge, before = u.weightMerge && u.weightMerge[k];
      if (!before) return;
      delete u.weightMerge[k];
      saveCur(); App.closeModal(); render();
      App.undoToast('Separado otra vez', () => { u.weightMerge = u.weightMerge || {}; u.weightMerge[k] = before; saveCur(); if (cur) render(); });
    }));
    document.getElementById('wt-hist-save').addEventListener('click', () => {
      const w = wIn.value.trim(), tech = tIn.value.trim();
      const wChanged = !!w && w !== (hasW ? row.weight : '');
      const tChanged = tech !== (row.tech || '');
      if (!wChanged && !tChanged) { App.closeModal(); return; }
      const user = cur.user;
      // si solo cambió la nota, no se toca la fecha del peso
      const entry = { key: row.key, name: row.name, weight: wChanged ? w : '', tech, at: Date.now() };
      if (!Array.isArray(user.weightLog)) user.weightLog = [];
      user.weightLog.push(entry);
      cur.save && cur.save();
      App.closeModal();
      render();
      App.undoToast(wChanged ? `Peso actualizado: ${w}` : 'Nota actualizada', () => {
        const i = user.weightLog.indexOf(entry);
        if (i >= 0) user.weightLog.splice(i, 1);
        cur && cur.save && cur.save();
        if (cur) render();
      });
    });
  }

  const saveCur = () => { if (cur && cur.save) cur.save(); };

  /* "Es el mismo que…": este renglón se junta con el que elijas (queda el nombre elegido y el peso más nuevo) */
  function openMergePicker(row) {
    const t = build(cur.user, { showNoWeight: true });
    const mine = t.sections.find(s => s.rows.some(r => r.key === row.key));
    const secs = (mine ? [mine] : []).concat(t.sections.filter(s => s !== mine))
      .map(s => ({ label: s.label, rows: s.rows.filter(r => r.key !== row.key) })).filter(s => s.rows.length);
    App.openModal('Es el mismo que…', `
      <p class="wt-pick-hint">Elegí el ejercicio que queda. <b>${esc(row.name)}</b> se junta con ese en un solo renglón, con el peso más nuevo de los dos.</p>
      <input id="wt-pick-q" class="form-input wt-search" placeholder="Buscar ejercicio…" autocomplete="off" />
      <div id="wt-pick-list">${secs.map(s => `
        <div class="wt-pick-sec" data-sec>
          <div class="wt-sec-head"><span>${esc(s.label)}</span></div>
          ${s.rows.map(r => `<button type="button" class="wt-row wt-pick-row" data-to="${esc(r.key)}" data-n="${esc(r.name.toLowerCase())}">
            <div class="wt-info"><div class="wt-name">${esc(r.name)}</div></div>
            <div class="wt-weight">${esc(r.weight)}</div>
          </button>`).join('')}
        </div>`).join('')}</div>
      <div class="modal-footer"><button class="btn btn-secondary" id="wt-pick-back">Volver</button></div>`);
    const q = document.getElementById('wt-pick-q');
    q.addEventListener('input', () => {
      const v = q.value.trim().toLowerCase();
      document.querySelectorAll('#wt-pick-list [data-sec]').forEach(sec => {
        let any = false;
        sec.querySelectorAll('.wt-pick-row').forEach(b => { const ok = !v || b.dataset.n.includes(v); b.classList.toggle('hidden', !ok); any = any || ok; });
        sec.classList.toggle('hidden', !any);
      });
    });
    document.getElementById('wt-pick-back').addEventListener('click', () => openHistory(build(cur.user, { showNoWeight: true }), row.key));
    document.querySelectorAll('.wt-pick-row').forEach(b => b.addEventListener('click', () => {
      const u = cur.user;
      u.weightMerge = u.weightMerge || {};
      let to = b.dataset.to, g = 0;
      while (u.weightMerge[to] && g++ < 10) to = u.weightMerge[to];
      if (to === row.key) return;
      u.weightMerge[row.key] = to;
      saveCur(); App.closeModal(); render();
      const name = b.querySelector('.wt-name').textContent;
      App.undoToast(`Juntado con ${name}`, () => { delete u.weightMerge[row.key]; saveCur(); if (cur) render(); });
    }));
  }

  function open(user, onBack, opts) {
    opts = opts || {};
    cur = { user, onBack, q: opts.query || '', showNoWeight: false, showRemoved: false, save: opts.save };
    render();
    if (opts.focus) {
      const t = build(user, { showNoWeight: true });
      let found = false; t.sections.forEach(s => s.rows.forEach(r => { if (r.key === opts.focus) found = true; }));
      if (found) openHistory(t, opts.focus);
    }
  }

  return { open, build, asText, openPreview, shareText, dmy };
})();

if (typeof module !== "undefined" && module.exports) module.exports = WeightsTable;
