(() => {
  const initialize = () => {
    if (document.getElementById('pleyz-standard-game')) return;

    const iframe = [...document.querySelectorAll('iframe[src]')].find(frame => !frame.closest('.page-ad-section'));
    const nativeGame = iframe ? null : document.querySelector('main.game-shell, .game-shell');
    if (!iframe && !nativeGame) {
      console.error('Legacy game page could not be standardized: no embedded or native game was found.');
      return;
    }

    const gamePath = decodeURIComponent(location.pathname.replace(/^\/+/, ''));
    const games = Array.isArray(window.PLEYZ_GAMES) ? window.PLEYZ_GAMES : [];
    if (!Array.isArray(window.PLEYZ_GAMES)) console.error('Legacy game page could not load homepage game catalog data.');
    const game = games.find(item => (item.iframeUrl || '').replace(/^\/+/, '') === gamePath);
    const originalDescription = document.querySelector('meta[name="description"]')?.content?.trim() || '';
    const nameFromHeading = document.querySelector('h1')?.textContent?.trim() || '';
    const nameFromTitle = cleanTitle(document.title);
    const name = game?.name || (nativeGame ? nameFromTitle : cleanHeading(nameFromHeading) || nameFromTitle) || 'Browser Game';
    const description = game?.description || originalDescription || findUsefulParagraphs()[0] || `${name} is a browser game available to play on PleyZ.`;
    const usefulParagraphs = findUsefulParagraphs();
    const existingControls = findControls();
    const genres = getGenres(game, description, name);
    const imageUrl = getImageUrl(game);
    const pageUrl = document.querySelector('link[rel="canonical"]')?.href || location.href.split('#')[0];

    const root = document.createElement('div');
    root.id = 'pleyz-standard-game';
    root.className = 'page-shell';
    root.innerHTML = `
      <a class="skip-link" href="#legacy-main-content">Skip to game content</a>
      <header class="topbar">
        <a class="site-brand" href="/">PleyZ Games</a>
        <h1></h1>
        <div class="actions">
          <a class="profile-score-link" href="/#leaderboard" title="View PleyZ score and leaderboard">
            <span class="profile-score-avatar" data-score-avatar>PZ</span>
            <span data-score-label>PleyZ Score</span>
          </a>
          <a class="btn" href="/">Home</a>
          <a class="btn" href="/account.html">Account</a>
          <a class="btn primary" href="/#games">Play More Games</a>
        </div>
      </header>
      <div id="legacy-main-content">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><ol>
          <li><a href="/">Home</a></li>
          <li><a href="/#games">Games</a></li>
          <li aria-current="page"></li>
        </ol></nav>
        <div class="game-layout">
          <div class="game-primary">
            <div class="game-frame"></div>
            <div class="game-action-bar">
              <div class="game-preferences" role="group" aria-label="Game preference">
                <button type="button" data-game-preference="like" aria-label="Like game" aria-pressed="false"><span aria-hidden="true">👍</span></button>
                <button type="button" data-game-preference="dislike" aria-label="Dislike game" aria-pressed="false"><span aria-hidden="true">👎</span></button>
              </div>
              <button class="btn compact" type="button" data-fullscreen>Fullscreen</button>
            </div>
            <section class="info-card" aria-labelledby="legacy-about-heading">
              <h2 id="legacy-about-heading"></h2>
              <div data-about-copy></div>
            </section>
            <section class="info-card" aria-labelledby="legacy-howto-heading">
              <h2 id="legacy-howto-heading">How to Play</h2>
              <p data-how-to-play></p>
            </section>
            <section class="info-card" aria-labelledby="legacy-dna-heading">
              <h2 id="legacy-dna-heading">Game DNA</h2>
              <div class="chip-list" data-genres></div>
            </section>
            <section class="info-card" aria-label="Game platform">
              <h2>Platform</h2>
              <p>Web browser</p>
            </section>
            <section class="info-card" aria-labelledby="legacy-faq-heading">
              <h2 id="legacy-faq-heading">FAQ</h2>
              <h3>What is ${escapeHtml(name)}?</h3>
              <p data-faq-description></p>
              <h3>Where can I play ${escapeHtml(name)}?</h3>
              <p>Play it in a web browser on PleyZ. No separate game download is required.</p>
              <h3>How do I control the game?</h3>
              <p data-faq-controls></p>
            </section>
            <section class="info-card" aria-labelledby="legacy-screenshot-heading" data-screenshot-section>
              <h2 id="legacy-screenshot-heading"></h2>
              <div class="screenshot-gallery"></div>
            </section>
          </div>
          <aside class="info-card related-games" aria-label="Related games">
            <h2>Games You Might Like</h2>
            <div class="related-grid"></div>
          </aside>
        </div>
        <footer class="site-footer">
          <a href="/">PleyZ Home</a>
          <a href="/about-us.html">About</a>
          <a href="/privacy-policy.html">Privacy</a>
          <a href="/termsandconditions.html">Terms</a>
          <a href="/contact-us.html">Contact</a>
        </footer>
      </div>`;

    const adSection = document.querySelector('.page-ad-section');
    const gameFrame = root.querySelector('.game-frame');
    if (iframe) gameFrame.appendChild(iframe);
    else {
      gameFrame.classList.add('native-game-frame');
      gameFrame.appendChild(nativeGame);
      const nativeSupport = document.getElementById('toast');
      if (nativeSupport) root.appendChild(nativeSupport);
    }
    root.querySelector('.topbar h1').textContent = name;
    root.querySelector('.game-preferences').dataset.gameId = String(game?.id ?? gamePath);
    root.querySelector('.breadcrumbs li[aria-current="page"]').textContent = name;
    root.querySelector('#legacy-about-heading').textContent = `About ${name}`;
    root.querySelector('#legacy-screenshot-heading').textContent = `${name} Screenshot`;
    root.querySelector('[data-faq-description]').textContent = description;
    root.querySelector('[data-how-to-play]').textContent = existingControls || 'Start the game and follow its on-screen instructions. The objective and controls can vary by game, so check the opening screen or in-game help for the current mode.';
    root.querySelector('[data-faq-controls]').textContent = existingControls || 'Follow the game’s on-screen prompts or help screen for the controls supported by this game.';

    const aboutCopy = root.querySelector('[data-about-copy]');
    appendParagraph(aboutCopy, description);
    usefulParagraphs.filter(text => normalizeText(text) !== normalizeText(description)).slice(0, 2).forEach(text => appendParagraph(aboutCopy, text));
    if (usefulParagraphs.length === 0 || aboutCopy.childElementCount === 1) {
      appendParagraph(aboutCopy, `Play ${name} online on PleyZ in your web browser. Start a session whenever you are ready, and use the fullscreen control above for a larger game view.`);
    }

    const genreList = root.querySelector('[data-genres]');
    genres.forEach(genre => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = genre;
      genreList.appendChild(chip);
    });

    const screenshotSection = root.querySelector('[data-screenshot-section]');
    if (imageUrl) {
      const figure = document.createElement('figure');
      figure.className = 'game-screenshot';
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = `${name} game artwork`;
      image.loading = 'lazy';
      image.decoding = 'async';
      const caption = document.createElement('figcaption');
      caption.textContent = `${name} game image`;
      figure.append(image, caption);
      root.querySelector('.screenshot-gallery').appendChild(figure);
      updateImageMetadata(imageUrl);
    } else {
      screenshotSection.remove();
    }

    addRelatedGames(root, games, game, genres);
    initializePreferences(root, game?.id ?? gamePath);
    updateProfileScore(root);
    root.querySelector('[data-fullscreen]').addEventListener('click', () => {
      const requestFullscreen = gameFrame.requestFullscreen || gameFrame.webkitRequestFullscreen;
      if (requestFullscreen) {
        const result = requestFullscreen.call(gameFrame);
        if (result?.catch) result.catch(error => console.error('Could not enter fullscreen mode:', error));
      }
    });

    removeLegacyLayout(adSection);
    document.body.classList.add('pleyz-legacy-game-page');
    document.body.classList.remove('pleyz-immersive-game');
    document.body.appendChild(root);
    if (adSection) root.querySelector('#legacy-main-content').appendChild(adSection);
    document.title = `Play ${name}${/\bonline\b/i.test(name) ? '' : ' Online'} | PleyZ`;
    updateMeta('og:title', document.title, 'property');
    updateMeta('twitter:title', document.title);
    updateMeta('og:description', description, 'property');
    updateMeta('twitter:description', description);
    addGameStructuredData({ name, description, pageUrl, imageUrl, genres });

    function findUsefulParagraphs() {
      return [...document.querySelectorAll('p')]
        .map(element => element.textContent.trim())
        .filter(text => text.length > 100 && !/step into a polished browser challenge|keyboard and mouse controls keep movement|touch controls make the game easy|free fan-made web adaptation|sponsored/i.test(text))
        .filter((text, index, list) => list.findIndex(other => normalizeText(other) === normalizeText(text)) === index);
    }

    function findControls() {
      const headings = [...document.querySelectorAll('h2, h3, h4')];
      for (const heading of headings) {
        if (!/how to play|controls|instructions/i.test(heading.textContent)) continue;
        const section = heading.closest('section') || heading.parentElement;
        const text = section?.textContent?.replace(heading.textContent, '').trim() || '';
        if (text.length < 20 || /keyboard and mouse controls keep movement|touch controls make the game easy/i.test(text)) continue;
        return text;
      }
      return '';
    }
  };

  function cleanHeading(text) {
    return text.replace(/^play\s+/i, '').replace(/\s+(?:online|on\s+pleyz).*$/i, '').trim();
  }

  function cleanTitle(text) {
    return text.split('|')[0].replace(/^PleyZ\s+/i, '').replace(/^Play\s+/i, '').trim();
  }

  function normalizeText(text) {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function appendParagraph(parent, text) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    parent.appendChild(paragraph);
  }

  function getGenres(game, description, name) {
    const categories = [...(game?.categories || []), game?.cat].filter(Boolean);
    const schemaGenres = getStructuredGenres();
    const genres = [...categories, ...schemaGenres];
    const detected = genres.length ? genres : detectGenres(`${name} ${description}`);
    return [...new Set(detected.map(value => value.toLowerCase()))];
  }

  function getStructuredGenres() {
    const genres = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent);
        const entities = data['@graph'] || [data];
        entities.filter(item => item['@type'] === 'VideoGame').forEach(item => {
          if (Array.isArray(item.genre)) genres.push(...item.genre);
          else if (item.genre) genres.push(item.genre);
          if (Array.isArray(item.keywords)) genres.push(...item.keywords);
          else if (typeof item.keywords === 'string') genres.push(...item.keywords.split(/[,;]/));
        });
      } catch (error) {
        console.error('Could not read game genre metadata:', error);
      }
    }
    return genres.map(genre => genre.trim()).filter(Boolean);
  }

  function detectGenres(text) {
    const source = text.toLowerCase();
    const rules = [
      ['racing', /\brace|racing|driving|car\b|motorcycle/],
      ['sports', /\bsport|football|soccer|basketball|tennis|golf|archery/],
      ['puzzle', /\bpuzzle|jigsaw|brain|logic|match|tictactoe|tic tac toe/],
      ['action', /\baction|shooter|fight|combat|assassin/],
      ['adventure', /\badventure|explor|quest|rescue/],
      ['arcade', /\barcade|runner|flappy|tower/],
      ['music', /\bmusic|piano|rhythm|song/],
      ['multiplayer', /\bmultiplayer|online|opponent|players/],
      ['survival', /\bsurvival|eliminat/],
      ['io', /\.io|\bio\b|worms|snake/]
    ];
    return rules.filter(([, pattern]) => pattern.test(source)).map(([genre]) => genre);
  }

  function getImageUrl(game) {
    let image = game?.imageUrl;
    if (!image) {
      const fallbacks = {
        'box-tower.html': '/box_tower.png',
        'crowd-rush.html': '/Crowd%20Rush-512x512.jpg',
        'magic-piano-tiles.html': '/magic-piano-tiles.png',
        'running-fred.html': '/runningfred.png',
        'squid-challenge.html': '/squid_challenge.png',
        'worms-zone.html': '/Worms-Zone.png'
      };
      image = fallbacks[location.pathname.split('/').pop()] || document.querySelector('meta[property="og:image"]')?.content;
    }
    if (!image) return '';
    try {
      return new URL(image, `${location.origin}/`).href;
    } catch (error) {
      console.error('Could not resolve game image URL:', error);
      return '';
    }
  }

  function addRelatedGames(root, games, currentGame, genres) {
    const related = games
      .filter(item => item !== currentGame && item.iframeUrl && item.imageUrl)
      .map(item => ({ item, score: (item.categories || [item.cat]).filter(Boolean).filter(category => genres.includes(category.toLowerCase())).length }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    const grid = root.querySelector('.related-grid');
    related.forEach(({ item }) => {
      const link = document.createElement('a');
      link.className = 'related-game';
      link.href = item.iframeUrl.startsWith('/') ? item.iframeUrl : `/${item.iframeUrl}`;
      const media = document.createElement('span');
      media.className = 'related-game-media';
      const image = document.createElement('img');
      image.src = new URL(item.imageUrl, `${location.origin}/`).href;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      const title = document.createElement('span');
      title.textContent = item.name;
      media.appendChild(image);
      link.append(media, title);
      grid.appendChild(link);
    });
    if (!related.length) root.querySelector('.related-games').remove();
  }

  function initializePreferences(root, gameId) {
    const controls = root.querySelector('.game-preferences');
    let username = '';
    let preferences = {};
    try {
      username = (localStorage.getItem('nikunj_current_username') || '').trim();
      const key = username ? `nikunj_game_preferences_${username}` : 'nikunj_game_preferences_guest';
      preferences = JSON.parse(localStorage.getItem(key) || '{}');
      if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) preferences = {};
    } catch (error) {
      console.error('Could not load game preferences:', error);
    }

    const key = username ? `nikunj_game_preferences_${username}` : 'nikunj_game_preferences_guest';
    const updateButtons = () => controls.querySelectorAll('[data-game-preference]').forEach(button => {
      button.setAttribute('aria-pressed', String(preferences[gameId] === button.dataset.gamePreference));
    });
    controls.addEventListener('click', event => {
      const button = event.target.closest('[data-game-preference]');
      if (!button) return;
      preferences[gameId] = preferences[gameId] === button.dataset.gamePreference ? '' : button.dataset.gamePreference;
      try {
        localStorage.setItem(key, JSON.stringify(preferences));
        updateButtons();
      } catch (error) {
        console.error('Could not save game preference:', error);
      }
    });
    updateButtons();
  }

  function updateProfileScore(root) {
    try {
      const username = (localStorage.getItem('nikunj_current_username') || '').trim();
      if (!username) return;
      const initials = username.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
      const score = Number(localStorage.getItem(`nikunj_pleyz_${username}`) || 0).toLocaleString();
      root.querySelector('[data-score-avatar]').textContent = initials || 'PZ';
      root.querySelector('[data-score-label]').textContent = `PleyZ ${score}`;
    } catch (error) {
      console.error('Could not load PleyZ profile score:', error);
    }
  }

  function removeLegacyLayout(adSection) {
    adSection?.remove();
    for (const child of [...document.body.children]) {
      if (
        child.tagName === 'SCRIPT'
        || child.id === 'pleyz-site-nav'
        || child.id === 'game-opening-status'
        || child.matches('.pleyz-feedback-dialog')
        || child.getAttribute('aria-label') === 'Open game feedback'
      ) continue;
      child.remove();
    }
  }

  function updateMeta(key, value, attribute = 'name') {
    let meta = document.querySelector(`meta[${attribute}="${key}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, key);
      document.head.appendChild(meta);
    }
    meta.content = value;
  }

  function updateImageMetadata(imageUrl) {
    updateMeta('og:image', imageUrl, 'property');
    updateMeta('twitter:image', imageUrl);
  }

  function addGameStructuredData({ name, description, pageUrl, imageUrl, genres }) {
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'VideoGame' || data['@graph']?.some(item => item['@type'] === 'VideoGame')) script.remove();
      } catch (error) {
        console.error('Could not inspect existing game structured data:', error);
      }
    });
    const data = {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name,
      description,
      url: pageUrl,
      gamePlatform: 'Web browser',
      genre: genres
    };
    if (imageUrl) data.image = imageUrl;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/legacy-game-page.css';
  document.head.appendChild(stylesheet);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
