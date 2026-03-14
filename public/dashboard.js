/* dashboard.js — ES5, iOS 6 compatible */
'use strict';

// ── Constants ────────────────────────────────────────────────────────────────

var POLL_NORMAL = 3000;
var POLL_FAST   = 600;
var POLL_ERROR  = 8000;

var DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var MONTHS = ['January','February','March','April','May','June',
              'July','August','September','October','November','December'];

// ── Shared state ─────────────────────────────────────────────────────────────

var homeState = { overhead: false, desk: false, amplifier: false };

var spState = {
  isPlaying:   false,
  progressMs:  0,
  durationMs:  0,
  volume:      0,
  track:       null
};
var spPollTimer   = null;
var spLastPoll    = 0;  // Date.now() when state was last received

// ── XHR helper ───────────────────────────────────────────────────────────────

function xhr(method, url, body, cb) {
  var req = new XMLHttpRequest();
  req.open(method, url, true);
  req.setRequestHeader('Content-Type', 'application/json');
  req.onreadystatechange = function () {
    if (req.readyState !== 4) return;
    if (req.status >= 200 && req.status < 300) {
      var data = null;
      if (req.responseText) {
        try { data = JSON.parse(req.responseText); } catch (e) {}
      }
      if (cb) cb(null, data);
    } else {
      if (cb) cb(new Error('HTTP ' + req.status), null);
    }
  };
  req.send(body ? JSON.stringify(body) : null);
}

function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatMs(ms) {
  var s = Math.floor(ms / 1000);
  var m = Math.floor(s / 60);
  s = s % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function el(id) { return document.getElementById(id); }

// ── Home devices ─────────────────────────────────────────────────────────────

function fetchHomeState() {
  xhr('GET', '/api/home/state', null, function (err, data) {
    if (err || !data) return;
    homeState.overhead  = !!data.overhead;
    homeState.desk      = !!data.desk;
    homeState.amplifier = !!data.amplifier;
    renderAllDevices();
  });
}

function renderAllDevices() {
  renderDevice('overhead');
  renderDevice('desk');
  renderDevice('amplifier');
}

function renderDevice(device) {
  var on  = homeState[device];
  var btn = el('btn-' + device);
  var st  = el('status-' + device);
  if (!btn) return;

  btn.className = 'toggle-btn ' + (on ? 'on' : 'off');
  btn.innerHTML = on ? 'ON' : 'OFF';

  if (st) {
    st.className = 'device-status' + (on ? ' live' : '');
    st.innerHTML = on ? 'ON' : '&#8212;';
  }
}

function toggleDevice(device) {
  // Optimistic update
  homeState[device] = !homeState[device];
  renderDevice(device);

  xhr('POST', '/api/home/' + device + '/toggle', null, function (err, data) {
    if (err) {
      // Revert
      homeState[device] = !homeState[device];
      renderDevice(device);
    } else if (data) {
      homeState[device] = !!data.on;
      renderDevice(device);
    }
  });
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function updateClock() {
  var now  = new Date();
  var h    = now.getHours();
  var m    = now.getMinutes();
  var s    = now.getSeconds();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;

  el('clock-time').innerHTML =
    h + ':' + (m < 10 ? '0' : '') + m +
    '<span id="clock-sec">:' + (s < 10 ? '0' : '') + s + '</span>';

  el('clock-ampm').innerHTML = ampm;
  el('clock-day').innerHTML  = DAYS[now.getDay()];
  el('clock-date').innerHTML =
    MONTHS[now.getMonth()].substring(0, 3) + ' ' + now.getDate();
}

// ── Spotify: init & auth ──────────────────────────────────────────────────────

function openSpotify() {
  xhr('POST', '/api/auth/open', null, function () {
    setTimeout(function () { pollSpotify(); }, 2000);
  });
}

function checkSpotify() {
  xhr('GET', '/api/auth/status', null, function (err, data) {
    if (!err && data && data.running) {
      showPlayer();
      pollSpotify();
    } else {
      showLaunch();
    }
  });
}

function showLaunch() {
  el('sp-launch').style.display = 'block';
  el('sp-player').style.display = 'none';
}

function showPlayer() {
  el('sp-launch').style.display = 'none';
  el('sp-player').style.display = 'block';
}

// ── Spotify: polling ──────────────────────────────────────────────────────────

function schedulePoll(ms) {
  if (spPollTimer) clearTimeout(spPollTimer);
  spPollTimer = setTimeout(pollSpotify, ms);
}

function pollSpotify() {
  xhr('GET', '/api/player/state', null, function (err, data) {
    if (err) {
      schedulePoll(POLL_ERROR);
      return;
    }
    if (!data) {
      // 204: nothing playing
      renderNoPlayback();
      schedulePoll(POLL_NORMAL);
      return;
    }
    spLastPoll       = Date.now();
    spState.isPlaying  = !!data.isPlaying;
    spState.progressMs = data.progressMs  || 0;
    spState.durationMs = data.durationMs  || 0;
    spState.volume     = data.volume      || 0;
    spState.track      = data.track       || null;

    renderSpotify();
    showPlayer();
    schedulePoll(POLL_NORMAL);
  });
}

// ── Spotify: rendering ────────────────────────────────────────────────────────

function renderNoPlayback() {
  el('sp-track').innerHTML    = 'Nothing playing';
  el('sp-artist').innerHTML   = '';
  el('sp-time').innerHTML     = '&#8212;';
  el('sp-vol-val').innerHTML  = '&#8212;';
  el('sp-prog-fill').style.width = '0%';
  el('sp-btn-play').innerHTML = '&#9654;';
  el('sp-art').style.display    = 'none';
  el('sp-no-art').style.display = 'block';
}

function renderSpotify() {
  var t = spState.track;
  if (!t) { renderNoPlayback(); return; }

  // Track / artist
  el('sp-track').innerHTML  = escHtml(t.name);
  el('sp-artist').innerHTML = escHtml(t.artists ? t.artists.join(', ') : '');

  // Album art
  if (t.artUrl) {
    el('sp-art').src              = t.artUrl;
    el('sp-art').style.display    = 'block';
    el('sp-no-art').style.display = 'none';
  } else {
    el('sp-art').style.display    = 'none';
    el('sp-no-art').style.display = 'block';
  }

  // Play/pause button
  el('sp-btn-play').innerHTML = spState.isPlaying ? '&#9646;&#9646;' : '&#9654;';

  // Volume
  el('sp-vol-val').innerHTML = spState.volume;

  updateProgress();
}

function updateProgress() {
  if (!spState.durationMs) return;
  var elapsed = spState.isPlaying ? (Date.now() - spLastPoll) : 0;
  var pos = spState.progressMs + elapsed;
  if (pos > spState.durationMs) pos = spState.durationMs;
  var pct = (pos / spState.durationMs) * 100;

  el('sp-prog-fill').style.width = pct + '%';
  el('sp-time').innerHTML = formatMs(pos) + ' / ' + formatMs(spState.durationMs);
}

// ── Spotify: controls ─────────────────────────────────────────────────────────

function spTogglePlay() {
  var url = spState.isPlaying ? '/api/player/pause' : '/api/player/play';
  spState.isPlaying = !spState.isPlaying;
  el('sp-btn-play').innerHTML = spState.isPlaying ? '&#9646;&#9646;' : '&#9654;';
  xhr('POST', url, null, function () { schedulePoll(POLL_FAST); });
}

function spPrev() {
  xhr('POST', '/api/player/previous', null, function () { schedulePoll(POLL_FAST); });
}

function spNext() {
  xhr('POST', '/api/player/next', null, function () { schedulePoll(POLL_FAST); });
}

function spVolume(delta) {
  var v = Math.max(0, Math.min(100, (spState.volume || 0) + delta));
  spState.volume = v;
  el('sp-vol-val').innerHTML = v;
  xhr('POST', '/api/player/volume', { volumePercent: v }, null);
}

function spSeek(e) {
  if (!spState.durationMs) return;
  var bar  = el('sp-prog-bg');
  var rect = bar.getBoundingClientRect();
  var pct  = (e.clientX - rect.left) / rect.width;
  if (pct < 0) pct = 0;
  if (pct > 1) pct = 1;
  var posMs = Math.round(pct * spState.durationMs);
  spState.progressMs = posMs;
  spLastPoll = Date.now();
  updateProgress();
  xhr('POST', '/api/player/seek', { positionMs: posMs }, function () {
    schedulePoll(POLL_FAST);
  });
}

// ── Progress ticker (replaces rAF for iOS 6) ──────────────────────────────────

function startProgressTicker() {
  setInterval(function () {
    if (spState.isPlaying && spState.durationMs) updateProgress();
  }, 500);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

function init() {
  fetchHomeState();
  checkSpotify();
  updateClock();
  setInterval(updateClock, 1000);
  startProgressTicker();
}

window.onload = init;
