const HISTORY_TAB_TYPES = ['history', 'watchLater', 'liked'];
let activeHistoryTab = 'history';
const DRAGONFILM_DATA_PREFIXES = ['dragonfilm_'];
const DRAGONFILM_MANAGED_STORAGE_KEYS = new Set(['dragonfilm_history', 'dragonfilm_watch_later', 'dragonfilm_liked_movies']);
const HISTORY_PRIVATE_STORAGE_KEYS = new Set(['dragonfilm_auth_token', 'dragonfilm_user', 'dragonfilm_users']);

document.addEventListener('DOMContentLoaded', () => {
  activeHistoryTab = getHistoryTabFromHash();
  bindHistoryTabs();
  syncHistoryTabButtons();
  renderActiveHistoryTab();
  bindHistoryImportExport();
  window.addEventListener('hashchange', () => {
    const tab = getHistoryTabFromHash();
    if (tab === activeHistoryTab) return;
    activeHistoryTab = tab;
    syncHistoryTabButtons();
    renderActiveHistoryTab();
  });
  document.getElementById('history-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.history-remove-btn');
    if (!btn) return;
    MovieLibrary.remove(btn.dataset.listType, { slug: btn.dataset.slug, _server: btn.dataset.server });
    renderActiveHistoryTab();
    showToast('Đã xóa khỏi danh sách');
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    const label = activeHistoryTab === 'history' ? 'lịch sử xem' : (activeHistoryTab === 'watchLater' ? 'phim xem sau' : 'phim yêu thích');
    if (confirm(`Xóa toàn bộ ${label}?`)) {
      if (activeHistoryTab === 'history') {
        History.clear();
        Object.keys(localStorage).filter(k => k.startsWith('dragonfilm_time_')).forEach(k => localStorage.removeItem(k));
        if (typeof scheduleCloudUpload === 'function') scheduleCloudUpload();
      } else {
        MovieLibrary.clear(activeHistoryTab);
      }
      renderActiveHistoryTab();
      showToast(`Đã xóa ${label}`);
    }
  });
});

function bindHistoryTabs() {
  document.querySelectorAll('.history-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeHistoryTab = tab.dataset.historyTab || 'history';
      syncHistoryTabButtons();
      updateHistoryHash(activeHistoryTab);
      renderActiveHistoryTab();
    });
  });
}

function getHistoryTabFromHash() {
  const hashTab = decodeURIComponent(location.hash.replace('#', ''));
  return HISTORY_TAB_TYPES.includes(hashTab) ? hashTab : 'history';
}

function syncHistoryTabButtons() {
  document.querySelectorAll('.history-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.historyTab === activeHistoryTab);
  });
}

function updateHistoryHash(tab) {
  const nextUrl = `${location.pathname}${location.search}${tab === 'history' ? '' : `#${tab}`}`;
  window.history.replaceState({}, '', nextUrl);
}

function renderActiveHistoryTab() {
  if (activeHistoryTab === 'history') renderHistory();
  else renderMovieList(activeHistoryTab);
}

function bindHistoryImportExport() {
  const importInput = document.getElementById('history-import-file');

  document.getElementById('btn-export-history')?.addEventListener('click', exportHistory);
  document.getElementById('btn-import-history')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', importHistoryFile);
}

function exportHistory() {
  if (window.DragonFilmData) {
    DragonFilmData.exportAll();
    return;
  }

  const payload = {
    app: 'dragonfilm',
    type: 'all-data',
    version: 2,
    exportedAt: new Date().toISOString(),
    localStorage: getDragonFilmStorage(),
    history: History.get(),
    resumeTimes: getResumeTimes(),
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
}

function importHistoryFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (window.DragonFilmData) {
    DragonFilmData.importFile(file, renderActiveHistoryTab);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      const importStorage = getImportStorage(payload);
      const importedHistory = getImportedHistory(payload, importStorage);
      const importedResumeTimes = getImportedResumeTimes(payload, importStorage);
      const importedMovieLibrary = getImportedMovieLibrary(payload, importStorage);
      const hasStorageData = importStorage && Object.keys(importStorage).some(isDragonFilmStorageKey);
      const hasImportableData = Array.isArray(importedHistory)
        || Object.keys(importedResumeTimes).length > 0
        || Object.keys(importedMovieLibrary).length > 0
        || hasStorageData;

      if (!hasImportableData) throw new Error('invalid data');

      if (hasStorageData) restoreDragonFilmStorage(importStorage);
      if (Array.isArray(importedHistory)) mergeHistory(importedHistory);
      restoreResumeTimes(importedResumeTimes);
      MovieLibrary.importData(importedMovieLibrary);
      renderActiveHistoryTab();
      showToast('Đã nhập mọi dữ liệu DragonFilm');
    } catch (error) {
      showToast('File dữ liệu không hợp lệ', 'error');
    }
  };
  reader.readAsText(file);
}

function getDragonFilmStorage() {
  return Object.keys(localStorage)
    .filter(key => isDragonFilmStorageKey(key) && !isPrivateHistoryStorageKey(key))
    .sort()
    .reduce((data, key) => {
      data[key] = localStorage.getItem(key);
      return data;
    }, {});
}

function getImportStorage(payload) {
  const storage = payload?.localStorage || payload?.storage;
  return storage && typeof storage === 'object' && !Array.isArray(storage) ? storage : null;
}

function isDragonFilmStorageKey(key) {
  return DRAGONFILM_DATA_PREFIXES.some(prefix => String(key || '').startsWith(prefix));
}

function isPrivateHistoryStorageKey(key) {
  return HISTORY_PRIVATE_STORAGE_KEYS.has(String(key || ''));
}

function isManagedDragonFilmStorageKey(key) {
  return DRAGONFILM_MANAGED_STORAGE_KEYS.has(key) || String(key || '').startsWith('dragonfilm_time_');
}

function restoreDragonFilmStorage(storage) {
  Object.entries(storage || {}).forEach(([key, value]) => {
    if (!isDragonFilmStorageKey(key) || isManagedDragonFilmStorageKey(key) || isPrivateHistoryStorageKey(key)) return;
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch {
      // Ignore quota/private mode limits and continue with the rest of the import.
    }
  });
}

function getImportedHistory(payload, storage) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.history)) return payload.history;
  const storedHistory = parseStoredJson(storage?.dragonfilm_history);
  return Array.isArray(storedHistory) ? storedHistory : null;
}

function getImportedResumeTimes(payload, storage) {
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
}

function getImportedMovieLibrary(payload, storage) {
  const library = {};
  const directLibrary = payload?.movieLibrary && typeof payload.movieLibrary === 'object' && !Array.isArray(payload.movieLibrary)
    ? payload.movieLibrary
    : {};
  const watchLater = Array.isArray(directLibrary.watchLater)
    ? directLibrary.watchLater
    : parseStoredJson(storage?.dragonfilm_watch_later);
  const liked = Array.isArray(directLibrary.liked)
    ? directLibrary.liked
    : parseStoredJson(storage?.dragonfilm_liked_movies);

  if (Array.isArray(watchLater)) library.watchLater = watchLater;
  if (Array.isArray(liked)) library.liked = liked;
  return library;
}

function parseStoredJson(value) {
  if (typeof value !== 'string') return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function getResumeTimes() {
  const times = {};
  Object.keys(localStorage)
    .filter(key => key.startsWith('dragonfilm_time_'))
    .forEach(key => {
      times[key.replace('dragonfilm_time_', '')] = parseFloat(localStorage.getItem(key)) || 0;
    });
  return times;
}

function restoreResumeTimes(times) {
  Object.entries(times || {}).forEach(([slug, time]) => {
    const value = parseFloat(time);
    if (slug && value > 5) ResumeTime.set(slug, value);
  });
}

function mergeHistory(importedHistory) {
  const byKey = new Map();
  [...History.get(), ...importedHistory].forEach(item => {
    if (!item || !item.slug) return;
    const key = historyItemKey(item);
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
  const merged = [...byKey.values()]
    .sort((a, b) => Number(b.watchedAt || 0) - Number(a.watchedAt || 0))
    .slice(0, 50);
  History.save(merged);
}

function movieListHref(m) {
  const params = new URLSearchParams({
    slug: m.slug,
    server: m._server || 'kkphim',
  });
  const sources = Object.entries(m._serverSlugs || {})
    .filter(([, slug]) => slug)
    .map(([server, slug]) => `${server}:${encodeURIComponent(slug)}`)
    .join('|');
  if (sources) params.set('sources', sources);
  return `movie.html?${params.toString()}`;
}

function renderMovieList(type) {
  const list = MovieLibrary.get(type);
  const el = document.getElementById('history-list');
  const countEl = document.getElementById('history-count');
  const title = type === 'watchLater' ? 'Phim Xem Sau' : 'Phim Yêu Thích';
  const emptyText = type === 'watchLater' ? 'Chưa có phim xem sau' : 'Chưa có phim yêu thích';
  document.querySelector('.page-header-title').textContent = title;
  document.querySelector('.history-note').textContent = type === 'watchLater'
    ? 'Phim xem sau được lưu cục bộ và tự đồng bộ Supabase khi bạn đăng nhập.'
    : 'Phim yêu thích được lưu cục bộ và tự đồng bộ Supabase khi bạn đăng nhập.';
  if (countEl) countEl.textContent = list.length ? `${list.length} phim` : 'Chưa có phim nào';
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="icon history-empty-icon">♡</div>
      <h3>${emptyText}</h3>
      <p>Bấm nút trên poster hoặc trang xem phim để lưu vào đây.</p>
      <a href="index.html" class="btn-primary history-empty-cta">Tìm Phim</a>
    </div>`;
    return;
  }

  el.innerHTML = list.map(m => {
    const dateStr = formatHistoryDate(m.addedAt);
    const serverLabel = serverName(m._server);
    const imgEl = historyPoster(m, '♡');

    return `<div class="history-item">
      ${imgEl}
      <a class="history-info" href="${esc(movieListHref(m))}">
        <div class="history-title">${esc(m.name)}</div>
        <div class="history-meta">${m.year ? esc(m.year) + ' · ' : ''}${esc(serverLabel)} · đã lưu ${dateStr}</div>
        ${m.origin_name ? `<div class="history-detail-row"><span>${esc(m.origin_name)}</span></div>` : ''}
      </a>
      <button class="history-remove-btn" type="button" data-list-type="${esc(type)}" data-slug="${esc(m.slug)}" data-server="${esc(m._server || 'kkphim')}">Xóa</button>
    </div>`;
  }).join('');
}

function renderHistory() {
  const list    = History.get();
  const el      = document.getElementById('history-list');
  const countEl = document.getElementById('history-count');
  document.querySelector('.page-header-title').textContent = 'Lịch Sử Xem';
  document.querySelector('.history-note').textContent = 'Lịch sử xem, thời gian xem dở, xem sau và yêu thích được lưu cục bộ, sau đó tự đồng bộ Supabase khi bạn đăng nhập.';
  if (!el) return;

  if (countEl) countEl.textContent = list.length ? `${list.length} phim đã xem` : 'Chưa có phim nào';

  if (!list.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="icon history-empty-icon">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M10 8l6 4-6 4V8z"/></svg>
      </div>
      <h3>Chưa có lịch sử xem</h3>
      <p>Các phim bạn đã xem sẽ hiện ở đây.</p>
      <a href="index.html" class="btn-primary history-empty-cta">Xem Phim Ngay</a>
    </div>`;
    return;
  }

  el.innerHTML = list.map(m => {
    const time   = Number(m.watched_seconds || 0) || (m.resume_key ? ResumeTime.get(m.resume_key) : 0) || ResumeTime.get(m.slug);
    const dateStr = formatHistoryDate(m.watchedAt);
    const episodeLabel = m.episode_name || (m.episode_number ? `Tập ${m.episode_number}` : '');
    const serverLabel = m.source_name || serverName(m._server);
    const epParams = new URLSearchParams({
      slug: m.slug,
      server: m._server || 'kkphim',
    });
    if (m.episode_server_idx !== undefined) epParams.set('epServer', Number(m.episode_server_idx || 0));
    if (m.episode_index0 !== undefined) epParams.set('ep', Number(m.episode_index0 || 0));
    const imgEl = historyPoster(m, '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M10 8l6 4-6 4V8z"/></svg>');

    return `<a class="history-item" href="movie.html?${epParams.toString()}">
      ${imgEl}
      <div class="history-info">
        <div class="history-title">${esc(m.name)}</div>
        <div class="history-meta">${m.year ? m.year + ' · ' : ''}${esc(serverLabel)} · ${dateStr}</div>
        <div class="history-detail-row">
          ${episodeLabel ? `<span>${esc(episodeLabel)}</span>` : '<span>Chưa rõ tập</span>'}
          <span>${time > 5 ? `Đang xem tới ${fmtTime(time)}` : 'Chưa có mốc phút'}</span>
        </div>
        ${time > 5 ? `
        <div class="history-progress">
          <div class="history-progress-caption">${esc(episodeLabel || 'Chưa rõ tập')} · phút ${fmtTime(time)}</div>
          <div class="progress-bar-wrap"><div class="progress-bar-fill history-progress-fill"></div></div>
        </div>` : ''}
      </div>
      <div class="history-play-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </div>
    </a>`;
  }).join('');
}

function historyItemKey(item) {
  const server = item._server || 'kkphim';
  const episode = item.episode_slug || item.episode_index0 || 0;
  return `${server}:${item.slug}:${episode}`;
}

function serverName(server) {
  if (server === 'ophim') return 'Server 2';
  if (server === 'nguonc') return 'Server 3';
  return 'Server 1';
}

function formatHistoryDate(value) {
  const date = new Date(value || Date.now());
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return safeDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function historyPoster(movie, fallback) {
  if (movie.poster_url) {
    return `<img class="history-poster" src="${esc(movie.poster_url)}" alt="${esc(movie.name)}" onerror="this.outerHTML='${escAttr(historyPosterPlaceholder(fallback))}'">`;
  }
  return historyPosterPlaceholder(fallback);
}

function historyPosterPlaceholder(content) {
  return `<div class="history-poster history-poster-placeholder">${content}</div>`;
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(s) {
  return esc(s).replace(/'/g, '&#039;');
}
