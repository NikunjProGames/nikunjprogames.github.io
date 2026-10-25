const CATEGORY_TAG_RULES = {
  action: ['action', 'combat', 'fighter', 'fighting', 'shooter', 'shooting', 'battle', 'fps', 'war', 'gun', 'guns'],
  adventure: ['adventure', 'quest', 'exploration', 'explore', 'story', 'rpg'],
  arcade: ['arcade'],
  'american football': ['american football'],
  'brain training': ['brain training', 'memory', 'educational'],
  'bubble shooter': ['bubble shooter', 'bubble popping'],
  cars: ['car', 'cars', 'vehicle', 'vehicles', 'motorcycle', 'bike'],
  'car racing': ['car racing', 'racing car'],
  casual: ['casual', 'cozy', 'relaxing', 'idle', 'merge'],
  driving: ['driving', 'drive'],
  endless: ['endless', 'runner', 'runners', 'running'],
  fighting: ['fighting', 'fighter', 'brawler', 'martial arts', 'boxing', 'wrestling'],
  'fps shooting': ['fps', 'first person shooter', 'first-person shooter'],
  horror: ['horror', 'scary', 'jump scare'],
  io: ['io', '.io', 'multiplayer io'],
  mahjong: ['mahjong'],
  multiplayer: ['multiplayer', 'online multiplayer', 'pvp', 'co op', 'coop'],
  music: ['music', 'rhythm'],
  parkour: ['parkour', 'obby', 'platformer', 'platforming'],
  puzzle: ['puzzle', 'logic', 'brain', 'word', 'quiz', 'trivia', 'jigsaw', 'match 3', 'matching', 'mahjong', 'chess', 'checkers', 'sudoku', 'sort'],
  racing: ['race', 'racing', 'speed'],
  scary: ['scary', 'jump scare'],
  shooting: ['shooter', 'shooting', 'fps', 'gun', 'guns', 'weapon', 'weapons', 'aim'],
  simulation: ['simulation', 'simulator', 'management', 'tycoon', 'cooking', 'restaurant'],
  skill: ['skill', 'precision', 'reflex', 'timing', 'reaction'],
  snake: ['snake'],
  space: ['space', 'galaxy', 'planet'],
  sports: ['sport', 'sports', 'basketball', 'football', 'soccer', 'tennis', 'golf', 'baseball', 'volleyball', 'bowling', 'archery', 'carrom', 'ping pong'],
  strategy: ['strategy', 'tactical', 'tower defense', 'defense', 'card battler'],
  survival: ['survival'],
  'survival zombies': ['zombie', 'zombies'],
  'two player': ['2 player', 'two player', '2 players', 'local multiplayer'],
  words: ['words', 'word game', 'word games']
};

const CATEGORY_ALIASES = {
  '3d': ['3d'],
  'american football': ['american football'],
  'brain training': ['brain training'],
  'bubble shooter': ['bubble shooter'],
  car: ['cars', 'driving'],
  'car racing': ['car racing', 'cars', 'racing', 'driving'],
  cars: ['cars', 'driving'],
  'chill casual': ['chill casual', 'casual'],
  'fps': ['fps shooting', 'shooting', 'action'],
  'fps shooting': ['fps shooting', 'shooting', 'action'],
  'first person shooter': ['fps shooting', 'shooting', 'action'],
  fight: ['fighting', 'action'],
  fighter: ['fighting', 'action'],
  fighting: ['fighting', 'action'],
  gun: ['shooting', 'action'],
  guns: ['shooting', 'action'],
  'gun game': ['shooting', 'action'],
  'gun games': ['shooting', 'action'],
  'hidden object': ['hidden object'],
  'match 3': ['puzzle'],
  multiplayer: ['multiplayer'],
  obby: ['parkour'],
  'puzzle game': ['puzzle'],
  shooter: ['shooting', 'action'],
  shooting: ['shooting', 'action'],
  scary: ['scary', 'horror'],
  'survival horror': ['survival', 'horror'],
  'tactical strategy': ['tactical strategy', 'strategy'],
  'two player': ['two player', 'multiplayer'],
  '2 player': ['two player', 'multiplayer'],
  'unblocked games': ['unblocked'],
  'word game': ['words', 'puzzle']
};

const CATEGORY_LABELS = new Set([
  '3d', 'action', 'adventure', 'american football', 'arcade', 'boys',
  'brain training', 'bubble shooter', 'car racing', 'cars', 'casual',
  'chill casual', 'driving', 'endless', 'fighting',
  'fps shooting', 'girls', 'hidden object', 'horror', 'io', 'kids',
  'mahjong', 'multiplayer', 'music', 'new in 2026', 'nostalgia', 'parkour',
  'physics oddities', 'pleyz picks', 'puzzle', 'racing', 'scary', 'shooting',
  'simulation', 'skill', 'snake', 'space', 'sports', 'strategy', 'survival',
  'survival zombies', 'tactical strategy', 'two player', 'unblocked', 'words',
  'other'
]);

function normalizeCategoryText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function listCategoryValues(value) {
  if (Array.isArray(value)) return value.flatMap(listCategoryValues);
  return String(value || '').split(',').map(normalizeCategoryText).filter(Boolean);
}

function getCategoryMatches(text, terms) {
  const normalized = ` ${normalizeCategoryText(text)} `;
  return terms.some(term => normalized.includes(` ${normalizeCategoryText(term)} `));
}

function normalizeGameCategories(game = {}) {
  const sourceCategories = [
    ...listCategoryValues(game.categories),
    ...listCategoryValues(game.cats),
    ...listCategoryValues(game.category),
    ...listCategoryValues(game.cat)
  ];
  const categories = new Set();

  function addCategory(value) {
    const label = normalizeCategoryText(value);
    if (!label) return;
    const mapped = CATEGORY_ALIASES[label] || (CATEGORY_LABELS.has(label) ? [label] : []);
    mapped.forEach(category => categories.add(category));
  }

  sourceCategories.forEach(addCategory);

  const tags = [
    ...sourceCategories,
    ...listCategoryValues(game.tags),
    ...listCategoryValues(game.gameDna),
    normalizeCategoryText(game.title || game.name)
  ].filter(Boolean).join(' ');

  Object.entries(CATEGORY_TAG_RULES).forEach(([category, terms]) => {
    if (getCategoryMatches(tags, terms)) categories.add(category);
  });

  return categories.size ? [...categories] : ['other'];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalizeGameCategories };
} else {
  globalThis.PLEYZ_CATEGORY_TAXONOMY = { normalizeGameCategories };
}
