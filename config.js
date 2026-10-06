'use strict';

// Runtime settings, read from environment variables.
//   PORT  port to listen on (default 3000)
//   DEMO  set to 1 to use the built-in demo player instead of the Spotify desktop app,
//         and to skip any CMD_* device commands

function flag(value) {
  return /^(1|true|yes|on)$/i.test(value || '');
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  demo: flag(process.env.DEMO),
};
