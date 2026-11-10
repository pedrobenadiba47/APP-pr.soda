/* ============================================================
   ORGANIZER MODULE  -  PR.47
   Carpetas de rutinas por alumno. Mira los nombres de las rutinas (y, si el nombre no dice nada,
   los ejercicios) y las reparte en pocas carpetas: Full body, Localizado, Tren superior, Piernas…
   Todo es aditivo: cada rutina recibe un campo `folder` y cada alumno una lista `folders`.
   Nada se borra ni se renombra, y todo se puede mover o renombrar a mano desde la app.
============================================================ */

const Organizer = (() => {

  /* ── Tipos de carpeta (la etiqueta es el nombre inicial; después se puede cambiar) ── */
  const TAGS = {
    full:  { label: 'Full body',               color: '#28D2DB' },
    loc:   { label: 'Localizado',              color: '#e91e63' },
    ais:   { label: 'Aislados',                color: '#9b59b6' },
    mod:   { label: 'Módulos cortos',          color: '#f1c40f' },
    aer:   { label: 'Aeróbico y resistencia',  color: '#2ecc71' },
    reh:   { label: 'Rehab y adaptadas',       color: '#e74c3c' },
    pp:    { label: 'Push / Pull',             color: '#e67e22' },
    base:  { label: 'Rutina base',             color: '#607d8b' },
    gtu:   { label: 'Glúteo + tren superior',  color: '#e91e63' },
    tsp:   { label: 'Tren superior + piernas', color: '#1abc9c' },
    ts:    { label: 'Tren superior',           color: '#5aabcc' },
    glu:   { label: 'Glúteos',                 color: '#e91e63' },
    leg:   { label: 'Piernas',                 color: '#e67e22' },
    core:  { label: 'Core y abdominales',      color: '#f1c40f' },
    otras: { label: 'Otras rutinas',           color: '#607d8b' },
  };
  const LEG_CORE_LABEL = 'Piernas y core';

  /* a qué carpetas puede ir a parar una rutina suelta, en orden de preferencia */
  const PREFS = {
    pp: ['ts', 'tsp'], ts: ['tsp', 'pp'], tsp: ['ts'],
    leg: ['core', 'tsp'], core: ['leg', 'glu', 'loc'],
    glu: ['loc', 'gtu'], gtu: ['glu', 'loc', 'ts'], loc: ['glu', 'gtu'], ais: ['loc', 'glu'],
    mod: [], base: [], aer: [], reh: [], full: [], otras: [],
  };
  const GLU_FAMILY = ['glu', 'loc', 'gtu', 'ais'];
  const maxFolders = n => Math.max(4, Math.min(8, Math.ceil(n / 4)));   // pocas carpetas: ~1 cada 4 rutinas

  /* Íconos (trazo, 24×24) */
  const ICONS = {
    full:  '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.5v6M7 10l5-1.5 5 1.5M12 13.5l-3.5 7M12 13.5l3.5 7"/>',
    loc:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    ais:   '<polygon points="12 3 3 8 12 13 21 8 12 3"/><polyline points="3 12.5 12 17.5 21 12.5"/><polyline points="3 17 12 22 21 17"/>',
    mod:   '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    aer:   '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    reh:   '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
    pp:    '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>',
    base:  '<polygon points="12 2 15.1 8.6 22 9.5 17 14.4 18.2 21.4 12 18 5.8 21.4 7 14.4 2 9.5 8.9 8.6 12 2"/>',
    gtu:   '<polygon points="12 3 3 8 12 13 21 8 12 3"/><polyline points="3 12.5 12 17.5 21 12.5"/>',
    tsp:   '<rect x="2" y="10.5" width="3" height="3" rx=".5"/><rect x="19" y="10.5" width="3" height="3" rx=".5"/><rect x="5" y="8.5" width="2" height="7" rx=".5"/><rect x="17" y="8.5" width="2" height="7" rx=".5"/><line x1="7" y1="12" x2="17" y2="12"/>',
    ts:    '<rect x="2" y="10.5" width="3" height="3" rx=".5"/><rect x="19" y="10.5" width="3" height="3" rx=".5"/><rect x="5" y="8.5" width="2" height="7" rx=".5"/><rect x="17" y="8.5" width="2" height="7" rx=".5"/><line x1="7" y1="12" x2="17" y2="12"/>',
    glu:   '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z"/>',
    leg:   '<polyline points="6 17 12 11 18 17"/><polyline points="6 11 12 5 18 11"/>',
    core:  '<path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3z"/>',
    otras: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>',
  };
  const iconSVG = (tag, size) => `<svg width="${size || 22}" height="${size || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[tag] || ICONS.otras}</svg>`;

  const norm = s => (typeof Generator !== 'undefined' && Generator._core) ? Generator._core.norm(s)
    : String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim();
  const uid  = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const isEx = it => !it.type || it.type === 'exercise';

  /* ── 1) A qué tipo de carpeta va una rutina ─────────────── */
  const NAME_RULES = [
    ['full', /full ?body|completo/],
    ['aer',  /aerobic|anaerob|resistencia|cardio\b/],
    ['reh',  /rehab|adaptad|lesion/],
    ['loc',  /localizad/],
    ['ais',  /aislad/],
    ['mod',  /modulos?\b/],
    ['pp',   /\bpush\b|\bpull\b/],
    ['base', /\bbase\b/],
  ];
  const UP = ['pecho', 'espalda', 'hombros', 'bicep', 'tricep'];

  function cleanName(user, name) {                       // se saca el nombre del alumno ("RUTINA_AGUS_DÍA1")
    let n = norm(name);
    norm(user && user.name).split(' ').filter(t => t.length >= 3).forEach(t => { n = n.replace(new RegExp('\\b' + t + 's?\\b', 'g'), ' '); });
    return n.replace(/\s+/g, ' ').trim();
  }
  function nameGroups(r, n) {
    const g = new Set((typeof Generator !== 'undefined' && Generator._core) ? Generator._core.nameGroups(r.name || '') : []);
    if (/\besp\b/.test(n)) g.add('espalda');
    if (/\bpec\b/.test(n)) g.add('pecho');
    return g;
  }
  function contentGroups(r) {                            // si el nombre no dice nada, se mira qué ejercicios tiene
    const items = r.items || (r.exercises || []).map(e => Object.assign({ type: 'exercise' }, e));
    const c = {}; let tot = 0;
    items.filter(isEx).forEach(it => {
      ((Generator._core.classify(it.name, {})) || []).forEach(g => { c[g] = (c[g] || 0) + 1; tot++; });
    });
    const sum = arr => arr.reduce((s, g) => s + (c[g] || 0), 0);
    return { up: sum(UP), leg: c.piernas || 0, glu: c.gluteos || 0, core: c.core || 0, tot };
  }
  function classify(user, r) {
    const n = cleanName(user, r.name);
    for (const [tag, rx] of NAME_RULES) if (rx.test(n)) return tag;
    const g = nameGroups(r, n);
    let up = UP.some(x => g.has(x)), leg = g.has('piernas'), glu = g.has('gluteos'), core = g.has('core');
    if (!up && !leg && !glu && !core) {                  // el nombre no dice nada: se usa el contenido
      const c = contentGroups(r);
      if (c.tot) {
        const lower = (c.leg + c.glu) / c.tot, upper = c.up / c.tot;
        if (lower >= 0.3 && upper >= 0.2) return 'full';          // un poco de todo
        glu = c.glu / c.tot >= 0.35; leg = !glu && c.leg / c.tot >= 0.3;
        up = upper >= 0.3; core = !glu && !leg && !up && c.core / c.tot >= 0.3;
      }
    }
    if (glu && up) return 'gtu';
    if (up && leg) return 'tsp';
    if (up) return 'ts';
    if (glu) return 'glu';
    if (leg) return 'leg';
    if (core) return 'core';
    return 'otras';
  }

  /* ── 2) Plan de carpetas de un alumno ───────────────────── */
  function plan(user) {
    const groups = {};                                   // tag -> { tag, label, ids: [], origin: {tag: n} }
    (user.routines || []).forEach(r => {
      const tag = classify(user, r);
      (groups[tag] = groups[tag] || { tag, ids: [], origin: {} });
      groups[tag].ids.push(r.id); groups[tag].origin[tag] = (groups[tag].origin[tag] || 0) + 1;
    });
    const list = () => Object.values(groups);
    const mergeInto = (from, to) => {
      to.ids.push(...from.ids);
      Object.keys(from.origin).forEach(k => { to.origin[k] = (to.origin[k] || 0) + from.origin[k]; });
      delete groups[from.tag];
    };
    const target = (f, minSize) => { for (const t of (PREFS[f.tag] || [])) if (groups[t] && groups[t] !== f && groups[t].ids.length >= minSize) return groups[t]; return null; };
    // 1) una rutina que quedó sola se suma a una carpeta parecida que ya tiene al menos 2
    list().filter(f => f.ids.length === 1).forEach(f => { const t = groups[f.tag] && target(f, 2); if (t) mergeInto(f, t); });
    // 2) las que siguen solas se juntan entre sí si son parecidas (piernas con core, glúteos con localizado…)
    list().filter(f => f.ids.length === 1).forEach(f => { const t = groups[f.tag] && target(f, 1); if (t) mergeInto(f, t); });
    // 3) si todavía quedan sueltas, a "Otras rutinas" (una sola suelta puede quedar sola)
    const lone = list().filter(f => f.ids.length === 1 && f.tag !== 'otras');
    if (lone.length > 1) {
      const o = groups.otras || (groups.otras = { tag: 'otras', ids: [], origin: {} });
      lone.forEach(f => mergeInto(f, o));
    }
    // 4) demasiadas carpetas para la cantidad de rutinas: las más chicas se juntan con una parecida
    const cap = maxFolders((user.routines || []).length);
    while (list().length > cap) {
      // solo se juntan carpetas que tienen una parecida (un "Módulos cortos" o un "Aeróbico" son estilos propios)
      const small = list().filter(f => f.tag !== 'otras' && target(f, 1)).sort((a, b) => a.ids.length - b.ids.length)[0];
      if (!small || small.ids.length > 3) break;
      mergeInto(small, target(small, 1));
    }
    // nombre final de cada carpeta
    return list().sort((a, b) => b.ids.length - a.ids.length).map(f => {
      const o = f.origin, keys = Object.keys(o), n = f.ids.length;
      const top = keys.sort((a, b) => o[b] - o[a])[0] || f.tag;
      if (f.tag === 'otras') return { tag: 'otras', label: TAGS.otras.label, ids: f.ids };
      if (keys.length === 2 && o.leg && o.core) return { tag: 'leg', label: LEG_CORE_LABEL, ids: f.ids };
      if (keys.length > 1 && keys.every(k => GLU_FAMILY.includes(k)) && o[top] / n < 0.6)
        return { tag: top, label: 'Glúteos y localizado', ids: f.ids };
      return { tag: top, label: TAGS[top].label, ids: f.ids };
    });
  }

  /* ── 3) Aplicar al alumno ───────────────────────────────── */
  function makeFolder(tag, label) { return { id: uid(), name: label || TAGS[tag].label, tag }; }

  /* La primera vez: arma las carpetas y mete cada rutina en la suya. Devuelve true si cambió algo. */
  function ensure(user) {
    if (!user || user.isTrainer && !(user.routines || []).length) return false;
    if (user.folders && user.folders.length) return false;
    if (!(user.routines || []).length) return false;
    user.folders = [];
    plan(user).forEach(p => {
      const f = makeFolder(p.tag, p.label); user.folders.push(f);
      const ids = new Set(p.ids);
      user.routines.forEach(r => { if (ids.has(r.id)) r.folder = f.id; });
    });
    return true;
  }

  /* Carpeta para una rutina nueva (la crea si hace falta). Devuelve el id. */
  function folderFor(user, routine) {
    if (!user.folders) user.folders = [];
    const tag = classify(user, routine);
    const byTag = t => user.folders.find(f => f.tag === t);
    let f = byTag(tag);
    if (!f) for (const t of (PREFS[tag] || [])) { f = byTag(t); if (f) break; }
    if (!f && user.folders.length && !(PREFS[tag] || []).length) f = null;
    if (!f) { f = makeFolder(tag); user.folders.push(f); }
    return f.id;
  }

  /* Rutinas que quedaron sin carpeta (por ejemplo, de una importación) */
  function fillMissing(user) {
    let n = 0;
    (user.routines || []).forEach(r => {
      if (!r.folder || !(user.folders || []).some(f => f.id === r.folder)) { r.folder = folderFor(user, r); n++; }
    });
    return n;
  }

  /* Músculos que suele trabajar una carpeta (el conjunto más repetido en sus rutinas) */
  function folderGroups(user, folderId) {
    const count = {};
    (user.routines || []).filter(r => r.folder === folderId).forEach(r => {
      const g = (r.groups && r.groups.length) ? r.groups : Array.from(nameGroups(r, cleanName(user, r.name)));
      const clean = g.filter(x => x !== 'cardio');
      if (!clean.length) return;
      const key = clean.slice().sort().join('+');
      count[key] = (count[key] || 0) + 1;
    });
    const best = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    return best ? best.split('+') : [];
  }

  const api = { TAGS, ICONS, iconSVG, classify, plan, ensure, folderFor, fillMissing, folderGroups, makeFolder, cleanName };
  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Organizer;
