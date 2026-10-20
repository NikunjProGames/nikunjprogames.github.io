const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const createPlaygamaVideoUrl = require('./playgama-video-url.js');

const PLAYGAMA_JSON_PATTERN = /^game(?: \(\d+\))?\.json$/;

function loadHomepageGames(indexPath) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const match = html.match(/const GAMES\s*=\s*(\[[\s\S]*?\n\s*\]);/);
  if (!match) throw new Error('Could not find the homepage GAMES array in index.html.');
  const games = vm.runInNewContext(`(${match[1]})`, {}, { timeout: 1000 });
  if (!Array.isArray(games)) throw new Error('The homepage GAMES value must be an array.');
  return games;
}

function loadExistingPreviewUrls(catalogPath) {
  const source = fs.readFileSync(catalogPath, 'utf8');
  const match = source.match(/window\.PLEYZ_GAME_PREVIEW_VIDEOS\s*=\s*Object\.freeze\((\{[\s\S]*?\n[ \t]*\})\);/);
  if (!match) throw new Error('Could not find PLEYZ_GAME_PREVIEW_VIDEOS in game-preview-videos.js.');
  const urls = vm.runInNewContext(`(${match[1]})`, {}, { timeout: 1000 });
  if (!urls || typeof urls !== 'object' || Array.isArray(urls)) {
    throw new Error('The homepage preview URL catalog must be an object.');
  }
  return { ...urls };
}

function getPlaygamaEntries(rootDirectory) {
  const sourceFiles = fs.readdirSync(rootDirectory).filter(filename => PLAYGAMA_JSON_PATTERN.test(filename));
  return sourceFiles.flatMap(filename => {
    const source = JSON.parse(fs.readFileSync(path.join(rootDirectory, filename), 'utf8'));
    const entries = Array.isArray(source) ? source : source.segments?.flatMap(segment => segment.hits || []);
    if (!Array.isArray(entries)) throw new Error(`${filename} does not contain a Playgama game list.`);
    return entries;
  });
}

function getHomepageSlug(game) {
  const iframePath = String(game.iframeUrl || '').split(/[?#]/, 1)[0];
  return path.posix.basename(iframePath).replace(/\.html$/i, '').toLowerCase();
}

function generateGamePreviewVideos(rootDirectory = __dirname) {
  const indexPath = path.join(rootDirectory, 'index.html');
  const catalogPath = path.join(rootDirectory, 'game-preview-videos.js');
  const homepageGames = loadHomepageGames(indexPath);
  const urls = loadExistingPreviewUrls(catalogPath);
  const metadataBySlug = new Map();

  getPlaygamaEntries(rootDirectory).forEach(entry => {
    const slug = String(entry.slug || '').trim().toLowerCase();
    const videoId = String(entry.videoId || entry.videos?.find(video => video.playgama_id)?.playgama_id || '').trim();
    if (!slug || !videoId) return;
    if (metadataBySlug.has(slug) && metadataBySlug.get(slug) !== videoId) {
      throw new Error(`Conflicting Playgama video IDs found for slug "${slug}".`);
    }
    metadataBySlug.set(slug, videoId);
  });

  let added = 0;
  homepageGames.forEach(game => {
    const gameId = String(game.id || '').trim();
    const videoId = metadataBySlug.get(getHomepageSlug(game));
    if (!gameId || !videoId || Object.hasOwn(urls, gameId)) return;
    urls[gameId] = createPlaygamaVideoUrl(videoId);
    added += 1;
  });

  const sortedUrls = Object.fromEntries(
    Object.entries(urls).sort(([left], [right]) => Number(left) - Number(right))
  );
  const output = `window.PLEYZ_GAME_PREVIEW_VIDEOS = Object.freeze(${JSON.stringify(sortedUrls, null, 2)});\n`;
  if (fs.readFileSync(catalogPath, 'utf8') !== output) {
    fs.writeFileSync(catalogPath, output);
  }
  return { added, total: Object.keys(sortedUrls).length };
}

module.exports = generateGamePreviewVideos;

if (require.main === module) {
  try {
    const { added, total } = generateGamePreviewVideos();
    console.log(`Added ${added} Playgama preview URL${added === 1 ? '' : 's'}; ${total} URLs are in the homepage catalog.`);
  } catch (error) {
    console.error(`Could not generate homepage game previews: ${error.message}`);
    process.exitCode = 1;
  }
}
