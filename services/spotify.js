'use strict';

// Chooses the media backend used by the API routes:
//   - appleScript: drives the Spotify desktop app on this Mac (the normal mode)
//   - demoPlayer:  an in-memory player with sample tracks (DEMO=1)
// Both export the same functions.

const { demo } = require('../config');

module.exports = demo ? require('./demoPlayer') : require('./appleScript');
