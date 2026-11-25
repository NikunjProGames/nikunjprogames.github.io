function getCompleteSentences(text, title) {
  const sentences = [];
  const abbreviations = new Set(['vs', 'e.g', 'i.e', 'mr', 'mrs', 'dr']);
  const titleStart = title ? text.toLowerCase().indexOf(title.toLowerCase()) : -1;
  const titleEnd = titleStart + title.length;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!'.!?'.includes(text[index])) continue;
    if (titleStart >= 0 && index >= titleStart && index < titleEnd) continue;
    const next = text.slice(index + 1).trimStart()[0];
    if (next && /[a-z]/.test(next)) continue;
    const previousWord = text.slice(0, index).match(/([a-z.]+)$/i)?.[1].toLowerCase();
    if (text[index] === '.' && abbreviations.has(previousWord)) continue;
    if (text[index] === '.' && /^[A-Z]$/.test(previousWord || '') && next && /[A-Z]/.test(next)) continue;
    if (next === '\u2013' || next === '\u2014' || next === '-') continue;
    const sentence = text.slice(start, index + 1).trim();
    if (sentence && !/^\d+\.$/.test(sentence)) sentences.push(sentence);
    start = index + 1;
  }
  if (!sentences.length && text.trim()) sentences.push(text.trim());
  return sentences;
}

function trimToLimit(text, limit) {
  if (text.length <= limit) return text;
  const shortened = text.slice(0, limit);
  const wordEnd = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, wordEnd > 0 ? wordEnd : limit - 1).replace(/[,:;\u2013\u2014-]+$/, '').trim()}…`;
}

function isUsefulContinuation(sentence, result, title) {
  const normalized = sentence.toLowerCase();
  if (
    sentence.length < 24
    || /[?]\s*$/.test(sentence)
    || /\b(?:html5|why choose|what do you need to do|update alert|is waiting for you|20\d{2})\b/i.test(sentence)
    || /^(?:(?:p\.\s*)?s\.\s*[-\u2013\u2014]|core gameplay|gameplay|q:|a:)/i.test(sentence)
  ) return false;

  const normalizedTitle = title.toLowerCase();
  if (!normalizedTitle) return true;
  const occurrences = normalized.split(normalizedTitle).length - 1;
  return occurrences < 2 && !(result.toLowerCase().includes(normalizedTitle) && occurrences > 0);
}

function createGameSeoDescription(title, description, providedSeoDescription, shortDescription) {
  const gameTitle = String(title || '').trim();
  const supplied = String(providedSeoDescription || '').trim();
  const suppliedShort = String(shortDescription || '').trim();
  const descriptionSentences = getCompleteSentences(String(description || '').trim(), gameTitle);
  const preferred = supplied || suppliedShort || descriptionSentences[0] || '';
  if (!preferred) return `Play ${gameTitle || 'this game'} on PleyZ.`;
  if (supplied || preferred.length >= 70) return trimToLimit(preferred, 160);

  const candidates = [preferred, ...descriptionSentences];
  let result = '';
  const included = new Set();
  let sentenceCount = 0;
  for (const candidate of candidates) {
    const sentence = candidate.trim();
    const normalized = sentence.toLowerCase().replace(/[\s.!?]+$/, '');
    if (!sentence || included.has(normalized) || result.length >= 140 || sentenceCount >= 2) continue;
    if (result && !isUsefulContinuation(sentence, result, gameTitle)) continue;
    included.add(normalized);
    const combined = result ? `${result} ${sentence}` : sentence;
    if (combined.length <= 160) {
      result = combined;
      sentenceCount += 1;
    }
    else if (!result) result = trimToLimit(sentence, 160);
    if (result.length >= 140) break;
  }
  return trimToLimit(result || `Play ${gameTitle || 'this game'} on PleyZ.`, 160);
}

module.exports = createGameSeoDescription;
