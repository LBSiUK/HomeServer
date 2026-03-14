'use strict';

var express = require('express');
var router  = express.Router();
var exec    = require('child_process').exec;

// ── In-memory device state ────────────────────────────────────────────────────
// State resets on server restart. Adjust defaults here if needed.
var deviceState = {
  overhead:  false,
  desk:      false,
  amplifier: false
};

// ── Optional shell commands ───────────────────────────────────────────────────
// Hook real devices by setting environment variables before starting the server:
//   CMD_OVERHEAD_ON="shortcuts run 'Overhead On'"  CMD_OVERHEAD_OFF="shortcuts run 'Overhead Off'"
//   CMD_DESK_ON="shortcuts run 'Desk On'"           CMD_DESK_OFF="shortcuts run 'Desk Off'"
//   CMD_AMP_ON="shortcuts run 'Amp On'"             CMD_AMP_OFF="shortcuts run 'Amp Off'"
// Or replace null with any shell command string.
var commands = {
  overhead:  { on: process.env.CMD_OVERHEAD_ON  || null, off: process.env.CMD_OVERHEAD_OFF  || null },
  desk:      { on: process.env.CMD_DESK_ON      || null, off: process.env.CMD_DESK_OFF      || null },
  amplifier: { on: process.env.CMD_AMP_ON       || null, off: process.env.CMD_AMP_OFF       || null }
};

function runCommand(cmd) {
  if (!cmd) return;
  exec(cmd, function (err) {
    if (err) console.error('[home] command error:', err.message);
  });
}

// GET /api/home/state
router.get('/state', function (req, res) {
  res.json(deviceState);
});

// POST /api/home/:device/toggle
router.post('/:device/toggle', function (req, res) {
  var device = req.params.device;
  if (!(device in deviceState)) {
    return res.status(404).json({ error: 'Unknown device: ' + device });
  }
  deviceState[device] = !deviceState[device];
  runCommand(deviceState[device] ? commands[device].on : commands[device].off);
  res.json({ device: device, on: deviceState[device] });
});

// POST /api/home/:device/set  — body: { on: bool }
router.post('/:device/set', function (req, res) {
  var device = req.params.device;
  if (!(device in deviceState)) {
    return res.status(404).json({ error: 'Unknown device: ' + device });
  }
  var on = !!req.body.on;
  if (deviceState[device] !== on) {
    deviceState[device] = on;
    runCommand(on ? commands[device].on : commands[device].off);
  }
  res.json({ device: device, on: deviceState[device] });
});

module.exports = router;
