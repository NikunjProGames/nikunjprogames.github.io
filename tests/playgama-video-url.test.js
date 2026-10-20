const test = require('node:test');
const assert = require('node:assert/strict');
const createPlaygamaVideoUrl = require('../playgama-video-url.js');

test('formats a Playgama video ID using the page video URL format', () => {
  assert.equal(
    createPlaygamaVideoUrl('897c9cffa54f408488ae9e1725baa889'),
    'https://static.playgama.com/p-video/897c9cffa54f408488ae9e1725baa889/orig_length_h320.mp4'
  );
});

test('trims surrounding whitespace from a video ID', () => {
  assert.equal(
    createPlaygamaVideoUrl(' video_id-1 '),
    'https://static.playgama.com/p-video/video_id-1/orig_length_h320.mp4'
  );
});

test('rejects IDs that could alter the generated URL path', () => {
  assert.throws(() => createPlaygamaVideoUrl('../other'), /valid Playgama video ID/);
  assert.throws(() => createPlaygamaVideoUrl(''), /valid Playgama video ID/);
});
