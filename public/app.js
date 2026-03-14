'use strict';

// ── DOM references ────────────────────────────────────────────────────────────
const els = {
  launchView:    document.getElementById('launch-view'),
  playerView:    document.getElementById('player-view'),
  btnOpenSpotify:document.getElementById('btn-open-spotify'),
  albumArt:      document.getElementById('album-art'),
  noPlayback:    document.getElementById('no-playback'),
  trackName:     document.getElementById('track-name'),
  trackArtists:  document.getElementById('track-artists'),
  trackAlbum:    document.getElementById('track-album'),
  progressTime:  document.getElementById('progress-time'),
  seekBar:       document.getElementById('seek-bar'),
  durationTime:  document.getElementById('duration-time'),
  btnShuffle:    document.getElementById('btn-shuffle'),
  btnPrev:       document.getElementById('btn-prev'),
  btnPlayPause:  document.getElementById('btn-play-pause'),
  iconPlay:      document.getElementById('icon-play'),
  iconPause:     document.getElementById('icon-pause'),
  btnNext:       document.getElementById('btn-next'),
  btnRepeat:     document.getElementById('btn-repeat'),
  volumeBar:     document.getElementById('volume-bar'),
  volumeValue:   document.getElementById('volume-value'),
  silenceAudio:  document.getElementById('silence-audio'),
};

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  pollTimer: null,
  rafId:     null,
  progress:  { progressMs: 0, timestamp: 0, isPlaying: false, durationMs: 0 },
  lastArtUrl: null,
  isSeeking:  false,
};

const POLL_NORMAL_MS = 3000;
const POLL_FAST_MS   = 600;
const POLL_ERROR_MS  = 8000;

// ── Utilities ─────────────────────────────────────────────────────────────────
function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (res.status === 204) return null;
  return res.json();
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const status = await api('GET', '/api/auth/status');
    if (status.running) {
      showPlayer();
    } else {
      showLaunch();
    }
  } catch {
    showLaunch();
  }
}

function showLaunch() {
  els.launchView.classList.remove('hidden');
  els.playerView.classList.add('hidden');
  stopPolling();
  cancelAnimationFrame(state.rafId);
}

function showPlayer() {
  els.launchView.classList.add('hidden');
  els.playerView.classList.remove('hidden');
  startPolling(0);
  startProgressRAF();
  setupMediaSession();
  // Try to start silence immediately; if blocked by autoplay policy,
  // it will be started on the first user interaction instead.
  els.silenceAudio.play().catch(() => {});
}

els.btnOpenSpotify.addEventListener('click', async () => {
  await api('POST', '/api/auth/open');
  // Give Spotify a moment to launch, then check again
  setTimeout(init, 2000);
});

// ── Polling ───────────────────────────────────────────────────────────────────
function startPolling(delayMs = POLL_NORMAL_MS) {
  clearTimeout(state.pollTimer);
  state.pollTimer = setTimeout(poll, delayMs);
}

function stopPolling() {
  clearTimeout(state.pollTimer);
}

async function poll() {
  try {
    const data = await api('GET', '/api/player/state');
    if (data) {
      renderState(data);
    } else {
      renderNoPlayback();
    }
    startPolling(POLL_NORMAL_MS);
  } catch {
    startPolling(POLL_ERROR_MS);
  }
}

function quickPoll() {
  startPolling(POLL_FAST_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPolling();
  else poll();
});

// ── Render ────────────────────────────────────────────────────────────────────
function renderState(s) {
  if (s.track?.artUrl && s.track.artUrl !== state.lastArtUrl) {
    els.albumArt.src = s.track.artUrl;
    state.lastArtUrl = s.track.artUrl;
  }

  const hasTrack = !!s.track;
  els.noPlayback.classList.toggle('hidden', hasTrack);
  els.albumArt.style.display = hasTrack ? '' : 'none';

  els.trackName.textContent    = s.track?.name              || '';
  els.trackArtists.textContent = s.track?.artists?.join(', ') || '';
  els.trackAlbum.textContent   = s.track?.album             || '';

  state.progress = {
    progressMs: s.progressMs,
    timestamp:  s.timestamp,
    isPlaying:  s.isPlaying,
    durationMs: s.durationMs,
  };

  els.durationTime.textContent = formatMs(s.durationMs || 0);
  els.seekBar.max = s.durationMs || 100;

  els.iconPlay.classList.toggle('hidden', s.isPlaying);
  els.iconPause.classList.toggle('hidden', !s.isPlaying);

  els.btnShuffle.classList.toggle('active', s.shuffleState);
  els.btnRepeat.classList.toggle('active', s.repeatState !== 'off');
  els.btnRepeat.title = `Repeat: ${s.repeatState}`;

  if (document.activeElement !== els.volumeBar && s.volume !== null) {
    els.volumeBar.value = s.volume;
    els.volumeValue.textContent = s.volume;
  }

  updateMediaSession(s);
}

function renderNoPlayback() {
  els.noPlayback.classList.remove('hidden');
  els.albumArt.style.display = 'none';
  els.trackName.textContent  = '';
  els.trackArtists.textContent = '';
  els.trackAlbum.textContent = '';
  els.progressTime.textContent = '0:00';
  els.durationTime.textContent = '0:00';
  els.seekBar.value = 0;
  els.iconPlay.classList.remove('hidden');
  els.iconPause.classList.add('hidden');
  state.progress.isPlaying = false;
}

// ── Progress RAF ──────────────────────────────────────────────────────────────
function startProgressRAF() {
  cancelAnimationFrame(state.rafId);
  function tick() {
    if (!state.isSeeking) {
      const { progressMs, timestamp, isPlaying, durationMs } = state.progress;
      const displayed = isPlaying
        ? Math.min(progressMs + (Date.now() - timestamp), durationMs || Infinity)
        : progressMs;
      els.progressTime.textContent = formatMs(displayed);
      els.seekBar.value = displayed;
    }
    state.rafId = requestAnimationFrame(tick);
  }
  state.rafId = requestAnimationFrame(tick);
}

// ── Controls ──────────────────────────────────────────────────────────────────
async function control(method, path, body) {
  try {
    await api(method, path, body);
    quickPoll();
  } catch (err) {
    console.error('Control failed:', path, err);
  }
}

els.btnPlayPause.addEventListener('click', () => {
  const playing = state.progress.isPlaying;
  state.progress.isPlaying = !playing;
  els.iconPlay.classList.toggle('hidden', !playing);
  els.iconPause.classList.toggle('hidden', playing);
  control('POST', playing ? '/api/player/pause' : '/api/player/play');
});

els.btnNext.addEventListener('click',     () => control('POST', '/api/player/next'));
els.btnPrev.addEventListener('click',     () => control('POST', '/api/player/previous'));

els.btnShuffle.addEventListener('click', () => {
  const next = !els.btnShuffle.classList.contains('active');
  els.btnShuffle.classList.toggle('active', next);
  control('POST', '/api/player/shuffle', { state: next });
});

els.btnRepeat.addEventListener('click', () => {
  const cycle   = ['off', 'context', 'track'];
  const current = cycle.find(v => els.btnRepeat.title.endsWith(v)) || 'off';
  const next    = cycle[(cycle.indexOf(current) + 1) % cycle.length];
  els.btnRepeat.title = `Repeat: ${next}`;
  els.btnRepeat.classList.toggle('active', next !== 'off');
  control('POST', '/api/player/repeat', { state: next });
});

// Seek
els.seekBar.addEventListener('mousedown',  () => { state.isSeeking = true; });
els.seekBar.addEventListener('touchstart', () => { state.isSeeking = true; });
els.seekBar.addEventListener('change', () => {
  const positionMs = parseInt(els.seekBar.value, 10);
  state.isSeeking = false;
  state.progress.progressMs = positionMs;
  state.progress.timestamp  = Date.now();
  control('POST', '/api/player/seek', { positionMs });
});

// Volume (debounced)
const sendVolume = debounce((v) => control('POST', '/api/player/volume', { volumePercent: v }), 300);
els.volumeBar.addEventListener('input', () => {
  const v = parseInt(els.volumeBar.value, 10);
  els.volumeValue.textContent = v;
  sendVolume(v);
});

// ── Media Session API ─────────────────────────────────────────────────────────
function setupMediaSession() {
  if (!navigator.mediaSession) return;

  navigator.mediaSession.setActionHandler('play', () => {
    control('POST', '/api/player/play');
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    control('POST', '/api/player/pause');
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    control('POST', '/api/player/next');
  });
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    control('POST', '/api/player/previous');
  });
  try {
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      const positionMs = Math.round(details.seekTime * 1000);
      state.progress.progressMs = positionMs;
      state.progress.timestamp  = Date.now();
      control('POST', '/api/player/seek', { positionMs });
    });
  } catch (e) { /* seekto not supported in all browsers */ }

  // Start silence on first user interaction if autoplay was blocked
  document.addEventListener('click', () => {
    els.silenceAudio.play().catch(() => {});
  }, { once: true });
}

function updateMediaSession(s) {
  if (!navigator.mediaSession || !s.track) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title:   s.track.name,
    artist:  s.track.artists.join(', '),
    album:   s.track.album,
    artwork: s.track.artUrl
      ? [{ src: window.location.origin + s.track.artUrl, sizes: '300x300', type: 'image/jpeg' }]
      : [],
  });

  navigator.mediaSession.playbackState = s.isPlaying ? 'playing' : 'paused';

  try {
    navigator.mediaSession.setPositionState({
      duration:     s.durationMs / 1000,
      playbackRate: 1,
      position:     s.progressMs / 1000,
    });
  } catch (e) { /* setPositionState not supported in all browsers */ }
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
