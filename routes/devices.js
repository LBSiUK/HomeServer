'use strict';

const express = require('express');

const router = express.Router();

// GET /api/devices
// AppleScript doesn't expose Spotify Connect device listing.
// Spotify Connect switching is done within the Spotify app itself.
router.get('/', (req, res) => {
  res.json({
    devices: [{
      id:               'local',
      name:             'This Mac',
      type:             'Computer',
      isActive:         true,
      volumePercent:    null,
      isPrivateSession: false,
    }],
    note: 'Device switching is handled within the Spotify app.',
  });
});

// POST /api/devices/transfer — not supported via AppleScript
router.post('/transfer', (req, res) => {
  res.status(501).json({
    error:   'not_supported',
    message: 'Device switching is not available via the AppleScript backend. Use the Spotify app to switch devices.',
  });
});

module.exports = router;
