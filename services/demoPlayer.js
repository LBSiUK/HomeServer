'use strict';

// In-memory stand-in for the Spotify desktop app, used when DEMO=1.
// It exposes the same functions as appleScript.js, so every page works without
// Spotify, macOS or a network connection. Tracks and artwork are made-up samples.

const TRACKS = [
  { id: 'demo:1', name: 'Night Drive',    artist: 'The Placeholders', album: 'Sample Sessions', durationMs: 232000, artUrl: '/demo/art-1.jpg' },
  { id: 'demo:2', name: 'Paper Lanterns', artist: 'Mock Orchestra',   album: 'Test Pressing',   durationMs: 257000, artUrl: '/demo/art-2.jpg' },
  { id: 'demo:3', name: 'Low Tide',       artist: 'Demo Tape',        album: 'Stub Songs',      durationMs: 185000, artUrl: '/demo/art-3.jpg' },
];

const player = {
  running:    true,
  playing:    true,
  index:      0,
  positionMs: 83000,     // position when `since` was recorded
  since:      Date.now(),
  volume:     60,
  shuffle:    false,
  repeat:     false,
};

// Fold elapsed play time into positionMs, moving on to the next track at the end.
function settle() {
  const now = Date.now();
  if (player.playing) {
    player.positionMs += now - player.since;
    while (player.positionMs >= TRACKS[player.index].durationMs) {
      player.positionMs -= TRACKS[player.index].durationMs;
      if (!player.repeat && player.index === TRACKS.length - 1) {
        player.index = 0;
        player.positionMs = 0;
        player.playing = false;
        break;
      }
      player.index = (player.index + 1) % TRACKS.length;
    }
  }
  player.since = now;
}

function jump(index) {
  settle();
  player.index = (index + TRACKS.length) % TRACKS.length;
  player.positionMs = 0;
}

async function isRunning() { return player.running; }
async function open()      { player.running = true; }

async function getState() {
  if (!player.running) return null;
  settle();
  const t = TRACKS[player.index];
  return {
    isPlaying:    player.playing,
    progressMs:   Math.round(player.positionMs),
    durationMs:   t.durationMs,
    volume:       player.volume,
    shuffleState: player.shuffle,
    repeatState:  player.repeat ? 'context' : 'off',
    track: {
      id:         t.id,
      name:       t.name,
      artists:    [t.artist],
      album:      t.album,
      artUrl:     t.artUrl,
      durationMs: t.durationMs,
    },
    device: {
      id:            'demo',
      name:          'Demo player',
      type:          'Computer',
      volumePercent: player.volume,
    },
    timestamp: Date.now(),
  };
}

async function play()  { settle(); player.playing = true; }
async function pause() { settle(); player.playing = false; }
async function next()  { jump(player.index + 1); }

async function previous() {
  settle();
  // Like Spotify: restart the track unless we are near its start.
  if (player.positionMs > 3000) player.positionMs = 0;
  else jump(player.index - 1);
}

async function seek(positionMs) {
  settle();
  const max = TRACKS[player.index].durationMs - 1;
  player.positionMs = Math.max(0, Math.min(max, Number(positionMs) || 0));
}

async function setVolume(pct)       { player.volume = Math.max(0, Math.min(100, Math.round(pct))); }
async function setShuffle(enabled)  { player.shuffle = !!enabled; }
async function setRepeat(enabled)   { player.repeat = !!enabled; }

module.exports = { isRunning, open, getState, play, pause, next, previous, seek, setVolume, setShuffle, setRepeat };
