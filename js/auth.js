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

const DRAGONFILM_PRIVATE_STORAGE_KEYS = new Set([
  'dragonfilm_auth_token',
  'dragonfilm_user',
  'dragonfilm_users',
]);

function isPrivateDragonFilmStorageKey(key) {
  return DRAGONFILM_PRIVATE_STORAGE_KEYS.has(String(key || ''));
}

function scheduleCloudUpload() {
  if (typeof window !== 'undefined' && window.DragonFilmCloud) {
    window.DragonFilmCloud.scheduleUpload();
  }
}

// ---- Auth helpers ----
const Auth = {
  getUser() { try { return JSON.parse(localStorage.getItem('dragonfilm_user')); } catch { return null; } },
  getToken() { return localStorage.getItem('dragonfilm_auth_token') || ''; },
  saveUser(u, token = '') {
    localStorage.setItem('dragonfilm_user', JSON.stringify(u));
    if (token) localStorage.setItem('dragonfilm_auth_token', token);
  },
  clearSession() {
    localStorage.removeItem('dragonfilm_user');
    localStorage.removeItem('dragonfilm_auth_token');
  },
  logout() { Auth.clearSession(); window.location.reload(); },
  async register(username, password) {
    const validationError = Auth._validate(username, password);
    if (validationError) return { ok: false, msg: validationError };
    const cloud = window.DragonFilmCloud;
    if (!cloud) return Auth._registerLocal(username, password);

    try {
      const session = await cloud.register(username, password);
      Auth.saveUser(session.user, session.token);
      await cloud.afterSignIn();
      return { ok: true, cloud: true };
    } catch (error) {
      if (cloud.canUseLocalFallback(error)) return Auth._registerLocal(username, password);
      return { ok: false, msg: error.message || 'Không kết nối được server đăng ký.' };
    }
  },
  async login(username, password) {
    const validationError = Auth._validate(username, password);
    if (validationError) return { ok: false, msg: validationError };
    const cloud = window.DragonFilmCloud;
    if (!cloud) return Auth._loginLocal(username, password);

    try {
      const session = await cloud.login(username, password);
      Auth.saveUser(session.user, session.token);
      await cloud.afterSignIn();
      return { ok: true, cloud: true };
    } catch (error) {
      if (cloud.canUseLocalFallback(error)) return Auth._loginLocal(username, password);
      return { ok: false, msg: error.message || 'Không kết nối được server đăng nhập.' };
    }
  },
  _validate(username, password) {
    if (!username || !password) return 'Vui lòng điền đầy đủ thông tin.';
    if (username.length < 3) return 'Tên tài khoản ít nhất 3 ký tự.';
    if (username.length > 32) return 'Tên tài khoản tối đa 32 ký tự.';
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return 'Tên tài khoản chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.';
    if (password.length < 4) return 'Mật khẩu ít nhất 4 ký tự.';
    return '';
  },
  _registerLocal(username, password) {
    const users = Auth._getUsers();
    if (users[username]) return { ok: false, msg: 'Tên tài khoản đã tồn tại.' };
    users[username] = { username, password };
    localStorage.setItem('dragonfilm_users', JSON.stringify(users));
    Auth.saveUser({ username });
    return { ok: true, localOnly: true };
  },
  _loginLocal(username, password) {
    const users = Auth._getUsers();
    const u = users[username];
    if (!u || u.password !== password) return { ok: false, msg: 'Sai tên tài khoản hoặc mật khẩu.' };
    Auth.saveUser({ username });
    return { ok: true, localOnly: true };
  },
  _getUsers() { try { return JSON.parse(localStorage.getItem('dragonfilm_users')) || {}; } catch { return {}; } }
};

// ---- History helpers ----
const History = {
  _key: 'dragonfilm_history',
  get() { try { return JSON.parse(localStorage.getItem(this._key)) || []; } catch { return []; } },
  save(list) {
    localStorage.setItem(this._key, JSON.stringify(list));
    scheduleCloudUpload();
  },
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
  clear() {
    localStorage.removeItem(this._key);
    scheduleCloudUpload();
  }
};

// ---- Personal movie lists ----
const MovieLibrary = {
  keys: {
    watchLater: 'dragonfilm_watch_later',
    liked: 'dragonfilm_liked_movies',
  },
  labels: {
    watchLater: 'Phim xem sau',
    liked: 'Phim yêu thích',
  },
  get(type) {
    try {
      return JSON.parse(localStorage.getItem(this.keys[type])) || [];
    } catch {
      return [];
    }
  },
  save(type, list) {
    if (!this.keys[type]) return;
    localStorage.setItem(this.keys[type], JSON.stringify(list || []));
    scheduleCloudUpload();
  },
  keyOf(movie) {
    if (!movie) return '';
    return `${movie._server || 'kkphim'}:${movie.slug || movie.id || movie.name || ''}`;
  },
  normalize(movie) {
    const serverSlugs = movie?._serverSlugs || (movie?.slug ? { [movie._server || 'kkphim']: movie.slug } : {});
    return {
      slug: movie?.slug || '',
      name: movie?.name || movie?.title || movie?.origin_name || '',
      origin_name: movie?.origin_name || movie?.original_title || '',
      poster_url: movie?.poster_url || movie?.thumb_url || movie?.tmdb?.poster_url || movie?.omdb?.poster || movie?.anilist?.cover_url || '',
      year: movie?.year || movie?.tmdb?.year || movie?.omdb?.year || movie?.anilist?.season_year || '',
      _server: movie?._server || Object.keys(serverSlugs)[0] || 'kkphim',
      _sources: movie?._sources || Object.keys(serverSlugs),
      _serverSlugs: serverSlugs,
      addedAt: Number(movie?.addedAt || Date.now()),
    };
  },
  has(type, movie) {
    const key = this.keyOf(movie);
    return Boolean(key && this.get(type).some(item => this.keyOf(item) === key));
  },
  add(type, movie) {
    if (!this.keys[type] || !movie?.slug) return false;
    const item = this.normalize(movie);
    const key = this.keyOf(item);
    const list = this.get(type).filter(existing => this.keyOf(existing) !== key);
    list.unshift(item);
    this.save(type, list.slice(0, 200));
    return true;
  },
  remove(type, movie) {
    if (!this.keys[type]) return false;
    const key = this.keyOf(movie);
    this.save(type, this.get(type).filter(item => this.keyOf(item) !== key));
    return true;
  },
  toggle(type, movie) {
    if (this.has(type, movie)) {
      this.remove(type, movie);
      return false;
    }
    this.add(type, movie);
    return true;
  },
  clear(type) {
    if (this.keys[type]) {
      localStorage.removeItem(this.keys[type]);
      scheduleCloudUpload();
    }
  },
  exportData() {
    return {
      watchLater: this.get('watchLater'),
      liked: this.get('liked'),
    };
  },
  importData(data = {}) {
    ['watchLater', 'liked'].forEach(type => {
      const incoming = Array.isArray(data[type]) ? data[type] : [];
      const byKey = new Map();
      [...this.get(type), ...incoming].forEach(item => {
        const normalized = this.normalize(item);
        const key = this.keyOf(normalized);
        if (!key || !normalized.slug) return;
        const existing = byKey.get(key);
        if (!existing || Number(normalized.addedAt || 0) > Number(existing.addedAt || 0)) {
          byKey.set(key, normalized);
        }
      });
      this.save(type, [...byKey.values()].sort((a, b) => Number(b.addedAt || 0) - Number(a.addedAt || 0)));
    });
  },
};

// ---- Resume time ----
const ResumeTime = {
  key(slug) { return `dragonfilm_time_${slug}`; },
  get(slug) { return parseFloat(localStorage.getItem(this.key(slug))) || 0; },
  set(slug, time) {
    if (time > 5) {
      localStorage.setItem(this.key(slug), time);
      scheduleCloudUpload();
    }
  }
};

// ---- Import/export all DragonFilm data ----
const DragonFilmData = {
  prefixes: ['dragonfilm_'],
  managedKeys: new Set(['dragonfilm_history', 'dragonfilm_watch_later', 'dragonfilm_liked_movies']),

  exportAll() {
    const payload = {
      app: 'dragonfilm',
      type: 'all-data',
      version: 2,
      exportedAt: new Date().toISOString(),
      localStorage: this.getStorage(),
      history: History.get(),
      resumeTimes: this.getResumeTimes(),
      movieLibrary: MovieLibrary.exportData(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `dragonfilm-data-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Đã xuất mọi dữ liệu DragonFilm');
  },

  chooseImportFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.hidden = true;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.remove();
      if (file) this.importFile(file);
    });
    document.body.appendChild(input);
    input.click();
  },

  importFile(file, onSuccess) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.importPayload(JSON.parse(reader.result));
        this.refreshAfterImport();
        if (typeof onSuccess === 'function') onSuccess();
        showToast('Đã nhập mọi dữ liệu DragonFilm');
      } catch {
        showToast('File dữ liệu không hợp lệ', 'error');
      }
    };
    reader.readAsText(file);
  },

  importPayload(payload) {
    const importStorage = this.getImportStorage(payload);
    const importedHistory = this.getImportedHistory(payload, importStorage);
    const importedResumeTimes = this.getImportedResumeTimes(payload, importStorage);
    const importedMovieLibrary = this.getImportedMovieLibrary(payload, importStorage);
    const hasStorageData = importStorage && Object.keys(importStorage).some(key => this.isStorageKey(key) && !isPrivateDragonFilmStorageKey(key));
    const hasImportableData = Array.isArray(importedHistory)
      || Object.keys(importedResumeTimes).length > 0
      || Object.keys(importedMovieLibrary).length > 0
      || hasStorageData;

    if (!hasImportableData) throw new Error('invalid data');

    if (hasStorageData) this.restoreStorage(importStorage);
    if (Array.isArray(importedHistory)) this.mergeHistory(importedHistory);
    this.restoreResumeTimes(importedResumeTimes);
    MovieLibrary.importData(importedMovieLibrary);
  },

  getStorage() {
    return Object.keys(localStorage)
      .filter(key => this.isStorageKey(key) && !isPrivateDragonFilmStorageKey(key))
      .sort()
      .reduce((data, key) => {
        data[key] = localStorage.getItem(key);
        return data;
      }, {});
  },

  getImportStorage(payload) {
    const storage = payload?.localStorage || payload?.storage;
    return storage && typeof storage === 'object' && !Array.isArray(storage) ? storage : null;
  },

  isStorageKey(key) {
    return this.prefixes.some(prefix => String(key || '').startsWith(prefix));
  },

  isManagedStorageKey(key) {
    return this.managedKeys.has(key) || String(key || '').startsWith('dragonfilm_time_');
  },

  restoreStorage(storage) {
    Object.entries(storage || {}).forEach(([key, value]) => {
      if (!this.isStorageKey(key) || this.isManagedStorageKey(key) || isPrivateDragonFilmStorageKey(key)) return;
      try {
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      } catch {
        // Ignore storage quota/private mode limits and continue importing.
      }
    });
  },

  getImportedHistory(payload, storage) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.history)) return payload.history;
    const storedHistory = this.parseStoredJson(storage?.dragonfilm_history);
    return Array.isArray(storedHistory) ? storedHistory : null;
  },

  getImportedResumeTimes(payload, storage) {
    const times = {};
    if (payload?.resumeTimes && typeof payload.resumeTimes === 'object' && !Array.isArray(payload.resumeTimes)) {
      Object.assign(times, payload.resumeTimes);
    }
    Object.entries(storage || {}).forEach(([key, value]) => {
      if (String(key).startsWith('dragonfilm_time_')) {
        times[key.replace('dragonfilm_time_', '')] = parseFloat(value) || 0;
      }
    });
    return times;
  },

  getImportedMovieLibrary(payload, storage) {
    const library = {};
    const directLibrary = payload?.movieLibrary && typeof payload.movieLibrary === 'object' && !Array.isArray(payload.movieLibrary)
      ? payload.movieLibrary
      : {};
    const watchLater = Array.isArray(directLibrary.watchLater)
      ? directLibrary.watchLater
      : this.parseStoredJson(storage?.dragonfilm_watch_later);
    const liked = Array.isArray(directLibrary.liked)
      ? directLibrary.liked
      : this.parseStoredJson(storage?.dragonfilm_liked_movies);

    if (Array.isArray(watchLater)) library.watchLater = watchLater;
    if (Array.isArray(liked)) library.liked = liked;
    return library;
  },

  parseStoredJson(value) {
    if (typeof value !== 'string') return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  },

  getResumeTimes() {
    const times = {};
    Object.keys(localStorage)
      .filter(key => key.startsWith('dragonfilm_time_'))
      .forEach(key => {
        times[key.replace('dragonfilm_time_', '')] = parseFloat(localStorage.getItem(key)) || 0;
      });
    return times;
  },

  restoreResumeTimes(times) {
    Object.entries(times || {}).forEach(([slug, time]) => {
      const value = parseFloat(time);
      if (slug && value > 5) ResumeTime.set(slug, value);
    });
  },

  mergeHistory(importedHistory) {
    const byKey = new Map();
    [...History.get(), ...importedHistory].forEach(item => {
      if (!item || !item.slug) return;
      const key = this.historyItemKey(item);
      const existing = byKey.get(key);
      if (!existing || Number(item.watchedAt || 0) > Number(existing.watchedAt || 0)) {
        byKey.set(key, {
          slug: item.slug,
          name: item.name || item.slug,
          poster_url: item.poster_url || '',
          year: item.year || '',
          _server: item._server || 'kkphim',
          source_name: item.source_name || '',
          episode_name: item.episode_name || '',
          episode_slug: item.episode_slug || '',
          episode_server_name: item.episode_server_name || '',
          episode_server_idx: Number(item.episode_server_idx || 0),
          episode_index0: Number(item.episode_index0 || 0),
          episode_number: Number(item.episode_number || 0),
          watched_seconds: Number(item.watched_seconds || 0),
          resume_key: item.resume_key || '',
          watchedAt: Number(item.watchedAt || Date.now()),
        });
      }
    });
    History.save([...byKey.values()]
      .sort((a, b) => Number(b.watchedAt || 0) - Number(a.watchedAt || 0))
      .slice(0, 50));
  },

  historyItemKey(item) {
    const server = item._server || 'kkphim';
    const episode = item.episode_slug || item.episode_index0 || 0;
    return `${server}:${item.slug}:${episode}`;
  },

  refreshAfterImport() {
    if (typeof renderActiveHistoryTab === 'function') renderActiveHistoryTab();
    if (typeof renderMovieLibraryActions === 'function') renderMovieLibraryActions();
    if (typeof libraryMovieFromElement === 'function') {
      document.querySelectorAll('.movie-action-btn[data-library-action]').forEach(btn => {
        btn.classList.toggle('active', MovieLibrary.has(btn.dataset.libraryAction, libraryMovieFromElement(btn)));
      });
    }
    document.dispatchEvent(new CustomEvent('dragonfilm:data-imported'));
  },
};

if (typeof window !== 'undefined') window.DragonFilmData = DragonFilmData;

const DragonFilmCloud = {
  apiBase: (typeof window !== 'undefined' && window.DRAGONFILM_API_BASE ? window.DRAGONFILM_API_BASE : '').replace(/\/$/, ''),
  uploadTimer: null,
  syncing: false,

  hasSession() {
    return Boolean(Auth.getToken());
  },

  async register(username, password) {
    return this.request('/api/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ username, password }),
    });
  },

  async login(username, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ username, password }),
    });
  },

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    const token = Auth.getToken();
    if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(`${this.apiBase}${path}`, {
        ...options,
        headers,
      });
    } catch {
      const error = new Error('Không kết nối được server Vercel.');
      error.status = 0;
      throw error;
    }

    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }

    if (!response.ok || payload?.ok === false) {
      const error = new Error(payload?.error || `Server trả về lỗi ${response.status}.`);
      error.status = response.status;
      error.code = payload?.code;
      throw error;
    }

    return payload || { ok: true };
  },

  async afterSignIn() {
    if (!this.hasSession()) return;
    this.setStatus('Đang đồng bộ Supabase');

    try {
      const cloudData = await this.download();
      if (this.isImportable(cloudData)) DragonFilmData.importPayload(cloudData);
      await this.uploadNow();
      DragonFilmData.refreshAfterImport();
      this.setStatus('Đã đồng bộ Supabase');
    } catch (error) {
      console.warn(error);
      this.setStatus('Chưa đồng bộ Supabase', true);
    }
  },

  async syncOnLoad() {
    if (!this.hasSession()) return;
    this.setStatus('Đang đồng bộ Supabase');

    try {
      const cloudData = await this.download();
      if (this.isImportable(cloudData)) DragonFilmData.importPayload(cloudData);
      await this.uploadNow();
      DragonFilmData.refreshAfterImport();
      this.setStatus('Đã đồng bộ Supabase');
    } catch (error) {
      console.warn(error);
      this.setStatus('Chưa đồng bộ Supabase', true);
    }
  },

  async download() {
    const response = await this.request('/api/user-data');
    return response.data || null;
  },

  scheduleUpload() {
    if (!this.hasSession()) return;
    clearTimeout(this.uploadTimer);
    this.uploadTimer = setTimeout(() => {
      this.uploadNow().catch(error => {
        console.warn(error);
        this.setStatus('Chưa đồng bộ Supabase', true);
      });
    }, 1200);
  },

  async uploadNow() {
    if (!this.hasSession() || this.syncing) return;
    this.syncing = true;

    try {
      await this.request('/api/user-data', {
        method: 'POST',
        body: JSON.stringify({ data: this.buildPayload() }),
      });
      this.setStatus('Đã đồng bộ Supabase');
    } finally {
      this.syncing = false;
    }
  },

  buildPayload() {
    return {
      app: 'dragonfilm',
      type: 'cloud-data',
      version: 3,
      savedAt: new Date().toISOString(),
      localStorage: DragonFilmData.getStorage(),
      history: History.get(),
      resumeTimes: DragonFilmData.getResumeTimes(),
      movieLibrary: MovieLibrary.exportData(),
    };
  },

  isImportable(data) {
    return Boolean(data && (
      Array.isArray(data.history)
      || Object.keys(data.resumeTimes || {}).length
      || Object.keys(data.movieLibrary || {}).length
      || Object.keys(data.localStorage || data.storage || {}).length
    ));
  },

  canUseLocalFallback(error) {
    const localHost = ['localhost', '127.0.0.1', ''].includes(location.hostname);
    return location.protocol === 'file:' || (localHost && (!error?.status || error.status === 404));
  },

  setStatus(text, isError = false) {
    document.querySelectorAll('[data-cloud-status]').forEach(el => {
      el.textContent = text;
      el.classList.toggle('sync-error', Boolean(isError));
    });
  },
};

if (typeof window !== 'undefined') window.DragonFilmCloud = DragonFilmCloud;

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

// ---- Guest viewing notice ----
function initGuestNotice() {
  const key = 'dragonfilm_guest_notice_seen';
  if (localStorage.getItem(key)) return;
  if (document.getElementById('guest-notice')) return;

  const overlay = document.createElement('div');
  overlay.className = 'guest-notice-overlay';
  overlay.id = 'guest-notice';
  overlay.innerHTML = `
    <div class="guest-notice" role="dialog" aria-modal="true" aria-labelledby="guest-notice-title">
      <button class="guest-notice-close" type="button" aria-label="Đóng thông báo">×</button>
      <div class="guest-notice-kicker">DragonFilm</div>
      <h2 id="guest-notice-title">Xem phim ngay, không cần tài khoản</h2>
      <p>Bạn có thể chọn phim và xem liền. Khi đăng nhập, lịch sử xem, phim xem sau và phim yêu thích sẽ được đồng bộ qua Supabase để dùng trên nhiều thiết bị.</p>
      <button class="guest-notice-action" type="button">Đã hiểu</button>
    </div>`;

  const close = () => {
    localStorage.setItem(key, '1');
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 220);
  };

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  overlay.querySelector('.guest-notice-close')?.addEventListener('click', close);
  overlay.querySelector('.guest-notice-action')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

// ---- Init header auth UI ----
function initHeaderAuth() {
  const user = Auth.getUser();
  const loginBtn = document.getElementById('btn-login');
  const userMenu = document.getElementById('user-menu');
  const avatarEl = document.getElementById('user-avatar');
  const usernameEl = document.getElementById('user-name');
  const userSubEl = userMenu?.querySelector('.user-info-sub');

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    if (avatarEl) avatarEl.textContent = user.username.charAt(0).toUpperCase();
    if (usernameEl) usernameEl.textContent = user.username;
    if (userSubEl) {
      userSubEl.setAttribute('data-cloud-status', '');
      userSubEl.textContent = Auth.getToken() ? 'Đồng bộ Supabase' : 'Lưu cục bộ';
    }
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

  document.querySelectorAll('[data-data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('user-menu')?.classList.remove('open');
      if (btn.dataset.dataAction === 'export') DragonFilmData.exportAll();
      if (btn.dataset.dataAction === 'import') DragonFilmData.chooseImportFile();
    });
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
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const submitBtn = form.querySelector('[type="submit"]');
    const u = document.getElementById('login-user')?.value.trim();
    const p = document.getElementById('login-pass')?.value;
    const err = document.getElementById('login-error');
    if (err) { err.textContent = ''; err.classList.remove('show'); }
    if (submitBtn) submitBtn.disabled = true;
    const r = await Auth.login(u, p);
    if (submitBtn) submitBtn.disabled = false;
    if (!r.ok) { if (err) { err.textContent = r.msg; err.classList.add('show'); } return; }
    overlay.classList.remove('open');
    showToast(r.localOnly ? `Chào mừng ${u}! Dữ liệu đang lưu cục bộ.` : `Chào mừng ${u}! Đã bật đồng bộ.`);
    setTimeout(() => location.reload(), 600);
  });

  // Register form
  document.getElementById('reg-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const submitBtn = form.querySelector('[type="submit"]');
    const u = document.getElementById('reg-user')?.value.trim();
    const p = document.getElementById('reg-pass')?.value;
    const err = document.getElementById('reg-error');
    if (err) { err.textContent = ''; err.classList.remove('show'); }
    if (submitBtn) submitBtn.disabled = true;
    const r = await Auth.register(u, p);
    if (submitBtn) submitBtn.disabled = false;
    if (!r.ok) { if (err) { err.textContent = r.msg; err.classList.add('show'); } return; }
    overlay.classList.remove('open');
    showToast(r.localOnly ? `Đăng ký cục bộ thành công, chào ${u}.` : `Đăng ký thành công, chào ${u}. Đã bật đồng bộ.`);
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

// ---- Header search redirect for secondary pages ----
function initHeaderSearchRedirect() {
  document.querySelectorAll('[data-header-search]').forEach(search => {
    const input = search.querySelector('input');
    const button = search.querySelector('button');
    if (!input || !button) return;

    const go = () => {
      const q = input.value.trim();
      window.location.href = q ? `index.html?q=${encodeURIComponent(q)}` : 'index.html';
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        go();
      }
    });
    button.addEventListener('click', go);
  });
}

// ---- Init all ----
document.addEventListener('DOMContentLoaded', () => {
  initHeaderAuth();
  initModal();
  initGuestNotice();
  initMobileNav();
  initHeaderSearchRedirect();
  DragonFilmCloud.syncOnLoad();
  document.body.classList.add('page-enter');
});
