/* ============================================================
   GENERATOR MODULE  -  PR.47
   Arma rutinas nuevas para un alumno usando SOLO ejercicios que
   ya hizo con él (mismo nombre y último peso) y copiando su estilo:
   entrada en calor, bloques, descansos, pausas activas y pasadas.
   Parte 1: lógica (sin pantalla).  Parte 2: pantallas.
============================================================ */

const Generator = (() => {

  const DAY_MS  = 86400000;
  const OVR_KEY = 'fitpro_exgroups_v1';   // correcciones manuales de músculo por ejercicio
  const EV_KEY  = 'fitpro_events_v2';     // agenda (para saber cuándo fue la última clase)

  /* ── Músculos ───────────────────────────────────────────── */
  const GROUPS = [
    { key: 'pecho',   label: 'Pecho',       up: 'PECHO' },
    { key: 'espalda', label: 'Espalda',     up: 'ESPALDA' },
    { key: 'hombros', label: 'Hombros',     up: 'HOMBROS' },
    { key: 'bicep',   label: 'Bíceps',      up: 'BICEP' },
    { key: 'tricep',  label: 'Tríceps',     up: 'TRICEP' },
    { key: 'piernas', label: 'Piernas',     up: 'PIERNAS' },
    { key: 'gluteos', label: 'Glúteos',     up: 'GLÚTEOS' },
    { key: 'core',    label: 'Abdominales', up: 'ABDOMINALES' },
    { key: 'cardio',  label: 'Cardio',      up: 'CARDIO' },
  ];
  const GL = {}; const GU = {};
  GROUPS.forEach(g => { GL[g.key] = g.label; GU[g.key] = g.up; });

  const UPPER = ['pecho', 'espalda', 'hombros', 'bicep', 'tricep'];
  const FULL  = ['piernas', 'espalda', 'pecho', 'hombros', 'core'];
  const PRESETS = [
    { label: 'GAP',           groups: ['gluteos', 'core', 'piernas'] },
    { label: 'Tren superior', groups: UPPER },
    { label: 'Push',          groups: ['pecho', 'hombros', 'tricep'] },
    { label: 'Pull',          groups: ['espalda', 'bicep'] },
    { label: 'Full body',     groups: FULL },
  ];
  const GENERIC_COMBOS = [
    ['pecho', 'tricep'], ['espalda', 'bicep'], ['piernas', 'gluteos'], ['hombros', 'core'],
    ['gluteos', 'core', 'piernas'], ['pecho', 'espalda'], ['piernas', 'core'], UPPER, FULL,
  ];

  /* ── Utilidades ─────────────────────────────────────────── */
  const isEx = it => !it.type || it.type === 'exercise';
  const esc  = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
  function wpick(arr, wf, rng) {
    let tot = 0; const ws = arr.map(x => { const w = Math.max(0, wf(x)); tot += w; return w; });
    if (!arr.length) return null;
    if (tot <= 0) return pick(arr, rng);
    let r = rng() * tot;
    for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }
  const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const dkey  = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const pdate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const diffDays = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / DAY_MS);
  const fmtDate = ms => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };

  /* ── Nombres: normalizar y emparejar ────────────────────── */
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9+]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'en', 'a', 'al', 'y', 'e', 'un', 'una', 'por', 'para', 'o']);
  const SYN  = { manc: 'mancuerna', maq: 'maquina', isquios: 'isquiotibial', isquiotibiales: 'isquiotibial',
                 cudriceps: 'cuadricep', abodminales: 'abdominal', ismetrico: 'isometrico', estoacadas: 'estocada', estoacada: 'estocada' };
  function singular(t) {
    if (t.length <= 3) return t;
    if (/[^aeiou]es$/.test(t)) return t.slice(0, -2);      // abdominales -> abdominal, flexiones -> flexion
    if (/s$/.test(t)) return t.slice(0, -1);               // estocadas -> estocada, biceps -> bicep
    return t;
  }
  const _tokCache = new Map();
  function tokenList(name) {
    if (_tokCache.has(name)) return _tokCache.get(name);
    const n = norm(name)
      .replace(/\bsit ?ups?\b/g, 'situp').replace(/\bpull ?overs?\b/g, 'pullover')
      .replace(/\bhip ?thrust\b/g, 'hipthrust').replace(/\btras ?nuca\b/g, 'trasnuca');
    const out = [];
    for (let t of n.split(' ')) {
      if (!t || STOP.has(t)) continue;
      out.push(singular(SYN[t] || t));
    }
    out.sort();
    _tokCache.set(name, out);
    return out;
  }
  const canonKey = name => tokenList(name).join(' ');
  function isVariant(a, b) {                 // "plancha" ⊂ "plancha marchando": mismo movimiento
    const A = new Set(a.filter(t => t !== '+')), B = new Set(b.filter(t => t !== '+'));
    const [s, l] = A.size <= B.size ? [A, B] : [B, A];
    if (!s.size) return false;
    for (const t of s) if (!l.has(t)) return false;
    return true;
  }

  /* ── Clasificación por músculo (según el nombre) ────────── */
  const RULES = [
    ['pecho',   /\bpecho\b|pectoral|\bpec\b|apertura|press (de )?banca|bench|press inclinado|press pec|flexiones?\b|\bchest\b/],
    ['espalda', /dorsal|jalon|lat pull|dominada|\bremo\b(?! al menton| aerobico)|pull ?over|trapecio|\bback\b/],
    ['hombros', /hombro|vuelo|arnold|remo al menton|posteriores|frontales|elevacion frontal|press militar|face pull|shoulder/],
    ['bicep',   /bicep|\bcurl\b|martillo|scott|antebrazo/],
    ['tricep',  /tricep|fondos|frances|extension (en polea alta|por encima)|patada de tricep|tras ?nuca|\bdips\b/],
    ['piernas', /sentadilla|estoa?cada|zancada|prensa|bulgara|cuadricep|cudricep|isquio|aductor|gemelo|peso muerto|buenos dias|salto al (banco|cajon)|ascenso al banco|camilla|sillon|\bsumo\b|\bpop\b|hack/],
    ['gluteos', /glute|puente|hip ?thrust|cuadrupedia|patada de burro|abduccion|abductor|caminata lateral/],
    ['core',    /abdominal|abodminal|\babs\b|plancha|crunch|sit ?ups?|russian|dead bug|punto medio|knee pull|bolita|\bcortos?\b|cortitos|elevacion(es)? de piernas|lumbar|climber|boca abajo|pierna cruzada|rueda|oblicuo|colchoneta|superman|hiperextension/],
    ['cardio',  /burpee|jumping|skipping|aerobico|trote|corrida|\bcinta\b|\bbici|eliptico/],
  ];
  const PIERNAS_GENERICO = /\bpierna|isometrico|ismetrico|rodilla|\bstep\b/;
  const _clsCache = new Map();
  function classify(name, overrides) {
    const key = canonKey(name);
    if (overrides && overrides[key]) return overrides[key].slice();
    if (_clsCache.has(name)) return _clsCache.get(name).slice();
    const n = norm(name);
    let g = [];
    for (const [grp, rx] of RULES) if (rx.test(n)) g.push(grp);
    const has = x => g.includes(x);
    if (has('tricep') && has('hombros') && /hombro/.test(n) && !/tricep/.test(n)) g = g.filter(x => x !== 'tricep');
    if (!has('piernas') && !has('gluteos') && !has('core') && PIERNAS_GENERICO.test(n)) g.push('piernas');
    if (has('gluteos') && has('core') && /glute/.test(n) && !/abdominal|plancha|crunch/.test(n)) g = g.filter(x => x !== 'core');
    if (!g.length && /salto/.test(n)) g = ['piernas', 'cardio'];
    _clsCache.set(name, g);
    return g.slice();
  }

  /* Patrones de movimiento: para no cargar lo mismo dos días seguidos */
  const FAMILIES = [
    ['estocada',   /estoa?cada|zancada|bulgara|paso largo|ascenso al banco/],
    ['sentadilla', /sentadilla|prensa|hack|\bsumo\b|\bpop\b|mesero/],
    ['puente',     /puente|hip ?thrust/],
    ['bisagra',    /peso muerto|buenos dias|isquio/],
    ['cuadriceps', /cuadricep|cudricep|sillon/],
    ['cadera',     /aductor|abduccion|abductor|gluteo medio|caminata lateral/],
    ['patada',     /patada|cuadrupedia|burro/],
  ];
  function patternOf(name) {
    const n = norm(name);
    for (const [f, rx] of FAMILIES) if (rx.test(n)) return f;
    return '';
  }
  function familyOf(name, groups) { return patternOf(name) || (groups && groups[0]) || 'otro'; }
  /* "tipo de movimiento" para variar dentro de la misma rutina: el patrón o la primera palabra ("remo", "dorsalera"…) */
  function moveOf(name) {
    const p = patternOf(name);
    if (p) return p;
    const t = norm(name).split(' ').filter(x => x && !STOP.has(x))[0] || '';
    return singular(SYN[t] || t);
  }

  /* Músculos que dice el NOMBRE de la rutina ("PECHO + TRICEP | PIERNAS + PASADAS") */
  function nameGroups(name) {
    const n = norm(name), g = new Set();
    const add = arr => arr.forEach(x => g.add(x));
    if (/\bgap\b/.test(n)) add(['gluteos', 'core', 'piernas']);
    if (/pecho|chest|pectoral/.test(n)) g.add('pecho');
    if (/\bpush\b/.test(n)) add(['pecho', 'hombros', 'tricep']);
    if (/espalda|\bback\b|dorsal/.test(n)) g.add('espalda');
    if (/\bpull\b/.test(n)) add(['espalda', 'bicep']);
    if (/hombro/.test(n)) g.add('hombros');
    if (/bicep|brazos/.test(n)) g.add('bicep');
    if (/tricep|brazos/.test(n)) g.add('tricep');
    if (/pierna|aductor|cuadri|isquio|\blegs\b/.test(n)) g.add('piernas');
    if (/gluteo|glute/.test(n)) g.add('gluteos');
    if (/abdominal|\babs\b|\bcore\b|lumbar/.test(n)) g.add('core');
    if (/tren superior|upper body/.test(n)) add(UPPER);
    if (/full body/.test(n)) add(FULL);
    return [...g];
  }

  /* ── Pesos: la nota con el peso más reciente ────────────── */
  const PLACEHOLDER = /^(\?+|x ?kg|fijarse peso|fijar peso|ver peso|completar|poner peso|\.+|-+)$/i;
  const validNote = n => { n = (n || '').trim(); return !!n && !PLACEHOLDER.test(n); };

  function stepWeight(note, dir) {          // sube/baja el primer número de la nota
    const s = String(note || '');
    if (/\d\s*\/\s*\d/.test(s)) return null;
    const m = s.match(/(\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    const comma = m[1].includes(',');
    const val = parseFloat(m[1].replace(',', '.'));
    const rest = s.slice(m.index + m[1].length);
    let step;
    if (/^\s*lad/i.test(rest))               step = 0.5;
    else if (/^\s*(lbs?|libra)/i.test(rest)) step = 5;
    else if (val >= 5)                       step = 2.5;
    else                                     step = Number.isInteger(val) ? 1 : 0.5;
    const nv = Math.max(0, Math.round((val + dir * step) * 100) / 100);
    let out = String(nv); if (comma) out = out.replace('.', ',');
    return s.slice(0, m.index) + out + rest;
  }

  /* ══════════════════════════════════════════════════════════
     ANÁLISIS DE UN ALUMNO
  ══════════════════════════════════════════════════════════ */
  function routineTime(r) {
    if (r.forDate) return pdate(r.forDate).getTime() + 12 * 3600000;   // clase generada para ese día
    const n = parseInt(String(r.id || '').slice(0, 8), 36);            // los ids llevan la hora de creación
    return (n > 1.5e12 && n < 4.1e12) ? n : 0;
  }

  function buildMeta(r, idx, ovr) {
    let items = r.items;
    if (!items) items = (r.exercises || []).map(e => Object.assign({}, e, { type: 'exercise' }));
    const exs = items.filter(isEx);
    const gcount = {};
    exs.forEach(e => classify(e.name, ovr).forEach(g => { gcount[g] = (gcount[g] || 0) + 1; }));
    const keys = new Set(exs.map(e => canonKey(e.name)));
    const fams = new Set(exs.map(e => familyOf(e.name, classify(e.name, ovr))));
    const named = (r.groups && r.groups.length) ? r.groups.slice() : nameGroups(r.name || '');
    const load = Object.keys(gcount).filter(g => g !== 'cardio' && (gcount[g] >= 2 || (exs.length <= 5 && gcount[g] >= 1)));
    const intent = named.length ? named : load;
    return { r, idx, at: routineTime(r), items, exs, exCount: exs.length, gcount, keys, fams,
             intent, load, all: [...new Set([...intent, ...load])] };
  }

  function analyze(user, ovr) {
    ovr = ovr || {};
    const metas = (user.routines || []).map((r, i) => buildMeta(r, i, ovr)).filter(m => m.items.length)
      .sort((a, b) => (a.at - b.at) || (a.idx - b.idx));

    /* banco de ejercicios del alumno */
    const bank = new Map();
    metas.forEach((m, mi) => {
      m.exs.forEach((it, ei) => {
        const key = canonKey(it.name);
        if (!key) return;
        let b = bank.get(key);
        if (!b) {
          const groups = classify(it.name, ovr);
          b = { key, name: it.name, tok: tokenList(it.name), groups, family: familyOf(it.name, groups), move: moveOf(it.name),
                count: 0, lastMi: -1, occ: [], relSum: 0, relN: 0 };
          bank.set(key, b);
        }
        b.count++; b.lastMi = mi; b.name = it.name;        // gana el nombre más reciente
        b.occ.push({ mi, at: m.at, noteAt: it.noteAt || m.at, sets: it.sets, reps: it.reps,
                     dropset: !!it.dropset, note: (it.note || '').trim(), normal: m.exCount >= 4 });
        b.relSum += m.exs.length > 1 ? ei / (m.exs.length - 1) : 0.5; b.relN++;
      });
    });
    for (const b of bank.values()) {
      // se prefieren los datos de rutinas "normales" (4+ ejercicios): los días aeróbicos usan series/notas especiales
      const base = b.occ.some(o => o.normal) ? b.occ.filter(o => o.normal) : b.occ;
      b.last = base[base.length - 1];
      const w = base.filter(o => validNote(o.note)).sort((x, y) => (y.noteAt - x.noteAt) || (y.mi - x.mi))[0];
      b.weight = w ? w.note : '';
      b.weightAt = w ? w.noteAt : 0;
      b.relPos = b.relN ? b.relSum / b.relN : 0.5;
    }

    /* posición típica de cada músculo dentro de la rutina */
    const gs = {};
    for (const b of bank.values()) b.groups.forEach(g => {
      (gs[g] = gs[g] || { s: 0, n: 0 }); gs[g].s += b.relPos * b.count; gs[g].n += b.count;
    });
    const groupPos = {}; Object.keys(gs).forEach(g => { groupPos[g] = gs[g].s / gs[g].n; });
    const poolSize = {}; GROUPS.forEach(g => { poolSize[g.key] = 0; });
    for (const b of bank.values()) b.groups.forEach(g => { poolSize[g]++; });

    return { user, metas, bank, groupPos, poolSize, prof: buildProfile(metas), ovr };
  }

  /* Cómo arma las clases este alumno (últimas 10 rutinas) */
  function buildProfile(metas) {
    const recent = metas.filter(m => m.exCount >= 3).slice(-10);
    const prof = { recent, median: 9, avgGroups: 2, maxBlock: 4, hasBreaks: false,
                   pool: { warmup: [], rest: [], 'active-pause': [], 'speed-run': [] },
                   core: { rate: 0, avg: 0 }, avgPer: {} };
    if (!recent.length) return prof;
    const sizes = recent.map(m => m.exCount).sort((a, b) => a - b);
    prof.median = sizes[Math.floor(sizes.length / 2)];
    prof.avgGroups = Math.max(1, recent.reduce((s, m) => s + Math.max(1, m.intent.length), 0) / recent.length);
    let maxB = 0;
    recent.forEach(m => {
      let run = 0;
      m.items.forEach(it => {
        if (isEx(it)) { run++; return; }
        if (run) { maxB = Math.max(maxB, run); run = 0; }
        if (it.type !== 'warmup') prof.hasBreaks = true;
        const c = Object.assign({}, it); delete c.id;
        if (prof.pool[it.type]) prof.pool[it.type].push(c);
      });
      maxB = Math.max(maxB, run);
    });
    prof.maxBlock = clamp(maxB, 2, 10);
    prof.warmRate = recent.filter(m => m.items.some(it => it.type === 'warmup')).length / recent.length;
    const nonCore = recent.filter(m => !m.intent.includes('core') && m.exCount >= 4);
    const withCore = nonCore.filter(m => (m.gcount.core || 0) >= 1);
    if (nonCore.length) {
      prof.core.rate = withCore.length / nonCore.length;
      prof.core.avg  = withCore.length ? withCore.reduce((s, m) => s + m.gcount.core, 0) / withCore.length : 0;
    }
    GROUPS.forEach(g => {
      const ms = recent.filter(m => m.intent.includes(g.key) && (m.gcount[g.key] || 0) > 0);
      if (ms.length) prof.avgPer[g.key] = ms.reduce((s, m) => s + m.gcount[g.key], 0) / ms.length;
    });
    return prof;
  }

  /* Última clase del alumno: de la agenda si hay, si no la última rutina */
  function lastClassInfo(user, an, events, today) {
    today = startOfDay(today || new Date());
    const tk = dkey(today);
    let best = null;
    Object.keys(events || {}).forEach(k => {
      if (k >= tk) return;
      const day = events[k];
      ((day && day.classes) || []).forEach(c => {
        if (c.userId === user.id && c.routineId && (!best || k > best.k)) best = { k, routineId: c.routineId };
      });
    });
    if (best) {
      const m = an.metas.find(x => x.r.id === best.routineId);
      if (m) return { meta: m, daysAgo: Math.max(0, diffDays(today, pdate(best.k))), source: 'agenda' };
    }
    // sin agenda: la última rutina ya pasada (las generadas para días que vienen todavía no cuentan)
    const past = an.metas.filter(x => !x.at || x.at <= today.getTime() + DAY_MS);
    const m = past[past.length - 1];
    if (!m) return null;
    return { meta: m, daysAgo: m.at ? Math.max(0, diffDays(today, new Date(m.at))) : 99, source: 'rutina' };
  }

  /* ══════════════════════════════════════════════════════════
     SUGERENCIA DE MÚSCULOS
  ══════════════════════════════════════════════════════════ */
  function sigOf(m) {
    let s = (m.intent || []).filter(g => g !== 'cardio');
    if (!s.length) s = (m.load || []).filter(g => g !== 'cardio');
    return s;
  }
  function weightedOverlap(a, b) {            // qué parte de "a" ya se trabajó en "b" (core pesa menos)
    const w = g => g === 'core' ? 0.4 : 1;
    const tot = a.reduce((s, g) => s + w(g), 0);
    if (!tot) return 0;
    return a.filter(g => b.includes(g)).reduce((s, g) => s + w(g), 0) / tot;
  }

  /* ctx: { prev:{groups,daysAgo}|null, now, avoidSets:[[...]], weekCount:{g:n} } -> [{groups, why, score}] */
  function suggest(an, ctx) {
    ctx = ctx || {};
    const now = ctx.now || Date.now();
    const prev = ctx.prev || null;
    const cand = new Map();
    an.metas.slice(-14).forEach(m => {
      const sig = sigOf(m);
      if (!sig.length || sig.length > 7) return;
      const groups = sig.slice().sort(), k = groups.join('+');
      let c = cand.get(k);
      if (!c) cand.set(k, c = { groups, uses: 0, last: 0 });
      c.uses++; c.last = Math.max(c.last, m.at);
    });
    if (cand.size < 3) GENERIC_COMBOS.forEach(gc => {
      const groups = gc.slice().sort(), k = groups.join('+');
      if (!cand.has(k)) cand.set(k, { groups, uses: 0, last: now - 30 * DAY_MS });
    });

    const lastG = {};
    an.metas.forEach(m => m.all.forEach(g => { lastG[g] = Math.max(lastG[g] || 0, m.at); }));

    const list = [];
    cand.forEach(c => {
      const groups = c.groups.filter(g => an.poolSize[g] > 0);        // solo músculos con ejercicios cargados
      if (!groups.length) return;
      const daysSince = c.last ? Math.max(0, (now - c.last) / DAY_MS) : 60;
      let score = 2.2 * Math.min(daysSince, 45) / 45 + 0.35 * Math.min(c.uses, 5);
      const gap = groups.reduce((s, g) => s + Math.min(lastG[g] ? Math.max(0, (now - lastG[g]) / DAY_MS) : 30, 30) / 30, 0) / groups.length;
      score += gap;
      let ov = 0;
      if (prev) {
        ov = weightedOverlap(groups, prev.groups);
        const d = prev.daysAgo;
        const pen = d <= 1 ? 7 : d <= 2 ? 4.5 : d <= 3 ? 1.6 : d <= 5 ? 0.7 : 0.25;
        score -= pen * ov;
        if (sameSet(groups.slice().sort(), prev.groups.slice().sort())) score -= d <= 3 ? 3 : 1.2;
      }
      (ctx.avoidSets || []).forEach(s => { if (sameSet(groups.slice().sort(), s.slice().sort())) score -= 3; });
      if (ctx.weekCount) score -= 0.6 * groups.reduce((s, g) => s + (ctx.weekCount[g] || 0), 0) / groups.length;
      list.push({ groups, score, uses: c.uses, daysSince, ov });
    });
    list.sort((a, b) => b.score - a.score);
    const out = [], seen = new Set();
    for (const c of list) {
      const k = c.groups.slice().sort().join('+');
      if (seen.has(k)) continue;
      seen.add(k);
      let why;
      if (prev && prev.daysAgo <= 2 && c.ov === 0) why = prev.daysAgo <= 1 ? 'Ayer trabajó otros músculos' : 'No repite los músculos de la clase anterior';
      else if (!c.uses) why = 'Combinación nueva con sus ejercicios';
      else if (c.daysSince >= 21) why = `Hace ${Math.round(c.daysSince / 7)} semanas que no lo hace`;
      else if (c.daysSince >= 10) why = 'Hace más de una semana que no lo hace';
      else why = 'Rota con sus últimas clases';
      out.push({ groups: c.groups, why, score: c.score });
      if (out.length >= 3) break;
    }
    return out;
  }

  /* Varias clases en la semana: gaps = días desde la clase anterior de cada una */
  function planWeek(an, gaps, prevGroups, now) {
    const plan = [], avoidSets = [], weekCount = {};
    let prev = prevGroups ? { groups: prevGroups, daysAgo: gaps[0] } : null;
    gaps.forEach((gap, i) => {
      if (prev) prev.daysAgo = gap;
      const sg = suggest(an, { prev, now, avoidSets, weekCount });
      plan.push(sg);
      const top = sg[0] ? sg[0].groups : [];
      avoidSets.push(top);
      top.forEach(g => { weekCount[g] = (weekCount[g] || 0) + 1; });
      prev = { groups: top, daysAgo: 0 };
    });
    return plan;
  }

  /* ══════════════════════════════════════════════════════════
     GENERACIÓN DE LA RUTINA
  ══════════════════════════════════════════════════════════ */
  function allocate(groups, total, wOf, cap) {
    const q = {}; groups.forEach(g => { q[g] = 0; });
    const act = groups.filter(g => cap[g] > 0);
    if (!act.length) return q;
    let left = total;
    if (total >= act.length) act.forEach(g => { q[g] = 1; left--; });
    const W = act.reduce((s, g) => s + wOf(g), 0) || 1;
    while (left > 0) {
      const open = act.filter(g => q[g] < cap[g]);
      if (!open.length) break;
      let best = open[0], bd = -Infinity;
      open.forEach(g => { const d = total * wOf(g) / W - q[g]; if (d > bd) { bd = d; best = g; } });
      q[best]++; left--;
    }
    return q;
  }

  const blocksOf = sk => {
    const out = []; let s = -1;
    sk.forEach((n, i) => {
      if (n.t === 'E') { if (s < 0) s = i; }
      else if (s >= 0) { out.push({ s, e: i - 1 }); s = -1; }
    });
    if (s >= 0) out.push({ s, e: sk.length - 1 });
    return out;
  };
  const CONTEXT_NOTE = /vuelta|finaliz/i;      // notas atadas a una rutina concreta ("al finalizar las 2 vueltas")

  function adaptSkeleton(sk, N, prof, rng) {
    sk = sk.slice();
    let cnt = sk.filter(n => n.t === 'E').length;
    const maxB = prof.hasBreaks ? Math.max(3, prof.maxBlock) : 99;
    while (cnt > N) {
      const bl = blocksOf(sk);
      if (!bl.length) break;
      const big = bl.filter(b => b.e - b.s >= 1);
      if (big.length) {
        const b = wpick(big, c => c.e - c.s + 1, rng);
        sk.splice(b.e, 1);
      } else {
        const b = pick(bl, rng);
        sk.splice(b.s, 1);
        if (b.s > 0 && sk[b.s] && sk[b.s].t === 'B' && sk[b.s - 1].t === 'B') sk.splice(b.s, 1);
      }
      cnt--;
    }
    while (cnt < N) {
      const bl = blocksOf(sk);
      const open = bl.filter(b => b.e - b.s + 1 < maxB);
      if (open.length) {
        const b = wpick(open, c => maxB - (c.e - c.s + 1) + 1, rng);
        sk.splice(b.e + 1, 0, { t: 'E' });
      } else {
        const pool = prof.pool.rest.concat(prof.pool['active-pause']);
        if (pool.length) sk.push({ t: 'B', it: Object.assign({}, pick(pool, rng)) });
        sk.push({ t: 'E' });
      }
      cnt++;
    }
    return sk;
  }

  function mutateBreaks(sk, prof, rng) {
    const okPool = type => (prof.pool[type] || []).filter(x => !CONTEXT_NOTE.test(x.note || ''));
    return sk.map(n => {
      if (n.t !== 'B') return n;
      const type = n.it.type;
      let it = Object.assign({}, n.it);
      if (type === 'rest' || type === 'active-pause') {
        const rest = okPool('rest'), act = okPool('active-pause');
        if (rng() < 0.12 && rest.length >= 3 && act.length >= 3) it = Object.assign({}, pick(type === 'rest' ? act : rest, rng));
        else if (rng() < 0.4 && okPool(type).length) it = Object.assign({}, pick(okPool(type), rng));
      } else if (type === 'speed-run') {
        if (rng() < 0.5 && prof.pool['speed-run'].length) it = Object.assign({}, pick(prof.pool['speed-run'], rng));
      } else if (type === 'warmup') {
        if (rng() < 0.4 && okPool('warmup').length) it = Object.assign({}, pick(okPool('warmup'), rng));
      }
      if (CONTEXT_NOTE.test(it.note || '')) {
        const alt = okPool(it.type).filter(x => x.note);
        it.note = alt.length ? pick(alt, rng).note : '';
      }
      return { t: 'B', it };
    });
  }

  /* dos cortes iguales seguidos (pasa al sacar un bloque entero) se dejan en uno solo */
  function cleanSkeleton(sk) {
    const out = [];
    sk.forEach(n => {
      const p = out[out.length - 1];
      if (n.t === 'B' && p && p.t === 'B' && p.it.type === n.it.type && n.it.type !== 'warmup') return;
      out.push(n);
    });
    return out;
  }

  function defaultN(an, groups) {
    const m = Math.max(1, groups.length);
    return clamp(Math.round(an.prof.median * (0.6 + 0.4 * m / an.prof.avgGroups)), 3, 18);
  }

  function buildName(groups, forDate) {
    const lab = sameSet(groups.slice().sort(), ['core', 'gluteos', 'piernas']) ? 'GAP' : groups.map(g => GU[g] || g.toUpperCase()).join(' + ');
    return `${lab} · ${fmtDate(forDate.getTime())}`;
  }

  /* req: { groups, n, prev:{keys,fams,groups,daysAgo}|null, weekKeys:Set, rng, uid, forDate:Date } */
  function generate(an, req) {
    const rng = req.rng || Math.random;
    const uid = req.uid || (() => Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const sel = new Set(req.groups);
    const prof = an.prof;
    const prev = req.prev || null;
    const hard = !!prev && prev.daysAgo <= 1, soft = !!prev && prev.daysAgo <= 2;
    const warnings = [];

    const entries = [...an.bank.values()].filter(e => e.groups.length);
    const fit = e => !e.groups.some(g => sel.has(g)) ? 0 : (e.groups.every(g => sel.has(g) || g === 'cardio') ? 1 : 0.35);

    const chosen = [], chosenKeys = new Set();
    const blocked = (e, lvl) => {
      if (chosenKeys.has(e.key)) return true;
      if (lvl >= 2) return false;                       // nivel 2: se permiten variantes del mismo movimiento
      for (const c of chosen) if (isVariant(c.e.tok, e.tok)) return true;
      return false;
    };
    const moveCount = {};
    const weightOf = (e, relax) => {
      let w = 1 + 1.2 * Math.log(1 + e.count);                      // los que más repite salen más seguido
      w *= Math.pow(0.55, moveCount[e.move] || 0);                  // no llenar la rutina de variantes del mismo movimiento
      const back = an.metas.length - 1 - e.lastMi;                  // 0 = estuvo en la última rutina
      w *= back === 0 ? 0.12 : back === 1 ? 0.45 : back === 2 ? 0.8 : 1;
      if (prev) {
        const inPrev = prev.keys.has(e.key), famPrev = prev.fams.has(e.family);
        if (hard)      w *= (inPrev ? (relax ? 0.02 : 0) : 1) * (famPrev ? (relax ? 0.05 : 0) : 1);
        else if (soft) w *= (inPrev ? 0.05 : 1) * (famPrev ? 0.15 : 1);
      }
      if (req.weekKeys && req.weekKeys.has(e.key)) w *= 0.3;
      return w;
    };
    // nivel 0: todas las reglas · 1: se relaja "ayer/anteayer" · 2: además se permiten variantes del mismo movimiento
    const pickOne = (pred, wf) => {
      for (let lvl = 0; lvl <= 2; lvl++) {
        const cs = []; let tot = 0;
        for (const e of entries) {
          if (blocked(e, lvl) || !pred(e)) continue;
          const w = wf(e, lvl >= 1);
          if (w > 0) { cs.push([e, w]); tot += w; }
        }
        if (cs.length) {
          let r = rng() * tot;
          for (const [e, w] of cs) { r -= w; if (r <= 0) return e; }
          return cs[cs.length - 1][0];
        }
      }
      return null;
    };
    const add = (e, group) => { chosen.push({ e, group }); chosenKeys.add(e.key); moveCount[e.move] = (moveCount[e.move] || 0) + 1; };

    /* cuántos por músculo: parejo entre los elegidos, con un empujoncito según lo que él suele hacer */
    const G = req.groups.slice();
    const coreYesterday = !!prev && prev.daysAgo <= 1 && prev.groups.includes('core');   // abs dos días seguidos: no se suman de relleno
    const compWanted = (!sel.has('core') && !coreYesterday && prof.core.rate >= 0.4) ? clamp(Math.round(prof.core.avg), 1, 2) : 0;
    const comp = Math.min(compWanted, Math.floor(req.n / 3));
    const mainN = Math.max(G.length ? 1 : 0, req.n - comp);
    const avail = {}; G.forEach(g => { avail[g] = entries.filter(e => fit(e) > 0 && e.groups.includes(g)).length; });
    const avgSel = G.reduce((s, g) => s + (prof.avgPer[g] || 2), 0) / (G.length || 1) || 1;
    const quota = allocate(G, mainN, g => clamp(Math.sqrt((prof.avgPer[g] || 2) / avgSel), 0.8, 1.25), avail);

    /* se va sacando de a uno, siempre del músculo que más le falta; si uno se queda sin ejercicios, el resto se reparte */
    const remaining = Object.assign({}, quota), done = {};
    for (;;) {
      const open = G.filter(g => remaining[g] > 0 && !done[g]);
      if (!open.length) break;
      const g = open.reduce((a, b) => (remaining[b] > remaining[a] ? b : a), open[0]);
      const e = pickOne(x => fit(x) > 0 && x.groups.includes(g), (x, rl) => weightOf(x, rl) * fit(x));
      if (!e) {
        done[g] = true;
        const over = remaining[g]; remaining[g] = 0;
        const rest = G.filter(x => !done[x]);
        for (let i = 0; i < over && rest.length; i++) remaining[rest[i % rest.length]]++;
        continue;
      }
      add(e, g); remaining[g]--;
    }
    for (let i = 0; i < comp; i++) {                                // complementarios (abs/plancha) como hace él
      const e = pickOne(x => x.groups.includes('core') && x.groups.every(g => g === 'core' || g === 'cardio'), weightOf);
      if (!e) break;
      add(e, 'core');
    }
    while (chosen.length < req.n) {                                 // último recurso si todavía faltan
      const e = pickOne(x => fit(x) > 0, (x, rl) => weightOf(x, rl) * fit(x));
      if (!e) break;
      add(e, e.groups.find(g => sel.has(g)) || e.groups[0]);
    }
    G.forEach(g => { if (!avail[g]) warnings.push(`No tiene ejercicios de ${GL[g]} cargados.`); });
    if (chosen.length < req.n) warnings.push(`Solo encontré ${chosen.length} ejercicios que cumplan.`);
    if (prev && prev.daysAgo <= 2) {
      const shared = G.filter(g => prev.groups.includes(g) && g !== 'core');
      if (shared.length) warnings.push(`${prev.daysAgo <= 1 ? 'Ayer' : 'Anteayer'} ya trabajó ${shared.map(g => GL[g]).join(' y ')}: usé ejercicios distintos.`);
      const again = chosen.filter(c => prev.keys.has(c.e.key)).map(c => c.e.name);
      if (again.length) warnings.push(`Repite ${again.slice(0, 3).join(', ')} de la clase anterior: no tiene otros ejercicios para ese músculo.`);
    }

    /* orden: respeta dónde suele poner cada músculo, con algo de azar */
    const gOrd = {};
    chosen.forEach(c => { if (gOrd[c.group] == null) gOrd[c.group] = (an.groupPos[c.group] != null ? an.groupPos[c.group] : 0.5) + gauss(rng) * 0.16; });
    chosen.forEach(c => { c.k = c.e.relPos + gauss(rng) * 0.1; });
    chosen.sort((a, b) => (gOrd[a.group] - gOrd[b.group]) || (a.k - b.k));

    /* estructura: se copia de una rutina reciente del alumno */
    const N = chosen.length;
    let sk, tmpl = null;
    if (prof.recent.length) {
      /* el molde es una rutina anterior del alumno: se prefieren las de músculos parecidos a los pedidos
         (cada tipo de día tiene su estructura), de tamaño parecido y más recientes */
      const lastM = an.metas[an.metas.length - 1];
      const cands = an.metas.filter(m => m.exCount >= 3).slice(-16);
      tmpl = wpick(cands, m => {
        const sig = new Set([...m.intent, ...m.load].filter(g => g !== 'cardio'));
        const inter = req.groups.filter(g => sig.has(g)).length;
        const uni = new Set([...sig, ...req.groups]).size || 1;
        const sameType = Math.pow(0.15 + inter / uni, 2.2);
        const near = 1 / (1 + Math.abs(m.exCount - N));
        const recency = 1 + cands.indexOf(m) * 0.1;
        return sameType * near * recency * (m === lastM ? 0.7 : 1);
      }, rng);
      sk = tmpl.items.map(it => isEx(it) ? { t: 'E' } : { t: 'B', it: (() => { const c = Object.assign({}, it); delete c.id; return c; })() });
      // una entrada en calor que casi nunca usa con este alumno no se copia siempre
      const keepWarm = clamp((prof.warmRate || 0) * 2, 0.1, 1);
      sk = sk.filter(n => !(n.t === 'B' && n.it.type === 'warmup' && rng() > keepWarm));
    } else {
      sk = [{ t: 'B', it: { type: 'warmup', duration: 5, unit: 'min', note: '' } }];
      for (let i = 0; i < N; i++) { sk.push({ t: 'E' }); if ((i + 1) % 3 === 0 && i < N - 1) sk.push({ t: 'B', it: { type: 'rest', duration: 60, unit: 'sec', note: '' } }); }
    }
    sk = cleanSkeleton(mutateBreaks(adaptSkeleton(sk, N, prof, rng), prof, rng));

    const items = [], slots = [];
    let ei = 0;
    const mkEx = e => {
      const o = { id: uid(), type: 'exercise', name: e.name, sets: e.last.sets, reps: e.last.reps, note: e.weight || '', dropset: !!e.last.dropset };
      if (e.weight && e.weightAt) o.noteAt = e.weightAt;
      return o;
    };
    sk.forEach(n => {
      if (n.t === 'E') { const c = chosen[ei++]; if (c) { slots.push(items.length); items.push(mkEx(c.e)); } }
      else items.push(Object.assign({ id: uid() }, n.it));
    });
    while (ei < chosen.length) { slots.push(items.length); items.push(mkEx(chosen[ei++].e)); }

    const forDate = req.forDate || new Date();
    return {
      items, chosen, slots, groups: req.groups.slice(), warnings,
      name: buildName(req.groups, forDate),
      description: tmpl ? (tmpl.r.description || '') : '',
      color: (tmpl && tmpl.r.color) || '#28D2DB',
      forDate: dkey(forDate), req, tmplName: tmpl ? tmpl.r.name : '',
    };
  }

  /* Cambia UN ejercicio por otro del mismo músculo */
  function swapExercise(an, draft, exIdx, rng, uid) {
    const cur = draft.chosen[exIdx];
    if (!cur) return false;
    const req = draft.req, prev = req.prev || null, sel = new Set(draft.groups);
    const others = draft.chosen.filter((_, i) => i !== exIdx);
    const keys = new Set(others.map(c => c.e.key));
    let pool = [...an.bank.values()].filter(e =>
      e.key !== cur.e.key && !keys.has(e.key) && e.groups.includes(cur.group) &&
      !others.some(c => isVariant(c.e.tok, e.tok)));
    if (prev && prev.daysAgo <= 2) {
      const strict = pool.filter(e => !prev.keys.has(e.key) && !prev.fams.has(e.family));
      if (strict.length) pool = strict;
    }
    if (!pool.length) return false;
    const e = wpick(pool, x => {
      const back = an.metas.length - 1 - x.lastMi;
      const same = others.filter(c => c.e.move === x.move).length;
      return (1 + 1.2 * Math.log(1 + x.count)) * Math.pow(0.55, same) * (back === 0 ? 0.12 : back === 1 ? 0.45 : 1) * (x.groups.every(g => sel.has(g) || g === 'cardio') ? 1 : 0.35);
    }, rng);
    const o = { id: (uid || (() => Date.now().toString(36)))(), type: 'exercise', name: e.name, sets: e.last.sets, reps: e.last.reps, note: e.weight || '', dropset: !!e.last.dropset };
    if (e.weight && e.weightAt) o.noteAt = e.weightAt;
    draft.items[draft.slots[exIdx]] = o;
    draft.chosen[exIdx] = { e, group: cur.group };
    return true;
  }

  /* ── Correcciones manuales de músculo ───────────────────── */
  function loadOverrides() { try { return JSON.parse(localStorage.getItem(OVR_KEY) || '{}'); } catch (e) { return {}; } }
  function saveOverride(key, groups) {
    const o = loadOverrides(); o[key] = groups; localStorage.setItem(OVR_KEY, JSON.stringify(o));
  }
  function loadEvents() { try { return JSON.parse(localStorage.getItem(EV_KEY) || '{}'); } catch (e) { return {}; } }

  /* ══════════════════════════════════════════════════════════
     PANTALLAS
  ══════════════════════════════════════════════════════════ */
  const _ui = {};
  const WD  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const WD3 = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const BL = { rest: 'Descanso', warmup: 'Entrada en calor', 'active-pause': 'Pausa activa', 'speed-run': 'Pasadas de velocidad' };
  const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const groupsLabel = gs => gs.map(g => GL[g]).join(' + ') || '—';
  let S = null;                                  // estado del diálogo abierto

  function show(title, html, wire, keepScroll) {
    const box = document.querySelector('.modal-box');
    const st = box && keepScroll ? box.scrollTop : 0;
    App.openModal(title, `<div id="gen-root">${html}</div>`);
    wire(document.getElementById('gen-root'));
    const b2 = document.querySelector('.modal-box');
    if (b2) b2.scrollTop = st;
  }

  /* ── 1) Elegir qué entrenar ─────────────────────────────── */
  _ui.open = function (ctx) {
    const an = analyze(ctx.user, loadOverrides());
    if (!an.metas.some(m => m.exCount)) { App.toast('Cargale primero alguna rutina con ejercicios'); return; }
    const today = startOfDay(new Date());
    const last = lastClassInfo(ctx.user, an, loadEvents(), today);
    const sch = (ctx.user.schedule || []).slice();
    S = { ctx, an, today, mode: 'single', days: sch.length >= 2 ? sch : [1, 3, 5],
          prevMetaId: last ? last.meta.r.id : '', prevDays: last ? last.daysAgo : 99,
          sessions: [], drafts: [], ov: null };
    initSessions();
    resuggest(true);
    renderSetup(false);
  };

  function prevCtx() {
    const m = S.an.metas.find(x => x.r.id === S.prevMetaId);
    return m ? { meta: m, groups: m.all, keys: m.keys, fams: m.fams } : null;
  }
  function recalcGaps() {
    S.sessions.forEach((s, i) => { s.gap = i === 0 ? S.prevDays + diffDays(s.date, S.today) : diffDays(s.date, S.sessions[i - 1].date); });
  }
  function initSessions() {
    const blank = { groups: [], n: 9, sugg: [], touchedG: false, touchedN: false };
    if (S.mode === 'single') {
      S.sessions = [Object.assign({ label: 'Hoy', date: S.today, gap: S.prevDays }, blank)];
    } else {
      const list = S.days.map(wd => { const d = new Date(S.today); while (d.getDay() !== wd) d.setDate(d.getDate() + 1); return { wd, date: d }; })
        .sort((a, b) => a.date - b.date);
      S.sessions = list.map(x => Object.assign({ label: `${WD[x.wd]} ${fmtDate(x.date.getTime())}`, date: x.date, wd: x.wd, gap: 0 }, blank));
    }
    recalcGaps();
  }
  function applySugg(s, sg, force) {
    s.sugg = sg;
    if (force || !s.touchedG) s.groups = sg[0] ? sg[0].groups.slice() : [];
    if (force || !s.touchedN) s.n = defaultN(S.an, s.groups);
    if (force) { s.touchedG = false; s.touchedN = false; }
  }
  function resuggest(force) {
    const prev = prevCtx(), now = Date.now();
    if (S.mode === 'single') {
      applySugg(S.sessions[0], suggest(S.an, { prev: prev ? { groups: prev.groups, daysAgo: S.sessions[0].gap } : null, now }), force);
    } else {
      const plan = planWeek(S.an, S.sessions.map(s => s.gap), prev ? prev.groups : null, now);
      S.sessions.forEach((s, i) => applySugg(s, plan[i], force));
    }
  }
  function sessionWarnings(i) {
    const s = S.sessions[i], an = S.an, out = [];
    if (!s.groups.length) return ['Elegí al menos un músculo.'];
    s.groups.forEach(g => { if (!an.poolSize[g]) out.push(`No tiene ejercicios de ${GL[g]} cargados todavía.`); });
    const before = i === 0 ? prevCtx() : { groups: S.sessions[i - 1].groups };
    if (before && s.gap <= 2) {
      const shared = s.groups.filter(g => before.groups.includes(g) && g !== 'core');
      if (shared.length) out.push(`La clase anterior fue ${s.gap <= 1 ? 'el día anterior' : 'dos días antes'} y trabajó ${shared.map(g => GL[g]).join(' y ')}. Te conviene elegir otros músculos.`);
    }
    return out;
  }

  function sessionHTML(i) {
    const s = S.sessions[i], an = S.an, week = S.mode === 'week';
    const top = s.sugg[0];
    const alts = s.sugg.slice(1).map((x, k) => `<button class="gen-alt" data-gen="alt" data-s="${i}" data-k="${k + 1}">${esc(groupsLabel(x.groups))}</button>`).join('');
    const chips = GROUPS.map(g => `<button class="gen-chip${s.groups.includes(g.key) ? ' on' : ''}${an.poolSize[g.key] ? '' : ' empty'}" data-gen="chip" data-s="${i}" data-g="${g.key}">${g.label}</button>`).join('');
    const presets = PRESETS.filter(p => p.groups.every(g => an.poolSize[g] > 0))
      .map(p => `<button class="gen-chip ghost" data-gen="preset" data-s="${i}" data-p="${esc(p.label)}">${esc(p.label)}</button>`).join('');
    return `
      <div class="gen-session">
        ${week ? `<div class="gen-s-title">${esc(s.label)}</div>` : ''}
        ${top ? `<div class="gen-sugg">Sugerido: <b>${esc(groupsLabel(top.groups))}</b><span>${esc(top.why)}</span></div>` : ''}
        ${alts ? `<div class="gen-alts"><i>Otras ideas:</i>${alts}</div>` : ''}
        <div class="gen-lbl">Músculos a entrenar</div>
        <div class="gen-chips">${chips}</div>
        ${presets ? `<div class="gen-lbl">Combinaciones rápidas</div><div class="gen-chips">${presets}</div>` : ''}
        ${sessionWarnings(i).map(w => `<div class="gen-warn">${esc(w)}</div>`).join('')}
        <div class="gen-n"><span>Cantidad de ejercicios</span>
          <div class="gen-step"><button data-gen="n" data-s="${i}" data-d="-1">−</button><b>${s.n}</b><button data-gen="n" data-s="${i}" data-d="1">+</button></div>
        </div>
      </div>`;
  }

  function renderSetup(keep) {
    const an = S.an, week = S.mode === 'week';
    const recent = an.metas.slice(-8).reverse();
    const optR = recent.map(m => `<option value="${esc(m.r.id)}"${m.r.id === S.prevMetaId ? ' selected' : ''}>${esc(trunc(m.r.name, 30))}${m.at ? ' · ' + fmtDate(m.at) : ''}</option>`).join('')
      + `<option value=""${!S.prevMetaId ? ' selected' : ''}>Ninguna reciente</option>`;
    const dv = S.prevDays <= 1 ? 1 : S.prevDays >= 5 ? 7 : S.prevDays;
    const optD = [[1, 'Ayer'], [2, 'Hace 2 días'], [3, 'Hace 3 días'], [4, 'Hace 4 días'], [7, 'Hace una semana o más']]
      .map(([v, l]) => `<option value="${v}"${v === dv ? ' selected' : ''}>${l}</option>`).join('');
    const days = week ? `<div class="gen-lbl">Días de clase</div><div class="gen-chips gen-days">${WEEK_ORDER.map(wd =>
      `<button class="gen-chip${S.days.includes(wd) ? ' on' : ''}" data-gen="wd" data-wd="${wd}">${WD3[wd]}</button>`).join('')}</div>` : '';
    const html = `
      <div class="gen-intro"><b>${esc(S.ctx.user.name)}</b> · ${an.metas.length} rutinas · ${an.bank.size} ejercicios propios</div>
      <div class="gen-box">
        <div class="gen-lbl">Clase anterior</div>
        <select class="form-select" data-gen="prevR">${optR}</select>
        <select class="form-select" data-gen="prevD">${optD}</select>
        <div class="gen-hint">La app evita repetir músculos y ejercicios de esa clase si fue hace poco.</div>
      </div>
      <div class="gen-seg">
        <button class="${!week ? 'on' : ''}" data-gen="mode" data-m="single">Una clase</button>
        <button class="${week ? 'on' : ''}" data-gen="mode" data-m="week">Varios días</button>
      </div>
      ${days}
      ${S.sessions.map((_, i) => sessionHTML(i)).join('')}
      <div class="gen-footer">
        <button class="btn btn-secondary" data-gen="cancel">Cancelar</button>
        <button class="btn btn-accent" data-gen="go">Generar</button>
      </div>`;
    show(week ? 'Generar semana' : 'Generar rutina', html, wireSetup, keep);
  }

  function wireSetup(root) {
    root.addEventListener('click', e => {
      const t = e.target.closest('button[data-gen]');
      if (!t) return;
      const a = t.dataset.gen, i = +t.dataset.s;
      if (a === 'cancel') { App.closeModal(); S = null; return; }
      if (a === 'mode') { if (S.mode !== t.dataset.m) { S.mode = t.dataset.m; initSessions(); resuggest(true); } return renderSetup(true); }
      if (a === 'wd') {
        const wd = +t.dataset.wd;
        S.days = S.days.includes(wd) ? S.days.filter(x => x !== wd) : S.days.concat(wd);
        if (!S.days.length) S.days = [wd];
        initSessions(); resuggest(true); return renderSetup(true);
      }
      if (a === 'chip') {
        const s = S.sessions[i], g = t.dataset.g;
        s.groups = s.groups.includes(g) ? s.groups.filter(x => x !== g) : s.groups.concat(g);
        s.touchedG = true;
        if (!s.touchedN) s.n = defaultN(S.an, s.groups);
        return renderSetup(true);
      }
      if (a === 'preset' || a === 'alt') {
        const s = S.sessions[i];
        const gs = a === 'preset' ? PRESETS.find(p => p.label === t.dataset.p).groups : s.sugg[+t.dataset.k].groups;
        s.groups = gs.filter(g => S.an.poolSize[g] > 0); s.touchedG = true;
        if (!s.touchedN) s.n = defaultN(S.an, s.groups);
        return renderSetup(true);
      }
      if (a === 'n') { const s = S.sessions[i]; s.n = clamp(s.n + (+t.dataset.d), 2, 24); s.touchedN = true; return renderSetup(true); }
      if (a === 'go') {
        if (S.sessions.some(s => !s.groups.length)) { App.toast('Elegí al menos un músculo'); return; }
        generateDrafts(0);
        const bad = S.drafts.findIndex(d => !d.chosen.length);
        if (bad >= 0) { App.toast(`No encontré ejercicios de ${groupsLabel(S.sessions[bad].groups)} para ${S.ctx.user.name}`, 3200); return; }
        renderPreview(false);
      }
    });
    root.addEventListener('change', e => {
      const t = e.target, a = t.dataset.gen;
      if (a === 'prevR') {
        S.prevMetaId = t.value;
        const m = S.an.metas.find(x => x.r.id === t.value);
        S.prevDays = m ? (m.at ? Math.max(0, diffDays(S.today, new Date(m.at))) : 99) : 99;
      } else if (a === 'prevD') S.prevDays = +t.value;
      else return;
      recalcGaps(); resuggest(false); renderSetup(true);
    });
  }

  /* ── 2) Armar y revisar ─────────────────────────────────── */
  function generateDrafts(from) {
    const prev0 = prevCtx();
    for (let i = from; i < S.sessions.length; i++) {
      const s = S.sessions[i];
      let before = null;
      if (i === 0) before = prev0 ? { keys: prev0.keys, fams: prev0.fams, groups: prev0.groups, daysAgo: s.gap } : null;
      else { const d = S.drafts[i - 1]; before = { keys: new Set(d.chosen.map(c => c.e.key)), fams: new Set(d.chosen.map(c => c.e.family)), groups: d.groups, daysAgo: s.gap }; }
      const weekKeys = new Set();
      for (let j = 0; j < i; j++) S.drafts[j].chosen.forEach(c => weekKeys.add(c.e.key));
      const d = generate(S.an, { groups: s.groups, n: s.n, prev: before, weekKeys,
        rng: mulberry32((Date.now() + i * 7919 + Math.floor(Math.random() * 1e6)) >>> 0), uid: S.ctx.uid, forDate: s.date });
      d.label = s.label;
      S.drafts[i] = d;
    }
    S.drafts.length = S.sessions.length;
  }

  function breakRowHTML(it) {
    const sub = it.type === 'speed-run'
      ? `${it.series} series × ${it.distance} ${it.distUnit} · descanso ${it.rest} ${it.restUnit}`
      : `${it.duration} ${it.unit === 'min' ? 'min' : 'seg'}${it.note ? ' · ' + it.note : ''}`;
    return `<div class="gen-row gen-break"><div class="gen-row-main"><div class="gen-row-name">${esc(BL[it.type] || it.type)}</div><div class="gen-row-sub">${esc(sub)}</div></div></div>`;
  }
  function draftHTML(d, i) {
    const week = S.drafts.length > 1;
    let ei = -1;
    const rows = d.items.map(it => {
      if (!isEx(it)) return breakRowHTML(it);
      ei++;
      const c = d.chosen[ei];
      const g = c.e.groups.find(x => d.groups.includes(x)) || c.e.groups[0];
      return `<div class="gen-row">
        <div class="gen-row-main"><div class="gen-row-name">${esc(it.name)}</div>
          <div class="gen-row-sub">${esc(it.sets)} × ${esc(it.reps)}${it.dropset ? ' <span class="dropset-badge">+dropset</span>' : ''}${it.note ? ` · <b>${esc(it.note)}</b>` : ''}</div></div>
        <button class="gen-badge" data-gen="badge" data-key="${esc(c.e.key)}" data-name="${esc(c.e.name)}" title="Cambiar músculo">${esc(GL[g] || '?')}</button>
        <button class="gen-swap" data-gen="swap" data-d="${i}" data-e="${ei}" title="Cambiar por otro ejercicio">↻</button>
      </div>`;
    }).join('');
    return `<div class="gen-draft">
      <div class="gen-d-head">
        <div><div class="gen-d-title">${week ? esc(d.label) + ' · ' : ''}${esc(d.name)}</div>
          <div class="gen-d-meta">${d.chosen.length} ejercicios${d.tmplName ? ' · estilo de “' + esc(trunc(d.tmplName, 28)) + '”' : ''}</div></div>
        <button class="gen-mini" data-gen="reroll" data-d="${i}">Mezclar</button>
      </div>
      ${d.warnings.map(w => `<div class="gen-warn">${esc(w)}</div>`).join('')}
      ${rows}
    </div>`;
  }
  function renderPreview(keep) {
    const html = `
      <div class="gen-hint" style="margin-top:-6px">Mismos ejercicios y últimos pesos de ${esc(S.ctx.user.name)}. Con ↻ cambiás uno por otro del mismo músculo; tocando el músculo lo corregís.</div>
      ${S.drafts.map((d, i) => draftHTML(d, i)).join('')}
      <div class="gen-footer">
        <button class="btn btn-secondary" data-gen="back">Volver</button>
        <button class="btn btn-accent" data-gen="save">${S.drafts.length > 1 ? `Guardar ${S.drafts.length} rutinas` : 'Guardar rutina'}</button>
      </div>`;
    show(S.drafts.length > 1 ? 'Semana generada' : 'Rutina generada', html, wirePreview, keep);
  }
  function wirePreview(root) {
    root.addEventListener('click', e => {
      const t = e.target.closest('button[data-gen]');
      if (!t) return;
      const a = t.dataset.gen;
      if (a === 'back') return renderSetup(false);
      if (a === 'reroll') { generateDrafts(+t.dataset.d); return renderPreview(true); }
      if (a === 'swap') {
        const ok = swapExercise(S.an, S.drafts[+t.dataset.d], +t.dataset.e, Math.random, S.ctx.uid);
        if (!ok) App.toast('No hay otro ejercicio de ese músculo');
        return renderPreview(true);
      }
      if (a === 'badge') return renderOverride(t.dataset.key, t.dataset.name);
      if (a === 'save') saveAll();
    });
  }

  function saveAll() {
    const u = S.ctx.user;
    if (!u.routines) u.routines = [];
    const saved = S.drafts.map(d => {
      const r = { id: S.ctx.uid(), name: d.name, description: d.description, color: d.color, exercises: [], items: d.items,
                  generated: true, groups: d.groups.slice(), forDate: d.forDate, genAt: Date.now() };
      u.routines.push(r);
      return r;
    });
    S.ctx.save();
    App.closeModal();
    if (S.ctx.onSaved) S.ctx.onSaved(saved);
    App.toast(saved.length > 1 ? `${saved.length} rutinas guardadas` : 'Rutina guardada');
    S = null;
  }

  /* ── 3) Corregir el músculo de un ejercicio ─────────────── */
  function renderOverride(key, name) {
    S.ov = { key, name, groups: classify(name, S.an.ovr) };
    drawOverride();
  }
  function drawOverride() {
    const o = S.ov;
    const chips = GROUPS.map(g => `<button class="gen-chip${o.groups.includes(g.key) ? ' on' : ''}" data-gen="og" data-g="${g.key}">${g.label}</button>`).join('');
    const html = `
      <p class="gen-hint" style="font-size:.85rem;color:var(--text2)">¿Qué músculos trabaja <b>${esc(o.name)}</b>?<br>Se recuerda para todos tus alumnos.</p>
      <div class="gen-chips">${chips}</div>
      <div class="gen-footer">
        <button class="btn btn-secondary" data-gen="ocancel">Cancelar</button>
        <button class="btn btn-accent" data-gen="osave">Guardar</button>
      </div>`;
    show('Cambiar músculo', html, root => root.addEventListener('click', e => {
      const t = e.target.closest('button[data-gen]');
      if (!t) return;
      const a = t.dataset.gen;
      if (a === 'ocancel') return renderPreview(true);
      if (a === 'og') { const g = t.dataset.g; o.groups = o.groups.includes(g) ? o.groups.filter(x => x !== g) : o.groups.concat(g); return drawOverride(); }
      if (a === 'osave') {
        if (!o.groups.length) { App.toast('Elegí al menos un músculo'); return; }
        saveOverride(o.key, o.groups);
        S.an = analyze(S.ctx.user, loadOverrides());
        S.drafts = []; S.ov = null;
        resuggest(true);
        App.toast('Listo, lo recuerdo');
        renderSetup(false);
      }
    }), true);
  }

  /* ── 4) Actualizar pesos después de la clase ────────────── */
  _ui.openWeights = function (ctx) {
    const rows = ctx.items.map((it, idx) => ({ it, idx })).filter(r => isEx(r.it));
    if (!rows.length) { App.toast('Esta rutina no tiene ejercicios'); return; }
    const html = `
      <div class="gen-hint" style="margin-top:-6px">Cambiá el peso de lo que subió o bajó. Queda como el último peso de cada ejercicio para las próximas rutinas.</div>
      ${rows.map(r => `
        <div class="gw-row" data-idx="${r.idx}">
          <div class="gw-info"><div class="gw-name">${esc(r.it.name)}</div><div class="gw-sub">${esc(r.it.sets)} × ${esc(r.it.reps)}</div></div>
          <div class="gw-ctl">
            <button class="gw-btn" data-gw="dec" aria-label="Bajar">−</button>
            <input class="gw-input" data-orig="${esc((r.it.note || '').trim())}" value="${esc(r.it.note || '')}" placeholder="Peso" />
            <button class="gw-btn" data-gw="inc" aria-label="Subir">+</button>
          </div>
        </div>`).join('')}
      <div class="gen-footer">
        <button class="btn btn-secondary" data-gw="cancel">Cancelar</button>
        <button class="btn btn-accent" data-gw="save">Guardar pesos</button>
      </div>`;
    show('Actualizar pesos', html, root => root.addEventListener('click', e => {
      const t = e.target.closest('button[data-gw]');
      if (!t) return;
      const a = t.dataset.gw;
      if (a === 'cancel') return App.closeModal();
      if (a === 'dec' || a === 'inc') {
        const inp = t.closest('.gw-row').querySelector('.gw-input');
        const nv = stepWeight(inp.value, a === 'inc' ? 1 : -1);
        if (nv == null) { App.toast('Escribí el peso a mano'); inp.focus(); return; }
        inp.value = nv;
        inp.classList.add('changed');
        return;
      }
      if (a === 'save') {
        let n = 0;
        root.querySelectorAll('.gw-row').forEach(row => {
          const inp = row.querySelector('.gw-input');
          const v = inp.value.trim();
          if (v === inp.dataset.orig) return;
          const it = ctx.items[+row.dataset.idx];
          it.note = v;
          if (v) it.noteAt = Date.now(); else delete it.noteAt;
          n++;
        });
        if (n) ctx.save();
        App.closeModal();
        if (n && ctx.onSaved) ctx.onSaved();
        App.toast(n ? `${n} peso${n > 1 ? 's' : ''} actualizado${n > 1 ? 's' : ''}` : 'Sin cambios');
      }
    }), false);
    document.getElementById('gen-root').addEventListener('input', e => { if (e.target.classList.contains('gw-input')) e.target.classList.add('changed'); });
  };

  const api = {
    open:        ctx => _ui.open(ctx),
    openWeights: ctx => _ui.openWeights(ctx),
    stepWeight,
    _core: { norm, canonKey, tokenList, classify, familyOf, nameGroups, analyze, suggest, planWeek, generate,
             swapExercise, lastClassInfo, defaultN, buildName, mulberry32, isVariant, stepWeight, validNote,
             GROUPS, GL, GU, PRESETS, dkey, pdate, diffDays },
    _ui,
    _helpers: { esc, clamp, fmtDate, startOfDay, loadOverrides, saveOverride, loadEvents, sameSet, GROUPS, GL, GU, PRESETS, mulberry32, dkey, pdate, diffDays, isEx },
  };
  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Generator;
