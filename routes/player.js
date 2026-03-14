'use strict';

const express = require('express');
const spotify = require('../services/appleScript');

const router = express.Router();

// GET /api/player/state
router.get('/state', async (req, res, next) => {
  try {
    const state = await spotify.getState();
    if (!state) return res.status(204).end();
    res.json(state);
  } catch (err) {
    next(err);
  }
});

// POST /api/player/play
router.post('/play', async (req, res, next) => {
  try {
    await spotify.play();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/player/pause
router.post('/pause', async (req, res, next) => {
  try {
    await spotify.pause();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/player/next
router.post('/next', async (req, res, next) => {
  try {
    await spotify.next();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/player/previous
router.post('/previous', async (req, res, next) => {
  try {
    await spotify.previous();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/player/seek
router.post('/seek', async (req, res, next) => {
  const { positionMs } = req.body;
  if (positionMs === undefined || positionMs === null) {
    return res.status(400).json({ error: 'bad_request', message: 'positionMs required.' });
  }
  try {
    await spotify.seek(positionMs);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/player/volume
router.post('/volume', async (req, res, next) => {
  const { volumePercent } = req.body;
  if (volumePercent === undefined || volumePercent < 0 || volumePercent > 100) {
    return res.status(400).json({ error: 'bad_request', message: 'volumePercent must be 0–100.' });
  }
  try {
    await spotify.setVolume(volumePercent);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/player/shuffle
router.post('/shuffle', async (req, res, next) => {
  if (typeof req.body.state !== 'boolean') {
    return res.status(400).json({ error: 'bad_request', message: 'state must be boolean.' });
  }
  try {
    await spotify.setShuffle(req.body.state);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/player/repeat
router.post('/repeat', async (req, res, next) => {
  const { state } = req.body;
  if (!['off', 'track', 'context'].includes(state)) {
    return res.status(400).json({ error: 'bad_request', message: 'state must be off, track, or context.' });
  }
  try {
    // AppleScript only has a boolean repeat toggle
    await spotify.setRepeat(state !== 'off');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
