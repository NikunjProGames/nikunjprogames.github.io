const fs = require('fs');
const path = require('path');

// 1. Point to your sample JSON file
const FEED_FILE = 'feed.json';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getVideoHtml(game) {
  const videoUrl = game.videoUrl || game.video_url || game.video || game.videos?.[0]?.external_url || game.videos?.[0]?.url || '';

  if (!videoUrl) return '';

  const safeUrl = escapeHtml(videoUrl);
  const youtubeMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
  const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/i);

  if (youtubeMatch) {
    const embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    return `
      <section class="video-card" aria-label="Game preview video">
        <h3>Game Preview</h3>
        <iframe src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </section>`;
  }

  if (vimeoMatch) {
    const embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return `
      <section class="video-card" aria-label="Game preview video">
        <h3>Game Preview</h3>
        <iframe src="${embedUrl}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </section>`;
  }

  return `
    <section class="video-card" aria-label="Game preview video">
      <h3>Game Preview</h3>
      <video controls preload="metadata" playsinline src="${safeUrl}"></video>
    </section>`;
}

function generateGamePages() {
  // Read the JSON file and HTML template
  const gamesData = fs.readFileSync(FEED_FILE, 'utf8');
  const games = JSON.parse(gamesData);
  const template = fs.readFileSync('template.html', 'utf8');

  // Create the output directory
  const outputDir = path.join(__dirname, 'games');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // 2. Loop through each game
  games.forEach(game => {
    // Make a safe URL slug (e.g., "Temple Run 2" -> "temple-run-2")
    const slug = game.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    // Convert JSON tags into HTML chips
    let tagsHtml = '';
    if (game.tags) {
      const tagArray = game.tags.split(',');
      tagsHtml = tagArray.map(tag => `<span class="chip">${tag.trim()}</span>`).join('\n        ');
    } else {
      tagsHtml = `<span class="chip">${game.category}</span>`;
    }

    // 3. Replace placeholders with actual data
    const videoHtml = getVideoHtml(game);

    let htmlContent = template
      .replaceAll('{{TITLE}}', game.title)
      .replaceAll('{{DESCRIPTION}}', game.description)
      .replaceAll('{{EMBED_URL}}', game.url)
      .replaceAll('{{INSTRUCTIONS}}', game.instructions || 'Mouse click or tap to play.')
      .replaceAll('{{TAGS}}', game.tags || game.category)
      .replaceAll('{{CHIPS}}', tagsHtml)
      .replaceAll('{{VIDEO_HTML}}', videoHtml);

    // 4. Save the file
    fs.writeFileSync(path.join(outputDir, `${slug}.html`), htmlContent);
  });

  console.log(`Success! ${games.length} game pages generated in the /games/ folder.`);
}

generateGamePages();