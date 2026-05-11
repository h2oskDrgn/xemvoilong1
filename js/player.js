/* ============================================================
   XEM VỚI LONG — player.js  (YouTube-style)
   ============================================================ */

const PlayerState = {
  slug: '',
  server: '',
  movie: null,
  episodes: [],
  currentServer: 0,
  currentEp: 0,
  videoEl: null,
  iframeEl: null,
  isIframe: false,
  serverSlugs: {},
  serverAvailability: {},
  holdTimer: null,
  controlsTimer: null,
};

/* ---- SVG Icons ---- */
const Icons = {
  play:      `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pause:     `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  back10:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V7l-4-4 4-4v3c.17 0 .33.01.5.01z"/><text x="8.5" y="15.5" font-size="7" font-weight="bold" fill="currentColor" font-family="sans-serif">10</text></svg>`,
  fwd10:     `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 3a9 9 0 1 1-9 9h2a7 7 0 1 0 7-7V7l4-4-4-4v3c-.17 0-.33.01-.5.01z"/><text x="8.5" y="15.5" font-size="7" font-weight="bold" fill="currentColor" font-family="sans-serif">10</text></svg>`,
  volHigh:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
  volMute:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
  fullscreen:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
  exitFs:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`,
  pip:       `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.95 2 1.95h18c1.1 0 2-.85 2-1.95V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/></svg>`,
};

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  PlayerState.slug   = qp('slug')   || '';
  PlayerState.server = qp('server') || API.currentServer;
  PlayerState.serverSlugs = parseServerSources(qp('sources'));
  if (PlayerState.server && PlayerState.slug) {
    PlayerState.serverSlugs[PlayerState.server] = PlayerState.slug;
  }
  API.currentServer  = PlayerState.server;

  if (!PlayerState.slug) {
    showError('Không tìm thấy phim. Vui lòng quay lại trang chủ.');
    return;
  }
  await loadMovie();
});

/* ============================================================
   LOAD MOVIE
   ============================================================ */
async function loadMovie() {
  showSpinner();
  try {
    await loadServerAvailability();
    const preferred = PlayerState.serverAvailability[PlayerState.server]?.playable
      ? PlayerState.server
      : Object.keys(PlayerState.serverAvailability).find(server => PlayerState.serverAvailability[server]?.playable);

    if (preferred) {
      activateApiServer(preferred, true);
    } else {
      renderApiServerButtons();
      showError('Phim này chưa có player API. Hãy thử server khác.');
    }
  } catch (e) {
    showError('Lỗi tải phim. Vui lòng thử lại.');
    console.error(e);
  }
}

function showSpinner() {
  const w = document.getElementById('player-wrap');
  if (w) w.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
}

function showError(msg) {
  const w = document.getElementById('player-wrap');
  if (w) w.innerHTML = `<div class="spinner-wrap" style="flex-direction:column;gap:14px">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
    <p style="color:var(--text-dim);font-family:var(--font-title);text-align:center;max-width:280px;font-size:14px">${msg}</p>
  </div>`;
}

/* ============================================================
   RENDER MOVIE INFO
   ============================================================ */
function renderMovieInfo(m) {
  document.title = `${m.name} - Xem Với Long`;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('movie-title', m.name || '');
  set('movie-sub', [m.year, m.quality, m.lang, m.origin_name].filter(Boolean).join(' · '));
  set('movie-desc', m.description || '');

  const posterEl = document.getElementById('movie-poster');
  if (posterEl && (m.poster_url || m.thumb_url)) {
    posterEl.src = m.poster_url || m.thumb_url;
    posterEl.onerror = function () { this.style.display = 'none'; };
  }

  const tagsEl = document.getElementById('movie-tags');
  if (tagsEl) {
    const cats = [...(m.category || []), ...(m.country || [])];
    tagsEl.innerHTML = cats
      .map(c => `<span class="movie-tag">${escHtml(typeof c === 'object' ? c.name : c)}</span>`)
      .join('');
  }
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ============================================================
   RENDER EPISODES
   ============================================================ */
function renderEpisodes(episodes) {
  PlayerState.episodes = episodes;
  const cont = document.getElementById('episode-servers');
  if (!cont) return;
  cont.innerHTML = '';

  if (!episodes?.length) {
    cont.innerHTML = '<p style="color:var(--text-muted);font-size:14px">Chưa có tập phim.</p>';
    return;
  }

  episodes.forEach((srv, si) => {
    const block = document.createElement('div');
    block.className = 'player-options';
    block.innerHTML = `<div class="player-options-title">${escHtml(srv.server_name)}</div>
      <div class="ep-grid" id="ep-grid-${si}"></div>`;
    cont.appendChild(block);

    const grid = block.querySelector(`#ep-grid-${si}`);
    (srv.items || []).forEach((ep, ei) => {
      const btn = document.createElement('button');
      btn.className = 'ep-btn';
      btn.textContent = ep.name || `Tập ${ei + 1}`;
      if (!ep.link_embed) {
        btn.disabled = true;
        btn.title = 'Tập này chưa có player API';
      }
      btn.addEventListener('click', () => playEpisode(si, ei, false));
      grid.appendChild(btn);
    });
  });
}

function setActiveEpBtn(si, ei) {
  document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`ep-grid-${si}`)?.querySelectorAll('.ep-btn')[ei]?.classList.add('active');
}

function findFirstPlayableEpisode(episodes) {
  if (!Array.isArray(episodes)) return null;
  for (let serverIdx = 0; serverIdx < episodes.length; serverIdx += 1) {
    const items = episodes[serverIdx]?.items || [];
    const epIdx = items.findIndex(ep => ep.link_embed);
    if (epIdx >= 0) return { serverIdx, epIdx };
  }
  return null;
}

function parseServerSources(raw) {
  const map = {};
  String(raw || '').split('|').forEach(part => {
    const [server, ...slugParts] = part.split(':');
    const slug = slugParts.join(':');
    if (server && slug) map[server] = decodeURIComponent(slug);
  });
  return map;
}

function encodeServerSources(sourceMap) {
  return Object.entries(sourceMap || {})
    .filter(([, slug]) => slug)
    .map(([server, slug]) => `${server}:${encodeURIComponent(slug)}`)
    .join('|');
}

function hasPlayableEpisode(movie) {
  return Boolean(findFirstPlayableEpisode(movie?.episodes || []));
}

async function loadServerAvailability() {
  const serverIds = Object.keys(API.servers);
  const results = await Promise.all(serverIds.map(async server => {
    const slug = PlayerState.serverSlugs[server] || PlayerState.slug;
    if (!slug) return [server, { available: false, playable: false, slug: '', movie: null }];
    const movie = await API.getDetailFromServer(server, slug, { quiet: true });
    if (!movie) return [server, { available: false, playable: false, slug, movie: null }];
    PlayerState.serverSlugs[server] = movie.slug || slug;
    return [server, {
      available: true,
      playable: hasPlayableEpisode(movie),
      slug: movie.slug || slug,
      movie,
    }];
  }));

  PlayerState.serverAvailability = Object.fromEntries(results);
  renderApiServerButtons();
}

function renderApiServerButtons() {
  document.querySelectorAll('.server-btn[data-server]').forEach(btn => {
    const server = btn.dataset.server;
    const cfg = API.servers[server];
    const status = PlayerState.serverAvailability[server];
    const hasMovie = Boolean(status?.playable);
    btn.classList.toggle('active', server === PlayerState.server);
    btn.classList.toggle('has-movie', hasMovie);
    btn.classList.toggle('no-movie', !hasMovie);
    btn.disabled = !hasMovie;
    if (cfg) {
      btn.textContent = `${cfg.name} · ${cfg.short} · ${hasMovie ? 'Có phim' : 'Không có'}`;
    }
  });
}

function updateMovieUrl() {
  const params = new URLSearchParams({
    slug: PlayerState.slug,
    server: PlayerState.server,
  });
  const sources = encodeServerSources(PlayerState.serverSlugs);
  if (sources) params.set('sources', sources);
  window.history.replaceState({}, '', `movie.html?${params.toString()}`);
}

function activateApiServer(server, shouldResume = false) {
  const status = PlayerState.serverAvailability[server];
  if (!status?.playable || !status.movie) {
    showToast('Server này chưa có phim phát được', 'error');
    renderApiServerButtons();
    return;
  }

  PlayerState.server = server;
  PlayerState.slug = status.slug;
  API.currentServer = server;
  PlayerState.movie = status.movie;
  renderApiServerButtons();
  renderMovieInfo(status.movie);
  renderEpisodes(status.movie.episodes);

  if (Auth.getUser()) {
    History.add({
      slug: status.movie.slug,
      name: status.movie.name,
      poster_url: status.movie.poster_url || status.movie.thumb_url,
      year: status.movie.year,
      _server: server,
    });
  }

  const firstPlayable = findFirstPlayableEpisode(status.movie.episodes);
  if (firstPlayable) playEpisode(firstPlayable.serverIdx, firstPlayable.epIdx, shouldResume);
  updateMovieUrl();
}

window.switchApiServer = function switchApiServer(serverId) {
  activateApiServer(serverId, false);
};

/* ============================================================
   PLAY EPISODE
   ============================================================ */
function playEpisode(serverIdx, epIdx, shouldResume = false) {
  const srv = PlayerState.episodes[serverIdx];
  if (!srv?.items[epIdx]) return;

  PlayerState.currentServer = serverIdx;
  PlayerState.currentEp     = epIdx;
  setActiveEpBtn(serverIdx, epIdx);

  if (PlayerState.videoEl && PlayerState.slug) {
    ResumeTime.set(PlayerState.slug, PlayerState.videoEl.currentTime);
  }

  const ep   = srv.items[epIdx];
  const link = ep.link_embed || '';
  if (!link) {
    showError('Tập này chưa có player API. Hãy thử tập khác hoặc nguồn khác.');
    return;
  }

  buildPlayer(link, true, shouldResume);
}

/* ============================================================
   BUILD PLAYER
   ============================================================ */
function buildPlayer(src, isIframe, shouldResume = false) {
  PlayerState.isIframe = isIframe;
  const wrap = document.getElementById('player-wrap');
  if (!wrap) return;

  if (isIframe) {
    wrap.innerHTML = `
      <div class="video-wrap" id="video-wrap">
        <iframe src="${escHtml(src)}" allowfullscreen
          allow="autoplay; fullscreen; picture-in-picture"
          id="player-iframe" referrerpolicy="no-referrer"></iframe>
        <div class="iframe-notice">Đang dùng player của API</div>
      </div>`;
    PlayerState.iframeEl = document.getElementById('player-iframe');
    PlayerState.videoEl  = null;
    return;
  }

  wrap.innerHTML = `
    <div class="video-wrap paused" id="video-wrap">

      <video id="player-video" preload="metadata" playsinline webkit-playsinline></video>

      <!-- Overlays -->
      <div class="click-overlay" id="click-overlay"></div>

      <div class="yt-seek-flash left" id="seek-left">
        ${Icons.back10}
        <span style="font-size:11px">10 giây</span>
      </div>
      <div class="yt-seek-flash right" id="seek-right">
        ${Icons.fwd10}
        <span style="font-size:11px">10 giây</span>
      </div>

      <div class="yt-speed-ind" id="speed-ind">2×</div>
      <div class="yt-buffering" id="buffering"></div>

      <!-- Center play icon (shown when paused) -->
      <div class="yt-center-play">${Icons.play}</div>

      <!-- Controls -->
      <div class="yt-controls" id="yt-controls">
        <div class="yt-progress" id="yt-progress">
          <div class="yt-progress-buf"  id="prog-buf"  style="width:0%"></div>
          <div class="yt-progress-fill" id="prog-fill" style="width:0%"></div>
          <div class="yt-progress-thumb" id="prog-thumb" style="left:0%"></div>
        </div>
        <div class="yt-controls-row">
          <button class="yt-btn" id="btn-play"  title="Play/Pause (Space)">${Icons.play}</button>
          <button class="yt-btn" id="btn-back10" title="Tua lùi 10s (←)">${Icons.back10}</button>
          <button class="yt-btn" id="btn-fwd10"  title="Tua tới 10s (→)">${Icons.fwd10}</button>
          <div class="yt-volume-wrap">
            <button class="yt-btn" id="btn-mute" title="Tắt tiếng (M)">${Icons.volHigh}</button>
            <input type="range" class="yt-volume-slider" id="vol-slider"
              min="0" max="1" step="0.02" value="1">
          </div>
          <span class="yt-time" id="time-display">0:00 / 0:00</span>
          <div class="yt-spacer"></div>
          <button class="yt-btn" id="btn-pip" title="Picture in Picture">${Icons.pip}</button>
          <button class="yt-btn" id="btn-fs"  title="Toàn màn hình (F)">${Icons.fullscreen}</button>
        </div>
      </div>

    </div>`;

  const video = document.getElementById('player-video');
  PlayerState.videoEl = video;
  video.src = src;

  video.addEventListener('loadedmetadata', () => {
    // Chỉ resume thời gian dở khi shouldResume = true (tức là lần đầu vào phim)
    // Khi chuyển tập (shouldResume = false) thì luôn bắt đầu từ đầu
    if (shouldResume) {
      const t = ResumeTime.get(PlayerState.slug);
      if (t > 5 && t < video.duration - 5) {
        video.currentTime = t;
        showToast(`Tiếp tục từ ${fmtTime(t)}`, 'info');
      }
    }
    video.play().catch(() => {});
  });

  initVideoControls(video);
}

/* ============================================================
   INIT VIDEO CONTROLS
   ============================================================ */
function initVideoControls(video) {
  const wrap      = document.getElementById('video-wrap');
  const overlay   = document.getElementById('click-overlay');
  const btnPlay   = document.getElementById('btn-play');
  const btnBack   = document.getElementById('btn-back10');
  const btnFwd    = document.getElementById('btn-fwd10');
  const btnMute   = document.getElementById('btn-mute');
  const volSlider = document.getElementById('vol-slider');
  const timeDisp  = document.getElementById('time-display');
  const progress  = document.getElementById('yt-progress');
  const progFill  = document.getElementById('prog-fill');
  const progBuf   = document.getElementById('prog-buf');
  const progThumb = document.getElementById('prog-thumb');
  const btnPip    = document.getElementById('btn-pip');
  const btnFs     = document.getElementById('btn-fs');
  const seekLeft  = document.getElementById('seek-left');
  const seekRight = document.getElementById('seek-right');
  const speedInd  = document.getElementById('speed-ind');
  const buffering = document.getElementById('buffering');

  /* ---- Show / hide controls ---- */
  const showControls = () => {
    wrap?.classList.add('show-controls');
    clearTimeout(PlayerState.controlsTimer);
    if (!video.paused) {
      PlayerState.controlsTimer = setTimeout(
        () => wrap?.classList.remove('show-controls'), 3000
      );
    }
  };
  wrap?.addEventListener('mousemove', showControls);
  // Touch: toggle show/hide
  let touchShowTimer;
  overlay?.addEventListener('touchstart', () => {
    clearTimeout(touchShowTimer);
    if (!wrap.classList.contains('show-controls')) {
      showControls();
    }
  }, { passive: true });

  /* ---- Buffering indicator ---- */
  video.addEventListener('waiting', () => buffering?.classList.add('show'));
  video.addEventListener('playing', () => buffering?.classList.remove('show'));
  video.addEventListener('canplay', () => buffering?.classList.remove('show'));

  /* ---- Play / Pause ---- */
  function togglePlay() {
    if (video.paused) video.play();
    else video.pause();
  }

  video.addEventListener('play', () => {
    if (btnPlay) btnPlay.innerHTML = Icons.pause;
    wrap?.classList.remove('paused');
    showControls();
  });
  video.addEventListener('pause', () => {
    if (btnPlay) btnPlay.innerHTML = Icons.play;
    wrap?.classList.add('paused', 'show-controls');
    clearTimeout(PlayerState.controlsTimer);
  });
  video.addEventListener('ended', () => {
    if (btnPlay) btnPlay.innerHTML = Icons.play;
    wrap?.classList.add('paused', 'show-controls');
  });

  btnPlay?.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

  /* ---- Click overlay: single tap = play/pause, double tap = seek ---- */
  let lastTap = 0, tapTimer;
  overlay?.addEventListener('click', (e) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      clearTimeout(tapTimer);
      // Double tap
      const rect = overlay.getBoundingClientRect();
      const x    = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
      const third = rect.width / 3;
      if (x < third) {
        video.currentTime = Math.max(0, video.currentTime - 10);
        flashEl(seekLeft);
      } else if (x > rect.width - third) {
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
        flashEl(seekRight);
      } else {
        togglePlay();
      }
    } else {
      tapTimer = setTimeout(() => { if (Date.now() - lastTap >= 295) togglePlay(); }, 300);
    }
    lastTap = now;
    showControls();
  });

  function flashEl(el) {
    if (!el) return;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 650);
  }

  /* ---- Hold to 2× speed ---- */
  let holdTimer;
  const startHold = () => {
    holdTimer = setTimeout(() => {
      video.playbackRate = 2;
      speedInd?.classList.add('show');
    }, 500);
  };
  const endHold = () => {
    clearTimeout(holdTimer);
    video.playbackRate = 1;
    speedInd?.classList.remove('show');
  };
  overlay?.addEventListener('mousedown', startHold);
  overlay?.addEventListener('mouseup',   endHold);
  overlay?.addEventListener('mouseleave', endHold);
  overlay?.addEventListener('touchstart', startHold, { passive: true });
  overlay?.addEventListener('touchend',   endHold);

  /* ---- Skip buttons ---- */
  btnBack?.addEventListener('click', (e) => {
    e.stopPropagation();
    video.currentTime = Math.max(0, video.currentTime - 10);
    flashEl(seekLeft);
  });
  btnFwd?.addEventListener('click', (e) => {
    e.stopPropagation();
    video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
    flashEl(seekRight);
  });

  /* ---- Volume ---- */
  volSlider?.addEventListener('input', (e) => {
    video.volume = parseFloat(e.target.value);
    video.muted  = video.volume === 0;
    updateVolBtn();
  });
  btnMute?.addEventListener('click', (e) => {
    e.stopPropagation();
    video.muted = !video.muted;
    if (volSlider) volSlider.value = video.muted ? 0 : (video.volume || 1);
    updateVolBtn();
  });
  function updateVolBtn() {
    if (btnMute) btnMute.innerHTML = (video.muted || video.volume === 0) ? Icons.volMute : Icons.volHigh;
  }

  /* ---- Time update ---- */
  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration * 100).toFixed(2);
    if (progFill)  progFill.style.width  = pct + '%';
    if (progThumb) progThumb.style.left  = pct + '%';
    if (timeDisp)  timeDisp.textContent  = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;
    ResumeTime.set(PlayerState.slug, video.currentTime);
  });

  video.addEventListener('progress', () => {
    if (!video.duration || !video.buffered.length) return;
    const end = video.buffered.end(video.buffered.length - 1);
    if (progBuf) progBuf.style.width = (end / video.duration * 100) + '%';
  });

  /* ============================================================
     DRAGGABLE SEEK BAR  (mouse + touch)
     ============================================================ */
  let isDragging = false;

  function getSeekPct(clientX) {
    const rect = progress.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function applySeek(pct) {
    if (!video.duration) return;
    video.currentTime = pct * video.duration;
    const p = (pct * 100).toFixed(2) + '%';
    if (progFill)  progFill.style.width = p;
    if (progThumb) progThumb.style.left = p;
  }

  /* mousedown on progress bar */
  progress?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    progress.classList.add('dragging');
    applySeek(getSeekPct(e.clientX));
  });

  /* touchstart on progress bar */
  progress?.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    isDragging = true;
    progress.classList.add('dragging');
    applySeek(getSeekPct(e.touches[0].clientX));
  }, { passive: true });

  /* mousemove on document */
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    applySeek(getSeekPct(e.clientX));
  });

  /* touchmove on document */
  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    applySeek(getSeekPct(e.touches[0].clientX));
  }, { passive: true });

  /* release */
  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    progress?.classList.remove('dragging');
  };
  document.addEventListener('mouseup',  endDrag);
  document.addEventListener('touchend', endDrag);

  /* ---- PiP ---- */
  btnPip?.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch { showToast('Trình duyệt không hỗ trợ PiP', 'error'); }
  });

  /* ============================================================
     FULLSCREEN  — works on desktop, Android, and iOS Safari
     ============================================================ */
  function isFullscreen() {
    return !!(
      document.fullscreenElement        ||
      document.webkitFullscreenElement  ||
      document.mozFullScreenElement     ||
      document.msFullscreenElement
    );
  }

  function enterFullscreen() {
    const el = wrap; // try wrapper first so custom controls are included
    if      (el.requestFullscreen)       el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen)    el.mozRequestFullScreen();
    else if (el.msRequestFullscreen)     el.msRequestFullscreen();
    // iOS Safari: video element native fullscreen (only option on iOS)
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
  }

  function exitFullscreen() {
    if      (document.exitFullscreen)           document.exitFullscreen();
    else if (document.webkitExitFullscreen)     document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen)      document.mozCancelFullScreen();
    else if (document.msExitFullscreen)         document.msExitFullscreen();
  }

  function toggleFullscreen() {
    isFullscreen() ? exitFullscreen() : enterFullscreen();
  }

  function updateFsIcon() {
    if (btnFs) btnFs.innerHTML = isFullscreen() ? Icons.exitFs : Icons.fullscreen;
  }

  btnFs?.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });

  ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange']
    .forEach(ev => document.addEventListener(ev, updateFsIcon));

  /* iOS Safari fires webkitendfullscreen on the video element */
  video.addEventListener('webkitendfullscreen', updateFsIcon);

  /* ---- Keyboard shortcuts ---- */
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); togglePlay(); showControls(); break;
      case 'ArrowLeft':   video.currentTime = Math.max(0, video.currentTime - 10); flashEl(seekLeft); break;
      case 'ArrowRight':  video.currentTime = Math.min(video.duration, video.currentTime + 10); flashEl(seekRight); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'm': case 'M': btnMute?.click(); break;
    }
  });
}

/* ============================================================
   HELPER (used on movie.html)
   ============================================================ */
function renderCard(m) {
  const poster = m.poster_url || m.thumb_url || '';
  const imgEl  = poster
    ? `<img src="${escHtml(poster)}" alt="${escHtml(m.name)}" loading="lazy"
          onerror="this.parentElement.innerHTML='<div class=movie-poster-placeholder></div>'">`
    : `<div class="movie-poster-placeholder"></div>`;
  return `<a class="movie-card" href="movie.html?slug=${encodeURIComponent(m.slug)}&server=${m._server || API.currentServer}">
    <div class="movie-poster">${imgEl}<div class="movie-overlay"><div class="play-btn-overlay">&#9654;</div></div></div>
    <div class="movie-info">
      <div class="movie-title">${escHtml(m.name)}</div>
      <div class="movie-sub">${m.year ? `<span>${m.year}</span>` : ''}</div>
    </div></a>`;
}
