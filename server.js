'use strict';

const express       = require('express');
const authRouter    = require('./routes/auth');
const playerRouter  = require('./routes/player');
const devicesRouter = require('./routes/devices');
const artRouter     = require('./routes/albums');
const homeRouter    = require('./routes/home');
const errorHandler  = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.use('/api/auth',    authRouter);
app.use('/api/player',  playerRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/art',     artRouter);
app.use('/api/home',    homeRouter);

// Minimal silent WAV served so browsers can activate the Media Session API.
// Browsers require a playing <audio> element before navigator.mediaSession works.
app.get('/api/silence', (req, res) => {
  const sampleRate = 8000;
  const numSamples = 4000; // 0.5 seconds
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + numSamples, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);          // PCM
  header.writeUInt16LE(1, 22);          // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28); // byte rate
  header.writeUInt16LE(1, 32);          // block align
  header.writeUInt16LE(8, 34);          // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(numSamples, 40);
  const data = Buffer.alloc(numSamples, 128); // 128 = silence for 8-bit unsigned PCM
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.concat([header, data]));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Spotify remote running at http://localhost:${PORT}`);
});
