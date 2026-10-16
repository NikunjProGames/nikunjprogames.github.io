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

const CATEGORY_TAG_RULES = {
  Action: ['action', 'combat', 'fighting', 'fighter', 'shooter', 'shooting', 'battle', 'survival', 'fps', 'war'],
  Adventure: ['adventure', 'adventures', 'quest', 'exploration', 'explore', 'story', 'rpg'],
  Arcade: ['arcade', 'arcades'],
  Boys: ['boys', 'games for boys'],
  Girls: ['girls', 'games for girls'],
  Cars: ['car', 'cars', 'driving', 'vehicle', 'vehicles', 'motorcycle', 'bike'],
  Racing: ['race', 'races', 'racing', 'speed'],
  Puzzle: ['puzzle', 'puzzles', 'logic', 'brain', 'word', 'quiz', 'trivia', 'jigsaw', 'match 3', 'matching', 'mahjong', 'chess', 'checkers', 'sudoku', 'sort'],
  Strategy: ['strategy', 'strategies', 'tactical', 'tower defense', 'defense'],
  Simulation: ['simulation', 'simulations', 'simulator', 'simulators', 'management', 'tycoon', 'cooking', 'restaurant'],
  Sports: ['sport', 'sports', 'basketball', 'football', 'soccer', 'tennis', 'golf', 'baseball', 'volleyball', 'bowling', 'archery', 'carrom', 'ping pong'],
  Multiplayer: ['multiplayer', 'online multiplayer', 'pvp', 'co op', 'coop', 'io'],
  'Two Player': ['2 player', 'two player', '2 players', 'local multiplayer'],
  Endless: ['endless', 'runner', 'runners', 'running'],
  Parkour: ['parkour', 'obby', 'platformer', 'platforming'],
  Skill: ['skill', 'skills', 'precision', 'reflex', 'timing', 'reaction'],
  Horror: ['horror', 'scary', 'zombie'],
  Nostalgia: ['retro', 'classic', 'old school', 'nostalgia'],
  Casual: ['casual', 'cozy', 'relaxing', 'idle', 'merge'],
  'Brain Training': ['brain training', 'memory', 'educational']
};

function inferCategoriesFromTags(tags) {
  const normalizedTags = tags.map(tag => ` ${slugify(tag).replace(/-/g, ' ')} `);
  return Object.entries(CATEGORY_TAG_RULES)
    .filter(([, terms]) => terms.some(term => {
      const normalizedTerm = ` ${slugify(term).replace(/-/g, ' ')} `;
      return normalizedTags.some(tag => tag.includes(normalizedTerm));
    }))
    .map(([category]) => category);
}

function getCompleteSentences(text) {
  const sentences = [];
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    if (!'.!?'.includes(text[index])) continue;
    const next = text.slice(index + 1).trimStart()[0];
    if (next && /[a-z]/.test(next)) continue;
    if (next === '\u2013' || next === '\u2014' || next === '-') continue;
    const sentence = text.slice(start, index + 1).trim();
    if (sentence) sentences.push(sentence);
    start = index + 1;
  }
  if (!sentences.length && text.trim()) sentences.push(text.trim());
  return sentences;
}

function getSeoDescription(title, description, providedSeoDescription, shortDescription) {
  const supplied = toPlainText(providedSeoDescription);
  const suppliedShort = toPlainText(shortDescription);
  const firstSentence = getCompleteSentences(toPlainText(description))[0] || '';
  const snippet = supplied || suppliedShort || firstSentence;
  if (!snippet) return `Play ${toPlainText(title)} on PleyZ.`;
  if (snippet.length <= 160) return snippet;

  const withinLimit = snippet.slice(0, 160);
  const sentenceEnd = Math.max(withinLimit.lastIndexOf('.'), withinLimit.lastIndexOf('!'), withinLimit.lastIndexOf('?'));
  if (sentenceEnd >= 100) return withinLimit.slice(0, sentenceEnd + 1).trim();

  const wordEnd = withinLimit.lastIndexOf(' ');
  return `${withinLimit.slice(0, wordEnd > 0 ? wordEnd : 159).replace(/[,:;\u2013\u2014-]+$/, '').trim()}…`;
}

function normalizeSeoContent(content, title) {
  if (content === undefined) return null;
  const label = toPlainText(title) || 'Untitled game';
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    throw new Error(`seoContent for "${label}" must be an object.`);
  }

  const readLines = (key, required = false) => {
    const value = content[key] ?? [];
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !toPlainText(item))) {
      throw new Error(`seoContent.${key} for "${label}" must be an array of non-empty strings.`);
    }
    const lines = value.map(item => toPlainText(item));
    if (required && !lines.length) throw new Error(`seoContent.${key} for "${label}" must not be empty.`);
    return lines;
  };
  const about = readLines('about', true);
  const features = readLines('features', true);
  if (features.length > 4) throw new Error(`seoContent.features for "${label}" must contain no more than four items.`);
  const story = readLines('story');

  const questions = content.questions ?? {};
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) {
    throw new Error(`seoContent.questions for "${label}" must be an object of categorized question arrays.`);
  }
  const normalizedQuestions = {};
  for (const category of ['core', 'mechanics', 'economy', 'retention']) {
    const entries = questions[category] ?? [];
    if (!Array.isArray(entries) || entries.some(item => (
      !item || typeof item !== 'object'
      || typeof item.question !== 'string' || !toPlainText(item.question)
      || typeof item.answer !== 'string' || !toPlainText(item.answer)
    ))) {
      throw new Error(`seoContent.questions.${category} for "${label}" must contain question/answer objects.`);
    }
    normalizedQuestions[category] = entries.map(item => ({
      question: toPlainText(item.question),
      answer: toPlainText(item.answer)
    }));
  }

  return {
    about,
    controls: readLines('controls'),
    features,
    modes: readLines('modes'),
    story,
    questions: normalizedQuestions
  };
}

function normalizeGame(game) {
  const description = toPlainText(game.description);
  const instructions = toPlainText(game.instructions);
  const tags = listFrom(game.tags);
  const categories = [...new Map(
    [...listFrom(game.categories), ...listFrom(game.category), ...inferCategoriesFromTags(tags)]
      .map(category => [toPlainText(category).toLowerCase(), toPlainText(category)])
  ).values()];
  if (!categories.length) categories.push('Other');
  const shortDescription = toPlainText(game.shortDescription)
    || getCompleteSentences(description)[0]
    || description.slice(0, 155).replace(/\s+\S*$/, '');

  return {
    ...game,
    slug: game.slug || slugify(game.title),
    description,
    descriptionSource: String(game.description || ''),
    shortDescription,
    instructions,
    instructionsSource: String(game.instructions || ''),
    howToPlay: toPlainText(game.howToPlay),
    controls: toPlainText(game.controls),
    features: listFrom(game.features),
    seoContent: normalizeSeoContent(game.seoContent, game.title),
    categories,
    tags,
    platforms: listFrom(game.platforms || ['Web browser']),
    difficulty: toPlainText(game.difficulty),
    gameDna: listFrom(game.gameDna || [...categories, ...tags]).slice(0, 12),
    faqs: Array.isArray(game.faqs) ? game.faqs : [],
    relatedGames: Array.isArray(game.relatedGames) ? game.relatedGames : [],
    relatedCategories: Array.isArray(game.relatedCategories) ? game.relatedCategories : [],
    seoTitle: toPlainText(game.seoTitle) || `Play ${toPlainText(game.title)} | PleyZ`,
    seoDescription: getSeoDescription(game.title, description, game.seoDescription, game.shortDescription),
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

function getDescriptionLines(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<(?:p|div|li|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .split(/\r?\n/)
    .map(line => toPlainText(line))
    .filter(Boolean);
}

function getDescriptionSectionHeading(line) {
  const source = line.trim().replace(/^\[([^\]]+)\]$/, '$1');
  const match = source.match(/^([^:]+?)(?::\s*(.*))?$/);
  const heading = toPlainText(match?.[1])
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/[\[\].:]\s*$/, '')
    .trim()
    .toLowerCase();
  const inlineContent = match?.[2] ? toPlainText(match[2]) : '';
  const sections = [
    [/^controls?$/, 'controls'],
    [/^(?:(?:key|game|main game|game main) )?features?(?: of the game)?$/, 'features'],
    [/^(?:levels?\s*\/\s*maps?\s*\/\s*worlds?|(?:game )?modes?(?:\s*&\s*environments)?)$/, 'modes'],
    [/^(?:game )?overview$/, 'intro'],
    [/^(?:about this game|full description)$/, 'intro'],
    [/^(?:story\s*\/\s*setting|story|setting)$/, 'story'],
    [/^core$/, 'intro'],
    [/^loop$/, 'mechanics'],
    [/^start$/, 'core'],
    [/^visual$/, 'features'],
    [/^playgama fact$/, 'intro'],
    [/^core gameplay\s*&\s*story$/, 'core'],
    [/^upgrades?\s*\/\s*progression\s*\/\s*economy$/, 'economy'],
    [/^characters?\s*\/\s*heroes\s*\/\s*skins?$/, 'economy'],
    [/^enemies\s*\/\s*bosses$/, 'mechanics'],
    [/^vehicles?\s*\/\s*cars?$/, 'mechanics'],
    [/^mechanics\s*&\s*progression$/, 'mechanics'],
    [/^economy\s*&\s*customization$/, 'economy'],
    [/^retention\s*&\s*(?:engagement|accessibility)$/, 'retention'],
    [/^tips for beginners$/, 'tipsForBeginners'],
    [/^advanced tips$/, 'advancedTips'],
    [/^common mistakes$/, 'commonMistakes']
  ];
  const section = sections.find(([pattern]) => pattern.test(heading));
  return section ? { key: section[1], inlineContent } : null;
}

function parseGameDescription(game) {
  const parsed = {
    intro: [],
    controls: [],
    features: [],
    modes: [],
    story: [],
    tipsForBeginners: [],
    advancedTips: [],
    commonMistakes: [],
    notes: { mechanics: [], economy: [] },
    questions: { core: [], mechanics: [], economy: [], retention: [] }
  };
  let currentSection = 'intro';
  const sectionsWithBullets = new Set();

  for (const originalLine of getDescriptionLines(game.descriptionSource || game.description)) {
    const heading = getDescriptionSectionHeading(originalLine);
    if (heading) {
      currentSection = heading.key;
      if (heading.inlineContent) {
        const destination = getDescriptionDestination(parsed, currentSection);
        destination?.push(heading.inlineContent);
      }
      continue;
    }
    const isBullet = /^\s*[-*•]\s*/.test(originalLine);
    if (isBullet) sectionsWithBullets.add(currentSection);
    const sentenceCount = (originalLine.match(/[.!?](?:\s|$)/g) || []).length;
    if (['features', 'tipsForBeginners', 'advancedTips', 'commonMistakes'].includes(currentSection)
      && !isBullet
      && originalLine.length > 90
      && /[.!?]/.test(originalLine)
      && (sectionsWithBullets.has(currentSection) || (currentSection === 'features' && sentenceCount > 1 && originalLine.length > 120))) {
      parsed.intro.push(originalLine);
      currentSection = 'intro';
      continue;
    }
    if (currentSection === 'intro' && /\b(?:choose from|includes?|offers?|features?)\b.{0,70}\b(?:game )?modes?\b/i.test(originalLine)) {
      parsed.modes.push(originalLine);
      continue;
    }
    const destination = getDescriptionDestination(parsed, currentSection);
    destination?.push(originalLine);
  }

  for (const [category, lines] of Object.entries(parsed.questions)) {
    parsed.questions[category] = parseQuestionAnswers(lines);
  }
  return parsed;
}

function getEditorialGameDescription(game) {
  const content = game.seoContent;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;

  const toQuestions = category => (Array.isArray(content.questions?.[category])
    ? content.questions[category]
    : []).filter(item => item && typeof item.question === 'string' && typeof item.answer === 'string')
    .map(item => ({ question: toPlainText(item.question), answer: toPlainText(item.answer) }))
    .filter(item => item.question && item.answer);

  return {
    intro: listFrom(content.about),
    controls: listFrom(content.controls),
    features: listFrom(content.features),
    modes: listFrom(content.modes),
    story: listFrom(content.story),
    tipsForBeginners: [],
    advancedTips: [],
    commonMistakes: [],
    notes: { mechanics: [], economy: [] },
    questions: {
      core: { questions: toQuestions('core'), notes: [] },
      mechanics: { questions: toQuestions('mechanics'), notes: [] },
      economy: { questions: toQuestions('economy'), notes: [] },
      retention: { questions: toQuestions('retention'), notes: [] }
    }
  };
}

function getDescriptionDestination(parsed, section) {
  if (parsed.questions[section]) return parsed.questions[section];
  if (parsed.notes[section]) return parsed.notes[section];
  return parsed[section];
}

function parseQuestionAnswers(lines) {
  const questions = [];
  const notes = [];
  let currentQuestion = '';
  let currentAnswer = '';
  const saveQuestion = () => {
    if (currentQuestion && currentAnswer) {
      questions.push({ question: currentQuestion.trim(), answer: currentAnswer.trim() });
    } else if (currentQuestion) notes.push(currentQuestion.trim());
    currentQuestion = '';
    currentAnswer = '';
  };

  for (const line of lines) {
    const inlinePair = line.match(/^Q:\s*(.*?)\s+A:\s*(.+)$/i);
    if (inlinePair) {
      saveQuestion();
      questions.push({ question: inlinePair[1].trim(), answer: inlinePair[2].trim() });
      continue;
    }
    const question = line.match(/^Q:\s*(.+)$/i);
    if (question) {
      saveQuestion();
      currentQuestion = question[1].trim();
      continue;
    }
    const answer = line.match(/^A:\s*(.+)$/i);
    if (answer && currentQuestion) {
      currentAnswer = currentAnswer ? `${currentAnswer} ${answer[1].trim()}` : answer[1].trim();
      continue;
    }
    if (currentQuestion && currentAnswer) currentAnswer += ` ${line}`;
    else notes.push(line);
  }
  saveQuestion();
  return { questions, notes };
}

function renderParagraphs(lines) {
  return lines.map(line => `<p>${escapeHtml(line)}</p>`).join('\n');
}

function renderList(lines) {
  const items = lines.map(line => `<li>${renderListItemContents(line)}</li>`);
  return items.length ? `<ul>${items.join('')}</ul>` : '';
}

function renderFeatureList(lines) {
  const maxBullets = 4;
  const groupSize = Math.ceil(lines.length / maxBullets);
  const groups = [];
  for (let index = 0; index < lines.length; index += groupSize) {
    groups.push(lines.slice(index, index + groupSize));
  }
  return `<ul>${groups.map(group => {
    const items = group.map(item => item.replace(/^\s*[-*•]\s*/, '').trim());
    if (items.length === 1) return `<li>${renderListItemContents(items[0])}</li>`;
    const [first, ...rest] = items.map(item => item.replace(/[.!?;,]+$/, ''));
    return `<li>${renderListItemContents(first)}${rest.map(item => `; ${escapeHtml(item)}`).join('')}.</li>`;
  }).join('')}</ul>`;
}

function renderListItemContents(line) {
  const text = line.replace(/^\s*[-*•]\s*/, '').trim();
  const split = text.match(/^(.{1,100}?)\s*[:：]\s+(.+)$/);
  const actionEnd = /[.!?]$/.test(split?.[1] || '') ? ' ' : ': ';
  return split
    ? `<strong>${escapeHtml(split[1])}</strong>${actionEnd}${escapeHtml(split[2])}`
    : `<strong>${escapeHtml(text)}</strong>`;
}

function getFeatureControl(line) {
  const text = line.replace(/^\s*[-*•]\s*/, '').trim();
  if (!/\b(?:keyboard|mouse|arrow keys|wasd|swipe|tilt|touch|tap|click|controller|left[- ]and[- ]right steering)\b/i.test(text)) {
    return '';
  }
  if (/\bmobile\b/i.test(text)) return `Mobile: ${text}`;
  if (/\bdesktop\b|\bkeyboard\b/i.test(text)) return `Desktop: ${text}`;
  return text;
}

function renderTips(groups) {
  return [
    ['Tips for Beginners', groups.tipsForBeginners],
    ['Advanced Tips', groups.advancedTips],
    ['Common Mistakes', groups.commonMistakes]
  ].filter(([, lines]) => lines.length)
    .map(([heading, lines]) => `<h3>${heading}</h3>${renderList(lines)}`)
    .join('\n');
}

function parseInstructionText(instructions) {
  const lines = getDescriptionLines(instructions);
  if (!lines.length) return { controls: [], howToPlay: '' };
  const playerOrDeviceLabels = /^(?:desktop|mobile|player\s*[12]|player\s*(?:one|two))\s*:/i;
  if (lines.every(line => playerOrDeviceLabels.test(line))) return { controls: lines, howToPlay: '' };

  const controlMapping = /^(?:move|movement|aim|shoot|fire|jump|boost|attack|run|drive|steer|turn|brake|accelerate|player\s*[12])\s*:/i;
  if (lines.every(line => controlMapping.test(line))) return { controls: lines, howToPlay: '' };
  if (lines.length === 1 && lines[0].length <= 140
    && /^(?:use\s+)?(?:mouse|keyboard|arrow keys|wasd|tap|click|drag|swipe|press)\b/i.test(lines[0])) {
    return { controls: lines, howToPlay: '' };
  }

  const source = String(instructions || '').trim();
  const platformBlocks = { Desktop: [], Mobile: [] };
  const narrativeLines = [];
  let currentPlatform = '';
  let foundPlatformControls = false;
  for (const line of lines) {
    const heading = line.match(/^(PC|Desktop|Mobile)(?:\s+controls?)\s*:?$/i);
    const label = line.match(/^(PC|Desktop|Mobile)\s*:\s*(.*)$/i);
    if (heading || label) {
      currentPlatform = (heading?.[1] || label[1]).toLowerCase() === 'mobile' ? 'Mobile' : 'Desktop';
      foundPlatformControls = true;
      const inlineControls = label?.[2].trim();
      if (inlineControls) platformBlocks[currentPlatform].push(inlineControls);
      continue;
    }
    if (currentPlatform) platformBlocks[currentPlatform].push(line);
    else narrativeLines.push(line);
  }
  if (foundPlatformControls) {
    const controls = Object.entries(platformBlocks)
      .filter(([, items]) => items.length)
      .map(([platform, items]) => `${platform}: ${items.join('; ')}`);
    return { controls, howToPlay: narrativeLines.join(' ') };
  }

  const labels = /(^|[.!?]\s*|\n\s*)(Control on a (mobile|desktop)(?: device)?|PC|Desktop|Mobile)(?:\s+control)?\s*:\s*/gi;
  const matches = [...source.matchAll(labels)];
  if (!matches.length) return { controls: [], howToPlay: lines.join(' ') };
  const controls = matches.map((match, index) => {
    const contentStart = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const label = match[2].toLowerCase().startsWith('control on a ')
      ? match[3]
      : match[2].replace(/\s+control$/i, '');
    return `${label.toLowerCase() === 'pc' ? 'Desktop' : label[0].toUpperCase() + label.slice(1)}: ${source.slice(contentStart, end).replace(/[.!?]\s*$/, '').trim()}`;
  }).filter(line => !/: \s*$/.test(line));
  const howToPlay = source.slice(0, matches[0].index).replace(/[.!?\s]+$/, '').trim();
  return { controls, howToPlay };
}

function renderControls(lines) {
  const controls = lines.map(line => {
    const labels = /(^|\s)(Desktop|Mobile|Player\s*[12]|Player\s*(?:One|Two))\s*:\s*/gi;
    const firstLabel = labels.exec(line);
    if (!firstLabel) return `<p>${escapeHtml(line)}</p>`;

    labels.lastIndex = 0;
    const pieces = [];
    let match;
    let lastIndex = 0;
    while ((match = labels.exec(line))) {
      if (match.index > lastIndex) {
        const text = line.slice(lastIndex, match.index).trim();
        if (text) pieces.push(escapeHtml(text));
      }
      const contentStart = labels.lastIndex;
      const next = labels.exec(line);
      const contentEnd = next ? next.index : line.length;
      pieces.push(`<strong>${escapeHtml(match[2])}:</strong> ${escapeHtml(line.slice(contentStart, contentEnd).trim())}`);
      if (next) labels.lastIndex = next.index;
      lastIndex = contentEnd;
      if (!next) break;
    }
    const remaining = line.slice(lastIndex).trim();
    if (remaining) pieces.push(escapeHtml(remaining));
    return `<p>${pieces.join(' ')}</p>`;
  });
  return controls.join('\n');
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
  const editorialContent = getEditorialGameDescription(game);
  const description = editorialContent || parseGameDescription(game);
  const instructionText = parseInstructionText(game.instructionsSource || game.instructions);
  const intro = description.intro.length
    ? description.intro
    : [game.shortDescription || game.seoDescription];
  const sourceControls = description.controls.length
    ? description.controls
    : editorialContent
      ? []
      : game.controls
      ? getDescriptionLines(game.controls)
    : instructionText.controls;
  const rawFeatures = [...new Set([...description.features, ...(editorialContent ? [] : game.features)])];
  const featureControls = sourceControls.length ? [] : rawFeatures.map(getFeatureControl).filter(Boolean);
  const controls = [...new Set([...sourceControls, ...featureControls])];
  const features = rawFeatures.filter(line => !getFeatureControl(line)
    && !(description.modes.length && /\bmodes?\b/i.test(line)));
  const coreQuestions = [
    ...description.questions.core.questions,
    ...(editorialContent ? [] : game.faqs.map(faq => ({ question: faq.question, answer: faq.answer })))
  ];
  const sections = [`<section class="info-card" aria-labelledby="game-description-heading">
      <h2 id="game-description-heading">About ${escapeHtml(game.title)}</h2>
      ${renderParagraphs(intro)}
      ${controls.length ? `<h3>Controls</h3>${renderControls(controls)}` : ''}
      ${features.length ? `<h3>Key Features</h3>${renderFeatureList(features)}` : ''}
      ${description.modes.length ? `<h3>Game Modes &amp; Environments</h3>${renderList(description.modes)}` : ''}
      ${renderQuestionCategory('Core Gameplay & Story', coreQuestions, [...description.story, ...description.questions.core.notes])}
      ${renderQuestionCategory('Mechanics & Progression', description.questions.mechanics.questions, description.questions.mechanics.notes, description.notes.mechanics)}
      ${renderQuestionCategory('Economy & Customization', description.questions.economy.questions, description.questions.economy.notes, description.notes.economy)}
      ${renderQuestionCategory('Retention & Accessibility', description.questions.retention.questions, description.questions.retention.notes)}
    </section>`];

  const howToPlay = game.howToPlay || instructionText.howToPlay || (!controls.length ? game.instructions : '');
  const tipsHtml = renderTips(description);
  if (howToPlay || tipsHtml) {
    sections.push(`<section class="info-card" aria-labelledby="how-to-play-heading">
      <h2 id="how-to-play-heading">How to Play</h2>
      ${howToPlay ? `<p>${escapeHtml(howToPlay)}</p>` : ''}
      ${tipsHtml}
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

function renderQuestionCategory(heading, questions, paragraphs = [], items = []) {
  return questions.length || paragraphs.length || items.length
    ? `<h3>${escapeHtml(heading)}</h3>${renderParagraphs(paragraphs)}${items.length ? renderList(items) : ''}${questions.length ? `<dl>${questions.map(item => `<dt>${escapeHtml(item.question)}</dt><dd>${escapeHtml(item.answer)}</dd>`).join('')}</dl>` : ''}`
    : '';
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
      description: game.seoDescription || game.shortDescription || game.description,
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
  const homepageGames = loadHomepageGames();
  const homepageIdBySlug = new Map(homepageGames.flatMap(game => {
    const match = String(game.iframeUrl || '').match(/^\/?games\/([^/]+)\.html$/);
    return match ? [[match[1], Number(game.id)]] : [];
  }));
  const legacyGames = homepageGames.map(game => ({
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
    id: homepageIdBySlug.get(game.slug) ?? Number(game.id),
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
  const likedCatalog = new Map();
  libraryGames.forEach(game => {
    const id = Number(game.id);
    if (!Number.isFinite(id) || !game.name || !game.href) return;
    const entry = likedCatalog.get(id);
    if (entry) {
      if (!entry.image && game.image) entry.image = game.image;
      return;
    }
    likedCatalog.set(id, {
      id,
      name: game.name,
      href: game.href,
      image: game.image || '',
      category: game.categories[0] || ''
    });
  });
  fs.writeFileSync(path.join(__dirname, 'liked-games-data.json'), JSON.stringify([...likedCatalog.values()]));
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

  const uniqueCategories = new Map();
  categories.forEach(category => {
    const slug = slugify(category.name);
    const existing = uniqueCategories.get(slug);
    if (!existing) {
      uniqueCategories.set(slug, { ...category, games: new Map(category.games) });
      return;
    }
    category.games.forEach((game, href) => existing.games.set(href, game));
    if (category.description) {
      existing.name = category.name;
      existing.description = category.description;
      existing.theme = category.theme || existing.theme;
    }
  });

  const categoryPages = [...uniqueCategories.entries()];
  const categoryTemplate = fs.readFileSync(path.join(__dirname, 'category-template.html'), 'utf8');
  const pages = categoryPages.map(([slug, category]) => {
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
    const coverSource = gameList[0]?.image || '';
    const coverUrl = coverSource && !/^(?:https?:|\/|data:)/i.test(coverSource) ? `/${coverSource}` : coverSource;
    const categoryArt = coverUrl
      ? `<img src="${escapeHtml(coverUrl)}" alt="" loading="eager" fetchpriority="high" decoding="async"><span class="category-visual-label">Featured in ${escapeHtml(category.name)}</span>`
      : `<div class="category-visual-fallback" aria-hidden="true">${escapeHtml(category.name.slice(0, 1).toUpperCase())}</div>`;
    const related = categoryPages
      .filter(([otherSlug]) => otherSlug !== slug)
      .sort((a, b) => b[1].games.size - a[1].games.size)
      .slice(0, 5)
      .map(([otherSlug, other]) => `<a href="/${otherSlug}-games/">${escapeHtml(other.name)} Games</a>`)
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
      .replaceAll('{{CATEGORY_ART}}', categoryArt)
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

function normalizeLegacyGamePages() {
  const homepageGames = loadHomepageGames();
  const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, 'legacy-game-seo.json'), 'utf8'));
  const gameNames = new Map();
  homepageGames.forEach(game => {
    const href = String(game.iframeUrl || '').replace(/^\/+/, '');
    if (!href || href.includes('/') || !href.endsWith('.html') || href === 'index.html') return;
    gameNames.set(href, game.name);
  });

  const targetFiles = new Set([
    ...gameNames.keys(),
    ...Object.keys(metadata.titles || {}),
    ...Object.keys(metadata.descriptions || {})
  ]);
  targetFiles.forEach(filename => {
    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) return;
    let html = fs.readFileSync(filePath, 'utf8');
    const explicitTitle = metadata.titles?.[filename];
    const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '';
    const name = explicitTitle || toPlainText(heading)
      .replace(/^play\s+/i, '')
      .replace(/\s+on\s+pleyz$/i, '')
      .replace(/\s+(?:game\s+)?for\s+free$/i, '')
      .replace(/\s+online$/i, '')
      .trim() || gameNames.get(filename) || path.basename(filename, '.html').replace(/-/g, ' ');
    const title = `Play ${name} | PleyZ`;
    const existingDescription = html.match(/<meta\b(?=[^>]*\bname\s*=\s*["']description["'])[^>]*\bcontent\s*=\s*["']([^"']*)["'][^>]*>/i)?.[1] || '';
    const description = metadata.descriptions?.[filename] || existingDescription || `Play ${name} in your browser on PleyZ.`;
    const canonical = `https://nikunjprogames.github.io/${filename}`;
    const insertIntoHead = tag => {
      html = html.replace(/<\/head>/i, `  ${tag}\n</head>`);
    };
    const setMeta = (attribute, key, content) => {
      const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}\\s*=\\s*["']${key}["'])[^>]*>`, 'i');
      const tag = `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
      if (matcher.test(html)) html = html.replace(matcher, tag);
      else insertIntoHead(tag);
    };

    const titleTag = `<title>${escapeHtml(title)}</title>`;
    if (/<title>[\s\S]*?<\/title>/i.test(html)) html = html.replace(/<title>[\s\S]*?<\/title>/i, titleTag);
    else insertIntoHead(titleTag);
    html = html.replace(/<meta\b(?=[^>]*\bname\s*=\s*["']keywords["'])[^>]*>\s*/ig, '');
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:site_name', 'PleyZ');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    const canonicalTag = `<link rel="canonical" href="${canonical}" />`;
    const canonicalMatcher = /<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>/i;
    if (canonicalMatcher.test(html)) html = html.replace(canonicalMatcher, canonicalTag);
    else insertIntoHead(canonicalTag);
    if (!html.includes('src="/site-shell.js"')) {
      html = html.replace(/<\/body>/i, '  <script src="/site-shell.js" defer></script>\n</body>');
    }
    if (!html.includes('src="/game-loading.js"')) {
      html = html.replace(/<\/body>/i, '  <script src="/game-loading.js" defer></script>\n</body>');
    }
    fs.writeFileSync(filePath, html);
  });

  return targetFiles.size;
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

    htmlContent = htmlContent.replace(/^[\t ]+$/gm, '');

    // 4. Save the file
    fs.writeFileSync(path.join(outputDir, `${game.slug}.html`), htmlContent);
  });

  console.log(`Success! ${games.length} game pages generated in the /games/ folder.`);
  console.log(`Success! ${buildCategoryPages(games)} category pages generated.`);
  console.log(`Normalized SEO metadata on ${normalizeLegacyGamePages()} legacy game pages.`);
}

if (process.argv.includes('--categories-only')) {
  const games = JSON.parse(fs.readFileSync(FEED_FILE, 'utf8')).map(normalizeGame);
  console.log(`Success! ${buildCategoryPages(games)} category pages generated.`);
} else {
  generateGamePages();
}