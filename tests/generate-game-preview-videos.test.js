const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const generateGamePreviewVideos = require('../generate-game-preview-videos.js');

test('adds missing Playgama video URLs by matching homepage and export slugs', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pleyz-preview-catalog-'));
  try {
    fs.writeFileSync(path.join(directory, 'index.html'), `
      <script>
      const GAMES = [
        { id: 12, name: 'New Game', iframeUrl: '/games/new-game.html' },
        { id: 13, name: 'Existing Game', iframeUrl: '/games/existing-game.html' },
        { id: 14, name: 'No Preview', iframeUrl: '/games/no-preview.html' }
      ];
      </script>
    `);
    fs.writeFileSync(path.join(directory, 'game-preview-videos.js'), `
      window.PLEYZ_GAME_PREVIEW_VIDEOS = Object.freeze({
        13: 'https://existing.example/preview.mp4'
      });
    `);
    fs.writeFileSync(path.join(directory, 'game.json'), JSON.stringify({
      segments: [{
        hits: [
          { slug: 'new-game', videoId: 'newVideoId' },
          { slug: 'existing-game', videoId: 'replacementVideoId' },
          { slug: 'unused-game', videoId: 'unusedVideoId' },
          { slug: 'no-video-game' }
        ]
      }]
    }));

    assert.deepEqual(generateGamePreviewVideos(directory), { added: 1, total: 2 });
    const output = fs.readFileSync(path.join(directory, 'game-preview-videos.js'), 'utf8');
    assert.match(output, /"12": "https:\/\/static\.playgama\.com\/p-video\/newVideoId\/orig_length_h320\.mp4"/);
    assert.match(output, /"13": "https:\/\/existing\.example\/preview\.mp4"/);
    assert.doesNotMatch(output, /"14":/);
    assert.deepEqual(generateGamePreviewVideos(directory), { added: 0, total: 2 });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
