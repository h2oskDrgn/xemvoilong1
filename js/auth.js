/* ============================================================
   DRAGONFILM - auth.js  (shared utilities)
   ============================================================ */

// ---- Toast ----
function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(40px)'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ---- Auth helpers ----
const Auth = {
  getUser() { try { return JSON.parse(localStorage.getItem('xvl_user')); } catch { return null; } },
  saveUser(u) { localStorage.setItem('xvl_user', JSON.stringify(u)); },
  logout() { localStorage.removeItem('xvl_user'); window.location.reload(); },
  register(username, password) {
    if (!username || !password) return { ok: false, msg: 'Vui lòng điền đầy đủ thông tin.' };
    if (username.length < 3) return { ok: false, msg: 'Tên tài khoản ít nhất 3 ký tự.' };
    if (password.length < 4) return { ok: false, msg: 'Mật khẩu ít nhất 4 ký tự.' };
    const users = Auth._getUsers();
    if (users[username]) return { ok: false, msg: 'Tên tài khoản đã tồn tại.' };
    users[username] = { username, password };
    localStorage.setItem('xvl_users', JSON.stringify(users));
    Auth.saveUser({ username });
    return { ok: true };
  },
  login(username, password) {
    if (!username || !password) return { ok: false, msg: 'Vui lòng điền đầy đủ thông tin.' };
    const users = Auth._getUsers();
    const u = users[username];
    if (!u || u.password !== password) return { ok: false, msg: 'Sai tên tài khoản hoặc mật khẩu.' };
    Auth.saveUser({ username });
    return { ok: true };
  },
  _getUsers() { try { return JSON.parse(localStorage.getItem('xvl_users')) || {}; } catch { return {}; } }
};

// ---- History helpers ----
const History = {
  _key: 'xvl_history',
  get() { try { return JSON.parse(localStorage.getItem(this._key)) || []; } catch { return []; } },
  save(list) { localStorage.setItem(this._key, JSON.stringify(list)); },
  add(movie) {
    if (!movie || !movie.slug) return;
    const server = movie._server || 'kkphim';
    const key = `${server}:${movie.slug}:${movie.episode_slug || movie.episode_index0 || 0}`;
    const current = this.get();
    const previous = current.find(m => `${m._server || 'kkphim'}:${m.slug}:${m.episode_slug || m.episode_index0 || 0}` === key) || {};
    let list = current.filter(m => `${m._server || 'kkphim'}:${m.slug}:${m.episode_slug || m.episode_index0 || 0}` !== key);
    list.unshift({ ...previous, ...movie, _server: server, watchedAt: Date.now() });
    if (list.length > 50) list = list.slice(0, 50);
    this.save(list);
  },
  remove(slug) {
    this.save(this.get().filter(m => m.slug !== slug));
  },
  clear() { localStorage.removeItem(this._key); }
};

// ---- Resume time ----
const ResumeTime = {
  key(slug) { return `xvl_time_${slug}`; },
  get(slug) { return parseFloat(localStorage.getItem(this.key(slug))) || 0; },
  set(slug, time) { if (time > 5) localStorage.setItem(this.key(slug), time); }
};

// ---- DOM helpers ----
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }
function qs(params) { return new URLSearchParams(params).toString(); }
function qp(key) { return new URLSearchParams(location.search).get(key); }

// ---- Format duration ----
function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

// ---- Init header auth UI ----
function initHeaderAuth() {
  const user = Auth.getUser();
  const loginBtn = document.getElementById('btn-login');
  const userMenu = document.getElementById('user-menu');
  const avatarEl = document.getElementById('user-avatar');
  const usernameEl = document.getElementById('user-name');

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    if (avatarEl) avatarEl.textContent = user.username.charAt(0).toUpperCase();
    if (usernameEl) usernameEl.textContent = user.username;
  } else {
    if (loginBtn) loginBtn.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
  }

  // Toggle dropdown
  if (avatarEl) {
    avatarEl.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('user-menu')?.classList.toggle('open');
    });
  }

  document.addEventListener('click', () => {
    document.getElementById('user-menu')?.classList.remove('open');
  });

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    Auth.logout();
  });
}

// ---- Modal ----
function initModal() {
  const overlay = document.getElementById('auth-modal');
  if (!overlay) return;

  document.getElementById('btn-login')?.addEventListener('click', () => {
    overlay.classList.add('open');
    setTab('login');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });

  document.getElementById('modal-close')?.addEventListener('click', () => {
    overlay.classList.remove('open');
  });

  // Tabs
  $$('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => setTab(tab.dataset.tab));
  });

  function setTab(t) {
    $$('.modal-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === t));
    $$('.tab-panel').forEach(panel => panel.style.display = panel.dataset.panel === t ? 'block' : 'none');
  }
  setTab('login');

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user')?.value.trim();
    const p = document.getElementById('login-pass')?.value;
    const r = Auth.login(u, p);
    const err = document.getElementById('login-error');
    if (!r.ok) { if (err) { err.textContent = r.msg; err.classList.add('show'); } return; }
    overlay.classList.remove('open');
    showToast(`Chào mừng ${u}! 🎬`);
    setTimeout(() => location.reload(), 600);
  });

  // Register form
  document.getElementById('reg-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('reg-user')?.value.trim();
    const p = document.getElementById('reg-pass')?.value;
    const r = Auth.register(u, p);
    const err = document.getElementById('reg-error');
    if (!r.ok) { if (err) { err.textContent = r.msg; err.classList.add('show'); } return; }
    overlay.classList.remove('open');
    showToast(`Đăng ký thành công! Chào ${u} 🎉`);
    setTimeout(() => location.reload(), 600);
  });
}

// ---- Mobile nav ----
function initMobileNav() {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('mobile-nav');
  toggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    nav?.classList.toggle('open');
  });
  document.addEventListener('click', () => nav?.classList.remove('open'));
}

// ---- Init all ----
document.addEventListener('DOMContentLoaded', () => {
  initHeaderAuth();
  initModal();
  initMobileNav();
  document.body.classList.add('page-enter');
});
