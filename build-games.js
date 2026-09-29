const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

function toPlainText(value) {
  const entities = {
    amp: '&', apos: "'", bull: '•', gt: '>', ldquo: '“', lsquo: '‘', lt: '<',
    mdash: '—', nbsp: ' ', ndash: '–', quot: '"', rdquo: '”', reg: '®',
    rsquo: '’', trade: '™'
  };

  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&([a-z]+);/gi, (match, entity) => entities[entity.toLowerCase()] || match)
    .replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return toPlainText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function formatCategory(value) {
  const label = toPlainText(value).toLowerCase();
  const knownLabels = { io: 'IO', boys: 'Boys', girls: 'Girls', 'two player': 'Two Player' };
  return knownLabels[label] || label.replace(/\b\w/g, character => character.toUpperCase());
}

function listFrom(value) {
  if (Array.isArray(value)) return value.map(item => toPlainText(item)).filter(Boolean);
  return String(value || '').split(',').map(item => toPlainText(item)).filter(Boolean);
}

function normalizeGame(game) {
  const description = toPlainText(game.description);
  const instructions = toPlainText(game.instructions);
  const categories = [...new Set([...listFrom(game.categories), ...listFrom(game.category)])];
  const tags = listFrom(game.tags);
  const shortDescription = toPlainText(game.shortDescription) || description.slice(0, 155).replace(/\s+\S*$/, '');

  return {
    ...game,
    slug: game.slug || slugify(game.title),
    description,
    shortDescription,
    instructions,
    howToPlay: toPlainText(game.howToPlay),
    controls: toPlainText(game.controls),
    features: listFrom(game.features),
    categories,
    tags,
    platforms: listFrom(game.platforms || ['Web browser']),
    difficulty: toPlainText(game.difficulty),
    gameDna: listFrom(game.gameDna || [...categories, ...tags]).slice(0, 12),
    faqs: Array.isArray(game.faqs) ? game.faqs : [],
    relatedGames: Array.isArray(game.relatedGames) ? game.relatedGames : [],
    relatedCategories: Array.isArray(game.relatedCategories) ? game.relatedCategories : [],
    seoTitle: toPlainText(game.seoTitle) || `Play ${toPlainText(game.title)} Online | PleyZ`,
    seoDescription: toPlainText(game.seoDescription) || shortDescription,
    imageWidth: Number(game.width) || 448,
    imageHeight: Number(game.height) || 336
  };
}

function getVideoHtml(game) {
  const directCandidates = [
    game.videoUrl,
    game.video_url,
    game.video,
    game.videoURL,
    game.previewVideoUrl,
    game.preview_url,
    game.external_url,
    game.videos?.[0]?.external_url,
    game.videos?.[0]?.url,
    game.video_metadata?.[0]?.external_url,
    game.video_metadata?.[0]?.url,
    game.embed && String(game.embed).match(/https?:\/\/[^"'\s]+(?:mp4|webm|m3u8)/i)?.[0]
  ].filter(Boolean);

  const directVideoUrl = directCandidates.find(value => /\.(mp4|webm|m3u8)(\?|$)/i.test(value) || /static\.playgama\.com\/p-video\//i.test(value));
  const playgamaId = [
    game.videoId,
    game.playgama_id,
    game.playgamaId,
    game.videos?.[0]?.playgama_id,
    game.video_metadata?.[0]?.playgama_id,
  ].find(value => typeof value === 'string' && value.trim());

  const videoUrl = directVideoUrl || (playgamaId ? `https://static.playgama.com/p-video/${String(playgamaId).trim()}/orig_length_h640_6so.mp4` : '');

  if (!videoUrl) return '';

  const safeUrl = escapeHtml(videoUrl);
  const youtubeMatch = String(videoUrl).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
  const vimeoMatch = String(videoUrl).match(/vimeo\.com\/(\d+)/i);

  if (youtubeMatch) {
    const embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    return `
      <section class="video-card" aria-label="How to play video">
        <div class="video-card-header">
          <h3>How to Play</h3>
          <span>Quick guide</span>
        </div>
        <iframe src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </section>`;
  }

  if (vimeoMatch) {
    const embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return `
      <section class="video-card" aria-label="How to play video">
        <div class="video-card-header">
          <h3>How to Play</h3>
          <span>Quick guide</span>
        </div>
        <iframe src="${embedUrl}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </section>`;
  }

  return `
    <section class="video-card" aria-label="How to play video">
      <div class="video-card-header">
        <h3>How to Play</h3>
        <span>Quick guide</span>
      </div>
      <video controls preload="metadata" playsinline src="${safeUrl}"></video>
    </section>`;
}

function getRecommendationVideoUrl(game, homepageVideosBySlug) {
  const directCandidates = [
    game.videoUrl,
    game.video_url,
    game.video,
    game.videoURL,
    game.previewVideoUrl,
    game.preview_url,
    game.external_url,
    game.videos?.[0]?.external_url,
    game.videos?.[0]?.url,
    game.video_metadata?.[0]?.external_url,
    game.video_metadata?.[0]?.url
  ].filter(Boolean);
  const directVideoUrl = directCandidates.find(value =>
    /\.(?:mp4|webm)(?:\?|$)/i.test(value) || /static\.playgama\.com\/p-video\//i.test(value)
  );
  if (directVideoUrl) return directVideoUrl;

  const playgamaId = [
    game.videoId,
    game.playgama_id,
    game.playgamaId,
    game.videos?.[0]?.playgama_id,
    game.video_metadata?.[0]?.playgama_id
  ].find(value => typeof value === 'string' && value.trim());
  return playgamaId
    ? `https://static.playgama.com/p-video/${String(playgamaId).trim()}/orig_length_h640_6so.mp4`
    : homepageVideosBySlug.get(game.slug) || '';
}

function getRecommendationsHtml(game, games, homepageVideosBySlug) {
  const gameCategories = new Set(game.categories.map(category => category.toLowerCase()));
  const gameTags = new Set(game.tags.map(tag => tag.toLowerCase()));
  const recommendations = games
    .filter(candidate => candidate.slug !== game.slug)
    .map(candidate => {
      const sharedCategories = candidate.categories.filter(category => gameCategories.has(category.toLowerCase())).length;
      const sharedTags = candidate.tags.filter(tag => gameTags.has(tag.toLowerCase())).length;
      return { candidate, score: sharedCategories * 3 + sharedTags };
    })
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title))
    .slice(0, 5)
    .map(({ candidate }, index) => {
      const image = candidate.thumb
        ? `<img src="${escapeHtml(candidate.thumb)}" alt="" width="${candidate.imageWidth}" height="${candidate.imageHeight}" loading="${index === 0 ? 'eager' : 'lazy'}"${index === 0 ? ' fetchpriority="high"' : ''} decoding="async" />`
        : '';
      const videoUrl = getRecommendationVideoUrl(candidate, homepageVideosBySlug);
      const video = /\.(?:mp4|webm)(?:\?|$)/i.test(videoUrl)
        ? `<video class="related-game-preview" muted loop playsinline preload="none" tabindex="-1" src="${escapeHtml(videoUrl)}"></video>`
        : '';
      const media = image || video ? `<span class="related-game-media">${image}${video}</span>` : '';
      return `<a class="related-game" href="${candidate.slug}.html">${media}<span>${escapeHtml(candidate.title)}</span></a>`;
    })
    .join('\n        ');
  return recommendations;
}

function getGameContentHtml(game) {
  const sections = [`<section class="info-card" aria-labelledby="game-description-heading">
      <h2 id="game-description-heading">About ${escapeHtml(game.title)}</h2>
      <p>${escapeHtml(game.description)}</p>
    </section>`];

  const howToPlay = game.howToPlay || (!game.controls ? game.instructions : '');
  if (howToPlay) {
    sections.push(`<section class="info-card" aria-labelledby="how-to-play-heading">
      <h2 id="how-to-play-heading">How to Play</h2>
      <p>${escapeHtml(howToPlay)}</p>
    </section>`);
  }

  if (game.controls) {
    sections.push(`<section class="info-card" aria-labelledby="controls-heading">
      <h2 id="controls-heading">Controls</h2>
      <p>${escapeHtml(game.controls)}</p>
    </section>`);
  }

  if (game.features.length) {
    sections.push(`<section class="info-card" aria-labelledby="features-heading">
      <h2 id="features-heading">Features</h2>
      <ul>${game.features.map(feature => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>
    </section>`);
  }

  const dna = [...new Set([...game.gameDna, ...game.categories, ...game.tags])].slice(0, 12);
  if (dna.length) {
    sections.push(`<section class="info-card" aria-labelledby="game-dna-heading">
      <h2 id="game-dna-heading">Game DNA</h2>
      <div class="chip-list">${dna.map(item => `<span class="chip">${escapeHtml(item)}</span>`).join('')}</div>
    </section>`);
  }

  if (game.platforms.length || game.difficulty) {
    const details = [
      game.platforms.length ? `<p><strong>Platform:</strong> ${escapeHtml(game.platforms.join(', '))}</p>` : '',
      game.difficulty ? `<p><strong>Difficulty:</strong> ${escapeHtml(game.difficulty)}</p>` : ''
    ].filter(Boolean).join('');
    sections.push(`<section class="info-card" aria-label="Game details">${details}</section>`);
  }

  if (game.faqs.length) {
    sections.push(`<section class="info-card" aria-labelledby="faq-heading">
      <h2 id="faq-heading">Questions and Answers</h2>
      ${game.faqs.map(faq => `<h3>${escapeHtml(faq.question)}</h3><p>${escapeHtml(faq.answer)}</p>`).join('')}
    </section>`);
  }

  return sections.join('\n');
}

function getBreadcrumbsHtml(game) {
  const category = game.categories[0];
  const categoryLink = category
    ? `<li><a href="/${slugify(category)}-games/">${escapeHtml(category)} Games</a></li>`
    : '';
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="../">Home</a></li>${categoryLink}<li aria-current="page">${escapeHtml(game.title)}</li></ol></nav>`;
}

function getGameSchema(game) {
  const pageUrl = `https://nikunjprogames.github.io/games/${game.slug}.html`;
  const graph = [
    {
      '@type': 'VideoGame',
      '@id': `${pageUrl}#game`,
      name: game.title,
      description: game.description,
      url: pageUrl,
      image: game.thumb,
      gamePlatform: game.platforms,
      genre: game.categories,
      keywords: game.tags
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nikunjprogames.github.io/' },
        ...(game.categories[0] ? [{
          '@type': 'ListItem', position: 2, name: `${game.categories[0]} Games`,
          item: `https://nikunjprogames.github.io/${slugify(game.categories[0])}-games/`
        }] : []),
        { '@type': 'ListItem', position: game.categories[0] ? 3 : 2, name: game.title, item: pageUrl }
      ]
    }
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

function loadHomepageGames() {
  const homepage = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const match = homepage.match(/const GAMES = (\[[\s\S]*?\n\]);/);
  if (!match) return [];
  return vm.runInNewContext(`(${match[1]})`);
}

function buildCategoryPages(feedGames) {
  const legacyGames = loadHomepageGames().map(game => ({
    id: game.id,
    name: game.name,
    slug: game.iframeUrl && game.iframeUrl.startsWith('/games/')
      ? game.iframeUrl.split('/').pop().replace(/\.html$/, '')
      : slugify(game.name),
    href: game.iframeUrl && game.iframeUrl.startsWith('/games/')
      ? game.iframeUrl
      : `/${String(game.iframeUrl || `${slugify(game.name)}.html`).replace(/^\/+/, '')}`,
    image: game.imageUrl || '',
    categories: [...new Set([...(Array.isArray(game.categories) ? game.categories : []), game.cat].filter(Boolean))],
    tags: [...(Array.isArray(game.tags) ? game.tags : []), ...(Array.isArray(game.gameDna) ? game.gameDna : [])],
    width: Number(game.width) || 0,
    height: Number(game.height) || 0
  }));
  const catalogGames = feedGames.map(game => ({
    id: Number(game.id),
    name: game.title,
    slug: game.slug,
    href: `/games/${game.slug}.html`,
    image: game.thumb,
    categories: game.categories,
    tags: game.tags,
    width: game.imageWidth,
    height: game.imageHeight
  }));
  const categories = new Map();

  const libraryGames = [...legacyGames, ...catalogGames];
  const categoryThemes = {
    action: 'intense', adventure: 'weird', arcade: 'arcade', boys: 'intense',
    cars: 'intense', endless: 'skill', girls: 'chill', io: 'weird',
    multiplayer: 'intense', nostalgia: 'retro', parkour: 'skill', puzzle: 'brain',
    racing: 'intense', shooting: 'tactical', simulation: 'weird', sports: 'skill',
    strategy: 'tactical', 'two player': 'intense'
  };
  libraryGames.forEach(game => {
    game.categories.forEach(category => {
      const key = toPlainText(category).toLowerCase();
      if (!key) return;
      if (!categories.has(key)) categories.set(key, { name: formatCategory(category), games: new Map(), theme: categoryThemes[key] || 'default' });
      categories.get(key).games.set(game.href, game);
    });
  });

  const homepage = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const trendingMatch = homepage.match(/const TRENDING = (\[[\s\S]*?\n\]);/);
  const trendingIds = new Set(trendingMatch ? vm.runInNewContext(`(${trendingMatch[1]})`).map(game => game.id) : []);
  const curatedCategories = [
    { name: 'Brain Training', theme: 'brain', description: 'Browse games tagged for brain, memory, logic, quizzes, words, and trivia in the PleyZ library.', terms: ['brain', 'memory', 'logic', 'quiz', 'word', 'trivia'] },
    { name: 'Skill', theme: 'skill', description: 'Explore games tagged for skill, reflexes, precision, obstacles, and parkour.', terms: ['skill', 'precision', 'reflex', 'obstacle', 'parkour'] },
    { name: 'FPS & Shooting', theme: 'tactical', description: 'Find first-person shooters and shooting games identified by the PleyZ game catalog.', terms: ['fps', 'first person shooter', 'shooter', 'shooting'] },
    { name: 'Survival & Zombies', theme: 'intense', description: 'Play survival and zombie games identified by their catalog tags and titles.', terms: ['survival', 'zombie', 'battle royale'] },
    { name: 'Physics & Oddities', theme: 'weird', description: 'Discover physics-based and brainrot-tagged games from the PleyZ library.', terms: ['physics', 'brainrot', 'weird', 'experimental', 'chaotic', 'meme'] },
    { name: 'Chill & Casual', theme: 'chill', description: 'Browse games tagged casual, cozy, relaxing, or idle for a lower-pressure play session.', terms: ['casual', 'cozy', 'relax', 'idle'] },
    { name: 'Tactical Strategy', theme: 'tactical', description: 'Find strategy, tactical, defense, and tower games using the library’s own tags.', terms: ['tactical', 'strategy', 'defense', 'tower'] },
    { name: 'New in 2026', theme: 'fresh', description: 'Browse PleyZ games marked with the 2026 games tag in the current catalog feed.', select: game => (game.tags || []).some(tag => String(tag).trim().toLowerCase() === '2026 games') },
    { name: 'PleyZ Picks', theme: 'default', description: 'Browse the games in PleyZ’s current featured and trending selection.', select: game => trendingIds.has(game.id) }
  ];

  curatedCategories.forEach(category => {
    const selectedGames = libraryGames.filter(game => {
      if (category.select) return category.select(game);
      const labels = [...(game.categories || []), ...(game.tags || [])].map(value => String(value).trim().toLowerCase());
      return category.terms.some(term => labels.includes(term));
    }).slice(0, category.maxGames || 100);
    if (selectedGames.length < 4) return;
    categories.set(`editorial-${slugify(category.name)}`, {
      name: category.name,
      games: new Map(selectedGames.map(game => [game.href, game])),
      description: category.description,
      theme: category.theme
    });
  });

  const categoryTemplate = fs.readFileSync(path.join(__dirname, 'category-template.html'), 'utf8');
  const pages = [...categories.entries()].map(([key, category]) => {
    const slug = slugify(category.name);
    const categoryUrl = `/${slug}-games/`;
    const gameList = [...category.games.values()];
    const description = category.description || `Browse ${category.name.toLowerCase()} browser games on PleyZ. Open a game page for its description, available instructions, and related titles.`;
    const cards = gameList.map((game, index) => {
      const imageUrl = game.image && !/^(?:https?:|\/|data:)/i.test(game.image) ? `/${game.image}` : game.image;
      const imageDimensions = game.width && game.height ? ` width="${game.width}" height="${game.height}"` : '';
      return `<a class="game-item" href="${escapeHtml(game.href)}">
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt=""${imageDimensions} loading="${index === 0 ? 'eager' : 'lazy'}"${index === 0 ? ' fetchpriority="high"' : ''} decoding="async">` : ''}
      <span>${escapeHtml(game.name)}</span>
    </a>`;
    }).join('\n');
    const related = [...categories.entries()]
      .filter(([otherKey]) => otherKey !== key)
      .sort((a, b) => b[1].games.size - a[1].games.size)
      .slice(0, 5)
      .map(([, other]) => `<a href="/${slugify(other.name)}-games/">${escapeHtml(other.name)} Games</a>`)
      .join('\n');
    const schema = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${category.name} Games`,
      description,
      url: `https://nikunjprogames.github.io${categoryUrl}`,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: gameList.length,
        itemListElement: gameList.map((game, index) => ({
          '@type': 'ListItem', position: index + 1,
          name: game.name,
          url: `https://nikunjprogames.github.io${game.href}`
        }))
      }
    }).replace(/</g, '\\u003c');
    const html = categoryTemplate
      .replaceAll('{{CATEGORY}}', escapeHtml(category.name))
      .replaceAll('{{CATEGORY_SLUG}}', slug)
      .replaceAll('{{CATEGORY_THEME}}', category.theme || 'default')
      .replaceAll('{{DESCRIPTION}}', escapeHtml(description))
      .replaceAll('{{GAME_COUNT}}', String(gameList.length))
      .replaceAll('{{GAME_CARDS}}', cards)
      .replaceAll('{{RELATED_CATEGORIES}}', related)
      .replaceAll('{{JSON_LD}}', schema);
    return { slug, html };
  });

  const categoryUrls = new Set(pages.map(({ slug }) => `https://nikunjprogames.github.io/${slug}-games/`));
  pages.forEach(({ slug, html }) => {
    const outputDir = path.join(__dirname, `${slug}-games`);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'index.html'), html);
  });

  fs.readdirSync(__dirname, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.endsWith('-games'))
    .forEach(entry => {
      const url = `https://nikunjprogames.github.io/${entry.name}/`;
      if (categoryUrls.has(url)) return;
      const outputDir = path.join(__dirname, entry.name);
      const pagePath = path.join(outputDir, 'index.html');
      if (!fs.existsSync(pagePath)) return;
      const existingPage = fs.readFileSync(pagePath, 'utf8');
      if (!existingPage.includes('name="generator" content="PleyZ static category generator"')) return;
      fs.unlinkSync(pagePath);
      try { fs.rmdirSync(outputDir); } catch (_) {}
    });

  const sitemapPath = path.join(__dirname, 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    let sitemap = fs.readFileSync(sitemapPath, 'utf8');
    sitemap = sitemap.replace(/<url>[\s\S]*?<\/url>/g, entry => {
      const location = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
      if (!location || !/\/[^/]+-games\/$/.test(new URL(location).pathname)) return entry;
      return categoryUrls.has(location) ? entry : '';
    });
    const knownUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]));
    const additions = [...categoryUrls]
      .filter(url => !knownUrls.has(url))
      .map(url => `<url><loc>${url}</loc></url>`);
    if (additions.length) {
      sitemap = sitemap.replace('</urlset>', `${additions.join('\n')}\n</urlset>`);
      fs.writeFileSync(sitemapPath, sitemap);
    }
  }

  return pages.length;
}

function generateGamePages() {
  // Read the JSON file and HTML template
  const gamesData = fs.readFileSync(FEED_FILE, 'utf8');
  const games = JSON.parse(gamesData).map(normalizeGame);
  const template = fs.readFileSync('template.html', 'utf8');
  const homepageIdBySlug = new Map(loadHomepageGames().flatMap(game => {
    const match = String(game.iframeUrl || '').match(/^\/?games\/([^/]+)\.html$/);
    return match ? [[match[1], game.id]] : [];
  }));
  const homepageVideosBySlug = new Map(loadHomepageGames().flatMap(game => {
    const match = String(game.iframeUrl || '').match(/^\/?games\/([^/]+)\.html$/);
    return match && game.videoUrl ? [[match[1], game.videoUrl]] : [];
  }));

  // Create the output directory
  const outputDir = path.join(__dirname, 'games');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // 2. Loop through each game
  games.forEach(game => {
    // Convert JSON tags into HTML chips
    const tagsHtml = [...new Set([...game.categories, ...game.tags])]
      .map(tag => `<span class="chip">${escapeHtml(tag)}</span>`)
      .join('\n        ');

    // 3. Replace placeholders with actual data
    const videoHtml = getVideoHtml(game);
    const categoryLinks = game.categories.map(category =>
      `<a href="/${slugify(category)}-games/">${escapeHtml(category)} Games</a>`
    ).join('');

    let htmlContent = template
      .replaceAll('{{TITLE}}', escapeHtml(game.title))
      .replaceAll('{{GAME_ID}}', escapeHtml(String(homepageIdBySlug.get(game.slug) ?? game.id)))
      .replaceAll('{{SEO_TITLE}}', escapeHtml(game.seoTitle))
      .replaceAll('{{DESCRIPTION}}', escapeHtml(game.seoDescription))
      .replaceAll('{{SLUG}}', game.slug)
      .replaceAll('{{IMAGE}}', escapeHtml(game.thumb))
      .replaceAll('{{EMBED_URL}}', escapeHtml(game.url))
      .replaceAll('{{CHIPS}}', tagsHtml)
      .replaceAll('{{GAME_CONTENT_HTML}}', getGameContentHtml(game))
      .replaceAll('{{BREADCRUMBS_HTML}}', getBreadcrumbsHtml(game))
      .replaceAll('{{RELATED_CATEGORIES_HTML}}', categoryLinks)
      .replaceAll('{{JSON_LD}}', getGameSchema(game))
      .replaceAll('{{VIDEO_HTML}}', videoHtml)
      .replaceAll('{{RECOMMENDATIONS_HTML}}', getRecommendationsHtml(game, games, homepageVideosBySlug))
      .replaceAll('{{IMAGE_WIDTH}}', String(game.imageWidth))
      .replaceAll('{{IMAGE_HEIGHT}}', String(game.imageHeight));

    // 4. Save the file
    fs.writeFileSync(path.join(outputDir, `${game.slug}.html`), htmlContent);
  });

  console.log(`Success! ${games.length} game pages generated in the /games/ folder.`);
  console.log(`Success! ${buildCategoryPages(games)} category pages generated.`);
}

if (process.argv.includes('--categories-only')) {
  const games = JSON.parse(fs.readFileSync(FEED_FILE, 'utf8')).map(normalizeGame);
  console.log(`Success! ${buildCategoryPages(games)} category pages generated.`);
} else {
  generateGamePages();
}