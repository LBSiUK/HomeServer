'use strict';

const express = require('express');
const { isRunning, open } = require('../services/appleScript');

const router = express.Router();

// GET /api/auth/status — is Spotify running?
router.get('/status', async (req, res, next) => {
  try {
    const running = await isRunning();
    res.json({ running });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/open — launch Spotify
router.post('/open', async (req, res, next) => {
  try {
    await open();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
