const test = require('node:test');
const assert = require('node:assert/strict');
const createGameSeoDescription = require('../game-seo-description.js');

test('builds a fuller snippet from complete game-description sentences', () => {
  const description = 'You have two minutes. A ball appears on the court and you drag to set its arc. Consecutive baskets grow your multiplier.';
  const snippet = createGameSeoDescription('Basketball Rush', description, '', 'You have two minutes.');

  assert.match(snippet, /^You have two minutes\. A ball appears on the court/);
  assert.ok(snippet.length >= 70);
  assert.ok(snippet.length <= 160);
});

test('preserves a useful supplied SEO description', () => {
  const supplied = 'Lead a growing crowd through multiplier gates, avoid hazards, and outnumber rivals in this fast-paced runner.';
  assert.equal(
    createGameSeoDescription('Crowd Rush', 'A different source description.', supplied, 'A short line.'),
    supplied
  );
});

test('does not pad a short description with unsupported filler copy', () => {
  assert.equal(
    createGameSeoDescription('Basketball Rush', 'You have two minutes.', '', 'You have two minutes.'),
    'You have two minutes.'
  );
});

test('keeps generated descriptions within the search snippet limit', () => {
  const longDescription = Array.from({ length: 10 }, (_, index) =>
    `Round ${index + 1} adds a new verified gameplay detail for players to explore.`
  ).join(' ');
  assert.ok(
    createGameSeoDescription('Game', longDescription, '', '').length <= 160
  );
});

test('does not split common abbreviations in game titles', () => {
  assert.equal(
    createGameSeoDescription(
      'Plants vs. Zombies',
      'Welcome to the updated world of Plants vs. Zombies, where innovation meets tradition!',
      '',
      ''
    ),
    'Welcome to the updated world of Plants vs. Zombies, where innovation meets tradition!'
  );
});

test('skips FAQ headings and technical remnants when enriching a snippet', () => {
  assert.equal(
    createGameSeoDescription(
      'On Fire Basketball Shots',
      'The gym is packed, and the crowd is roaring! The scoreboard is ticking down. Stable performance regardless of internet quality. HTML5.',
      '',
      'The gym is packed, and the crowd is roaring!'
    ),
    'The gym is packed, and the crowd is roaring! The scoreboard is ticking down.'
  );
});
