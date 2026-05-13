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
    cachePrefix: 'dragonfilm_omdb_v2_',
    cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
    disabled: false,
    warnedDisabled: false,
  },

  tmdb: {
    apiKey: 'b3b5d5d4a229be123eb3cafe48dd6f85',
    base: 'https://api.themoviedb.org/3',
    imgBase: 'https://image.tmdb.org/t/p',
    cachePrefix: 'dragonfilm_tmdb_v2_',
    cacheTtlMs: 6 * 60 * 60 * 1000,
  },

  anilist: {
    base: 'https://graphql.anilist.co',
    cachePrefix: 'dragonfilm_anilist_',
    cacheTtlMs: 12 * 60 * 60 * 1000,
  },

  _current: 'kkphim',

  get currentServer() { return this._current; },
  set currentServer(id) {
    if (this.servers[id]) {
      this._current = id;
      localStorage.setItem('dragonfilm_server', id);
    }
  },

  init() {
    const saved = localStorage.getItem('dragonfilm_server');
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

  _normalizePeopleList(value) {
    if (!value) return [];
    const list = Array.isArray(value) ? value : String(value).split(/[,;|]/);
    return list
      .map(item => {
        if (typeof item === 'object') return item.name || item.title || '';
        return item;
      })
      .map(name => String(name || '').trim())
      .filter(Boolean);
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
        actor: this._normalizePeopleList(raw.actor || raw.actors || raw.cast),
        director: this._normalizePeopleList(raw.director || raw.directors),
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
      actor: this._normalizePeopleList(raw.actor || raw.actors || raw.cast),
      director: this._normalizePeopleList(raw.director || raw.directors),
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
    if (this.omdb.disabled) return null;

    const url = new URL(this.omdb.base);
    url.searchParams.set('apikey', this.omdb.apiKey);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        if (res.status === 401) {
          this.omdb.disabled = true;
          if (!this.omdb.warnedDisabled) {
            this.omdb.warnedDisabled = true;
            console.info('[OMDb] Disabled for this session: API key is unauthorized.');
          }
          return null;
        }
        throw new Error(`HTTP ${res.status}`);
      }
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

  _tmdbCacheGet(key) {
    try {
      const raw = localStorage.getItem(`${this.tmdb.cachePrefix}${key}`);
      if (!raw) return undefined;
      const cached = JSON.parse(raw);
      if (!cached || Date.now() - cached.ts > this.tmdb.cacheTtlMs) return undefined;
      return cached.data;
    } catch {
      return undefined;
    }
  },

  _tmdbCacheSet(key, data) {
    try {
      localStorage.setItem(`${this.tmdb.cachePrefix}${key}`, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // Ignore storage quota/private mode.
    }
  },

  async _fetchTmdb(path, params = {}) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.tmdb.base}${cleanPath}`);
    url.searchParams.set('api_key', this.tmdb.apiKey);
    url.searchParams.set('language', params.language || 'vi-VN');
    url.searchParams.set('region', params.region || 'VN');
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && key !== 'language' && key !== 'region') {
        url.searchParams.set(key, value);
      }
    });

    const cacheKey = `${cleanPath}:${url.searchParams.toString()}`;
    const cached = this._tmdbCacheGet(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._tmdbCacheSet(cacheKey, data);
      return data;
    } catch (err) {
      console.warn('[TMDB] fetch error:', err);
      return null;
    }
  },

  _anilistCacheGet(key) {
    try {
      const raw = localStorage.getItem(`${this.anilist.cachePrefix}${key}`);
      if (!raw) return undefined;
      const cached = JSON.parse(raw);
      if (!cached || Date.now() - cached.ts > this.anilist.cacheTtlMs) return undefined;
      return cached.data;
    } catch {
      return undefined;
    }
  },

  _anilistCacheSet(key, data) {
    try {
      localStorage.setItem(`${this.anilist.cachePrefix}${key}`, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // Ignore storage quota/private mode.
    }
  },

  async _fetchAniList(query, variables = {}, cacheKey = '') {
    const cached = cacheKey ? this._anilistCacheGet(cacheKey) : undefined;
    if (cached !== undefined) return cached;

    try {
      const res = await fetch(this.anilist.base, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.errors?.length) throw new Error(data.errors[0]?.message || 'GraphQL error');
      const payload = data?.data || null;
      if (cacheKey) this._anilistCacheSet(cacheKey, payload);
      return payload;
    } catch (err) {
      console.warn('[AniList] fetch error:', err);
      return null;
    }
  },

  _tmdbImage(path, size = 'w500') {
    if (!path) return '';
    if (String(path).startsWith('http')) return path;
    return `${this.tmdb.imgBase}/${size}${path}`;
  },

  _normalizeTmdbMovie(raw) {
    if (!raw) return null;
    const title = raw.title || raw.name || '';
    if (!title) return null;
    const releaseDate = raw.release_date || raw.first_air_date || '';
    return {
      id: raw.id,
      title,
      original_title: raw.original_title || raw.original_name || title,
      overview: raw.overview || '',
      poster_url: this._tmdbImage(raw.poster_path, 'w500'),
      backdrop_url: this._tmdbImage(raw.backdrop_path, 'w780'),
      release_date: releaseDate,
      year: String(releaseDate || '').slice(0, 4),
      vote_average: Number(raw.vote_average || 0),
      vote_count: Number(raw.vote_count || 0),
      popularity: Number(raw.popularity || 0),
      media_type: raw.media_type || 'movie',
      original_language: raw.original_language || '',
      origin_country: raw.origin_country || (raw.production_countries || []).map(country => country.iso_3166_1).filter(Boolean),
      _source: 'tmdb',
    };
  },

  _normalizeTmdbDetails(raw) {
    if (!raw) return null;
    const base = this._normalizeTmdbMovie(raw);
    if (!base) return null;
    return {
      ...base,
      runtime: raw.runtime || '',
      status: raw.status || '',
      tagline: raw.tagline || '',
      genres: (raw.genres || []).map(g => ({ id: g.id, name: g.name })).filter(g => g.name),
      cast: (raw.credits?.cast || [])
        .filter(person => person?.name)
        .slice(0, 12)
        .map(person => ({
          id: person.id,
          name: person.name,
          character: person.character || '',
          profile_url: this._tmdbImage(person.profile_path, 'w185'),
        })),
    };
  },

  _titleKey(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  },

  _taxonomyText(movie) {
    return [
      ...(movie?.category || []),
      ...(movie?.country || []),
    ].map(item => {
      if (typeof item === 'object') return `${item.name || ''} ${item.slug || ''}`;
      return item;
    }).join(' ');
  },

  _isVietnameseMovie(movie) {
    return /viet[-\s]?nam|việt\s*nam|vietnam/i.test(this._taxonomyText(movie));
  },

  _countrySignals(movie) {
    const text = this._taxonomyText(movie).toLowerCase();
    const checks = [
      { re: /han[-\s]?quoc|hàn\s*quốc|korea|south\s*korea/, countries: ['KR'], languages: ['ko'] },
      { re: /trung[-\s]?quoc|trung\s*quốc|china|hong[-\s]?kong|dai[-\s]?loan|đài\s*loan|taiwan/, countries: ['CN', 'HK', 'TW'], languages: ['zh', 'cn'] },
      { re: /nhat[-\s]?ban|nhật\s*bản|japan/, countries: ['JP'], languages: ['ja'] },
      { re: /viet[-\s]?nam|việt\s*nam|vietnam/, countries: ['VN'], languages: ['vi'] },
      { re: /thai[-\s]?lan|thái\s*lan|thailand/, countries: ['TH'], languages: ['th'] },
      { re: /au[-\s]?my|âu\s*mỹ|my|mỹ|usa|united\s*states|america/, countries: ['US'], languages: ['en'] },
      { re: /anh|united\s*kingdom|uk|britain/, countries: ['GB'], languages: ['en'] },
      { re: /an[-\s]?do|ấn\s*độ|india/, countries: ['IN'], languages: ['hi', 'ta', 'te', 'ml', 'kn'] },
    ];
    return checks.reduce((acc, item) => {
      if (!item.re.test(text)) return acc;
      acc.countries.push(...item.countries);
      acc.languages.push(...item.languages);
      return acc;
    }, { countries: [], languages: [] });
  },

  _hasTranslatedLocalTitle(movie) {
    const name = this._titleKey(movie?.name);
    const origin = this._titleKey(movie?.origin_name);
    return Boolean(name && origin && name !== origin);
  },

  _tmdbCountryCodes(info) {
    return [
      ...(Array.isArray(info?.origin_country) ? info.origin_country : []),
      ...(Array.isArray(info?.production_countries) ? info.production_countries.map(country => country.iso_3166_1 || country) : []),
    ].map(value => String(value || '').toUpperCase()).filter(Boolean);
  },

  _externalInfoHasContext(movie) {
    const year = String(movie?.year || '').match(/\d{4}/)?.[0] || '';
    const signals = this._countrySignals(movie);
    return Boolean(year || signals.countries.length || signals.languages.length);
  },

  _externalTitleCandidates(movie) {
    const clean = (value) => String(value || '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\b(vietsub|thuyet minh|long tieng|full|hd|fhd|4k)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const name = clean(movie?.name);
    const origin = clean(movie?.origin_name);
    const slugTitle = clean(String(movie?.slug || '').replace(/-/g, ' '));
    const nameKey = this._titleKey(name);
    const originKey = this._titleKey(origin);
    const base = this._isVietnameseMovie(movie)
      ? [name, originKey && originKey === nameKey ? origin : '', slugTitle]
      : [origin, name, slugTitle];

    return [...new Set(base.filter(Boolean))];
  },

  _scoreTmdbResult(query, year, result) {
    const target = this._titleKey(query);
    const candidates = [
      this._titleKey(result?.title),
      this._titleKey(result?.original_title),
    ].filter(Boolean);
    let score = 0;
    candidates.forEach(candidate => {
      if (candidate === target) score = Math.max(score, 100);
      else if (candidate.includes(target) || target.includes(candidate)) score = Math.max(score, 80);
      else {
        const words = target.split(/\s+/).filter(Boolean);
        const overlap = words.filter(word => candidate.includes(word)).length;
        score = Math.max(score, overlap * 12);
      }
    });
    const resultYear = String(result?.release_date || '').slice(0, 4);
    if (year && resultYear === year) score += 18;
    else if (year && resultYear) score -= 35;
    score += Math.min(8, Number(result?.vote_count || 0) / 1000);
    score += Math.min(8, Number(result?.popularity || 0) / 20);
    return score;
  },

  _isAcceptableExternalYearMatch(expectedYear, resultYear) {
    const expected = Number(String(expectedYear || '').match(/\d{4}/)?.[0] || 0);
    const found = Number(String(resultYear || '').match(/\d{4}/)?.[0] || 0);
    if (!expected || !found) return true;
    return Math.abs(expected - found) <= 1;
  },

  _isTrustedTmdbInfo(movie, info) {
    if (!info) return false;
    if (movie?._source === 'tmdb' && movie.id) return true;

    const year = String(movie?.year || '').match(/\d{4}/)?.[0] || '';
    const infoYear = String(info?.year || info?.release_date || '').match(/\d{4}/)?.[0] || '';
    if (year && infoYear && !this._isAcceptableExternalYearMatch(year, infoYear)) return false;

    const signals = this._countrySignals(movie);
    const expectedCountries = new Set(signals.countries.map(code => code.toUpperCase()));
    const expectedLanguages = new Set(signals.languages.map(code => code.toLowerCase()));
    if (expectedCountries.size || expectedLanguages.size) {
      const infoCountries = this._tmdbCountryCodes(info);
      const infoLanguage = String(info?.original_language || '').toLowerCase();
      const countryMatch = infoCountries.some(code => expectedCountries.has(code));
      const languageMatch = infoLanguage && expectedLanguages.has(infoLanguage);
      if (infoCountries.length || infoLanguage) return Boolean(countryMatch || languageMatch);
    }

    const hasContext = this._externalInfoHasContext(movie);
    if (!hasContext && this._hasTranslatedLocalTitle(movie)) return false;

    const titles = this._externalTitleCandidates(movie);
    const bestScore = Math.max(0, ...titles.map(title => this._scoreTmdbResult(title, year, info)));
    return bestScore >= (hasContext ? 52 : 92);
  },

  _stripHtml(value) {
    return String(value || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  },

  _isLikelyAnime(movie) {
    const taxonomy = [
      ...(movie?.category || []).map(item => typeof item === 'object' ? `${item.name} ${item.slug}` : item),
      ...(movie?.country || []).map(item => typeof item === 'object' ? `${item.name} ${item.slug}` : item),
    ].join(' ').toLowerCase();
    const haystack = [
      movie?.name,
      movie?.origin_name,
      movie?.slug,
      movie?.type,
      taxonomy,
    ].join(' ').toLowerCase();

    return /anime|hoat[-\s]?hinh|hoạt\s*hình|donghua|ova|ona/.test(haystack)
      || (/nhat[-\s]?ban|nhật\s*bản|japan/.test(taxonomy) && /hoat[-\s]?hinh|hoạt\s*hình|anime/.test(taxonomy));
  },

  _scoreAniListResult(query, year, result) {
    const target = this._titleKey(query);
    const title = result?.title || {};
    const candidates = [
      title.romaji,
      title.english,
      title.native,
      ...((result?.synonyms || []).slice(0, 8)),
    ].map(value => this._titleKey(value)).filter(Boolean);

    let score = 0;
    candidates.forEach(candidate => {
      if (candidate === target) score = Math.max(score, 100);
      else if (candidate.includes(target) || target.includes(candidate)) score = Math.max(score, 82);
      else {
        const words = target.split(/\s+/).filter(word => word.length > 2);
        const overlap = words.filter(word => candidate.includes(word)).length;
        score = Math.max(score, overlap * 14);
      }
    });

    if (year && String(result?.seasonYear || result?.startDate?.year || '') === year) score += 16;
    score += Math.min(8, Number(result?.popularity || 0) / 12000);
    score += Math.min(6, Number(result?.averageScore || 0) / 20);
    return score;
  },

  _normalizeAniListMedia(media) {
    if (!media) return null;
    const title = media.title || {};
    const characters = (media.characters?.edges || [])
      .filter(edge => edge?.node?.name?.full)
      .slice(0, 10)
      .map(edge => {
        const voiceActor = edge.voiceActors?.[0];
        return {
          id: edge.node.id,
          name: edge.node.name.full,
          role: edge.role || '',
          image_url: edge.node.image?.medium || '',
          voice_actor: voiceActor?.name?.full || '',
          voice_actor_image_url: voiceActor?.image?.medium || '',
        };
      });

    return {
      id: media.id,
      title_romaji: title.romaji || '',
      title_english: title.english || '',
      title_native: title.native || '',
      synonyms: media.synonyms || [],
      description: this._stripHtml(media.description),
      format: media.format || '',
      status: media.status || '',
      episodes: media.episodes || '',
      duration: media.duration || '',
      season_year: media.seasonYear || media.startDate?.year || '',
      average_score: Number(media.averageScore || 0),
      mean_score: Number(media.meanScore || 0),
      popularity: Number(media.popularity || 0),
      genres: media.genres || [],
      studios: (media.studios?.nodes || []).map(studio => studio.name).filter(Boolean),
      cover_url: media.coverImage?.extraLarge || media.coverImage?.large || '',
      banner_url: media.bannerImage || '',
      site_url: media.siteUrl || '',
      characters,
    };
  },

  _currentAniListSeason(date = new Date()) {
    const month = date.getMonth() + 1;
    if (month <= 3) return { season: 'WINTER', label: 'Mùa Đông', year: date.getFullYear() };
    if (month <= 6) return { season: 'SPRING', label: 'Mùa Xuân', year: date.getFullYear() };
    if (month <= 9) return { season: 'SUMMER', label: 'Mùa Hè', year: date.getFullYear() };
    return { season: 'FALL', label: 'Mùa Thu', year: date.getFullYear() };
  },

  async getTmdbWeeklyRanking(limit = 5) {
    const data = await this._fetchTmdb('/trending/movie/week', { page: 1, include_adult: false });
    return (data?.results || [])
      .map(item => this._normalizeTmdbMovie({ ...item, media_type: 'movie' }))
      .filter(Boolean)
      .slice(0, limit);
  },

  _tmdbRegionMatches(item, languages = [], countries = []) {
    const languageSet = new Set((languages || []).map(value => String(value).toLowerCase()));
    const countrySet = new Set((countries || []).map(value => String(value).toUpperCase()));
    const lang = String(item?.original_language || '').toLowerCase();
    const originCountries = Array.isArray(item?.origin_country) ? item.origin_country : [];
    return (lang && languageSet.has(lang))
      || originCountries.some(country => countrySet.has(String(country).toUpperCase()));
  },

  _dedupeTmdbRanking(items) {
    const map = new Map();
    (items || []).forEach(item => {
      if (!item) return;
      const mediaType = item.media_type || 'movie';
      const key = `${mediaType}:${item.id || item.title || item.name}`;
      if (map.has(key)) return;
      const normalized = this._normalizeTmdbMovie({ ...item, media_type: mediaType });
      if (normalized) map.set(key, normalized);
    });
    return [...map.values()];
  },

  async getTmdbRegionalWeeklyRanking({ limit = 20, languages = [], countries = [] } = {}) {
    const safeLimit = Math.max(1, Number(limit) || 20);
    const weeklyPages = [1, 2, 3, 4, 5];
    const weeklyResults = await Promise.all(
      weeklyPages.map(page => this._fetchTmdb('/trending/all/week', { page, include_adult: false }).catch(() => null))
    );

    const rawItems = weeklyResults
      .flatMap(page => page?.results || [])
      .filter(item => ['movie', 'tv'].includes(item?.media_type || 'movie'))
      .filter(item => this._tmdbRegionMatches(item, languages, countries));

    if (rawItems.length < safeLimit) {
      const baseParams = {
        page: 1,
        include_adult: false,
        sort_by: 'popularity.desc',
      };
      const languageList = languages.length ? languages : [''];
      const countryList = countries.length ? countries : [''];
      const discoverTasks = ['movie', 'tv'].flatMap(mediaType =>
        languageList.flatMap(language =>
          countryList.map(country => this._fetchTmdb(`/discover/${mediaType}`, {
            ...baseParams,
            ...(language ? { with_original_language: language } : {}),
            ...(country ? { with_origin_country: country } : {}),
          })
            .then(data => (data?.results || []).map(item => ({ ...item, media_type: mediaType })))
            .catch(() => []))
        )
      );
      const discoverItems = (await Promise.all(discoverTasks)).flat();
      rawItems.push(...discoverItems);
    }

    return this._dedupeTmdbRanking(rawItems).slice(0, safeLimit);
  },

  async getTmdbKoreaWeeklyRanking(limit = 20) {
    return this.getTmdbRegionalWeeklyRanking({
      limit,
      languages: ['ko'],
      countries: ['KR'],
    });
  },

  async getTmdbChinaWeeklyRanking(limit = 20) {
    return this.getTmdbRegionalWeeklyRanking({
      limit,
      languages: ['zh', 'cn'],
      countries: ['CN', 'HK', 'TW'],
    });
  },

  async _getAniListRanking({ limit = 12, seasonInfo = null, cacheKey = 'weekly' } = {}) {
    const seasonArgs = seasonInfo ? ', season: $season, seasonYear: $seasonYear' : '';
    const seasonVars = seasonInfo ? ', $season: MediaSeason, $seasonYear: Int' : '';
    const query = `
      query ($perPage: Int${seasonVars}) {
        Page(page: 1, perPage: $perPage) {
          media(type: ANIME${seasonArgs}, sort: TRENDING_DESC) {
            id
            title { romaji english native }
            synonyms
            description(asHtml: false)
            format
            status
            episodes
            duration
            seasonYear
            startDate { year }
            averageScore
            meanScore
            popularity
            genres
            coverImage { large extraLarge }
            bannerImage
            siteUrl
            studios(isMain: true) { nodes { name } }
          }
        }
      }`;
    const variables = {
      ...(seasonInfo ? { season: seasonInfo.season, seasonYear: seasonInfo.year } : {}),
      perPage: limit,
    };
    return (await this._fetchAniList(query, variables, `ranking:${cacheKey}:v1:${limit}`))?.Page?.media || [];
  },

  async getAniListWeeklyAnimeRanking(limit = 12) {
    const items = await this._getAniListRanking({ limit, cacheKey: 'weekly' });
    return items
      .map(media => this._normalizeAniListMedia(media))
      .filter(Boolean)
      .slice(0, limit);
  },

  async getAniListSeasonAnimeRanking(limit = 12) {
    const seasonInfo = this._currentAniListSeason();
    const items = await this._getAniListRanking({
      limit,
      seasonInfo,
      cacheKey: `season:${seasonInfo.season}:${seasonInfo.year}`,
    });
    const normalized = items
      .map(media => this._normalizeAniListMedia(media))
      .filter(Boolean)
      .slice(0, limit);
    return {
      ...seasonInfo,
      items: normalized,
    };
  },

  _hasPlayableLink(ep) {
    return Boolean(ep?.link_embed || ep?.link_m3u8);
  },

  _hasPlayableEpisode(movie) {
    return (movie?.episodes || []).some(server => (server?.items || []).some(ep => this._hasPlayableLink(ep)));
  },

  _scoreLocalMovieResult(query, year, movie) {
    const target = this._titleKey(query);
    if (!target) return 0;
    const targetWords = target.split(/\s+/).filter(word => word.length > 1);
    const candidates = [
      movie?.origin_name,
      movie?.name,
      String(movie?.slug || '').replace(/-/g, ' '),
    ].map(value => this._titleKey(value)).filter(Boolean);
    let score = 0;
    candidates.forEach(candidate => {
      if (candidate === target) score = Math.max(score, 100);
      else if (candidate.includes(target) || target.includes(candidate)) {
        const candidateWords = candidate.split(/\s+/).filter(word => word.length > 1);
        const overlap = targetWords.filter(word => candidateWords.includes(word)).length;
        const targetCoverage = targetWords.length ? overlap / targetWords.length : 0;
        const candidateCoverage = candidateWords.length ? overlap / candidateWords.length : 0;
        if (targetCoverage >= 0.85 && candidateCoverage >= 0.65) score = Math.max(score, 88);
        else if (targetWords.length >= 3 && targetCoverage >= 0.8) score = Math.max(score, 78);
      }
      else {
        const candidateWords = candidate.split(/\s+/).filter(word => word.length > 1);
        const overlap = targetWords.filter(word => candidateWords.includes(word)).length;
        const targetCoverage = targetWords.length ? overlap / targetWords.length : 0;
        const candidateCoverage = candidateWords.length ? overlap / candidateWords.length : 0;
        score = Math.max(score, Math.round(Math.min(targetCoverage, candidateCoverage) * 86));
      }
    });
    const movieYear = String(movie?.year || '').match(/\d{4}/)?.[0] || '';
    if (year && movieYear && this._isAcceptableExternalYearMatch(year, movieYear)) score += 14;
    else if (year && movieYear) score -= 45;
    return score;
  },

  _isStrongLocalMovieMatch(query, year, movie, strict = false) {
    const score = this._scoreLocalMovieResult(query, year, movie);
    const movieYear = String(movie?.year || '').match(/\d{4}/)?.[0] || '';
    const hasYearMismatch = Boolean(year && movieYear && !this._isAcceptableExternalYearMatch(year, movieYear));
    if (hasYearMismatch) return false;
    return score >= (strict || year ? 82 : 70);
  },

  async findPlayableMovie(query, options = {}) {
    const title = String(query || '').trim();
    if (!title) return null;
    const serverIds = options.serverIds || Object.keys(this.servers);
    const year = String(options.year || '').match(/\d{4}/)?.[0] || '';
    const strict = Boolean(options.strict);
    const result = await this.searchAll(title, 1, serverIds);
    const candidates = (result?.items || [])
      .map(movie => ({ movie, score: this._scoreLocalMovieResult(title, year, movie) }))
      .filter(item => this._isStrongLocalMovieMatch(title, year, item.movie, strict))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    for (const { movie } of candidates) {
      const slugs = movie._serverSlugs || { [movie._server || serverIds[0]]: movie.slug };
      const sources = (movie._sources?.length ? movie._sources : Object.keys(slugs))
        .filter(server => serverIds.includes(server));

      for (const server of sources) {
        const slug = slugs[server];
        if (!slug) continue;
        const detail = await this.getDetailFromServer(server, slug, { quiet: true });
        if (!detail || !this._hasPlayableEpisode(detail)) continue;
        if (!this._isStrongLocalMovieMatch(title, year, detail, strict)) continue;
        return {
          ...movie,
          ...detail,
          _server: server,
          slug: detail.slug || slug,
          _sources: sources,
          _serverSlugs: { ...slugs, [server]: detail.slug || slug },
        };
      }
    }

    return null;
  },

  async getAniListInfo(movie) {
    if (!this._isLikelyAnime(movie)) return null;

    const cacheKey = `info:v1:${this._movieKey(movie || {})}`;
    const cached = this._anilistCacheGet(cacheKey);
    if (cached !== undefined) return cached;

    const query = `
      query ($search: String) {
        Page(page: 1, perPage: 8) {
          media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            title { romaji english native }
            synonyms
            description(asHtml: false)
            format
            status
            episodes
            duration
            seasonYear
            startDate { year }
            averageScore
            meanScore
            popularity
            genres
            coverImage { large extraLarge }
            bannerImage
            siteUrl
            studios(isMain: true) { nodes { name } }
            characters(page: 1, perPage: 10, sort: ROLE) {
              edges {
                role
                node { id name { full } image { medium } }
                voiceActors(language: JAPANESE) {
                  name { full }
                  image { medium }
                }
              }
            }
          }
        }
      }`;

    const year = String(movie?.year || '').match(/\d{4}/)?.[0] || '';
    const titles = this._omdbTitleCandidates(movie);
    let best = null;

    for (const title of titles) {
      const data = await this._fetchAniList(query, { search: title }, `search:v1:${this._titleKey(title)}`);
      const ranked = (data?.Page?.media || [])
        .map(media => ({ media, score: this._scoreAniListResult(title, year, media) }))
        .sort((a, b) => b.score - a.score);
      if (ranked[0] && (!best || ranked[0].score > best.score)) best = ranked[0];
      if (best?.score >= 96) break;
    }

    const normalized = best?.score >= 45 ? this._normalizeAniListMedia(best.media) : null;
    this._anilistCacheSet(cacheKey, normalized);
    return normalized;
  },

  async enrichOneWithAniList(movie) {
    const anilist = await this.getAniListInfo(movie);
    return {
      ...movie,
      anilist,
      poster_url: movie?.poster_url || anilist?.cover_url || '',
      thumb_url: movie?.thumb_url || movie?.poster_url || anilist?.banner_url || anilist?.cover_url || '',
    };
  },

  async enrichWithAniList(items, options = {}) {
    const limit = options.limit || 12;
    return Promise.all((items || []).map((movie, index) => {
      if (index >= limit) return movie;
      return this.enrichOneWithAniList(movie).catch(() => movie);
    }));
  },

  async getTmdbInfo(movie) {
    const cacheKey = movie?._source === 'tmdb' && movie.id
      ? `info:tmdb:${movie.id}`
      : `info:${this._movieKey(movie || {})}`;
    const cached = this._tmdbCacheGet(cacheKey);
    if (cached !== undefined) return this._isTrustedTmdbInfo(movie, cached) ? cached : null;

    let detail = null;
    if (movie?._source === 'tmdb' && movie.id) {
      detail = await this._fetchTmdb(`/movie/${movie.id}`, { append_to_response: 'credits' });
    } else {
      const year = String(movie?.year || '').match(/\d{4}/)?.[0] || '';
      const titles = this._omdbTitleCandidates(movie);
      for (const title of titles) {
        const searches = [];
        if (year) searches.push(await this._fetchTmdb('/search/movie', { query: title, primary_release_year: year, page: 1, include_adult: false }));
        searches.push(await this._fetchTmdb('/search/movie', { query: title, page: 1, include_adult: false }));
        const results = searches.flatMap(data => data?.results || []);
        const best = results
          .map(item => ({ item, score: this._scoreTmdbResult(title, year, item) }))
          .filter(({ item, score }) => {
            const resultYear = String(item?.release_date || '').slice(0, 4);
            return score >= 52
              && this._isAcceptableExternalYearMatch(year, resultYear)
              && this._isTrustedTmdbInfo(movie, item);
          })
          .sort((a, b) => b.score - a.score)[0]?.item;
        if (best?.id) {
          detail = await this._fetchTmdb(`/movie/${best.id}`, { append_to_response: 'credits' });
          if (detail) break;
        }
      }
    }

    const normalized = this._normalizeTmdbDetails(detail);
    if (normalized && !this._isTrustedTmdbInfo(movie, normalized)) {
      this._tmdbCacheSet(cacheKey, null);
      return null;
    }
    this._tmdbCacheSet(cacheKey, normalized);
    return normalized;
  },

  async enrichOneWithTmdb(movie) {
    const tmdb = await this.getTmdbInfo(movie);
    return {
      ...movie,
      tmdb,
      poster_url: movie?.poster_url || tmdb?.poster_url || '',
      thumb_url: movie?.thumb_url || movie?.poster_url || tmdb?.backdrop_url || tmdb?.poster_url || '',
    };
  },

  async enrichWithTmdb(items, options = {}) {
    const limit = options.limit || 18;
    const enriched = await Promise.all((items || []).map((movie, index) => {
      if (index >= limit) return movie;
      return this.enrichOneWithTmdb(movie).catch(() => movie);
    }));

    if (options.sort) {
      enriched.sort((a, b) => {
        const scoreA = (a.tmdb?.vote_average || 0) + Math.min(0.5, Math.log10((a.tmdb?.vote_count || 0) + 1) / 10);
        const scoreB = (b.tmdb?.vote_average || 0) + Math.min(0.5, Math.log10((b.tmdb?.vote_count || 0) + 1) / 10);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
      });
    }

    if (options.rank) {
      let rank = 1;
      enriched.forEach(movie => {
        if (movie.tmdb?.vote_average) movie._rank = rank++;
        else delete movie._rank;
      });
    }

    return enriched;
  },

  _uniqueTmdbMovies(items) {
    const map = new Map();
    (items || []).forEach(item => {
      if (!item?.id || map.has(item.id)) return;
      map.set(item.id, item);
    });
    return [...map.values()];
  },

  _omdbTitleCandidates(movie) {
    return this._externalTitleCandidates(movie);
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

  _isTrustedOmdbInfo(movie, info) {
    if (!info) return false;
    const year = String(movie?.year || '').match(/\d{4}/)?.[0] || '';
    if (year && info?.year && !this._isAcceptableExternalYearMatch(year, info.year)) return false;
    if (!this._externalInfoHasContext(movie) && this._hasTranslatedLocalTitle(movie)) return false;
    const titles = this._externalTitleCandidates(movie);
    const targetTitles = [info.title, String(info.imdbID || '').replace(/-/g, ' ')]
      .map(value => this._titleKey(value))
      .filter(Boolean);
    const bestScore = Math.max(0, ...titles.flatMap(title => {
      const key = this._titleKey(title);
      return targetTitles.map(target => {
        if (key === target) return 100;
        if (key.includes(target) || target.includes(key)) return 82;
        const words = key.split(/\s+/).filter(word => word.length > 2);
        const overlap = words.filter(word => target.includes(word)).length;
        return overlap * 14;
      });
    }));
    return bestScore >= (this._externalInfoHasContext(movie) ? 52 : 92);
  },

  async getOmdbInfo(movie) {
    const cacheKey = this._movieKey(movie || {});
    const cached = this._omdbCacheGet(cacheKey);
    if (cached !== undefined) return this._isTrustedOmdbInfo(movie, cached) ? cached : null;

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
    if (normalized && !this._isTrustedOmdbInfo(movie, normalized)) {
      this._omdbCacheSet(cacheKey, null);
      return null;
    }
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
    const name = String(this._externalTitleCandidates(movie)[0] || movie.name || movie.origin_name || movie.slug || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
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
