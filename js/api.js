/* ============================================================
   DRAGONFILM - api.js  (multi-source movie API)
   ============================================================ */

const API = {
  // ---- Server configs ----
  servers: {
    kkphim: {
      name: 'Server 1',
      short: 'KKP',
      base: 'https://phimapi.com',
      endpoints: {
        latest:   (p) => `/danh-sach/phim-moi-cap-nhat?page=${p}`,
        search:   (q, p) => `/v1/api/tim-kiem?keyword=${encodeURIComponent(q)}&page=${p}`,
        detail:   (slug) => `/phim/${slug}`,
        genres:   () => `/the-loai`,
        genre:    (slug, p) => `/v1/api/the-loai/${slug}?page=${p}`,
        country:  (slug, p) => `/v1/api/quoc-gia/${slug}?page=${p}`,
        category: (type, p) => `/v1/api/danh-sach/${type}?page=${p}`,
      },
      imgBase: 'https://phimimg.com',
    },
    ophim: {
      name: 'Server 2',
      short: 'OP',
      base: 'https://ophim1.com',
      endpoints: {
        latest:   (p) => `/danh-sach/phim-moi-cap-nhat?page=${p}`,
        search:   (q, p) => `/v1/api/tim-kiem?keyword=${encodeURIComponent(q)}&page=${p}`,
        detail:   (slug) => `/phim/${slug}`,
        genres:   () => `/the-loai`,
        genre:    (slug, p) => `/v1/api/the-loai/${slug}?page=${p}`,
        country:  (slug, p) => `/v1/api/quoc-gia/${slug}?page=${p}`,
        category: (type, p) => `/v1/api/danh-sach/${type}?page=${p}`,
      },
      imgBase: 'https://img.ophim1.com/uploads/movies',
    },
    nguonc: {
      name: 'Server 3',
      short: 'NC',
      base: 'https://phim.nguonc.com',
      endpoints: {
        latest:   (p) => `/api/films/phim-moi-cap-nhat?page=${p}`,
        search:   (q, p) => `/api/films/search?keyword=${encodeURIComponent(q)}&page=${p}`,
        detail:   (slug) => `/api/film/${slug}`,
        genres:   () => `/api/films/the-loai`,
        genre:    (slug, p) => `/api/films/the-loai/${slug}?page=${p}`,
        country:  (slug, p) => `/api/films/quoc-gia/${slug}?page=${p}`,
        category: (type, p) => `/api/films/${type}?page=${p}`,
      },
      imgBase: 'https://phim.nguonc.com',
    }
  },

  omdb: {
    apiKey: '44d2be9c',
    base: 'https://www.omdbapi.com/',
    cachePrefix: 'dragonfilm_omdb_',
    cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  },

  _current: 'kkphim',

  get currentServer() { return this._current; },
  set currentServer(id) {
    if (this.servers[id]) {
      this._current = id;
      localStorage.setItem('xvl_server', id);
    }
  },

  init() {
    const saved = localStorage.getItem('xvl_server');
    if (saved && this.servers[saved]) this._current = saved;
  },

  _cfg() { return this.servers[this._current]; },
  _cfgFor(server) { return this.servers[server || this._current]; },

  async _fetch(path) {
    const cfg = this._cfg();
    const url = `${cfg.base}${path}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[API] fetch error:', err, url);
      return null;
    }
  },

  async _fetchFrom(server, path, options = {}) {
    const cfg = this._cfgFor(server);
    if (!cfg) return null;
    const url = `${cfg.base}${path}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (!options.quiet) console.warn('[API] fetch error:', err, url);
      return null;
    }
  },


  _normalizeTaxonomyItem(item) {
    if (!item) return null;
    const name = item.name || item.title || item.label || item.category_name || item.genre_name || '';
    const slug = item.slug || item.key || item.id || item.category_slug || item.genre_slug || '';
    if (!name || !slug) return null;
    return { name: String(name).trim(), slug: String(slug).trim() };
  },

  _extractTaxonomyList(data) {
    const candidates = [
      data,
      data?.items,
      data?.data,
      data?.data?.items,
      data?.categories,
      data?.category,
      data?.genres,
      data?.the_loai,
      data?.theloai,
    ];
    const arr = candidates.find(Array.isArray) || [];
    return arr.map(item => this._normalizeTaxonomyItem(item)).filter(Boolean);
  },

  async getGenresFromServer(server, options = {}) {
    const s = server || this._current;
    const cfg = this._cfgFor(s);
    if (!cfg) return [];

    const paths = [
      cfg.endpoints?.genres?.(),
      '/the-loai',
      '/v1/api/the-loai',
      '/api/films/the-loai',
      '/api/genres',
    ].filter(Boolean);

    for (const path of [...new Set(paths)]) {
      const data = await this._fetchFrom(s, path, { quiet: true, ...options });
      const list = this._extractTaxonomyList(data);
      if (list.length) return list;
    }
    return [];
  },

  async getGenresFromServers(serverIds = Object.keys(this.servers)) {
    const results = await Promise.all((serverIds || []).map(server =>
      this.getGenresFromServer(server, { quiet: true }).catch(() => [])
    ));
    const map = new Map();
    results.flat().forEach(item => {
      if (!item?.slug || !item?.name) return;
      if (!map.has(item.slug)) map.set(item.slug, item);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  },

  // ---- Normalize movie from any source ----
  _normalize(raw, server) {
    if (!raw) return null;
    const cfg = this.servers[server || this._current];

    // NguonC format
    if (server === 'nguonc') {
      const imgUrl = raw.poster_url || raw.thumb_url || '';
      const fullImg = imgUrl.startsWith('http') ? imgUrl : (imgUrl ? `${cfg.imgBase}${imgUrl}` : '');
      // Normalize categories/nations to [{name, slug}] format
      const normArr = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.map(i => typeof i === 'object' ? i : { name: i, slug: '' });
      };
      return {
        slug: raw.slug || raw.id || '',
        name: raw.name || raw.title || '',
        origin_name: raw.original_name || raw.origin_name || '',
        thumb_url: fullImg,
        poster_url: fullImg,
        year: raw.year || raw.release_year || '',
        type: raw.kind || raw.type || '',
        episode_current: raw.current_episode || raw.episode_current || '',
        quality: raw.quality || 'HD',
        lang: raw.language || raw.lang || 'Vietsub',
        category: normArr(raw.categories || raw.category || raw.genre || []),
        country: normArr(raw.nations || raw.country || []),
        _server: server || this._current,
      };
    }

    // KKPhim / OPhim format (compatible)
    return {
      slug: raw.slug || '',
      name: raw.name || raw.title || '',
      origin_name: raw.origin_name || raw.original_name || '',
      thumb_url: this._img(raw.thumb_url || raw.poster_url, cfg),
      poster_url: this._img(raw.poster_url || raw.thumb_url, cfg),
      year: raw.year || '',
      type: raw.type || '',
      episode_current: raw.episode_current || '',
      quality: raw.quality || 'HD',
      lang: raw.lang || raw.sub_docso || '',
      category: raw.category || [],
      country: raw.country || [],
      _server: server || this._current,
    };
  },

  _img(url, cfg) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return cfg.imgBase ? `${cfg.imgBase}/${url}` : url;
  },

  // ---- OMDb / IMDb ranking ----
  async _fetchOmdb(params) {
    const url = new URL(this.omdb.base);
    url.searchParams.set('apikey', this.omdb.apiKey);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    try {
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data?.Response === 'False' ? null : data;
    } catch (err) {
      console.warn('[OMDb] fetch error:', err);
      return null;
    }
  },

  _omdbCacheGet(key) {
    try {
      const raw = localStorage.getItem(`${this.omdb.cachePrefix}${key}`);
      if (!raw) return undefined;
      const cached = JSON.parse(raw);
      if (!cached || Date.now() - cached.ts > this.omdb.cacheTtlMs) return undefined;
      return cached.data;
    } catch {
      return undefined;
    }
  },

  _omdbCacheSet(key, data) {
    try {
      localStorage.setItem(`${this.omdb.cachePrefix}${key}`, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // Ignore storage quota/private mode.
    }
  },

  _omdbTitleCandidates(movie) {
    const clean = (value) => String(value || '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\b(vietsub|thuyet minh|long tieng|full|hd|fhd|4k)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const candidates = [
      clean(movie?.origin_name),
      clean(movie?.name),
      clean(String(movie?.slug || '').replace(/-/g, ' ')),
    ].filter(Boolean);

    return [...new Set(candidates)];
  },

  _normalizeOmdb(raw) {
    if (!raw) return null;
    const ratingValue = raw.imdbRating && raw.imdbRating !== 'N/A'
      ? Number.parseFloat(raw.imdbRating)
      : null;
    const voteValue = raw.imdbVotes && raw.imdbVotes !== 'N/A'
      ? Number.parseInt(String(raw.imdbVotes).replace(/,/g, ''), 10)
      : 0;
    const metascore = raw.Metascore && raw.Metascore !== 'N/A'
      ? Number.parseInt(raw.Metascore, 10)
      : null;
    const voteBoost = voteValue ? Math.min(0.35, Math.log10(voteValue + 1) / 20) : 0;
    const metaBoost = metascore ? Math.min(0.15, metascore / 700) : 0;

    return {
      title: raw.Title || '',
      year: raw.Year || '',
      rated: raw.Rated || '',
      released: raw.Released || '',
      runtime: raw.Runtime || '',
      genre: raw.Genre || '',
      director: raw.Director || '',
      actors: raw.Actors || '',
      plot: raw.Plot || '',
      language: raw.Language || '',
      country: raw.Country || '',
      awards: raw.Awards || '',
      poster: raw.Poster && raw.Poster !== 'N/A' ? raw.Poster : '',
      metascore,
      imdbRating: raw.imdbRating || '',
      imdbVotes: raw.imdbVotes || '',
      imdbID: raw.imdbID || '',
      type: raw.Type || '',
      ratingValue,
      voteValue,
      rankScore: ratingValue ? ratingValue + voteBoost + metaBoost : 0,
    };
  },

  async getOmdbInfo(movie) {
    const cacheKey = this._movieKey(movie || {});
    const cached = this._omdbCacheGet(cacheKey);
    if (cached !== undefined) return cached;

    const year = String(movie?.year || '').match(/\d{4}/)?.[0] || '';
    const titles = this._omdbTitleCandidates(movie);

    let found = null;
    for (const title of titles) {
      found = await this._fetchOmdb({ t: title, y: year, plot: 'short' });
      if (!found && year) found = await this._fetchOmdb({ t: title, plot: 'short' });
      if (found) break;

      const search = await this._fetchOmdb({ s: title, y: year });
      const first = search?.Search?.find(item => item?.imdbID) || search?.Search?.[0];
      if (first?.imdbID) {
        found = await this._fetchOmdb({ i: first.imdbID, plot: 'short' });
        if (found) break;
      }
    }

    const normalized = this._normalizeOmdb(found);
    this._omdbCacheSet(cacheKey, normalized);
    return normalized;
  },

  async enrichOneWithOmdb(movie) {
    const omdb = await this.getOmdbInfo(movie);
    return {
      ...movie,
      omdb,
      poster_url: movie?.poster_url || omdb?.poster || '',
      thumb_url: movie?.thumb_url || movie?.poster_url || omdb?.poster || '',
    };
  },

  async enrichWithOmdb(items, options = {}) {
    const limit = options.limit || 18;
    const enriched = await Promise.all((items || []).map((movie, index) => {
      if (index >= limit) return movie;
      return this.enrichOneWithOmdb(movie).catch(() => movie);
    }));

    if (options.sort) {
      enriched.sort((a, b) => {
        const scoreA = a.omdb?.rankScore || 0;
        const scoreB = b.omdb?.rankScore || 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
      });
    }

    if (options.rank) {
      let rank = 1;
      enriched.forEach(movie => {
        if (movie.omdb?.ratingValue) movie._rank = rank++;
        else delete movie._rank;
      });
    }

    return enriched;
  },

  // ---- Public API ----
  async getLatest(page = 1) {
    return this.getLatestOnServer(this._current, page);
  },

  async getLatestOnServer(server, page = 1) {
    const s = server || this._current;
    const cfg = this._cfgFor(s);
    if (!cfg) return { items: [], totalPages: 1 };
    const data = await this._fetchFrom(s, cfg.endpoints.latest(page), { quiet: true });
    if (!data) return { items: [], totalPages: 1 };

    let items = [], totalPages = 1;

    if (s === 'nguonc') {
      items = (data.items || data.data || []).map(m => this._normalize(m, s));
      totalPages = data.paginate?.last_page || data.pagination?.last_page || data.total_pages || 1;
    } else {
      // KKP / OPhim
      const list = data.items || data.data?.items || [];
      items = list.map(m => this._normalize(m, s));
      totalPages = data.pagination?.totalPages || data.data?.params?.pagination?.totalPages || 1;
    }

    return { items: items.filter(Boolean), totalPages };
  },

  async search(query, page = 1) {
    return this.searchOnServer(this._current, query, page);
  },

  async searchOnServer(server, query, page = 1) {
    const s = server || this._current;
    const cfg = this._cfgFor(s);
    if (!cfg) return { items: [], totalPages: 1 };
    const data = await this._fetchFrom(s, cfg.endpoints.search(query, page));
    if (!data) return { items: [], totalPages: 1 };

    let items = [], totalPages = 1;
    if (s === 'nguonc') {
      items = (data.items || data.data || []).map(m => this._normalize(m, s));
      totalPages = data.paginate?.last_page || 1;
    } else {
      const list = data.data?.items || data.items || [];
      items = list.map(m => this._normalize(m, s));
      totalPages = data.data?.params?.pagination?.totalPages || 1;
    }
    return { items: items.filter(Boolean), totalPages };
  },

  async searchAll(query, page = 1, serverIds = Object.keys(this.servers)) {
    const results = await Promise.all(
      serverIds.map(server => this.searchOnServer(server, query, page).catch(() => ({ items: [], totalPages: 1 })))
    );

    return this._mergeServerResults(results, serverIds);
  },

  async getLatestFromServers(page = 1, serverIds = Object.keys(this.servers)) {
    const results = await Promise.all(
      serverIds.map(server => this.getLatestOnServer(server, page).catch(() => ({ items: [], totalPages: 1 })))
    );
    return this._mergeServerResults(results, serverIds);
  },

  async getByGenreFromServers(slug, page = 1, serverIds = Object.keys(this.servers)) {
    const results = await Promise.all(
      serverIds.map(server => this._getListOnServer(server, 'genre', slug, page).catch(() => ({ items: [], totalPages: 1 })))
    );
    return this._mergeServerResults(results, serverIds);
  },

  async getByCountryFromServers(slug, page = 1, serverIds = Object.keys(this.servers)) {
    const results = await Promise.all(
      serverIds.map(server => this._getListOnServer(server, 'country', slug, page).catch(() => ({ items: [], totalPages: 1 })))
    );
    return this._mergeServerResults(results, serverIds);
  },

  async getByTypeFromServers(type, page = 1, serverIds = Object.keys(this.servers)) {
    const results = await Promise.all(
      serverIds.map(server => this._getListOnServer(server, 'category', type, page).catch(() => ({ items: [], totalPages: 1 })))
    );
    return this._mergeServerResults(results, serverIds);
  },

  _mergeServerResults(results, serverIds) {
    const grouped = new Map();
    results.forEach((result, index) => {
      const server = serverIds[index];
      (result.items || []).forEach(movie => {
        const key = this._movieKey(movie);
        if (!grouped.has(key)) {
          grouped.set(key, {
            ...movie,
            _server: server,
            _sources: [],
            _serverSlugs: {},
          });
        }
        const target = grouped.get(key);
        if (!target._sources.includes(server)) target._sources.push(server);
        target._serverSlugs[server] = movie.slug;
      });
    });

    const items = [...grouped.values()].map(movie => {
      const preferred = movie._serverSlugs[this._current] ? this._current : movie._sources[0];
      return {
        ...movie,
        _server: preferred,
        slug: movie._serverSlugs[preferred] || movie.slug,
      };
    });

    return {
      items,
      totalPages: Math.max(1, ...results.map(result => result.totalPages || 1)),
      searchedServers: serverIds,
    };
  },

  async getDetail(slug) {
    return this.getDetailFromServer(this._current, slug);
  },

  async getDetailFromServer(server, slug, options = {}) {
    const s = server || this._current;
    const cfg = this._cfgFor(s);
    if (!cfg) return null;
    const data = await this._fetchFrom(s, cfg.endpoints.detail(slug), options);
    if (!data) return null;

    if (s === 'nguonc') {
      // NguonC returns { film: {...}, episodes: [...] }
      const m = data.film || data.movie || data;
      const episodesRaw = data.episodes || m.episodes || [];
      return {
        ...this._normalize(m, s),
        description: m.description || m.content || '',
        episodes: this._parseEpisodesNguonC(episodesRaw),
      };
    }

    const m = data.movie || data.data?.item || data;
    const episodes = data.episodes || data.data?.episodes || [];
    return {
      ...this._normalize(m, s),
      description: m.content || m.description || '',
      episodes: this._parseEpisodes(episodes, cfg),
    };
  },

  _movieKey(movie) {
    const name = String(movie.origin_name || movie.name || movie.slug || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${name}:${movie.year || ''}`;
  },

  _parseEpisodes(raw, cfg) {
    if (!Array.isArray(raw)) return [];
    return raw.map(server => ({
      server_name: server.server_name || 'Server',
      items: (server.server_data || []).map(ep => ({
        name: ep.name,
        slug: ep.slug,
        link_m3u8: ep.link_m3u8 || '',
        link_embed: ep.link_embed || '',
      }))
    }));
  },

  _parseEpisodesNguonC(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((server, i) => ({
      server_name: server.server_name || `Server ${i + 1}`,
      items: (server.items || server.server_data || []).map(ep => ({
        name: ep.name || ep.title || `Tập ${i + 1}`,
        slug: ep.slug || '',
        link_m3u8:  ep.link_m3u8  || ep.m3u8   || '',
        link_embed: ep.link_embed || ep.embed   || ep.link_m3u8 || ep.m3u8 || '',
      }))
    }));
  },

  async getByGenre(slug, page = 1) { return this._getList('genre', slug, page); },
  async getByCountry(slug, page = 1) { return this._getList('country', slug, page); },
  async getByType(type, page = 1) { return this._getList('category', type, page); },

  async _getList(type, slug, page) {
    return this._getListOnServer(this._current, type, slug, page);
  },

  async _getListOnServer(server, type, slug, page) {
    const s = server || this._current;
    const cfg = this._cfgFor(s);
    if (!cfg) return { items: [], totalPages: 1 };
    const endpoint = cfg.endpoints[type](slug, page);
    const data = await this._fetchFrom(s, endpoint, { quiet: true });
    if (!data) return { items: [], totalPages: 1 };

    let items = [], totalPages = 1;
    if (s === 'nguonc') {
      items = (data.items || data.data || []).map(m => this._normalize(m, s));
      totalPages = data.paginate?.last_page || 1;
    } else {
      const list = data.data?.items || data.items || [];
      items = list.map(m => this._normalize(m, s));
      totalPages = data.data?.params?.pagination?.totalPages || 1;
    }
    return { items: items.filter(Boolean), totalPages };
  },
};

API.init();
