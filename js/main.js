/* ============================================================
   DRAGONFILM - main.js  (homepage logic)
   ============================================================ */

// ---- State ----
const state = {
  page: 1,
  totalPages: 1,
  mode: 'latest',   // latest | search | genre | country | type
  query: '',
  genre: '',
  country: '',
  type: '',
  loading: false,
};

const HOME_RECOMMEND_SERVERS = ['kkphim', 'nguonc'];
const HOME_SEARCH_SERVERS = Object.keys(API.servers);

const GENRES = [
  { name: 'Hành Động', slug: 'hanh-dong' }, { name: 'Tình Cảm', slug: 'tinh-cam' },
  { name: 'Hài Hước', slug: 'hai-huoc' }, { name: 'Cổ Trang', slug: 'co-trang' },
  { name: 'Kinh Dị', slug: 'kinh-di' }, { name: 'Anime', slug: 'hoat-hinh' },
  { name: 'Viễn Tưởng', slug: 'vien-tuong' }, { name: 'Tâm Lý', slug: 'tam-ly' },
  { name: 'Võ Thuật', slug: 'vo-thuat' }, { name: 'Phiêu Lưu', slug: 'phieu-luu' },
  { name: 'Gia Đình', slug: 'gia-dinh' }, { name: 'Khoa Học', slug: 'khoa-hoc' },
];

const FALLBACK_ALL_GENRES = [
  ...GENRES,
  { name: 'Âm Nhạc', slug: 'am-nhac' },
  { name: 'Bí Ẩn', slug: 'bi-an' },
  { name: 'Chính Kịch', slug: 'chinh-kich' },
  { name: 'Chiến Tranh', slug: 'chien-tranh' },
  { name: 'Hình Sự', slug: 'hinh-su' },
  { name: 'Học Đường', slug: 'hoc-duong' },
  { name: 'Kinh Điển', slug: 'kinh-dien' },
  { name: 'Tài Liệu', slug: 'tai-lieu' },
  { name: 'Thần Thoại', slug: 'than-thoai' },
  { name: 'Thể Thao', slug: 'the-thao' },
  { name: 'Phim 18+', slug: 'phim-18' },
];

const COUNTRIES = [
  { name: 'Việt Nam', slug: 'viet-nam' }, { name: 'Hàn Quốc', slug: 'han-quoc' },
  { name: 'Trung Quốc', slug: 'trung-quoc' }, { name: 'Nhật Bản', slug: 'nhat-ban' },
  { name: 'Mỹ', slug: 'au-my' }, { name: 'Thái Lan', slug: 'thai-lan' },
  { name: 'Anh', slug: 'anh' }, { name: 'Hong Kong', slug: 'hong-kong' },
  { name: 'Đài Loan', slug: 'dai-loan' }, { name: 'Ấn Độ', slug: 'an-do' },
];

const TYPES = [
  { name: 'Phim Lẻ', slug: 'phim-le' }, { name: 'Phim Bộ', slug: 'phim-bo' },
  { name: 'Hoạt Hình', slug: 'hoat-hinh' }, { name: 'TV Show', slug: 'tv-shows' },
];

// ---- Card renderer ----
function allowedServersForCurrentMode() {
  return ['search', 'genre'].includes(state.mode) ? HOME_SEARCH_SERVERS : HOME_RECOMMEND_SERVERS;
}

function getServerSlugs(m, allowedServers = allowedServersForCurrentMode()) {
  return m._serverSlugs || { [m._server || allowedServers[0]]: m.slug };
}

function buildMovieHref(m, allowedServers = allowedServersForCurrentMode()) {
  const serverSlugs = getServerSlugs(m, allowedServers);
  const sources = (m._sources?.length ? m._sources : Object.keys(serverSlugs)).filter(server => allowedServers.includes(server));
  const preferredServer = allowedServers.find(server => serverSlugs[server]) || m._server || sources[0] || allowedServers[0];
  const hrefParams = new URLSearchParams({
    slug: serverSlugs[preferredServer] || m.slug,
    server: preferredServer,
  });
  const sourceParam = encodeSourceMap(serverSlugs);
  if (sourceParam) hrefParams.set('sources', sourceParam);
  return `movie.html?${hrefParams.toString()}`;
}

function renderSourceBadges(m, allowedServers = allowedServersForCurrentMode()) {
  const serverSlugs = getServerSlugs(m, allowedServers);
  const sources = (m._sources?.length ? m._sources : Object.keys(serverSlugs)).filter(server => allowedServers.includes(server));
  const sourceBadges = sources
    .filter(server => API.servers[server])
    .map(server => `<span class="source-chip">${escHtml(API.servers[server].name.replace('Server ', 'SV '))}</span>`)
    .join('');
  return sourceBadges;
}

function formatOmdbBadge(m) {
  return m.omdb?.ratingValue ? `<span class="rating-chip">IMDb ${escHtml(m.omdb.imdbRating)}</span>` : '';
}

function formatTmdbBadge(m) {
  return m.tmdb?.vote_average ? `<span class="rating-chip">TMDB ${m.tmdb.vote_average.toFixed(1)}</span>` : '';
}

function formatRatingBadges(m) {
  return `${formatTmdbBadge(m)}${formatOmdbBadge(m)}`;
}

function formatRatingText(m) {
  const ratings = [
    m.tmdb?.vote_average ? `TMDB ${m.tmdb.vote_average.toFixed(1)}` : '',
    m.omdb?.ratingValue ? `IMDb ${m.omdb.imdbRating}` : '',
  ].filter(Boolean);
  return ratings.join(' · ') || 'TMDB';
}

function renderCard(m) {
  const poster = m.poster_url || m.thumb_url || '';
  const ep = m.episode_current || '';
  const typeLabel = m.type === 'series' ? 'Bộ' : m.type === 'single' ? 'Lẻ' : '';
  const href = buildMovieHref(m);
  const sourceBadges = renderSourceBadges(m);
  const rankBadge = m._rank ? `<span class="rank-chip">#${m._rank}</span>` : '';
  const ratingBadge = formatRatingBadges(m);
  const tmdbGenre = m.tmdb?.genres?.[0]?.name || '';
  const omdbGenre = m.omdb?.genre ? m.omdb.genre.split(',')[0].trim() : '';
  const genreText = tmdbGenre || omdbGenre;
  const imgEl = poster
    ? `<img src="${escHtml(poster)}" alt="${escHtml(m.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=movie-poster-placeholder><div>🎬</div><span>${escHtml(m.name)}</span></div>'">`
    : `<div class="movie-poster-placeholder"><div>🎬</div><span>${escHtml(m.name)}</span></div>`;

  return `<a class="movie-card" href="${href}">
    <div class="movie-poster">
      ${imgEl}
      <div class="movie-overlay"><div class="play-btn-overlay">▶</div></div>
      ${typeLabel ? `<div class="movie-badge ${m.type}">${typeLabel}</div>` : ''}
      ${ep ? `<div class="movie-badge ep">${ep.length > 10 ? ep.slice(0,9)+'…' : ep}</div>` : ''}
      ${m.quality ? `<div class="movie-quality">${escHtml(m.quality)}</div>` : ''}
    </div>
    <div class="movie-info">
      <div class="movie-title">${escHtml(m.name)}</div>
      ${rankBadge || ratingBadge ? `<div class="movie-rank-row">${rankBadge}${ratingBadge}</div>` : ''}
      <div class="movie-sub">
        ${m.year ? `<span>${m.year}</span>` : ''}
        ${m.lang ? `<span class="dot">·</span><span>${escHtml(m.lang)}</span>` : ''}
        ${genreText ? `<span class="dot">·</span><span>${escHtml(genreText)}</span>` : ''}
      </div>
      ${sourceBadges ? `<div class="movie-sources">${sourceBadges}</div>` : ''}
    </div>
  </a>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function encodeSourceMap(sourceMap) {
  const entries = Object.entries(sourceMap || {}).filter(([, slug]) => slug);
  if (entries.length <= 1) return '';
  return entries.map(([server, slug]) => `${server}:${encodeURIComponent(slug)}`).join('|');
}

function renderSkeletons(n = 12) {
  return Array.from({length: n}, () =>
    `<div class="skeleton-card"><div class="skeleton skeleton-poster"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div>`
  ).join('');
}

function updateSectionTitle() {
  const title = document.getElementById('section-title');
  if (!title) return;
  if (state.mode === 'search') title.textContent = 'Kết Quả Tìm Kiếm';
  else if (state.mode === 'genre') title.textContent = 'Phim Theo Thể Loại';
  else if (state.mode === 'country') title.textContent = 'Phim Theo Quốc Gia';
  else if (state.mode === 'type') title.textContent = 'Phim Theo Danh Mục';
  else title.textContent = 'Đề Xuất Theo TMDB';
}

function resultInfoText(count) {
  if (['search', 'genre'].includes(state.mode)) return `${count} phim từ SV 1, SV 2 và SV 3 · kèm thông tin TMDB nếu có`;
  if (state.mode === 'latest') return `${count} phim từ SV 1 và SV 3 · xếp theo điểm TMDB`;
  return `${count} phim từ SV 1 và SV 3 · ưu tiên thông tin TMDB`;
}

// ---- Load movies ----
async function loadMovies(resetPage = true) {
  if (state.loading) return;
  state.loading = true;
  if (resetPage) state.page = 1;
  syncHeroVisibility();

  const grid = document.getElementById('movie-grid');
  const pgWrap = document.getElementById('pagination');
  if (!grid) return;

  updateSectionTitle();
  grid.innerHTML = renderSkeletons();
  if (pgWrap) pgWrap.innerHTML = '';

  let result;
  try {
    if (state.mode === 'search' && state.query) {
      result = await API.searchAll(state.query, state.page, HOME_SEARCH_SERVERS);
    } else if (state.mode === 'genre' && state.genre) {
      result = await API.getByGenreFromServers(state.genre, state.page, HOME_SEARCH_SERVERS);
    } else if (state.mode === 'country' && state.country) {
      result = await API.getByCountryFromServers(state.country, state.page, HOME_RECOMMEND_SERVERS);
    } else if (state.mode === 'type' && state.type) {
      result = await API.getByTypeFromServers(state.type, state.page, HOME_RECOMMEND_SERVERS);
    } else {
      result = await API.getLatestFromServers(state.page, HOME_RECOMMEND_SERVERS);
    }
  } catch (e) {
    result = null;
  }

  if (result?.items?.length) {
    try {
      result.items = await API.enrichWithTmdb(result.items, {
        limit: state.mode === 'search' ? 12 : 24,
        sort: state.mode !== 'search',
        rank: state.mode !== 'search',
      });
    } catch (e) {
      console.warn('[TMDB] Không thể enrich danh sách:', e);
    }

    try {
      result.items = await API.enrichWithOmdb(result.items, {
        limit: state.mode === 'search' ? 12 : 24,
        sort: false,
        rank: false,
      });
    } catch (e) {
      console.warn('[OMDb] Không thể enrich dự phòng:', e);
    }
  }

  state.loading = false;

  if (!result || !result.items.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">🎬</div><h3>Không tìm thấy phim</h3><p>Thử tìm kiếm với từ khoá khác.</p></div>`;
    return;
  }

  state.totalPages = Math.min(result.totalPages || 1, 100);
  if (state.mode === 'latest') updateHeroFromMovies(result.items);
  grid.innerHTML = result.items.map(renderCard).join('');
  const info = document.getElementById('result-info');
  if (info) info.textContent = resultInfoText(result.items.length);
  renderPagination();
}

// ---- Pagination ----
function renderPagination() {
  const wrap = document.getElementById('pagination');
  if (!wrap || state.totalPages <= 1) return;

  const p = state.page, tp = state.totalPages;
  let pages = new Set([1, tp, p]);
  for (let i = Math.max(1, p-2); i <= Math.min(tp, p+2); i++) pages.add(i);
  pages = [...pages].sort((a,b) => a-b);

  let html = `<button class="page-btn" ${p<=1?'disabled':''} onclick="goPage(${p-1})">‹</button>`;
  let prev = 0;
  for (const pg of pages) {
    if (pg - prev > 1) html += `<span style="color:var(--text-muted);padding:0 4px">…</span>`;
    html += `<button class="page-btn${pg===p?' active':''}" onclick="goPage(${pg})">${pg}</button>`;
    prev = pg;
  }
  html += `<button class="page-btn" ${p>=tp?'disabled':''} onclick="goPage(${p+1})">›</button>`;
  wrap.innerHTML = html;
}

function goPage(p) {
  state.page = p;
  syncHeroVisibility();
  loadMovies(false);
  window.scrollTo({ top: document.getElementById('movie-grid')?.offsetTop - 80 || 0, behavior: 'smooth' });
}
window.goPage = goPage;

// ---- Filter chips ----
function setActiveGenreSlug(slug) {
  $$('#genre-chips .chip, #all-genre-chips .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.slug === slug);
  });
}

function clearOtherFilters(except = '') {
  if (except !== 'genre') $$('#genre-chips .chip, #all-genre-chips .chip').forEach(c => c.classList.remove('active'));
  if (except !== 'country') $$('#country-chips .chip').forEach(c => c.classList.remove('active'));
  if (except !== 'type') $$('#type-chips .chip').forEach(c => c.classList.remove('active'));
}

function applyGenreFilter(slug, name = '') {
  const sameGenre = state.mode === 'genre' && state.genre === slug;
  if (sameGenre) {
    state.mode = 'latest';
    state.genre = '';
    clearOtherFilters('');
  } else {
    state.mode = 'genre';
    state.genre = slug;
    clearOtherFilters('genre');
    setActiveGenreSlug(slug);
    const title = document.getElementById('all-genres-current');
    if (title) title.textContent = name ? `Đang chọn: ${name}` : '';
  }
  loadMovies();
}

function renderGenreButtons(wrap, genres) {
  if (!wrap) return;
  wrap.innerHTML = (genres || []).map(g =>
    `<button class="chip" data-slug="${escHtml(g.slug)}">${escHtml(g.name)}</button>`
  ).join('');
}

function uniqueGenres(list) {
  const map = new Map();
  (list || []).forEach(g => {
    if (!g?.slug || !g?.name) return;
    if (!map.has(g.slug)) map.set(g.slug, g);
  });
  return [...map.values()];
}

async function loadAllGenres() {
  const allWrap = document.getElementById('all-genre-chips');
  const status = document.getElementById('all-genres-status');
  if (!allWrap) return;

  renderGenreButtons(allWrap, FALLBACK_ALL_GENRES);
  if (status) status.textContent = 'Đang lấy thể loại từ API...';

  try {
    const fromApi = await API.getGenresFromServers?.(HOME_SEARCH_SERVERS);
    const merged = uniqueGenres([...(fromApi || []), ...FALLBACK_ALL_GENRES]);
    renderGenreButtons(allWrap, merged.length ? merged : FALLBACK_ALL_GENRES);
    if (state.mode === 'genre' && state.genre) setActiveGenreSlug(state.genre);
    if (status) status.textContent = `Có ${merged.length || FALLBACK_ALL_GENRES.length} thể loại`;
  } catch (err) {
    if (status) status.textContent = 'API lỗi, đang dùng danh sách dự phòng';
  }
}

function initAllGenrePanel() {
  const btn = document.getElementById('btn-all-genres');
  const panel = document.getElementById('all-genres-panel');
  const closeBtn = document.getElementById('btn-close-genres');
  const allWrap = document.getElementById('all-genre-chips');
  if (!btn || !panel || !allWrap) return;

  let loaded = false;
  const openPanel = async () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    btn.classList.toggle('active', willOpen);
    btn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen && !loaded) {
      loaded = true;
      await loadAllGenres();
    }
  };

  btn.addEventListener('click', openPanel);
  closeBtn?.addEventListener('click', () => {
    panel.hidden = true;
    btn.classList.remove('active');
    btn.setAttribute('aria-expanded', 'false');
  });

  allWrap.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    applyGenreFilter(chip.dataset.slug, chip.textContent.trim());
  });
}

function initFilters() {
  // Genres
  const genreWrap = document.getElementById('genre-chips');
  if (genreWrap) {
    renderGenreButtons(genreWrap, GENRES);
    genreWrap.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      applyGenreFilter(chip.dataset.slug, chip.textContent.trim());
    });
  }
  initAllGenrePanel();

  // Countries
  const ctryWrap = document.getElementById('country-chips');
  if (ctryWrap) {
    ctryWrap.innerHTML = COUNTRIES.map(c =>
      `<button class="chip" data-slug="${c.slug}">${c.name}</button>`
    ).join('');
    ctryWrap.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const active = chip.classList.toggle('active');
      $$('#country-chips .chip').forEach(c => c !== chip && c.classList.remove('active'));
      if (active) {
        state.mode = 'country'; state.country = chip.dataset.slug;
        clearOtherFilters('country');
      } else {
        state.mode = 'latest'; state.country = '';
      }
      loadMovies();
    });
  }

  // Types
  const typeWrap = document.getElementById('type-chips');
  if (typeWrap) {
    typeWrap.innerHTML = TYPES.map(t =>
      `<button class="chip" data-slug="${t.slug}">${t.name}</button>`
    ).join('');
    typeWrap.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const active = chip.classList.toggle('active');
      $$('#type-chips .chip').forEach(c => c !== chip && c.classList.remove('active'));
      if (active) {
        state.mode = 'type'; state.type = chip.dataset.slug;
        clearOtherFilters('type');
      } else {
        state.mode = 'latest'; state.type = '';
      }
      loadMovies();
    });
  }
}

// ---- Search ----
function initSearch() {
  const input = document.getElementById('search-input');
  const searchHeader = document.getElementById('search-header');
  let debounce;

  const doSearch = (q) => {
    q = q.trim();
    if (!q) {
      state.mode = 'latest'; state.query = '';
      $$('.chip').forEach(c => c.classList.remove('active'));
    } else {
      state.mode = 'search'; state.query = q;
    }
    loadMovies();
  };

  [input, searchHeader].forEach(el => {
    el?.addEventListener('input', e => {
      clearTimeout(debounce);
      debounce = setTimeout(() => doSearch(e.target.value), 500);
    });
    el?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(debounce); doSearch(e.target.value); }
    });
  });

  document.querySelector('.header-search button')?.addEventListener('click', () => {
    const q = searchHeader?.value || input?.value || '';
    clearTimeout(debounce); doSearch(q);
  });
}

// ---- Hero Banner ----
const HERO_FALLBACK = [
  { name: 'Avengers: Endgame', year: 2019, quality: '4K', type: 'Phim Lẻ', desc: 'Sau sự kiện tàn khốc của Thanos, các Avengers tập hợp lần cuối để chiến đấu cứu vũ trụ.', slug: 'avengers-endgame', bg: 'https://picsum.photos/seed/avengers/1600/600', badge: 'Nổi Bật', lang: 'Thuyết Minh' },
  { name: 'One Piece Film: Red', year: 2022, quality: '4K', type: 'Anime', desc: 'Shanks Tóc Đỏ và con gái Uta tái ngộ trong một buổi hòa nhạc bí ẩn thu hút cả thế giới.', slug: 'one-piece-film-red', bg: 'https://picsum.photos/seed/onepiece/1600/600', badge: 'Anime', lang: 'Vietsub' },
  { name: 'Squid Game', year: 2021, quality: 'FHD', type: 'Phim Bộ', desc: 'Những người nợ nần tham gia một cuộc trò chơi sinh tử với phần thưởng 45,6 tỷ won.', slug: 'squid-game', bg: 'https://picsum.photos/seed/squid/1600/600', badge: 'Hot', lang: 'Vietsub' },
];

function localCategoryLabel(m) {
  const first = m.category?.[0];
  if (typeof first === 'string') return first;
  return first?.name || m.type || 'Phim';
}

function heroTitleHtml(name) {
  const words = String(name || 'DragonFilm').trim().split(/\s+/);
  if (words.length <= 2) return escHtml(words.join(' '));
  const splitAt = Math.ceil(words.length / 2);
  return `${escHtml(words.slice(0, splitAt).join(' '))}<br>${escHtml(words.slice(splitAt).join(' '))}`;
}

function updateHeroFromMovies(items) {
  const slides = document.querySelectorAll('.hero-slide');
  if (!slides.length) return;

  const picks = (items || []).filter(movie => movie?.name).slice(0, slides.length);
  picks.forEach((m, index) => {
    const slide = slides[index];
    const bg = m.tmdb?.backdrop_url || m.tmdb?.poster_url || m.omdb?.poster || m.poster_url || m.thumb_url;
    const ratingText = formatRatingText(m);
    const genreText = m.tmdb?.genres?.[0]?.name || (m.omdb?.genre ? m.omdb.genre.split(',')[0].trim() : localCategoryLabel(m));
    const desc = m.tmdb?.overview || (m.omdb?.plot && m.omdb.plot !== 'N/A'
      ? m.omdb.plot
      : `Đề xuất từ DragonFilm, có trên ${renderSourceBadges(m, HOME_RECOMMEND_SERVERS).replace(/<[^>]+>/g, ' ').trim() || 'SV 1 và SV 3'}.`);

    const img = slide.querySelector('.hero-bg');
    if (img && bg) {
      img.src = bg;
      img.alt = m.name || '';
    }
    const badge = slide.querySelector('.hero-badge');
    if (badge) badge.textContent = index === 0 ? 'Đề Xuất TMDB' : `Hạng #${m._rank || index + 1}`;
    const title = slide.querySelector('.hero-title');
    if (title) title.innerHTML = heroTitleHtml(m.name);
    const year = slide.querySelector('.year');
    if (year) year.textContent = m.year || m.tmdb?.year || m.omdb?.year || '';
    const cat = slide.querySelector('.cat');
    if (cat) cat.textContent = genreText || 'Phim';
    const rating = slide.querySelector('.hero-rating');
    if (rating) rating.textContent = ratingText;
    const heroDesc = slide.querySelector('.hero-desc');
    if (heroDesc) heroDesc.textContent = desc;
    const actions = slide.querySelector('.hero-actions');
    if (actions) {
      actions.innerHTML = `<a href="${escHtml(buildMovieHref(m, HOME_RECOMMEND_SERVERS))}" class="btn-primary">Xem Ngay</a>
        <a href="#movies" class="btn-secondary">Danh Sách Phim</a>`;
    }
  });
}

function initHero() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot');
  if (!slides.length) return;

  let current = 0;
  const go = (idx) => {
    slides[current].classList.remove('active');
    dots[current]?.classList.remove('active');
    current = (idx + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current]?.classList.add('active');
  };

  dots.forEach((d, i) => d.addEventListener('click', () => { go(i); clearInterval(timer); timer = setInterval(() => go(current + 1), 5000); }));
  document.getElementById('hero-prev')?.addEventListener('click', () => { go(current - 1); clearInterval(timer); timer = setInterval(() => go(current + 1), 5000); });
  document.getElementById('hero-next')?.addEventListener('click', () => { go(current + 1); clearInterval(timer); timer = setInterval(() => go(current + 1), 5000); });

  let timer = setInterval(() => go(current + 1), 5000);
}

function syncHeroVisibility() {
  const hero = document.querySelector('.hero');
  const movies = document.getElementById('movies');
  if (!hero) return;
  const isFilteredView = state.mode !== 'latest';
  hero.classList.toggle('is-hidden', isFilteredView);
  movies?.classList.toggle('filtered-view', isFilteredView);
}

// ---- Main init ----
document.addEventListener('DOMContentLoaded', () => {
  initFilters();
  initSearch();
  initHero();
  syncHeroVisibility();
  loadMovies();
});
