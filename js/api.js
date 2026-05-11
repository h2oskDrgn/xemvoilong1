/* ============================================================
   XEM VỚI LONG - api.js  (multi-source movie API)
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
        genre:    (slug, p) => `/api/films/the-loai/${slug}?page=${p}`,
        country:  (slug, p) => `/api/films/quoc-gia/${slug}?page=${p}`,
        category: (type, p) => `/api/films/${type}?page=${p}`,
      },
      imgBase: 'https://phim.nguonc.com',
    }
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

  // ---- Public API ----
  async getLatest(page = 1) {
    const s = this._current;
    const cfg = this._cfg();
    const data = await this._fetch(cfg.endpoints.latest(page));
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

  async searchAll(query, page = 1) {
    const serverIds = Object.keys(this.servers);
    const results = await Promise.all(
      serverIds.map(server => this.searchOnServer(server, query, page).catch(() => ({ items: [], totalPages: 1 })))
    );

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
    const s = this._current;
    const cfg = this._cfg();
    const endpoint = cfg.endpoints[type](slug, page);
    const data = await this._fetch(endpoint);
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
