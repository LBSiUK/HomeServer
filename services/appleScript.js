'use strict';

const { exec } = require('child_process');

// Execute an AppleScript via stdin to avoid shell escaping issues
function run(script) {
  return new Promise((resolve, reject) => {
    const child = exec('osascript', { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr.trim() || err.message));
      resolve(stdout.trim());
    });
    child.stdin.write(script);
    child.stdin.end();
  });
}

async function isRunning() {
  const result = await run('return application "Spotify" is running');
  return result === 'true';
}

async function open() {
  await run('tell application "Spotify" to activate');
}

// Returns normalized player state, or null if Spotify is stopped/not running
async function getState() {
  const script = `
    if application "Spotify" is not running then
      return "not_running"
    end if
    tell application "Spotify"
      set s to player state
      if s is stopped then return "stopped"
      set ps  to s as string
      set pos to player position as string
      set vol to sound volume as string
      set shuf to shuffling as string
      set rep  to repeating as string
      set n    to name of current track
      set ar   to artist of current track
      set al   to album of current track
      set au   to artwork url of current track
      set dur  to duration of current track as string
      set tid  to id of current track
      return ps & tab & pos & tab & vol & tab & shuf & tab & rep & tab & n & tab & ar & tab & al & tab & au & tab & dur & tab & tid
    end tell
  `;

  const result = await run(script);

  if (result === 'not_running' || result === 'stopped') return null;

  const [playerState, pos, vol, shuf, rep, name, artist, album, rawArtUrl, duration, id] = result.split('\t');

  const progressMs  = Math.round(parseFloat(pos) * 1000);
  const durationMs  = Math.round(parseFloat(duration)); // AppleScript returns duration in ms already
  const volumePct   = parseInt(vol, 10);
  const artUrl      = rawArtUrl ? `/api/art?url=${encodeURIComponent(rawArtUrl)}` : null;

  return {
    isPlaying:    playerState === 'playing',
    progressMs,
    durationMs,
    volume:       volumePct,
    shuffleState: shuf === 'true',
    repeatState:  rep === 'true' ? 'context' : 'off',
    track: {
      id,
      name,
      artists:   [artist],
      album,
      artUrl,
      durationMs, // same value, already correct
    },
    device: {
      id:            'local',
      name:          'This Mac',
      type:          'Computer',
      volumePercent: volumePct,
    },
    timestamp: Date.now(),
  };
}

async function play()     { await run('tell application "Spotify" to play'); }
async function pause()    { await run('tell application "Spotify" to pause'); }
async function next()     { await run('tell application "Spotify" to next track'); }
async function previous() { await run('tell application "Spotify" to previous track'); }

async function seek(positionMs) {
  const seconds = positionMs / 1000;
  await run(`tell application "Spotify" to set player position to ${seconds}`);
}

async function setVolume(pct) {
  await run(`tell application "Spotify" to set sound volume to ${Math.round(pct)}`);
}

async function setShuffle(enabled) {
  await run(`tell application "Spotify" to set shuffling to ${enabled}`);
}

async function setRepeat(enabled) {
  await run(`tell application "Spotify" to set repeating to ${enabled}`);
}

module.exports = { isRunning, open, getState, play, pause, next, previous, seek, setVolume, setShuffle, setRepeat };
