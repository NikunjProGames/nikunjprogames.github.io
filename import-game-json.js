const fs = require('fs');
const path = require('path');

const SOURCE_FILE = path.join(__dirname, 'game.json');
const FEED_FILE = path.join(__dirname, 'feed.json');

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function toTitleCase(value) {
  return String(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function flattenSourceGames(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.segments)) {
    return raw.segments.flatMap((segment) => Array.isArray(segment.hits) ? segment.hits : []);
  }
  return [];
}

function buildFeedEntry(hit) {
  const genres = Array.isArray(hit.genres) ? hit.genres.filter(Boolean) : [];
  const tags = Array.isArray(hit.tags) ? hit.tags.filter(Boolean) : [];
  const image = Array.isArray(hit.images) && hit.images.length
    ? hit.images[0]
    : hit.imageSrcSquare || hit.imageSrc || '';

  const instructions = hit.howToPlayText || 'Tap or click to start playing.';
  const url = hit.gameURL || hit.playgamaGameUrl || '';
  const category = genres.length ? toTitleCase(genres[0]) : 'Arcade';

  return {
    id: hit.id || String(Date.now()),
    title: hit.title || 'Untitled Game',
    description: hit.description || '',
    instructions,
    url,
    category,
    tags: [...genres, ...tags].filter(Boolean).join(', '),
    thumb: image,
    width: '800',
    height: '450'
  };
}

function main() {
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }

  const sourceRaw = fs.readFileSync(SOURCE_FILE, 'utf8');
  const sourceGames = flattenSourceGames(JSON.parse(sourceRaw));

  const feedRaw = fs.readFileSync(FEED_FILE, 'utf8');
  const existingFeed = JSON.parse(feedRaw);

  const seenTitles = new Set(existingFeed.map((game) => String(game.title || '').toLowerCase()));
  const imported = [];

  sourceGames.forEach((hit) => {
    if (!hit || !hit.title) return;
    const normalizedTitle = String(hit.title).toLowerCase();
    if (seenTitles.has(normalizedTitle)) return;

    const entry = buildFeedEntry(hit);
    imported.push(entry);
    seenTitles.add(normalizedTitle);
  });

  if (!imported.length) {
    console.log('No new games were imported. The game may already exist in feed.json.');
    return;
  }

  const updatedFeed = existingFeed.concat(imported);
  fs.writeFileSync(FEED_FILE, JSON.stringify(updatedFeed, null, 2));

  console.log(`Imported ${imported.length} game(s) into feed.json`);
  imported.forEach((game) => {
    console.log(`- ${game.title} -> /games/${slugify(game.title)}.html`);
  });
}

main();
