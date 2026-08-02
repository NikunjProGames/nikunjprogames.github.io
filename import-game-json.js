const fs = require('fs');
const path = require('path');

const FEED_FILE = path.join(__dirname, 'feed.json');

function findSourceFiles() {
  return fs.readdirSync(__dirname, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json') && entry.name !== 'feed.json')
    .map((entry) => path.join(__dirname, entry.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

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
  const sourceFiles = findSourceFiles();

  if (!sourceFiles.length) {
    console.error('No JSON source files found in the project root.');
    process.exit(1);
  }

  const feedRaw = fs.readFileSync(FEED_FILE, 'utf8');
  const existingFeed = JSON.parse(feedRaw);
  const seenTitles = new Set(existingFeed.map((game) => String(game.title || '').toLowerCase()));
  const imported = [];
  const processedFiles = [];

  sourceFiles.forEach((sourceFile) => {
    let sourceRaw;
    try {
      sourceRaw = fs.readFileSync(sourceFile, 'utf8');
    } catch (error) {
      console.warn(`Skipping ${path.basename(sourceFile)}: ${error.message}`);
      return;
    }

    let sourceGames = [];
    try {
      sourceGames = flattenSourceGames(JSON.parse(sourceRaw));
    } catch (error) {
      console.warn(`Skipping ${path.basename(sourceFile)}: not a valid game JSON file (${error.message})`);
      return;
    }

    if (!sourceGames.length) {
      console.log(`Skipping ${path.basename(sourceFile)}: no usable game entries found.`);
      return;
    }

    processedFiles.push(path.basename(sourceFile));

    sourceGames.forEach((hit) => {
      if (!hit || !hit.title) return;
      const normalizedTitle = String(hit.title).toLowerCase();
      if (seenTitles.has(normalizedTitle)) return;

      const entry = buildFeedEntry(hit);
      imported.push(entry);
      seenTitles.add(normalizedTitle);
    });
  });

  if (!imported.length) {
    console.log('No new games were imported.');
    console.log(`Checked files: ${processedFiles.length ? processedFiles.join(', ') : 'none'}`);
    console.log('This usually means the title already exists in feed.json or the source file has no usable game entries.');
    return;
  }

  const updatedFeed = existingFeed.concat(imported);
  fs.writeFileSync(FEED_FILE, JSON.stringify(updatedFeed, null, 2));

  console.log(`Imported ${imported.length} game(s) into feed.json`);
  console.log(`Processed files: ${processedFiles.join(', ')}`);
  imported.forEach((game) => {
    console.log(`- ${game.title} -> /games/${slugify(game.title)}.html`);
  });
}

main();
