
/* ============================================================
   SYNTHWAVE BACKGROUND
============================================================ */
(function() {
  const canvas = document.getElementById('bg-canvas');
  const skipAnimatedBackground = window.matchMedia('(max-width: 768px)').matches
    || navigator.connection?.saveData === true;
  const lowPowerDevice = navigator.connection?.saveData === true
    || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4);
  if (lowPowerDevice) document.documentElement.classList.add('low-power-device');
  if (!canvas || skipAnimatedBackground || lowPowerDevice) {
    if (canvas) canvas.hidden = true;
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const meteors = [];
  const maxMeteors = 3;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animateBackground = !reducedMotion;
  let offset = 0;
  let nextMeteorIn = 0.8;
  let lastFrameTime = 0;
  let frameId = 0;
  let width = 0;
  let height = 0;
  let horizonY = 0;
  let vanishX = 0;

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    horizonY = height * 0.52;
    vanishX = width / 2;
    canvas.width = width;
    canvas.height = height;
  }

  function spawnMeteor() {
    if (meteors.length >= maxMeteors) return;
    const startY = horizonY * (0.08 + Math.random() * 0.62);
    const speed = 220 + Math.random() * 140;
    const travel = width + 180;
    meteors.push({
      x: -90,
      y: startY,
      startY,
      endY: horizonY * (0.08 + Math.random() * 0.62),
      speed,
      travel,
      arc: (Math.random() - 0.5) * Math.min(100, horizonY * 0.32),
      wave: 8 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
      length: 90 + Math.random() * 90,
      age: 0,
      lifetime: travel / speed
    });
  }

  function drawMeteors(deltaSeconds) {
    nextMeteorIn -= deltaSeconds;
    if (nextMeteorIn <= 0) {
      spawnMeteor();
      nextMeteorIn = 1.4 + Math.random() * 1.8;
    }

    for (let index = meteors.length - 1; index >= 0; index -= 1) {
      const meteor = meteors[index];
      meteor.age += deltaSeconds;
      meteor.x = -90 + meteor.speed * meteor.age;
      const progress = Math.min(1, meteor.age / meteor.lifetime);
      const smoothArc = Math.sin(progress * Math.PI);
      const wave = Math.sin(progress * Math.PI * 2 + meteor.phase) - Math.sin(meteor.phase);
      meteor.y = meteor.startY + (meteor.endY - meteor.startY) * progress
        + meteor.arc * smoothArc + meteor.wave * wave;
      const verticalSlope = ((meteor.endY - meteor.startY)
        + meteor.arc * Math.PI * Math.cos(progress * Math.PI)
        + meteor.wave * Math.PI * 2 * Math.cos(progress * Math.PI * 2 + meteor.phase))
        / meteor.travel;
      const fadeIn = Math.min(1, meteor.age / 0.14);
      const fadeOut = Math.min(1, (meteor.lifetime - meteor.age) / 0.25);
      const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
      const tailX = meteor.x - meteor.length;
      const tailY = meteor.y - verticalSlope * meteor.length;
      const trail = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
      trail.addColorStop(0, `rgba(255,255,255,${alpha})`);
      trail.addColorStop(0.18, `rgba(164,226,255,${alpha * 0.85})`);
      trail.addColorStop(1, 'rgba(0,191,255,0)');
      ctx.strokeStyle = trail;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(meteor.x, meteor.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(meteor.x, meteor.y, 2, 0, Math.PI * 2);
      ctx.fill();

      if (meteor.age >= meteor.lifetime
        || meteor.x < -meteor.length || meteor.x > width + meteor.length
        || meteor.y < -meteor.length || meteor.y > height + meteor.length) {
        meteors.splice(index, 1);
      }
    }
  }

  function drawMovingGrid(deltaSeconds) {
    offset = (offset + deltaSeconds * 0.72) % 1;
    for (let row = 1; row <= 24; row += 1) {
      const depth = row - offset;
      if (depth <= 0.01) continue;
      const perspective = 1 / depth;
      if (perspective > 1) continue;
      const y = horizonY + perspective * (height - horizonY);
      const halfWidth = perspective * width / 2;
      const alpha = Math.min(perspective * 0.65, 0.52);
      ctx.strokeStyle = row % 4 === 0
        ? `rgba(0,191,255,${alpha.toFixed(3)})`
        : `rgba(139,0,255,${(alpha * 0.85).toFixed(3)})`;
      ctx.lineWidth = Math.max(perspective * 1.3, 0.35);
      ctx.beginPath();
      ctx.moveTo(vanishX - halfWidth, y);
      ctx.lineTo(vanishX + halfWidth, y);
      ctx.stroke();
    }
  }

  function drawFrame(timestamp) {
    frameId = 0;
    if (document.hidden) return;
    if (timestamp - lastFrameTime < 40) {
      frameId = requestAnimationFrame(drawFrame);
      return;
    }
    const deltaSeconds = lastFrameTime ? Math.min((timestamp - lastFrameTime) / 1000, 0.1) : 0.04;
    lastFrameTime = timestamp;
    ctx.clearRect(0, 0, width, height);
    drawMovingGrid(deltaSeconds);
    if (animateBackground) drawMeteors(deltaSeconds);
    if (animateBackground) frameId = requestAnimationFrame(drawFrame);
  }

  function startAnimation() {
    lastFrameTime = 0;
    if (animateBackground && !frameId) frameId = requestAnimationFrame(drawFrame);
    else if (!animateBackground) drawFrame(performance.now());
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
    startAnimation();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startAnimation();
  });
  resizeCanvas();
  startAnimation();
})();

/* ============================================================
   GAME DATA
============================================================ */
const GAMES = window.PLEYZ_GAMES;

const GAME_PREVIEW_VIDEOS = window.PLEYZ_GAME_PREVIEW_VIDEOS;

const TRENDING = [
  { id:95,  name:'Hazmob FPS: Online Shooter',    color:'#008840', gradient:'linear-gradient(135deg,#003300,#006600)' },
  { id:94, name:'RIVALS FPS: Online Shooter', color:'#0057B8', gradient:'linear-gradient(135deg,#001530,#003080)' },
  { id:6, name:'GTA New York', color:'#FF0066', gradient:'linear-gradient(135deg,#3f0d3d,#ff0066)' },
  { id:9, name:'Moto Road Rash', color:'#2E8B00', gradient:'linear-gradient(135deg,#1a2000,#405000)' },
  { id:30, name:'Minecraft', color:'#00BFFF', gradient:'linear-gradient(135deg,#001a3a,#004080)' },
  { id:1, name:'Temple Run',     color:'#FF3300', gradient:'linear-gradient(135deg,#3a0010,#8a0020)' },
  { id:4, name:'Subway Surfers',   color:'#9D50FF', gradient:'linear-gradient(135deg,#250040,#600090)' },
  { id:2,  name:'Battledudes', color:'#5B2BFF', gradient:'linear-gradient(135deg,#1a003a,#500090)' },
  { id:10,  name:'Fireboy And Watergirl',      color:'#A100FF', gradient:'linear-gradient(135deg,#300030,#800060)' },
  { id:11,  name:'Pacman',      color:'#A100FF', gradient:'linear-gradient(135deg,#300030,#800060)' },
  { id:15, name:'Stock Car Hero', color:'#24B8FF', gradient:'linear-gradient(135deg,#0e2230,#24b8ff)' },
  { id:37, name:'FIFA Soccer 2023', color:'#8B00FF', gradient:'linear-gradient(135deg,#2d0f4f,#7b2cbf)' },
  { id:41, name:'DNA Evolution 3D', color:'#22C55E', gradient:'linear-gradient(135deg,#062b1d,#22c55e)' },
];

function createGameIconUrl(game) {
  const label = game.name.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><defs><linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${game.color}"/><stop offset="100%" stop-color="#09091a"/></linearGradient></defs><rect x="0" y="0" width="140" height="140" rx="28" fill="url(%23iconGrad)"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="Orbitron, sans-serif" font-size="44" fill="#fff">${label}</text></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function createGameImageMarkup(game, { eager = false, highPriority = false } = {}) {
  const imageUrl = game.imageUrl && game.imageUrl.trim();
  const src = imageUrl || createGameIconUrl(game);
  const className = imageUrl ? 'game-icon custom-game-image' : 'game-icon';
  return `<img class="${className}" src="${src}" alt="${game.name} image" width="92" height="92" loading="${eager ? 'eager' : 'lazy'}" fetchpriority="${highPriority ? 'high' : 'auto'}" decoding="async" />`;
}

function createGameVideoPreview(game) {
  const videoUrl = GAME_PREVIEW_VIDEOS[game.id];
  if (!videoUrl) return null;
  const video = document.createElement('video');
  video.className = 'game-hover-video';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.src = videoUrl;
  return video;
}

function startGameVideoPreview(card) {
  const game = GAMES.find(item => item.id === Number(card.dataset.id));
  const thumb = card.querySelector('.game-thumb');
  const preview = game && createGameVideoPreview(game);
  if (!thumb || !preview) return;

  preview.addEventListener('playing', () => thumb.classList.add('video-playing'), { once: true });
  preview.addEventListener('error', () => stopGameVideoPreview(card), { once: true });
  thumb.appendChild(preview);
  preview.play().catch(() => stopGameVideoPreview(card));
}

function stopGameVideoPreview(card) {
  const thumb = card.querySelector('.game-thumb');
  const preview = thumb?.querySelector('.game-hover-video');
  if (preview) {
    preview.pause();
    preview.removeAttribute('src');
    preview.load();
    preview.remove();
  }
  thumb?.classList.remove('video-playing');
}

function createGameTile(game) {
  const card = document.createElement('div');
  const category = game.cat || getGameCategories(game)[0] || 'game';
  card.className = 'game-card';
  card.dataset.id = String(game.id);
  card.dataset.cat = category;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Play ${game.name}${game.isOriginal ? ', PleyZ Original' : ''}`);
  card.innerHTML = `
    <div class="game-thumb">
      ${createGameImageMarkup(game)}
    </div>
    <h3 class="game-name">${game.name}</h3>
    <div class="game-badges">
      <span class="cat-badge cat-${category}">${category.toUpperCase()}</span>
      ${game.isOriginal ? '<span class="original-badge">PleyZ Original</span>' : ''}
    </div>
  `;
  card.dataset.hasPreview = String(Boolean(GAME_PREVIEW_VIDEOS[game.id]));
  return card;
}

async function submitRecommendationFeedback(button) {
  const user = window.firebaseAuth?.currentUser;
  if (!user) {
    openLoginModal();
    return;
  }
  const row = button.closest('.recommendation-feedback');
  row.querySelectorAll('button').forEach(option => { option.disabled = true; });
  try {
    const mood = getSelectedMood() || 'all';
    const { sendPleyzFeedback } = await import('/feedback-client.js');
    await sendPleyzFeedback(user, 'recommendations', button.dataset.gameId, {
      helpful: button.dataset.helpful === 'true',
      mood
    });
    const username = getCurrentUser();
    if (username) {
      const key = `pleyz_recommendation_feedback_${username}`;
      let allFeedback = {};
      try { allFeedback = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
      const feedback = { ...(allFeedback[mood] || (mood === 'all' ? allFeedback : {})) };
      feedback[button.dataset.gameId] = button.dataset.helpful === 'true';
      allFeedback[mood] = feedback;
      localStorage.setItem(key, JSON.stringify(allFeedback));
    }
    row.textContent = 'Thanks for your feedback.';
  } catch (error) {
    row.querySelectorAll('button').forEach(option => { option.disabled = false; });
    row.setAttribute('role', 'status');
    row.textContent = error.message || 'Feedback could not be saved.';
  }
}

function bindGameGrid(grid) {
  if (grid.dataset.eventsBound === 'true') return;
  grid.dataset.eventsBound = 'true';
  grid.addEventListener('click', event => {
    const helpfulButton = event.target.closest('[data-recommendation-helpful]');
    if (helpfulButton && grid.id === 'recommended-grid') {
      event.preventDefault();
      event.stopPropagation();
      submitRecommendationFeedback(helpfulButton);
      return;
    }
    const card = event.target.closest('.game-card');
    if (card && grid.contains(card) && !event.target.closest('iframe, video, [data-feedback-control]')) openGame(Number(card.dataset.id));
  });
  grid.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.game-card')) {
      event.preventDefault();
      openGame(Number(event.target.dataset.id));
    }
  });
  grid.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    const card = event.target.closest('.game-card[data-has-preview="true"]');
    if (!card || !grid.contains(card) || card.contains(event.relatedTarget)) return;
    startGameVideoPreview(card);
  });
  grid.addEventListener('pointerout', event => {
    const card = event.target.closest('.game-card[data-has-preview="true"]');
    if (!card || !grid.contains(card) || card.contains(event.relatedTarget)) return;
    stopGameVideoPreview(card);
  });
}

/* ============================================================
   RENDER FUNCTIONS
============================================================ */
function getGameCategories(game) {
  const uniqueCategories = new Set(window.PLEYZ_CATEGORY_TAXONOMY.normalizeGameCategories(game));
  if (TRENDING.some(entry => entry.id === game.id)) uniqueCategories.add('trending');

  const tags = getGameTags(game).map(tag => String(tag).toLowerCase());
  const rating = Number(game.rating ?? game.averageRating ?? game.avgRating ?? game.ratingValue);
  const isGem = game.gem === true
    || game.isGem === true
    || uniqueCategories.has('nostalgia')
    || uniqueCategories.has('gem')
    || uniqueCategories.has('gems')
    || tags.some(tag => ['gem', 'gems', 'iconic', 'classic', 'all-time-classic'].includes(tag))
    || TRENDING.some(entry => entry.id === game.id)
    || (Number.isFinite(rating) && rating >= 4.5);
  if (isGem) uniqueCategories.add('gems');

  return [...uniqueCategories];
}

function getGameTags(game) {
  const tags = Array.isArray(game.gameDna) ? game.gameDna : game.tags;
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') return tags.split(',').map(tag => tag.trim()).filter(Boolean);
  return [];
}

function getPreferenceKey() {
  const username = getCurrentUser();
  return username ? `nikunj_game_preferences_${username}` : 'nikunj_game_preferences_guest';
}

function getGamePreferences() {
  try {
    return JSON.parse(localStorage.getItem(getPreferenceKey()) || '{}');
  } catch (_) {
    return {};
  }
}

function getRecommendationFeedback(username, mood = 'all') {
  try {
    const feedback = JSON.parse(localStorage.getItem(`pleyz_recommendation_feedback_${username}`) || '{}');
    return feedback[mood] || (mood === 'all' ? feedback : {});
  } catch (_) {
    return {};
  }
}

function getRecommendationFeedbackSignals(username) {
  if (!username) return { categories: {}, tags: {}, keywords: {} };
  try {
    return JSON.parse(localStorage.getItem(`pleyz_recommendation_signals_${username}`) || '{"categories":{},"tags":{},"keywords":{}}');
  } catch (_) {
    return { categories: {}, tags: {}, keywords: {} };
  }
}

function findGameByFeedbackId(id) {
  return GAMES.find(game => String(game.id) === String(id)
    || String(game.iframeUrl || '').split(/[?#]/)[0].split('/').pop() === String(id));
}

function rankGamesForUser(games) {
  const recent = getRecentGamesForUser(getCurrentUser());
  const preferences = getGamePreferences();
  const recentGames = recent.map(item => GAMES.find(game => game.id === item.id)).filter(Boolean);
  const preferredCategories = new Set(
    recentGames.flatMap(game => getGameCategories(game))
  );
  const feedbackSignals = getRecommendationFeedbackSignals(getCurrentUser());

  return [...games].sort((a, b) => {
    const score = game => {
      const preference = preferences[game.id];
      if (preference === 'dislike') return -100;
      if (preference === 'like') return 50;
      const categoryMatch = getGameCategories(game).some(cat => preferredCategories.has(cat));
      return (categoryMatch ? 10 : 0)
        + getGameCategories(game).reduce((total, category) => total + (feedbackSignals.categories[category] || 0), 0)
        + getGameTags(game).reduce((total, tag) => total + (feedbackSignals.tags[String(tag).toLowerCase()] || 0), 0);
    };
    return score(b) - score(a);
  });
}

const GAMES_PER_BATCH = 24;
let currentGameBatch = 0;
let currentFilteredGames = [];
let currentGameFilter = 'all';
let gamesReady = false;
let recommendationsReady = false;
let recommendationMode = 'mood';

function renderGames(filter = 'all', reset = true) {
  if (!gamesReady) return;
  const grid = document.getElementById('games-grid');
  if (!grid) return;
  bindGameGrid(grid);
  const loadMoreButton = document.getElementById('load-more-games');
  if (loadMoreButton && loadMoreButton.dataset.eventsBound !== 'true') {
    loadMoreButton.dataset.eventsBound = 'true';
    loadMoreButton.addEventListener('click', () => renderGames(currentGameFilter, false));
  }

  const searchValue =
    document.getElementById('game-search')?.value.trim().toLowerCase() || '';

  // Recalculate the filtered game list when starting a new render
  if (reset) {
    currentGameBatch = 0;
    currentGameFilter = filter;
    if (loadMoreButton) loadMoreButton.hidden = true;

    currentFilteredGames = rankGamesForUser(GAMES.filter(g => {
      const categories = getGameCategories(g);
      const matchesCategory =
        filter === 'all' || categories.includes(filter);

      const matchesSearch =
        searchValue === '' ||
        g.name.toLowerCase().includes(searchValue);

      return matchesCategory && matchesSearch;
    }));

    grid.innerHTML = '';
  }

  if (!currentFilteredGames.length) {
    grid.innerHTML =
      `<div class="no-results">
        No games match your search. Try a different keyword or category.
      </div>`;
    if (loadMoreButton) loadMoreButton.hidden = true;
    return;
  }

  // Calculate which games to render
  const start = currentGameBatch * GAMES_PER_BATCH;
  const end = Math.min(
    start + GAMES_PER_BATCH,
    currentFilteredGames.length
  );

  const gamesToRender = currentFilteredGames.slice(start, end);

  const fragment = document.createDocumentFragment();
  gamesToRender.forEach(game => fragment.appendChild(createGameTile(game)));
  grid.appendChild(fragment);

  currentGameBatch++;
  if (loadMoreButton) loadMoreButton.hidden = end >= currentFilteredGames.length;
}
const PLAY_MOODS = {
  intense: { label: 'Intense', terms: ['action', 'shooter', 'shooting', 'fighting', 'combat', 'survival', 'battle', 'fps', 'horror', 'war'], exclude: ['casual', 'cozy', 'chill', 'relax', 'idle', 'merge', 'dress up', 'simulation', 'puzzle'] },
  think: { label: 'Make Me Think', terms: ['puzzle', 'strategy', 'logic', 'brain', 'chess', 'quiz', 'trivia', 'word', 'mahjong', 'checkers'], exclude: ['shooter', 'shooting', 'combat', 'racing'] },
  tired: { label: 'Low-Key', terms: ['casual', 'cozy', 'chill', 'relax', 'idle', 'merge', 'dress up', 'simulation', 'easy', 'cooking', 'tycoon'], exclude: ['action', 'shooter', 'shooting', 'fighting', 'combat', 'survival', 'battle', 'fps', 'horror', 'war'] },
  challenge: { label: 'Challenge Me', terms: ['skill', 'parkour', 'racing', 'sports', 'hard', 'challenge', 'precision', 'reflex'], exclude: ['idle', 'cozy', 'relax'] },
  weird: { label: 'Something Weird', terms: ['weird', 'experimental', 'physics', 'brainrot', 'odd', 'meme', 'bizarre'], exclude: ['cozy', 'relax', 'idle'] },
  quick: { label: 'Quick Games', terms: ['quick', 'arcade', 'runner', 'casual', 'fast paced', 'reaction', 'endless', 'speed', '2 minute'], exclude: ['story', 'campaign', 'long form'] },
  together: { label: 'Play Together', terms: ['multiplayer', 'multi player', '2 player', 'two player', 'co op', 'coop', 'friends', 'party', 'online', 'io', 'versus', 'team'], exclude: [] }
};

function getSelectedMood() {
  try {
    const mood = sessionStorage.getItem('pleyz_play_mood') || '';
    return PLAY_MOODS[mood] ? mood : '';
  } catch (_) {
    return '';
  }
}

function getPlayHistory(username) {
  if (!username) return {};
  try { return JSON.parse(localStorage.getItem(`pleyz_play_history_${username}`) || '{}'); }
  catch (_) { return {}; }
}

function renderRecommendedGames() {
  if (!recommendationsReady) return;
  const grid = document.getElementById('recommended-grid');
  if (!grid) return;
  bindGameGrid(grid);
  grid.removeAttribute('aria-busy');

  const username = getCurrentUser();
  const moodKey = recommendationMode === 'mood' ? getSelectedMood() : '';
  const recent = username ? getRecentGamesForUser(username) : [];
  const preferences = getGamePreferences();
  const recommendationFeedback = username ? getRecommendationFeedback(username, moodKey || 'all') : {};
  const feedbackSignals = getRecommendationFeedbackSignals(username);
  const history = getPlayHistory(username);
  const recentGames = recent.map(entry => GAMES.find(game => game.id === entry.id)).filter(Boolean);
  const categoryAffinity = new Map();
  const dnaAffinity = new Map();

  recentGames.forEach((game, index) => {
    const weight = Math.max(1, 4 - index * 0.6);
    getGameCategories(game).forEach(category => categoryAffinity.set(category, (categoryAffinity.get(category) || 0) + weight));
    getGameTags(game).forEach(tag => dnaAffinity.set(String(tag).toLowerCase(), (dnaAffinity.get(String(tag).toLowerCase()) || 0) + weight));
  });
  Object.entries(history).forEach(([id, data]) => {
    const game = GAMES.find(candidate => candidate.id === Number(id));
    if (!game) return;
    const weight = Math.min(4, Math.log2(Number(data.plays || 0) + 1));
    getGameCategories(game).forEach(category => categoryAffinity.set(category, (categoryAffinity.get(category) || 0) + weight));
    getGameTags(game).forEach(tag => dnaAffinity.set(String(tag).toLowerCase(), (dnaAffinity.get(String(tag).toLowerCase()) || 0) + weight));
  });
  Object.entries(preferences).forEach(([id, preference]) => {
    const game = findGameByFeedbackId(id);
    if (!game) return;
    const weight = preference === 'like' ? 2.5 : preference === 'dislike' ? -2 : 0;
    getGameCategories(game).forEach(category => categoryAffinity.set(category, (categoryAffinity.get(category) || 0) + weight));
    getGameTags(game).forEach(tag => dnaAffinity.set(String(tag).toLowerCase(), (dnaAffinity.get(String(tag).toLowerCase()) || 0) + weight));
  });
  Object.entries(recommendationFeedback).forEach(([id, helpful]) => {
    const game = findGameByFeedbackId(id);
    if (!game) return;
    const weight = helpful ? 5 : -2;
    getGameCategories(game).forEach(category => categoryAffinity.set(category, (categoryAffinity.get(category) || 0) + weight));
    getGameTags(game).forEach(tag => dnaAffinity.set(String(tag).toLowerCase(), (dnaAffinity.get(String(tag).toLowerCase()) || 0) + weight));
  });

  const mood = PLAY_MOODS[moodKey];
  const trendingRank = new Map(TRENDING.map((entry, index) => [entry.id, index]));
  let previouslyShown = new Set();
  try { previouslyShown = new Set(JSON.parse(sessionStorage.getItem('pleyz_recommendations_shown') || '[]')); } catch (_) {}

  const ranked = GAMES.map(game => {
    const categories = getGameCategories(game);
    const dna = getGameTags(game).map(tag => String(tag).toLowerCase());
    const preference = preferences[game.id];
    const text = ` ${`${game.name} ${categories.join(' ')} ${dna.join(' ')}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
    const matchesMoodTerm = terms => terms.some(term => text.includes(` ${term.toLowerCase()} `));
    const moodMatch = !mood?.terms.length || (
      matchesMoodTerm(mood.terms) && !matchesMoodTerm(mood.exclude || [])
    );
    let score = 0;
    categories.forEach(category => { score += categoryAffinity.get(category) || 0; });
    dna.forEach(tag => { score += (dnaAffinity.get(tag) || 0) * 0.35; });
    categories.forEach(category => { score += (feedbackSignals.categories[category] || 0) * 1.4; });
    dna.forEach(tag => { score += (feedbackSignals.tags[tag] || 0) * 0.8; });
    const gameWords = new Set(
      `${game.name} ${categories.join(' ')} ${dna.join(' ')} ${game.description || ''}`
        .toLowerCase()
        .match(/[a-z0-9]{3,}/g) || []
    );
    gameWords.forEach(word => { score += (feedbackSignals.keywords[word] || 0) * 0.55; });
    if (recommendationFeedback[game.id] === true) score += 1.25;
    if (recommendationFeedback[game.id] === false) score -= 0.75;
    if (preference === 'like') score += 1;
    if (preference === 'dislike') score -= 30;
    if (trendingRank.has(game.id)) score += Math.max(0.4, 2 - trendingRank.get(game.id) * 0.18);
    if (previouslyShown.has(game.id)) score -= mood ? 4 : 0.65;
    if (recent.some(entry => entry.id === game.id)) score -= 2.5;
    if (mood?.terms.length) score += moodMatch ? 5 : -1.5;
    return { game, score, categories, moodMatch };
  }).filter(item => preferences[item.game.id] !== 'dislike');

  const matchingMoodGames = mood?.terms.length ? ranked.filter(item => item.moodMatch) : [];
  const recommendationPool = mood?.terms.length ? matchingMoodGames : ranked;
  const recommendations = [];
  const categoryUse = new Map();
  const recommendationLimit = window.matchMedia('(min-width: 1800px)').matches ? 22 : 19;
  while (recommendationPool.length && recommendations.length < recommendationLimit) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    recommendationPool.forEach((item, index) => {
      const varietyPenalty = item.categories.reduce((total, category) => total + (categoryUse.get(category) || 0), 0) * 0.8;
      const adjusted = item.score - varietyPenalty;
      if (adjusted > bestScore) { bestScore = adjusted; bestIndex = index; }
    });
    const [chosen] = recommendationPool.splice(bestIndex, 1);
    recommendations.push(chosen.game);
    chosen.categories.forEach(category => categoryUse.set(category, (categoryUse.get(category) || 0) + 1));
  }

  if (username) {
    try {
      localStorage.setItem('pleyz_notification_recommendations_v1', JSON.stringify({
        username,
        uid: window.firebaseAuth?.currentUser?.uid || '',
        updatedAt: Date.now(),
        items: recommendations.slice(0, 3).map(game => ({
          name: game.name,
          href: game.iframeUrl || ''
        }))
      }));
      document.dispatchEvent(new Event('pleyz-notification-recommendations-updated'));
    } catch (error) {
      console.warn('PleyZ recommendation notices could not be saved:', error);
    }
  }

  const caption = document.getElementById('recommendations-caption');
  if (caption) {
    caption.textContent = recommendationMode === 'mood'
      ? mood
        ? `Games picked for your ${mood.label.toLowerCase()} mood.`
        : 'Choose a mood to find a game for how you feel.'
      : username && (recent.length || Object.keys(history).length || Object.keys(preferences).length)
        ? 'Picks shaped by your recent plays and feedback.'
        : username
          ? 'Play a few games to shape your personalized picks.'
          : 'Sign in and play to get picks shaped by your gameplay.';
  }

  const recommendationFragment = document.createDocumentFragment();
  if (mood?.terms.length && !recommendations.length) {
    const empty = document.createElement('div');
    empty.className = 'no-results';
    empty.textContent = `No clearly tagged ${mood.label.toLowerCase()} games yet. Try another mood.`;
    recommendationFragment.appendChild(empty);
  } else {
    recommendations.forEach((game, index) => {
      const card = createGameTile(game);
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', `Recommended game: ${game.name}`);
      const feedback = document.createElement('div');
      feedback.className = 'recommendation-feedback';
      feedback.dataset.feedbackControl = 'true';
      feedback.innerHTML = `<span>Helpful?</span><button type="button" data-recommendation-helpful data-game-id="${game.id}" data-helpful="true">Yes</button><button type="button" data-recommendation-helpful data-game-id="${game.id}" data-helpful="false">No</button>`;
      card.appendChild(feedback);
      if (index === 0) card.classList.add('pick-featured');
      recommendationFragment.appendChild(card);
    });
  }
  grid.replaceChildren(recommendationFragment);
  try {
    const shown = new Set([...previouslyShown, ...recommendations.map(game => game.id)]);
    sessionStorage.setItem('pleyz_recommendations_shown', JSON.stringify([...shown].slice(-80)));
  } catch (_) {}
}

const recommendationViewport = window.matchMedia('(min-width: 1800px)');
recommendationViewport.addEventListener('change', renderRecommendedGames);

let popularCountryReady = false;

function renderPopularCountryGames() {
  if (!popularCountryReady) return;
  const grid = document.getElementById('popular-country-grid');
  if (!grid) return;
  bindGameGrid(grid);
  const featuredGames = TRENDING
    .map(entry => GAMES.find(game => game.id === entry.id))
    .filter((game, index, games) => game && games.findIndex(item => item.id === game.id) === index)
    .slice(0, 16);
  const featuredIds = new Set(featuredGames.map(game => game.id));
  featuredGames.push(...GAMES.filter(game => !featuredIds.has(game.id)).slice(0, 16 - featuredGames.length));
  const fragment = document.createDocumentFragment();
  featuredGames.forEach((game, index) => {
    const card = createGameTile(game);
    if (index === 0) card.classList.add('country-featured');
    if (index === 1) card.classList.add('country-wide');
    fragment.appendChild(card);
  });
  grid.replaceChildren(fragment);
}

function renderPopularCountryLabel(countryName, countryCode) {
  const name = document.getElementById('popular-country-name');
  const flag = document.getElementById('popular-country-flag');
  const code = String(countryCode || '').toUpperCase();
  if (!name || !flag || !/^[A-Z]{2}$/.test(code) || !countryName) return;
  name.textContent = countryName;
  flag.textContent = String.fromCodePoint(...[...code].map(character => 127397 + character.charCodeAt(0)));
}

function updatePopularCountryHeading() {
  const cacheKey = 'pleyz_country_display';
  const cacheDuration = 24 * 60 * 60 * 1000;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cached && Date.now() - cached.savedAt < cacheDuration) {
      renderPopularCountryLabel(cached.name, cached.code);
      return;
    }
  } catch (_) {}

  try {
    const region = new Intl.Locale(navigator.language).region;
    if (region && /^[A-Z]{2}$/.test(region)) {
      const countryName = new Intl.DisplayNames([navigator.language], { type: 'region' }).of(region);
      renderPopularCountryLabel(countryName, region);
    }
  } catch (_) {}

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3000);
  fetch('https://ipapi.co/json/', { signal: controller.signal })
    .then(response => {
      if (!response.ok) throw new Error('Country lookup failed');
      return response.json();
    })
    .then(location => {
      const countryName = String(location.country_name || '').trim();
      const countryCode = String(location.country_code || '').toUpperCase();
      if (!countryName || countryName.length > 80 || !/^[A-Z]{2}$/.test(countryCode)) return;
      renderPopularCountryLabel(countryName, countryCode);
      try { localStorage.setItem(cacheKey, JSON.stringify({ name: countryName, code: countryCode, savedAt: Date.now() })); } catch (_) {}
    })
    .catch(() => {})
    .finally(() => window.clearTimeout(timeout));
}

let moodDiscoveryInitialized = false;

function initializeMoodDiscovery() {
  if (moodDiscoveryInitialized) return;
  const modeButtons = document.querySelectorAll('[data-recommendation-mode]');
  const moodButtons = document.querySelectorAll('.mood-option[data-mood]');
  const moodOptions = document.querySelector('.mood-options');
  if (!modeButtons.length || !moodButtons.length || !moodOptions) return;
  moodDiscoveryInitialized = true;

  const updateMode = mode => {
    recommendationMode = mode;
    modeButtons.forEach(button => {
      const active = button.dataset.recommendationMode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    moodOptions.hidden = mode !== 'mood';
    renderRecommendedGames();
  };

  modeButtons.forEach(button => {
    button.addEventListener('click', () => updateMode(button.dataset.recommendationMode));
  });
  moodButtons.forEach(button => {
    button.addEventListener('click', () => {
      const moodKey = button.dataset.mood;
      if (!PLAY_MOODS[moodKey]) return;
      try { sessionStorage.setItem('pleyz_play_mood', moodKey); } catch (_) {}
      moodButtons.forEach(option => option.setAttribute('aria-pressed', String(option === button)));
      updateMode('mood');
    });
  });

  const selectedMood = getSelectedMood();
  moodButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mood === selectedMood)));
  moodOptions.hidden = false;
}

function renderTrending() {
  const row = document.getElementById('trending-row');
  if (!row) return;
  row.innerHTML = '';
  TRENDING.forEach((g, index) => {
    const game = GAMES.find(item => item.id === g.id) || g;
    const card = document.createElement('article');
    card.className = `trending-card${index === 0 ? ' featured' : ''}`;
    card.onclick = () => openGame(g.id);
    card.innerHTML = `
      <div class="hot-badge"><i class="fas fa-star"></i> PICK</div>
      <div class="trending-thumb" style="background:${g.gradient};">
        ${createGameImageMarkup(game, { eager: index < 3, highPriority: index === 0 })}
      </div>
      <div class="trending-info">
        <div class="trending-topline">
          <span class="trending-pill">${index === 0 ? 'Featured' : 'PleyZ pick'}</span>
        </div>
        <div class="trending-name">${g.name}</div>
        <div class="trending-meta">
          <span>Instant play</span>
          <span>${getGameCategories(game)[0] || 'Games'}</span>
        </div>
      </div>`;
    row.appendChild(card);
    if (index > 0) {
      const image = card.querySelector('img');
      const bounds = image?.getBoundingClientRect();
      if (bounds
        && bounds.top < window.innerHeight
        && bounds.bottom > 0
        && bounds.left < window.innerWidth
        && bounds.right > 0) {
        image.loading = 'eager';
      }
    }
  });

  const wrap = document.getElementById('trending-scroll');
  if (!wrap) return;
  if (wrap.dataset.eventsBound !== 'true') {
    wrap.dataset.eventsBound = 'true';
    let isDragging = false, startX, scrollLeft;
    wrap.addEventListener('mousedown', e => {
      isDragging = true;
      wrap.dataset.dragging = 'true';
      startX = e.pageX - wrap.offsetLeft;
      scrollLeft = wrap.scrollLeft;
    });
    const stopDragging = () => {
      isDragging = false;
      wrap.dataset.dragging = 'false';
    };
    wrap.addEventListener('mouseleave', stopDragging);
    wrap.addEventListener('mouseup', stopDragging);
    wrap.addEventListener('mousemove', e => {
      if (!isDragging) return;
      e.preventDefault();
      wrap.scrollLeft = scrollLeft - (e.pageX - wrap.offsetLeft - startX);
    });
    wrap.addEventListener('pointerdown', () => { wrap.dataset.dragging = 'true'; });
    window.addEventListener('pointerup', stopDragging);
  }
  if (!wrap.dataset.autoplayBound) {
    wrap.dataset.autoplayBound = 'true';
    window.setInterval(() => {
      if (document.hidden || wrap.dataset.dragging === 'true' || wrap.matches(':hover') || wrap.contains(document.activeElement)) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const maxScroll = wrap.scrollWidth - wrap.clientWidth;
      if (maxScroll <= 1) return;
      const nextScroll = wrap.scrollLeft + wrap.clientWidth;
      wrap.scrollTo({ left: nextScroll >= maxScroll - 8 ? 0 : nextScroll, behavior: 'smooth' });
    }, 5000);
  }
  document.querySelectorAll('.trending-arrow').forEach(button => {
    if (button.dataset.eventsBound === 'true') return;
    button.dataset.eventsBound = 'true';
    button.addEventListener('click', () => {
      const direction = Number(button.dataset.trendingDirection) || 1;
      wrap.scrollBy({ left: direction * Math.max(220, wrap.clientWidth * 0.75), behavior: 'smooth' });
    });
  });
}

let leaderboardReady = false;

async function renderLeaderboard() {
  if (!leaderboardReady) return;
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 4;
  cell.style.cssText = 'text-align:center;padding:1.5rem;color:var(--text-dim)';

  if (window.firebaseFetchLeaderboard) {
    return window.firebaseFetchLeaderboard();
  }

  cell.textContent = 'Connecting to the PleyZ leaderboard...';
  row.appendChild(cell);
  tbody.replaceChildren(row);
}

/* ============================================================
   GAME SEARCH
============================================================ */
document.getElementById('game-search').addEventListener('input', () => {
  renderGames('all');
});

/* ============================================================
   MOBILE NAV
============================================================ */
function setMobileNavActive(button) {
  document.querySelectorAll('.mobile-nav-item').forEach(item => item.classList.remove('active'));
  button?.classList.add('active');
}
function mobileNavGo(target, button) {
  setMobileNavActive(button);
  document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
}
function mobileNavSearch(button) {
  setMobileNavActive(button);
  document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' });
  window.setTimeout(() => document.getElementById('game-search')?.focus(), 350);
}
function mobileNavAuth(button) {
  setMobileNavActive(button);
  if (getCurrentUser()) openAccountPage();
  else openLoginModal();
}
window.addEventListener('scroll', () => {
  document.querySelector('header').classList.toggle('scrolled', window.scrollY > 18);
});
/* ============================================================
   LOGIN MODAL
============================================================ */
let authMode = 'login';

function openLoginModal() {
  setAuthMode('login');
  document.getElementById('login-modal').classList.add('open');
}
function closeLoginModal() {
  document.getElementById('login-modal').classList.remove('open');
  document.getElementById('auth-error').textContent = '';
}
document.getElementById('login-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('login-modal')) closeLoginModal();
});

function getCurrentUser() {
  const saved = localStorage.getItem('nikunj_current_username');
  if (saved && saved.trim()) return saved.trim();

  if (window.firebaseAuth?.currentUser) {
    const user = window.firebaseAuth.currentUser;
    const email = user.email || '';
    const username = (user.displayName || '').trim() || email.split('@')[0] || 'Player';
    setCurrentUser(username);
    return username;
  }
  return null;
}

function setCurrentUser(username) {
  const clean = (username || '').trim();
  if (!clean) {
    localStorage.removeItem('nikunj_current_username');
    return;
  }
  localStorage.setItem('nikunj_current_username', clean);
}

function clearCurrentUser() {
  localStorage.removeItem('nikunj_current_username');
}

function getRecentGamesForUser(username) {
  if (!username) return [];
  try {
    return JSON.parse(localStorage.getItem(`nikunj_recent_games_${username}`) || '[]');
  } catch (e) {
    return [];
  }
}

function setRecentGamesForUser(username, recent) {
  localStorage.setItem(`nikunj_recent_games_${username}`, JSON.stringify(recent));
}

function saveRecentGame(gameId) {
  const username = getCurrentUser();
  if (!username) return;
  const game = GAMES.find(g => g.id === gameId);
  if (!game) return;

  const playHistory = getPlayHistory(username);
  const previousPlay = playHistory[gameId] || {};
  playHistory[gameId] = {
    plays: Number(previousPlay.plays || 0) + 1,
    lastPlayed: Date.now()
  };
  const boundedHistory = Object.fromEntries(
    Object.entries(playHistory)
      .sort((a, b) => Number(b[1].lastPlayed || 0) - Number(a[1].lastPlayed || 0))
      .slice(0, 100)
  );
  localStorage.setItem(`pleyz_play_history_${username}`, JSON.stringify(boundedHistory));

  const recent = getRecentGamesForUser(username);
  const existingIndex = recent.findIndex(item => item.id === gameId);
  if (existingIndex !== -1) recent.splice(existingIndex, 1);
  recent.unshift({ id: game.id, name: game.name, color: game.color || '#8B00FF' });
  if (recent.length > 5) recent.length = 5;
  setRecentGamesForUser(username, recent);
  renderRecentGamesPanel();
  renderRecommendedGames();
  // increment local PleyZ for non-Firebase users
  if (!window.firebaseAuth || !window.firebaseAuth.currentUser) {
    try { incrementLocalPleyz(username); } catch (e) { }
  }
}

function incrementLocalPleyz(username) {
  if (!username) return;
  const keyScore = `nikunj_pleyz_${username}`;
  const keyGames = `nikunj_games_${username}`;
  const score = parseInt(localStorage.getItem(keyScore) || '0', 10) + 1;
  const games = parseInt(localStorage.getItem(keyGames) || '0', 10) + 1;
  localStorage.setItem(keyScore, String(score));
  localStorage.setItem(keyGames, String(games));
}

function renderRecentGamesPanel(mode = 'recent') {
  const username = getCurrentUser();
  const listEl = document.getElementById('recent-list');
  const emptyEl = document.querySelector('.recent-empty');
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = '';
  const titleEl = document.getElementById('recent-panel-title');
  if (titleEl) titleEl.textContent = mode === 'liked' ? 'Liked games' : 'Recent games';

  let panelGames = [];
  if (mode === 'liked') {
    panelGames = Object.entries(getGamePreferences())
      .filter(([, preference]) => preference === 'like')
      .map(([id]) => GAMES.find(game => game.id === Number(id)))
      .filter(Boolean)
      .map(game => ({ id: game.id, name: game.name, color: game.color || '#8B00FF', label: 'Liked game' }));
    if (!panelGames.length) {
      emptyEl.textContent = 'No liked games yet. Like a game to save it here.';
      return;
    }
  } else {
    if (!username) {
      emptyEl.textContent = 'Log in to save recent games and view them here.';
      return;
    }

    const recent = getRecentGamesForUser(username);
    if (!recent.length) {
      emptyEl.textContent = `No recent games yet, ${username}. Play a game to add it here.`;
      return;
    }

    const recentIds = new Set(recent.map(entry => entry.id));
    const recentGames = recent
      .map(entry => GAMES.find(game => game.id === entry.id))
      .filter(Boolean);
    const relatedGames = rankGamesForUser(GAMES.filter(game => {
      if (recentIds.has(game.id)) return false;
      return recentGames.some(recentGame =>
        getGameCategories(game).some(category => getGameCategories(recentGame).includes(category))
      );
    })).slice(0, 3);

    panelGames = [
      ...recent.slice(0, 2).map(entry => ({ ...entry, label: 'Recently played' })),
      ...relatedGames.map(game => ({
        id: game.id,
        name: game.name,
        color: game.color || '#8B00FF',
        label: 'Recommended for you'
      }))
    ];
  }

  emptyEl.textContent = '';
  panelGames.forEach(entry => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'recent-game-item';
    item.onclick = () => { openGame(entry.id); toggleRecentPanel(false); };
    item.innerHTML = `
      <div class="recent-game-thumb" style="background:${entry.color};">${entry.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}</div>
      <div class="recent-game-meta"><strong>${entry.name}</strong><small>${entry.label}</small></div>
    `;
    listEl.appendChild(item);
  });
}

function toggleRecentPanel(forceOpen, mode = 'recent') {
  const panel = document.getElementById('recent-panel');
  const button = document.getElementById('recent-toggle-button');
  if (!panel || !button) return false;

  const isOpen = panel.getAttribute('data-open') === 'true';
  const open = forceOpen === undefined ? !isOpen : Boolean(forceOpen);
  panel.setAttribute('data-open', open ? 'true' : 'false');
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  panel.dataset.mode = mode;
  if (open) renderRecentGamesPanel(mode);
  return open;
}

function closeRecentPanel() {
  toggleRecentPanel(false);
}

document.addEventListener('click', event => {
  if (!event.target.closest('.recent-games-wrapper, #mobile-liked-games-button')) {
    closeRecentPanel();
  }
});

function updateAuthUI() {
  const username = getCurrentUser();
  const userDisplay = document.getElementById('user-display');
  const avatarButton = document.getElementById('profile-avatar-button');
  const authButton = document.getElementById('auth-action-button');
  const footerAuthButton = document.getElementById('footer-auth-button');
  const mobileAuthButton = document.getElementById('mobile-auth-action');

  if (username) {
    userDisplay.textContent = `Welcome, ${username}`;
    userDisplay.style.display = 'inline-block';
    authButton.hidden = true;
    if (avatarButton) {
      const photoUrl = window.firebaseAuth?.currentUser?.photoURL;
      avatarButton.innerHTML = photoUrl
        ? `<img src="${photoUrl}" alt="" width="38" height="38" />`
        : username.slice(0, 2).toUpperCase();
      avatarButton.style.display = 'inline-grid';
      avatarButton.style.placeItems = 'center';
    }
    if (footerAuthButton) {
      footerAuthButton.textContent = 'Account / Profile';
      footerAuthButton.onclick = openAccountPage;
    }
    if (mobileAuthButton) mobileAuthButton.innerHTML = '<i class="fas fa-user"></i><span>Account</span>';
  } else {
    userDisplay.textContent = '';
    userDisplay.style.display = 'none';
    if (avatarButton) {
      avatarButton.innerHTML = '';
      avatarButton.style.display = 'none';
    }
    authButton.hidden = false;
    authButton.innerHTML = '<i class="fas fa-user"></i> Login';
    authButton.onclick = openLoginModal;
    if (footerAuthButton) {
      footerAuthButton.textContent = 'Login';
      footerAuthButton.onclick = openLoginModal;
    }
    if (mobileAuthButton) mobileAuthButton.innerHTML = '<i class="fas fa-user"></i><span>Login</span>';
  }
  renderRecentGamesPanel();
  renderRecommendedGames();
}

function openAccountPage() {
  if (!getCurrentUser()) {
    openLoginModal();
    return;
  }
  window.location.href = 'account.html';
}

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  document.getElementById('login-tab').classList.toggle('active', isLogin);
  document.getElementById('signup-tab').classList.toggle('active', !isLogin);
  document.getElementById('signup-confirm-group').style.display = isLogin ? 'none' : 'block';
  document.getElementById('auth-submit-button').innerHTML = isLogin
    ? '<i class="fas fa-sign-in-alt"></i> Sign In'
    : '<i class="fas fa-user-plus"></i> Sign Up';
  document.getElementById('auth-title').textContent = isLogin ? 'Welcome Back' : 'Create Account';
  document.getElementById('auth-subtitle').textContent = isLogin
    ? 'Enjoying PleyZ? Create a free account to save your profile, earn points when opening games, and join the leaderboard.'
    : 'Create a free account to save your profile, earn points when opening games, and join the leaderboard.';
  document.getElementById('auth-note').textContent = isLogin
    ? 'New here? Create an account to keep your progress.'
    : 'Already have an account? Sign in to continue.';
  document.getElementById('auth-error').textContent = '';
}

async function handleAuthSubmit() {
  if (authMode === 'login') {
    await handleLogin();
  } else {
    await handleSignup();
  }
}

async function waitForFirebaseAuth(timeout = 8000) {
  const startedAt = Date.now();
  while (!window.firebaseLogin && Date.now() - startedAt < timeout) {
    if (window.firebaseAuthReady) {
      try {
        await Promise.race([
          window.firebaseAuthReady,
          new Promise(resolve => setTimeout(resolve, 250))
        ]);
      } catch (_) {
        return false;
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return Boolean(window.firebaseLogin);
}

function getAuthErrorMessage(error, action) {
  if (error?.code === 'auth/configuration-not-found') {
    return 'Email sign-in is not enabled yet. Enable Email/Password in Firebase Authentication settings.';
  }
  if (error?.code === 'auth/invalid-credential') return 'Incorrect email or password.';
  if (error?.code === 'auth/email-already-in-use') return 'That email is already registered.';
  return error?.message || `Unable to ${action}. Please try again.`;
}

async function handleLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = '';
  if (!email) { errorEl.textContent = 'Email is required.'; return; }
  if (!username) { errorEl.textContent = 'Username is required.'; return; }
  if (!password) { errorEl.textContent = 'Password is required.'; return; }
  if (!(await waitForFirebaseAuth()) || !window.firebaseLogin) {
    errorEl.textContent = 'Authentication is still loading. Please try again.';
    return;
  }
  try {
    await window.firebaseLogin(email, password, username);
    setCurrentUser(username);
    updateAuthUI();
    closeLoginModal();
  } catch (err) {
    errorEl.textContent = getAuthErrorMessage(err, 'sign in');
  }
}

async function handleSignup() {
  const email = document.getElementById('auth-email').value.trim();
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const confirmPassword = document.getElementById('auth-confirm-password').value;
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = '';
  if (!email) { errorEl.textContent = 'Email is required.'; return; }
  if (!username) { errorEl.textContent = 'Username is required.'; return; }
  if (!password) { errorEl.textContent = 'Password is required.'; return; }
  if (password.length < 6) { errorEl.textContent = 'Password must be at least 6 characters.'; return; }
  if (password !== confirmPassword) { errorEl.textContent = 'Passwords do not match.'; return; }
  if (!(await waitForFirebaseAuth()) || !window.firebaseSignup) {
    errorEl.textContent = 'Authentication is still loading. Please try again.';
    return;
  }
  try {
    await window.firebaseSignup(email, password, username);
    setCurrentUser(username);
    updateAuthUI();
    closeLoginModal();
  } catch (err) {
    errorEl.textContent = getAuthErrorMessage(err, 'create your account');
  }
}

setAuthMode('login');
updateAuthUI();

/* ============================================================
  DIRECT GAME LAUNCH
============================================================ */
let gameLaunchPending = false;
window.addEventListener('pageshow', () => {
  gameLaunchPending = false;
  const loader = document.getElementById('game-launch-loader');
  if (loader) loader.hidden = true;
});

function openGame(id) {
  const game = GAMES.find(g => g.id === id);
  if (!game || gameLaunchPending) return;

  const launchUrl = game.iframeUrl?.trim() || (game.slug ? `/games/${game.slug}.html` : '');
  if (!launchUrl) return;
  const gameUrl = new URL(launchUrl, window.location.origin);

  gameLaunchPending = true;
  const loader = document.getElementById('game-launch-loader');
  if (loader) loader.hidden = false;
  saveRecentGame(game.id);
  try {
    sessionStorage.setItem('pleyz_active_game', JSON.stringify({ id: game.id, path: gameUrl.pathname }));
  } catch (_) {}
  window.location.assign(gameUrl.href);
}

function getValidRandomGamePool() {
  const pool = Array.isArray(window.PLEYZ_GAME_LIBRARY) && window.PLEYZ_GAME_LIBRARY.length
    ? window.PLEYZ_GAME_LIBRARY
    : Array.isArray(GAMES) ? GAMES : [];

  return pool.filter(game => {
    const rawUrl = game && (game.iframeUrl || game.href || game.url);
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    const trimmed = rawUrl.trim();
    if (!trimmed || /^#|^javascript:|^mailto:|^tel:/i.test(trimmed)) return false;
    if (/placeholder|coming soon|tbd|soon/i.test(trimmed)) return false;
    return true;
  });
}

function launchRandomGame() {
  const pool = getValidRandomGamePool();
  if (!pool.length) {
    alert('No valid games are available right now.');
    return;
  }
  const selected = pool[Math.floor(Math.random() * pool.length)];
  if (selected && selected.id) {
    openGame(selected.id);
    return;
  }
  const targetUrl = selected && (selected.iframeUrl || selected.href || selected.url);
  if (targetUrl) {
    window.location.assign(new URL(targetUrl, window.location.origin).href);
  }
}

window.PLEYZ_GAME_LIBRARY = Array.isArray(GAMES) ? GAMES : [];
const button = document.getElementById('random-game-button');
if (button) {
  button.addEventListener('click', launchRandomGame);
}

/* ============================================================
   SIDEBAR INITIALIZATION
============================================================ */
const SIDEBAR_CATEGORIES = [
  {cat: 'all', label: 'All'},
  ...[...new Set(GAMES.flatMap(getGameCategories))]
    .sort((first, second) => first.localeCompare(second))
    .map(cat => ({
      cat,
      label: ({
        '2d': '2D Games',
        '3d': '3D Games',
        'ad-free': 'Ad-free Games',
        boys: 'Games for Boys',
        girls: 'Games for Girls',
        gems: 'Gems for You',
        io: '.io Games',
        nostalgia: 'Nostalgia',
        original: 'Original Games',
        trending: 'Trending Games',
        'two player': 'Two Player'
      })[cat] || cat.replace(/(^|[\s-])\w/g, character => character.toUpperCase())
    }))
];

function initSidebar() {
  const ul = document.getElementById('sidebar-cats');
  if (!ul) return;
  ul.innerHTML = '';
  const categoryPages = new Set(['action', 'adventure', 'boys', 'girls', 'puzzle', 'multiplayer']);
  SIDEBAR_CATEGORIES.forEach(item => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    const slug = item.cat === 'all'
      ? ''
      : categoryPages.has(item.cat)
        ? `${item.cat}-games`
        : `index.html?cat=${encodeURIComponent(item.cat)}`;
    a.href = slug ? `/${slug}` : '/';
    a.textContent = item.label;
    a.dataset.cat = item.cat;
    li.appendChild(a);
    ul.appendChild(li);
  });
  // mark 'All' active by default
  const first = document.querySelector('#sidebar-cats a[data-cat="all"]');
  if (first) first.classList.add('active');
}

// Initialize sidebar right away
initSidebar();

/* ============================================================
   INIT
============================================================ */
// URL driven category filter: support ?cat=action and path /action-games
function applyUrlCategoryFilter(){
  const params = new URLSearchParams(location.search);
  let cat = params.get('cat');
  if (!cat) {
    // detect /action-games style paths
    const p = (location.pathname || '').replace(/\/$/, '');
    const base = p.split('/').pop();
    if (base && base.endsWith('-games')) cat = base.replace('-games', '');
  }
  if (cat) {
    document.querySelectorAll('#sidebar-cats a').forEach(x => x.classList.toggle('active', x.dataset.cat === cat));
    currentGameFilter = cat;
    // scroll to games section
    const gamesSection = document.getElementById('games');
    if (gamesSection) gamesSection.scrollIntoView({behavior:'smooth', block:'start'});
    return true;
  }
  return false;
}

let deferredHomeSectionsInitialized = false;

function renderInitialGamesFallback() {
  const grid = document.getElementById('games-grid');
  if (!gamesReady || !grid || grid.children.length || !Array.isArray(GAMES) || !GAMES.length) return;
  bindGameGrid(grid);
  GAMES.slice(0, 24).forEach(game => {
    try {
      grid.appendChild(createGameTile(game));
    } catch (error) {
      console.warn('Fallback game card render failed:', error);
    }
  });
}

function initializeDeferredHomeSections() {
  if (deferredHomeSectionsInitialized) return;
  deferredHomeSectionsInitialized = true;

  const renderDeferredSection = section => {
    switch (section.id) {
      case 'games':
        gamesReady = true;
        try {
          renderGames(currentGameFilter);
        } catch (error) {
          console.warn('Initial games render failed:', error);
        }
        renderInitialGamesFallback();
        break;
      case 'recommendations':
        recommendationsReady = true;
        renderRecommendedGames();
        break;
      case 'popular-country':
        popularCountryReady = true;
        renderPopularCountryGames();
        updatePopularCountryHeading();
        break;
      case 'leaderboard':
        leaderboardReady = true;
        renderLeaderboard();
        break;
    }
  };
  const deferredSections = ['games', 'recommendations', 'popular-country', 'leaderboard']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  if (!('IntersectionObserver' in window)) {
    deferredSections.forEach(renderDeferredSection);
    return;
  }

  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      sectionObserver.unobserve(entry.target);
      renderDeferredSection(entry.target);
    });
  }, { rootMargin: '320px 0px' });
  deferredSections.forEach(section => sectionObserver.observe(section));
}

try {
  initializeMoodDiscovery();
  applyUrlCategoryFilter();
  renderTrending();
  initializeDeferredHomeSections();
  if (new URLSearchParams(location.search).get('signin') === '1') {
    setAuthMode(new URLSearchParams(location.search).get('signup') === '1' ? 'signup' : 'login');
    document.getElementById('login-modal').classList.add('open');
  }
} catch (err) {
  // Avoid halting the rest of the script — try again shortly
  console.warn('Initial render failed, retrying shortly', err);
  setTimeout(() => {
    try { initializeMoodDiscovery(); renderTrending(); initializeDeferredHomeSections(); } catch (e) { console.error('Retry failed', e); }
  }, 200);
}
