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

const RANKING_LIMIT = 20;
const RANKING_COLLAPSED = 5;
const rankingState = {
  tmdbWeekly: { items: [], type: 'tmdb', expanded: false, wrapId: 'tmdb-weekly-rank' },
  tmdbKoreaWeekly: { items: [], type: 'tmdb', expanded: false, wrapId: 'tmdb-korea-weekly-rank' },
  tmdbChinaWeekly: { items: [], type: 'tmdb', expanded: false, wrapId: 'tmdb-china-weekly-rank' },
  animeWeekly: { items: [], type: 'anime', expanded: false, wrapId: 'anilist-weekly-rank' },
  animeSeason: { items: [], type: 'anime', expanded: false, wrapId: 'anilist-season-rank' },
};

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
  const preferredServer = (m._server && allowedServers.includes(m._server) && serverSlugs[m._server])
    ? m._server
    : allowedServers.find(server => serverSlugs[server]) || sources[0] || allowedServers[0];
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

function movieLibraryDataset(m) {
  const sources = encodeSourceMap(getServerSlugs(m));
  return `data-slug="${escHtml(m.slug || '')}" data-server="${escHtml(m._server || API.currentServer)}" data-name="${escHtml(m.name || '')}" data-origin="${escHtml(m.origin_name || '')}" data-poster="${escHtml(m.poster_url || m.thumb_url || '')}" data-year="${escHtml(m.year || '')}" data-sources="${escHtml(sources)}"`;
}

function libraryMovieFromElement(el) {
  const serverSlugs = {};
  String(el?.dataset?.sources || '').split('|').forEach(part => {
    const [server, ...slugParts] = part.split(':');
    if (server && slugParts.length) serverSlugs[server] = decodeURIComponent(slugParts.join(':'));
  });
  if (el?.dataset?.server && el?.dataset?.slug) serverSlugs[el.dataset.server] = el.dataset.slug;
  return {
    slug: el?.dataset?.slug || '',
    name: el?.dataset?.name || '',
    origin_name: el?.dataset?.origin || '',
    poster_url: el?.dataset?.poster || '',
    year: el?.dataset?.year || '',
    _server: el?.dataset?.server || API.currentServer,
    _sources: Object.keys(serverSlugs),
    _serverSlugs: serverSlugs,
  };
}

function formatOmdbBadge(m) {
  return m.omdb?.ratingValue ? `<span class="rating-chip">IMDb ${escHtml(m.omdb.imdbRating)}</span>` : '';
}

function formatTmdbBadge(m) {
  return m.tmdb?.vote_average ? `<span class="rating-chip">TMDB ${m.tmdb.vote_average.toFixed(1)}</span>` : '';
}

function formatAniListBadge(m) {
  return m.anilist?.average_score ? `<span class="rating-chip">AniList ${m.anilist.average_score}%</span>` : '';
}

function formatRatingBadges(m) {
  return `${formatAniListBadge(m)}${formatTmdbBadge(m)}${formatOmdbBadge(m)}`;
}

function formatRatingText(m) {
  const ratings = [
    m.anilist?.average_score ? `AniList ${m.anilist.average_score}%` : '',
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
  const anilistGenre = m.anilist?.genres?.[0] || '';
  const tmdbGenre = m.tmdb?.genres?.[0]?.name || '';
  const omdbGenre = m.omdb?.genre ? m.omdb.genre.split(',')[0].trim() : '';
  const genreText = localCategoryLabel(m) || anilistGenre || tmdbGenre || omdbGenre;
  const libraryData = movieLibraryDataset(m);
  const isWatchLater = typeof MovieLibrary !== 'undefined' && MovieLibrary.has('watchLater', m);
  const isLiked = typeof MovieLibrary !== 'undefined' && MovieLibrary.has('liked', m);
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
      <div class="movie-actions">
        <button class="movie-action-btn${isWatchLater ? ' active' : ''}" type="button" data-library-action="watchLater" ${libraryData} title="Phim xem sau" aria-label="Phim xem sau">＋</button>
        <button class="movie-action-btn${isLiked ? ' active' : ''}" type="button" data-library-action="liked" ${libraryData} title="Phim yêu thích" aria-label="Phim yêu thích">♡</button>
      </div>
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
  if (['search', 'genre'].includes(state.mode)) return `${count} phim từ SV 1, SV 2 và SV 3 · kèm TMDB/IMDb/AniList nếu có`;
  if (state.mode === 'latest') return `${count} phim từ SV 1 và SV 3 · xếp theo điểm TMDB`;
  return `${count} phim từ SV 1 và SV 3 · ưu tiên thông tin TMDB/IMDb/AniList`;
}

// ---- Compact weekly rankings ----
function rankingTitle(item, type) {
  return type === 'anime'
    ? (item.title_english || item.title_romaji || item.title_native || 'Anime')
    : (item.title || item.original_title || 'Phim');
}

function rankingAltTitle(item, type) {
  if (type === 'anime') {
    const title = rankingTitle(item, type);
    return [item.title_romaji, item.title_native, ...(item.synonyms || [])]
      .find(value => value && value !== title) || '';
  }
  return item.original_title && item.original_title !== item.title ? item.original_title : '';
}

function rankingTitleCandidates(item, type) {
  const values = type === 'anime'
    ? [item.title_english, item.title_romaji, item.title_native, ...(item.synonyms || [])]
    : [item.title, item.original_title];
  const seen = new Set();
  return values
    .map(value => String(value || '').trim())
    .filter(value => {
      const key = value.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function encodeRankCandidates(values) {
  return values.map(value => encodeURIComponent(value)).join('|');
}

function decodeRankCandidates(value) {
  return String(value || '')
    .split('|')
    .map(part => {
      try { return decodeURIComponent(part); }
      catch { return part; }
    })
    .map(part => part.trim())
    .filter(Boolean);
}

function renderRankingRows(items, type, expanded = false) {
  if (!items?.length) {
    return '<div class="weekly-rank-empty">Chưa có dữ liệu.</div>';
  }

  return items.slice(0, expanded ? items.length : RANKING_COLLAPSED).map((item, index) => {
    const candidates = rankingTitleCandidates(item, type);
    const title = candidates[0] || rankingTitle(item, type);
    const altTitle = candidates.find(value => value !== title) || rankingAltTitle(item, type);
    const poster = type === 'anime'
      ? (item.cover_url || item.banner_url || '')
      : (item.poster_url || item.backdrop_url || '');
    const score = type === 'anime'
      ? (item.average_score ? `${item.average_score}%` : `${Math.round(item.popularity || 0)}`)
      : (item.vote_average ? item.vote_average.toFixed(1) : `${Math.round(item.popularity || 0)}`);
    const meta = type === 'anime'
      ? (item.season_year || item.format || '')
      : (item.year || 'TMDB');
    const img = poster
      ? `<img src="${escHtml(poster)}" alt="${escHtml(title)}" loading="lazy">`
      : '<span class="weekly-rank-poster-placeholder"></span>';
    const year = type === 'anime' ? (item.season_year || '') : (item.year || '');

    return `<button class="weekly-rank-row" type="button" data-rank-title="${escHtml(title)}" data-rank-alt="${escHtml(altTitle)}" data-rank-candidates="${escHtml(encodeRankCandidates(candidates))}" data-rank-year="${escHtml(year)}">
      <span class="weekly-rank-no">${index + 1}.</span>
      <span class="weekly-rank-poster">${img}</span>
      <span class="weekly-rank-copy">
        <strong>${escHtml(title)}</strong>
        <em>${escHtml(meta)}</em>
      </span>
      <span class="weekly-rank-score">${escHtml(score)}</span>
    </button>`;
  }).join('');
}

function renderRankingPanel(key) {
  const panel = rankingState[key];
  const wrap = document.getElementById(panel?.wrapId);
  const btn = document.querySelector(`.weekly-rank-more[data-rank-key="${key}"]`);
  if (!panel || !wrap) return;
  wrap.innerHTML = renderRankingRows(panel.items, panel.type, panel.expanded);
  if (btn) {
    const canExpand = panel.items.length > RANKING_COLLAPSED;
    btn.hidden = !canExpand;
    btn.textContent = panel.expanded ? 'Thu gọn' : `Xem thêm ${panel.items.length}`;
  }
}

async function loadWeeklyRankings() {
  const tmdbWrap = document.getElementById('tmdb-weekly-rank');
  const koreaWrap = document.getElementById('tmdb-korea-weekly-rank');
  const chinaWrap = document.getElementById('tmdb-china-weekly-rank');
  const animeWeeklyWrap = document.getElementById('anilist-weekly-rank');
  const animeWrap = document.getElementById('anilist-season-rank');
  const seasonLabel = document.getElementById('anilist-season-label');

  if (tmdbWrap && typeof API.getTmdbWeeklyRanking === 'function') {
    API.getTmdbWeeklyRanking(RANKING_LIMIT)
      .then(items => {
        rankingState.tmdbWeekly.items = items || [];
        renderRankingPanel('tmdbWeekly');
      })
      .catch(() => { tmdbWrap.innerHTML = '<div class="weekly-rank-empty">Không tải được TMDB.</div>'; });
  }

  if (koreaWrap && typeof API.getTmdbKoreaWeeklyRanking === 'function') {
    API.getTmdbKoreaWeeklyRanking(RANKING_LIMIT)
      .then(items => {
        rankingState.tmdbKoreaWeekly.items = items || [];
        renderRankingPanel('tmdbKoreaWeekly');
      })
      .catch(() => { koreaWrap.innerHTML = '<div class="weekly-rank-empty">Không tải được TMDB.</div>'; });
  }

  if (chinaWrap && typeof API.getTmdbChinaWeeklyRanking === 'function') {
    API.getTmdbChinaWeeklyRanking(RANKING_LIMIT)
      .then(items => {
        rankingState.tmdbChinaWeekly.items = items || [];
        renderRankingPanel('tmdbChinaWeekly');
      })
      .catch(() => { chinaWrap.innerHTML = '<div class="weekly-rank-empty">Không tải được TMDB.</div>'; });
  }

  if (animeWeeklyWrap && typeof API.getAniListWeeklyAnimeRanking === 'function') {
    API.getAniListWeeklyAnimeRanking(RANKING_LIMIT)
      .then(items => {
        rankingState.animeWeekly.items = items || [];
        renderRankingPanel('animeWeekly');
      })
      .catch(() => { animeWeeklyWrap.innerHTML = '<div class="weekly-rank-empty">Không tải được AniList.</div>'; });
  }

  if (animeWrap && typeof API.getAniListSeasonAnimeRanking === 'function') {
    API.getAniListSeasonAnimeRanking(RANKING_LIMIT)
      .then(result => {
        if (seasonLabel && result?.label && result?.year) {
          seasonLabel.textContent = `${result.label} ${result.year}`;
        }
        rankingState.animeSeason.items = result?.items || [];
        renderRankingPanel('animeSeason');
      })
      .catch(() => { animeWrap.innerHTML = '<div class="weekly-rank-empty">Không tải được AniList.</div>'; });
  }
}

async function openRankingMovie(btn) {
  const title = btn?.dataset?.rankTitle || '';
  if (!title || btn.disabled) return;
  const titleCandidates = [
    ...decodeRankCandidates(btn.dataset.rankCandidates),
    title,
    btn.dataset.rankAlt || '',
  ];
  const uniqueTitleCandidates = [...new Set(titleCandidates.map(value => String(value).trim()).filter(Boolean))];
  const originalText = btn.querySelector('.weekly-rank-score')?.textContent || '';
  btn.disabled = true;
  btn.classList.add('is-loading');
  const scoreEl = btn.querySelector('.weekly-rank-score');
  if (scoreEl) scoreEl.textContent = '...';
  showToast(`Đang tìm nguồn phát cho "${title}"...`, 'info');

  try {
    let found = null;
    for (const candidate of uniqueTitleCandidates) {
      found = await API.findPlayableMovie(candidate, {
        year: btn.dataset.rankYear || '',
        serverIds: HOME_SEARCH_SERVERS,
        strict: true,
      });
      if (found) break;
    }
    if (!found) {
      showToast(`"${title}" chưa có trong 3 nguồn phát.`, 'error');
      return;
    }
    window.location.href = buildMovieHref(found, HOME_SEARCH_SERVERS);
  } catch (err) {
    showToast('Không kiểm tra được nguồn phát, vui lòng thử lại.', 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('is-loading');
    if (scoreEl) scoreEl.textContent = originalText;
  }
}

function initRankingInteractions() {
  document.getElementById('weekly-rankings')?.addEventListener('click', (e) => {
    const moreBtn = e.target.closest('.weekly-rank-more');
    if (moreBtn) {
      const key = moreBtn.dataset.rankKey;
      if (rankingState[key]) {
        rankingState[key].expanded = !rankingState[key].expanded;
        renderRankingPanel(key);
      }
      return;
    }

    const row = e.target.closest('.weekly-rank-row');
    if (row) openRankingMovie(row);
  });
}

function initMovieLibraryActions() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.movie-action-btn');
    if (!btn || typeof MovieLibrary === 'undefined') return;
    e.preventDefault();
    e.stopPropagation();
    const type = btn.dataset.libraryAction;
    const movie = libraryMovieFromElement(btn);
    const added = MovieLibrary.toggle(type, movie);
    btn.classList.toggle('active', added);
    const label = type === 'liked' ? 'phim yêu thích' : 'phim xem sau';
    showToast(added ? `Đã thêm vào ${label}` : `Đã bỏ khỏi ${label}`);
  });
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
      result.items = await API.enrichWithAniList(result.items, {
        limit: state.mode === 'search' ? 12 : 18,
      });
    } catch (e) {
      console.warn('[AniList] Không thể enrich danh sách:', e);
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

  let html = `<button class="page-btn" ${p <= 1 ? 'disabled' : ''} data-page="${p - 1}">‹</button>`;
  let prev = 0;
  for (const pg of pages) {
    if (pg - prev > 1) html += '<span class="page-gap">…</span>';
    html += `<button class="page-btn${pg === p ? ' active' : ''}" data-page="${pg}">${pg}</button>`;
    prev = pg;
  }
  html += `<button class="page-btn" ${p >= tp ? 'disabled' : ''} data-page="${p + 1}">›</button>`;
  wrap.innerHTML = html;
}

function goPage(p) {
  state.page = p;
  syncHeroVisibility();
  loadMovies(false);
  window.scrollTo({ top: document.getElementById('movie-grid')?.offsetTop - 80 || 0, behavior: 'smooth' });
}
window.goPage = goPage;

function initPagination() {
  document.getElementById('pagination')?.addEventListener('click', (event) => {
    const btn = event.target.closest('.page-btn[data-page]');
    if (!btn || btn.disabled) return;
    const page = Number(btn.dataset.page || 1);
    if (Number.isFinite(page)) goPage(page);
  });
}

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
  let popupDebounce;
  let popupRequestId = 0;
  const popupCache = new Map();

  const popupForInput = (el) => document.querySelector(`.search-popup[data-search-popup="${el?.id || ''}"]`);

  const hideSearchPopups = () => {
    document.querySelectorAll('.search-popup').forEach(popup => {
      popup.hidden = true;
      popup.innerHTML = '';
    });
  };

  const popupState = (popup, message) => {
    if (!popup) return;
    popup.hidden = false;
    popup.innerHTML = `<div class="search-popup-state">${escHtml(message)}</div>`;
  };

  const renderSearchPopup = (popup, items, query) => {
    if (!popup) return;
    const q = String(query || '').trim();
    if (!items.length) {
      popupState(popup, `Không thấy kết quả cho "${q}".`);
      return;
    }
    popup.hidden = false;
    popup.innerHTML = `<div class="search-popup-list">
      ${items.slice(0, 6).map(movie => {
        const poster = movie.poster_url || movie.thumb_url || '';
        const href = buildMovieHref(movie, HOME_SEARCH_SERVERS);
        const source = (movie._sources || [movie._server])
          .filter(Boolean)
          .map(server => API.servers[server]?.short || API.servers[server]?.name || server)
          .slice(0, 2)
          .join(' · ');
        const meta = [
          movie.year,
          movie.quality,
          movie.lang,
          localCategoryLabel(movie),
        ].filter(Boolean).join(' · ');
        const posterHtml = poster
          ? `<img class="search-popup-poster" src="${escHtml(poster)}" alt="${escHtml(movie.name)}" loading="lazy" onerror="this.outerHTML='<span class=&quot;search-popup-poster search-popup-placeholder&quot;>DF</span>'">`
          : '<span class="search-popup-poster search-popup-placeholder">DF</span>';
        return `<a class="search-popup-item" href="${escHtml(href)}">
          ${posterHtml}
          <span class="search-popup-main">
            <strong class="search-popup-title">${escHtml(movie.name || 'Không tên')}</strong>
            <span class="search-popup-meta">${escHtml(meta || movie.origin_name || 'DragonFilm')}</span>
          </span>
          ${source ? `<span class="search-popup-source">${escHtml(source)}</span>` : ''}
        </a>`;
      }).join('')}
    </div>
    <button class="search-popup-more" type="button" data-popup-search="${escHtml(q)}">Xem tất cả kết quả</button>`;
  };

  const showSearchPopup = async (el, query) => {
    const q = String(query || '').trim();
    const popup = popupForInput(el);
    if (!popup) return;
    if (q.length < 2) {
      popup.hidden = true;
      popup.innerHTML = '';
      return;
    }

    const requestId = ++popupRequestId;
    popupState(popup, 'Đang tìm...');
    try {
      const cacheKey = q.toLowerCase();
      let result = popupCache.get(cacheKey);
      if (!result) {
        result = await API.searchAll(q, 1, HOME_SEARCH_SERVERS);
        popupCache.set(cacheKey, result);
      }
      if (requestId !== popupRequestId || document.activeElement !== el) return;
      renderSearchPopup(popup, result?.items || [], q);
    } catch (err) {
      if (requestId === popupRequestId) popupState(popup, 'Không tải được gợi ý, thử nhấn Enter.');
    }
  };

  const doSearch = (q) => {
    q = q.trim();
    if (input && input.value !== q) input.value = q;
    if (searchHeader && searchHeader.value !== q) searchHeader.value = q;
    hideSearchPopups();
    if (!q) {
      state.mode = 'latest'; state.query = '';
      $$('.chip').forEach(c => c.classList.remove('active'));
    } else {
      state.mode = 'search'; state.query = q;
    }
    loadMovies();
  };

  searchHeader?.addEventListener('input', e => {
    clearTimeout(popupDebounce);
    popupDebounce = setTimeout(() => showSearchPopup(searchHeader, e.target.value), 250);
  });
  searchHeader?.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideSearchPopups();
    if (e.key === 'ArrowDown') {
      const first = popupForInput(searchHeader)?.querySelector('.search-popup-item');
      if (first) {
        e.preventDefault();
        first.focus();
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(popupDebounce);
      showSearchPopup(searchHeader, e.target.value);
    }
  });
  searchHeader?.addEventListener('focus', e => {
    const q = e.target.value;
    if (q.trim().length >= 2) {
      clearTimeout(popupDebounce);
      popupDebounce = setTimeout(() => showSearchPopup(searchHeader, q), 120);
    }
  });

  input?.addEventListener('input', e => {
    clearTimeout(debounce);
    hideSearchPopups();
    debounce = setTimeout(() => doSearch(e.target.value), 500);
  });
  input?.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideSearchPopups();
    if (e.key === 'Enter') {
      clearTimeout(debounce);
      doSearch(e.target.value);
    }
  });

  document.querySelector('.header-search button')?.addEventListener('click', () => {
    const q = searchHeader?.value || '';
    clearTimeout(popupDebounce);
    showSearchPopup(searchHeader, q);
  });

  document.addEventListener('click', (e) => {
    const more = e.target.closest('[data-popup-search]');
    if (more) {
      e.preventDefault();
      const q = more.dataset.popupSearch || '';
      if (searchHeader) searchHeader.value = q;
      if (input) input.value = q;
      clearTimeout(debounce);
      clearTimeout(popupDebounce);
      doSearch(q);
      return;
    }
    if (!e.target.closest('.header-search')) hideSearchPopups();
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
    const bg = m.poster_url || m.thumb_url || m.anilist?.banner_url || m.tmdb?.backdrop_url || m.anilist?.cover_url || m.tmdb?.poster_url || m.omdb?.poster;
    const ratingText = formatRatingText(m);
    const genreText = localCategoryLabel(m) || m.anilist?.genres?.[0] || m.tmdb?.genres?.[0]?.name || (m.omdb?.genre ? m.omdb.genre.split(',')[0].trim() : '');
    const desc = m.description || m.anilist?.description || m.tmdb?.overview || (m.omdb?.plot && m.omdb.plot !== 'N/A'
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

function applyFilter(kind, slug) {
  if (!kind || !slug) return;
  state.query = '';
  if (kind === 'genre') {
    state.mode = 'genre';
    state.genre = slug;
    state.country = '';
    state.type = '';
    clearOtherFilters('genre');
    setActiveGenreSlug(slug);
  } else if (kind === 'country') {
    state.mode = 'country';
    state.genre = '';
    state.country = slug;
    state.type = '';
    clearOtherFilters('country');
    $$('#country-chips .chip').forEach(chip => chip.classList.toggle('active', chip.dataset.slug === slug));
  } else if (kind === 'type') {
    state.mode = 'type';
    state.genre = '';
    state.country = '';
    state.type = slug;
    clearOtherFilters('type');
    $$('#type-chips .chip').forEach(chip => chip.classList.toggle('active', chip.dataset.slug === slug));
  }
}

function initHeroFilters() {
  document.querySelector('.hero')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-hero-filter]');
    if (!btn) return;
    applyFilter(btn.dataset.heroFilter, btn.dataset.slug);
    loadMovies();
    document.getElementById('movies')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function applyInitialRouteParams() {
  const params = new URLSearchParams(location.search);
  const q = (params.get('q') || '').trim();
  const genre = (params.get('genre') || '').trim();
  const type = (params.get('type') || '').trim();

  if (q) {
    state.mode = 'search';
    state.query = q;
    const input = document.getElementById('search-input');
    const header = document.getElementById('search-header');
    if (input) input.value = q;
    if (header) header.value = q;
    return;
  }

  if (genre) {
    applyFilter('genre', genre);
    return;
  }

  if (type) {
    applyFilter('type', type);
  }
}

function syncHeroVisibility() {
  const hero = document.querySelector('.hero');
  const movies = document.getElementById('movies');
  const rankings = document.getElementById('weekly-rankings');
  if (!hero) return;
  const isFilteredView = state.mode !== 'latest';
  hero.classList.toggle('is-hidden', isFilteredView);
  rankings?.classList.toggle('is-hidden', isFilteredView);
  movies?.classList.toggle('filtered-view', isFilteredView);
}

// ---- Main init ----
document.addEventListener('DOMContentLoaded', () => {
  initFilters();
  initSearch();
  initHero();
  initHeroFilters();
  initRankingInteractions();
  initMovieLibraryActions();
  initPagination();
  applyInitialRouteParams();
  loadWeeklyRankings();
  syncHeroVisibility();
  loadMovies();
});
