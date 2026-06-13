/* ============================================================
   APP CORE  —  PR.47
============================================================ */

const App = (() => {

  const SECTIONS = {
    timer:    { el: 'section-timer',    title: 'Reloj'     },
    calendar: { el: 'section-calendar', title: 'Agenda'    },
    users:    { el: 'section-users',    title: 'Usuarios'  }
  };

  function navigate(key) {
    if (!SECTIONS[key]) return;
    document.querySelector('.pdf-view-overlay')?.remove(); // close PDF overlay on tab switch
    closeModal(); // close any open modal (e.g. calendar routine view) on tab switch

    Object.entries(SECTIONS).forEach(([k, v]) => {
      document.getElementById(v.el).classList.toggle('active', k === key);
    });
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === key);
    });
    setTitle(SECTIONS[key].title);

    // Sincronizar body state con el timer al cambiar de sección
    if (key === 'timer') {
      // Volvemos al timer → restaurar colores según estado actual
      if (typeof Timer !== 'undefined') Timer.syncBodyState();
    } else {
      // Salimos del timer → limpiar body state para que no afecte otras secciones
      document.body.classList.remove('sw-running','it-prep','it-exercise','it-rest');
    }

    // Cuando se entra al calendario, leer localStorage fresco (puede haber cambios de usuarios.js)
    if (key === 'calendar' && typeof Calendar !== 'undefined') {
      Calendar.reload();
    }

    // Manage FAB visibility — never reset the sub-view so state is preserved
    // when the user switches tabs and comes back (e.g. mid-routine → timer → back)
    if (key === 'users') {
      const onList = !document.getElementById('users-list-view').classList.contains('hidden');
      document.getElementById('add-user-btn').classList.toggle('hidden', !onList);
    } else {
      document.getElementById('add-user-btn').classList.add('hidden');
    }
  }

  function setTitle(t) {
    document.getElementById('page-title').textContent = t;
  }

  function openModal(title, bodyHTML) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML    = bodyHTML;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
  }

  let toastTimer;
  function toast(msg, dur = 2200) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), dur);
  }

  // ── PWA standalone height fix ──────────────────────────────
  // In Safari, window.innerHeight is short (browser chrome takes space).
  // In PWA standalone there's no chrome, but CSS 100dvh/100% can still
  // inherit the Safari measurement. Solution: use window.screen.height,
  // which is always the physical screen height in CSS px (e.g. 852 on
  // iPhone 16) and never changes based on browser chrome.
  function fixPWAHeight() {
    if (!window.navigator.standalone) return;
    const h = window.screen.height + 'px';
    document.documentElement.style.height = h;
    document.body.style.height            = h;
  }

  function init() {
    fixPWAHeight();

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.section));
    });

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') closeModal();
    });

    Timer.init();
    Calendar.init();
    Users.init();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    navigate('timer');
  }

  return { init, navigate, openModal, closeModal, toast, setTitle };
})();

document.addEventListener('DOMContentLoaded', App.init);
