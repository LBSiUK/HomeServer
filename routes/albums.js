'use strict';

const express = require('express');
const fetch   = require('node-fetch');

const router = express.Router();

// GET /api/art?url=<encoded-cdn-url>
// Proxies album art from Spotify's CDN so clients never need to reach external URLs.
router.get('/', async (req, res, next) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'bad_request', message: 'url query parameter required.' });
  }

  // Only allow proxying from Spotify's CDN
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'bad_request', message: 'Invalid URL.' });
  }

  if (!parsed.hostname.endsWith('.scdn.co') && !parsed.hostname.endsWith('.spotifycdn.com')) {
    return res.status(403).json({ error: 'forbidden', message: 'Only Spotify CDN URLs are allowed.' });
  }

  try {
    const imgRes = await fetch(url);
    if (!imgRes.ok) {
      return res.status(502).json({ error: 'upstream_fetch_failed', message: 'Failed to fetch album art.' });
    }
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    imgRes.body.pipe(res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
