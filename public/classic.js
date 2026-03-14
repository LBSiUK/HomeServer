// Spotify Remote - iOS 3 / iPod Touch 1st gen compatible
// ES3 only: var, function declarations, XMLHttpRequest, no JSON.parse, no querySelector

// ── JSON polyfill (for iOS 3 which lacks JSON.parse) ─────────────────────────
if (typeof JSON === 'undefined') {
  JSON = {};
}
if (typeof JSON.parse !== 'function') {
  JSON.parse = function (str) {
    return eval('(' + str + ')');
  };
}

// ── DOM refs (populated in init) ──────────────────────────────────────────────
var elLaunchView, elPlayerView, elBtnOpenSpotify;
var elAlbumArt, elNoPlayback;
var elTrackName, elTrackArtist, elTrackAlbum;
var elProgressFill, elProgressBg, elProgressTime, elDurationTime;
var elBtnPlay, elBtnPause, elBtnPrev, elBtnNext;
var elBtnShuffle, elBtnRepeat;
var elVolValue, elBtnVolUp, elBtnVolDn;

// ── App state ─────────────────────────────────────────────────────────────────
var pollTimer      = null;
var progressTimer  = null;
var currentVolume  = 50;
var isPlaying      = false;
var progressMs     = 0;
var durationMs     = 0;
var progressAt     = 0;   // Date.now() when progressMs was last set
var lastArtUrl     = '';
var shuffleActive  = false;
var repeatActive   = false;

var POLL_MS        = 3000;
var POLL_FAST_MS   = 700;
var POLL_ERROR_MS  = 8000;

// ── XHR helper ────────────────────────────────────────────────────────────────
function apiRequest(method, path, body, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, path, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) { return; }
    if (callback) { callback(xhr.status, xhr.responseText); }
  };
  xhr.send(body ? JSON.stringify(body) : null);
}

function apiGet(path, callback) {
  apiRequest('GET', path, null, callback);
}

function apiPost(path, body) {
  apiRequest('POST', path, body, null);
}

// ── Time formatting ───────────────────────────────────────────────────────────
function formatMs(ms) {
  var s = Math.floor(ms / 1000);
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  elLaunchView    = document.getElementById('launch-view');
  elPlayerView    = document.getElementById('player-view');
  elBtnOpenSpotify= document.getElementById('btn-open-spotify');
  elAlbumArt      = document.getElementById('album-art');
  elNoPlayback    = document.getElementById('no-playback');
  elTrackName     = document.getElementById('track-name');
  elTrackArtist   = document.getElementById('track-artist');
  elTrackAlbum    = document.getElementById('track-album');
  elProgressFill  = document.getElementById('progress-fill');
  elProgressBg    = document.getElementById('progress-bg');
  elProgressTime  = document.getElementById('progress-time');
  elDurationTime  = document.getElementById('duration-time');
  elBtnPlay       = document.getElementById('btn-play');
  elBtnPause      = document.getElementById('btn-pause');
  elBtnPrev       = document.getElementById('btn-prev');
  elBtnNext       = document.getElementById('btn-next');
  elBtnShuffle    = document.getElementById('btn-shuffle');
  elBtnRepeat     = document.getElementById('btn-repeat');
  elVolValue      = document.getElementById('vol-value');
  elBtnVolUp      = document.getElementById('btn-vol-up');
  elBtnVolDn      = document.getElementById('btn-vol-dn');

  bindControls();
  checkStatus();
}

// ── Status check ──────────────────────────────────────────────────────────────
function checkStatus() {
  apiGet('/api/auth/status', function (status, text) {
    var data = JSON.parse(text);
    if (data.running) {
      showPlayer();
    } else {
      showLaunch();
    }
  });
}

function showLaunch() {
  elLaunchView.style.display = 'block';
  elPlayerView.style.display = 'none';
  stopPolling();
  stopProgressTimer();
}

function showPlayer() {
  elLaunchView.style.display = 'none';
  elPlayerView.style.display = 'block';
  startPolling(0);
  startProgressTimer();
}

// ── Polling ───────────────────────────────────────────────────────────────────
function startPolling(delay) {
  stopPolling();
  pollTimer = setTimeout(poll, typeof delay === 'number' ? delay : POLL_MS);
}

function stopPolling() {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function poll() {
  apiGet('/api/player/state', function (status, text) {
    if (status === 204 || text === '') {
      renderNoPlayback();
      startPolling(POLL_MS);
      return;
    }
    if (status === 200) {
      var data = JSON.parse(text);
      renderState(data);
      startPolling(POLL_MS);
    } else {
      startPolling(POLL_ERROR_MS);
    }
  });
}

function quickPoll() {
  startPolling(POLL_FAST_MS);
}

// ── Progress timer (replaces requestAnimationFrame) ──────────────────────────
function startProgressTimer() {
  stopProgressTimer();
  progressTimer = setInterval(tickProgress, 500);
}

function stopProgressTimer() {
  if (progressTimer !== null) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function tickProgress() {
  if (!isPlaying || durationMs === 0) { return; }
  var elapsed = new Date().getTime() - progressAt;
  var displayed = progressMs + elapsed;
  if (displayed > durationMs) { displayed = durationMs; }
  elProgressTime.innerHTML = formatMs(displayed);
  var pct = Math.round((displayed / durationMs) * 100);
  elProgressFill.style.width = pct + '%';
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderState(s) {
  if (s.track) {
    elAlbumArt.style.display   = 'block';
    elNoPlayback.style.display = 'none';

    if (s.track.artUrl && s.track.artUrl !== lastArtUrl) {
      elAlbumArt.src = s.track.artUrl;
      lastArtUrl = s.track.artUrl;
    }

    elTrackName.innerHTML   = escapeHtml(s.track.name);
    elTrackArtist.innerHTML = escapeHtml(s.track.artists ? s.track.artists.join(', ') : '');
    elTrackAlbum.innerHTML  = escapeHtml(s.track.album);
  } else {
    renderNoPlayback();
    return;
  }

  isPlaying   = s.isPlaying;
  progressMs  = s.progressMs;
  durationMs  = s.durationMs;
  progressAt  = new Date().getTime();

  elDurationTime.innerHTML = formatMs(durationMs);
  var pct = durationMs > 0 ? Math.round((progressMs / durationMs) * 100) : 0;
  elProgressFill.style.width = pct + '%';
  elProgressTime.innerHTML = formatMs(progressMs);

  elBtnPlay.style.display  = isPlaying ? 'none' : 'inline-block';
  elBtnPause.style.display = isPlaying ? 'inline-block' : 'none';

  shuffleActive = s.shuffleState;
  repeatActive  = s.repeatState !== 'off';

  if (shuffleActive) {
    elBtnShuffle.className = 'toggle-btn active';
  } else {
    elBtnShuffle.className = 'toggle-btn';
  }
  if (repeatActive) {
    elBtnRepeat.className = 'toggle-btn active';
  } else {
    elBtnRepeat.className = 'toggle-btn';
  }

  if (s.volume !== null && s.volume !== undefined) {
    currentVolume = s.volume;
    elVolValue.innerHTML = currentVolume;
  }
}

function renderNoPlayback() {
  elAlbumArt.style.display   = 'none';
  elNoPlayback.style.display = 'block';
  elTrackName.innerHTML      = '\u00a0';
  elTrackArtist.innerHTML    = '\u00a0';
  elTrackAlbum.innerHTML     = '\u00a0';
  elProgressFill.style.width = '0%';
  elProgressTime.innerHTML   = '0:00';
  elDurationTime.innerHTML   = '0:00';
  elBtnPlay.style.display    = 'inline-block';
  elBtnPause.style.display   = 'none';
  isPlaying = false;
}

// ── Progress bar tap to seek ──────────────────────────────────────────────────
function bindProgressSeek() {
  function handleSeek(clientX) {
    if (durationMs === 0) { return; }
    var bar   = elProgressBg;
    var left  = 0;
    var node  = bar;
    // Calculate offset from page left
    while (node) {
      left += node.offsetLeft;
      node  = node.offsetParent;
    }
    var width = bar.offsetWidth;
    var x     = clientX - left;
    if (x < 0) { x = 0; }
    if (x > width) { x = width; }
    var pct      = x / width;
    var posMs    = Math.round(pct * durationMs);
    progressMs   = posMs;
    progressAt   = new Date().getTime();
    elProgressFill.style.width = Math.round(pct * 100) + '%';
    elProgressTime.innerHTML   = formatMs(posMs);
    apiPost('/api/player/seek', { positionMs: posMs });
    quickPoll();
  }

  elProgressBg.addEventListener('touchstart', function (e) {
    e.preventDefault();
    handleSeek(e.touches[0].clientX);
  }, false);

  elProgressBg.addEventListener('click', function (e) {
    handleSeek(e.clientX);
  }, false);
}

// ── Bind all controls ─────────────────────────────────────────────────────────
function bindControls() {
  bindProgressSeek();

  elBtnOpenSpotify.addEventListener('click', function (e) {
    e.preventDefault();
    apiPost('/api/auth/open', null);
    setTimeout(checkStatus, 2000);
  }, false);

  elBtnPlay.addEventListener('click', function (e) {
    e.preventDefault();
    isPlaying = true;
    elBtnPlay.style.display  = 'none';
    elBtnPause.style.display = 'inline-block';
    apiPost('/api/player/play', null);
    quickPoll();
  }, false);

  elBtnPause.addEventListener('click', function (e) {
    e.preventDefault();
    isPlaying = false;
    elBtnPause.style.display = 'none';
    elBtnPlay.style.display  = 'inline-block';
    apiPost('/api/player/pause', null);
    quickPoll();
  }, false);

  elBtnPrev.addEventListener('click', function (e) {
    e.preventDefault();
    apiPost('/api/player/previous', null);
    quickPoll();
  }, false);

  elBtnNext.addEventListener('click', function (e) {
    e.preventDefault();
    apiPost('/api/player/next', null);
    quickPoll();
  }, false);

  elBtnVolUp.addEventListener('click', function (e) {
    e.preventDefault();
    currentVolume = currentVolume + 10;
    if (currentVolume > 100) { currentVolume = 100; }
    elVolValue.innerHTML = currentVolume;
    apiPost('/api/player/volume', { volumePercent: currentVolume });
  }, false);

  elBtnVolDn.addEventListener('click', function (e) {
    e.preventDefault();
    currentVolume = currentVolume - 10;
    if (currentVolume < 0) { currentVolume = 0; }
    elVolValue.innerHTML = currentVolume;
    apiPost('/api/player/volume', { volumePercent: currentVolume });
  }, false);

  elBtnShuffle.addEventListener('click', function (e) {
    e.preventDefault();
    shuffleActive = !shuffleActive;
    if (shuffleActive) {
      elBtnShuffle.className = 'toggle-btn active';
    } else {
      elBtnShuffle.className = 'toggle-btn';
    }
    apiPost('/api/player/shuffle', { state: shuffleActive });
  }, false);

  elBtnRepeat.addEventListener('click', function (e) {
    e.preventDefault();
    repeatActive = !repeatActive;
    if (repeatActive) {
      elBtnRepeat.className = 'toggle-btn active';
    } else {
      elBtnRepeat.className = 'toggle-btn';
    }
    apiPost('/api/player/repeat', { state: repeatActive ? 'context' : 'off' });
  }, false);
}

// ── Utility ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) { return ''; }
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

// ── Start ─────────────────────────────────────────────────────────────────────
window.onload = init;
