(() => {
  if (!document.body || document.getElementById('game-opening-status')) return;

  const style = document.createElement('style');
  style.textContent = `
    .game-opening-status { position: fixed; z-index: 2147483000; left: 50%; bottom: 24px; display: inline-flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid rgba(0,191,255,.42); border-radius: 8px; background: rgba(8,10,18,.94); color: #f5f7fb; font: 700 15px Rajdhani, sans-serif; box-shadow: 0 8px 28px rgba(0,0,0,.38); pointer-events: none; opacity: 1; transform: translate(-50%, 0); transition: opacity .18s ease, transform .18s ease; }
    .game-opening-status.is-hidden { opacity: 0; transform: translate(-50%, 8px); }
    .game-opening-spinner { width: 16px; height: 16px; flex: 0 0 16px; border: 2px solid rgba(255,255,255,.24); border-top-color: #00bfff; border-radius: 50%; animation: game-opening-spin .7s linear infinite; }
    @keyframes game-opening-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .game-opening-spinner { animation-duration: 1.5s; } }
  `;
  document.head.appendChild(style);

  const status = document.createElement('div');
  status.className = 'game-opening-status';
  status.id = 'game-opening-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.innerHTML = '<span class="game-opening-spinner" aria-hidden="true"></span><span>Opening game...</span>';
  document.body.appendChild(status);

  const minimumVisibleMs = 700;
  const startedAt = performance.now();
  let dismissScheduled = false;
  let dismissed = false;
  const dismiss = () => {
    if (dismissScheduled) return;
    dismissScheduled = true;
    const remaining = Math.max(0, minimumVisibleMs - (performance.now() - startedAt));
    window.setTimeout(() => {
      if (dismissed) return;
      dismissed = true;
      status.classList.add('is-hidden');
      window.setTimeout(() => status.remove(), 220);
    }, remaining);
  };

  const gameFrame = document.querySelector('.game-frame iframe') || document.querySelector('iframe[src]');
  gameFrame?.addEventListener('load', dismiss, { once: true });
  if (document.readyState === 'complete') window.setTimeout(dismiss, 300);
  else window.addEventListener('load', dismiss, { once: true });
  window.setTimeout(dismiss, 12000);
})();

(() => {
  const feedbackTags = [
    ['fun', 'Fun'],
    ['challenging', 'Challenging'],
    ['easy-controls', 'Easy controls'],
    ['great-design', 'Great design'],
    ['good-for-short-sessions', 'Good for short sessions'],
    ['too-difficult', 'Too difficult'],
    ['bugs', 'Bugs'],
    ['slow', 'Slow'],
    ['not-for-me', 'Not for me']
  ];

  function createFeedbackPopup(user, gameId) {
    const style = document.createElement('style');
    style.textContent = `
      .pleyz-feedback-dialog { width:min(460px,calc(100vw - 24px)); max-height:90vh; padding:0; border:1px solid rgba(40,185,255,.45); border-radius:12px; background:#0b1125; color:#edf4ff; box-shadow:0 24px 80px #0009; font:16px Rajdhani,sans-serif; }
      .pleyz-feedback-dialog::backdrop { background:#030611c9; backdrop-filter:blur(3px); }
      .pleyz-feedback-form { display:grid; gap:12px; padding:20px; overflow:auto; }
      .pleyz-feedback-form h2 { margin:0; font:700 1.25rem Orbitron,sans-serif; }
      .pleyz-feedback-form p { margin:0; color:#9eabc3; }
      .pleyz-feedback-form button { border:1px solid #ffffff24; border-radius:7px; padding:7px 10px; background:#101a35; color:#edf4ff; font:inherit; }
      .pleyz-feedback-form button[aria-pressed=true] { border-color:#28b9ff; color:#28b9ff; }
      .pleyz-feedback-stars,.pleyz-feedback-tags,.pleyz-feedback-reaction { display:flex; flex-wrap:wrap; gap:6px; }
      .pleyz-feedback-tags button { font-size:.9rem; }
      .pleyz-feedback-form textarea { min-height:76px; resize:vertical; border:1px solid #ffffff24; border-radius:7px; padding:9px; background:#070d1e; color:#edf4ff; font:inherit; }
      .pleyz-feedback-form [data-feedback-status] { min-height:1.2em; }
      .pleyz-feedback-submit { background:#28b9ff!important; color:#00111a!important; font-weight:700!important; }
      .pleyz-feedback-close { justify-self:end; }
      @media(max-width:480px) { .pleyz-feedback-form { padding:16px; } }
    `;
    document.head.appendChild(style);

    const dialog = document.createElement('dialog');
    dialog.className = 'pleyz-feedback-dialog';
    dialog.setAttribute('aria-labelledby', 'pleyz-feedback-title');
    dialog.innerHTML = `
      <form class="pleyz-feedback-form">
        <button class="pleyz-feedback-close" type="button" data-close aria-label="Close feedback">Close</button>
        <h2 id="pleyz-feedback-title">How was this game?</h2>
        <div><p>Rate it from 1 to 5</p><div class="pleyz-feedback-stars" role="group" aria-label="Game rating"></div></div>
        <div><p>What stood out?</p><div class="pleyz-feedback-tags"></div></div>
        <label>Optional note<textarea name="feedback" maxlength="1000" placeholder="Anything we should know?"></textarea></label>
        <div><p>Would you recommend playing it?</p><div class="pleyz-feedback-reaction"><button type="button" data-interaction="like" aria-pressed="false">Like</button><button type="button" data-interaction="dislike" aria-pressed="false">Dislike</button></div></div>
        <p>Your feedback helps improve PleyZ game picks.</p>
        <p data-feedback-status role="status"></p>
        <button class="pleyz-feedback-submit" type="submit">Send feedback</button>
      </form>`;
    document.body.appendChild(dialog);

    let rating = 0;
    const status = dialog.querySelector('[data-feedback-status]');
    const starRow = dialog.querySelector('.pleyz-feedback-stars');
    for (let value = 1; value <= 5; value += 1) {
      const star = document.createElement('button');
      star.type = 'button';
      star.textContent = '★';
      star.setAttribute('aria-label', `${value} star${value === 1 ? '' : 's'}`);
      star.setAttribute('aria-pressed', 'false');
      star.addEventListener('click', () => {
        rating = value;
        starRow.querySelectorAll('button').forEach((item, index) => item.setAttribute('aria-pressed', String(index < value)));
      });
      starRow.appendChild(star);
    }

    const selectedTags = new Set();
    const tagRow = dialog.querySelector('.pleyz-feedback-tags');
    feedbackTags.forEach(([tag, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        if (selectedTags.has(tag)) selectedTags.delete(tag);
        else if (selectedTags.size < 5) selectedTags.add(tag);
        button.setAttribute('aria-pressed', String(selectedTags.has(tag)));
      });
      tagRow.appendChild(button);
    });

    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.querySelectorAll('[data-interaction]').forEach(button => {
      button.addEventListener('click', async () => {
        try {
          const { sendPleyzFeedback } = await import('/feedback-client.js');
          await sendPleyzFeedback(user, 'interactions', gameId, {
            interaction: button.dataset.interaction
          });
          dialog.querySelectorAll('[data-interaction]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
          status.textContent = 'Game reaction saved.';
        } catch (error) {
          status.textContent = error.message || 'Could not save your reaction.';
        }
      });
    });
    dialog.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      if (!rating) {
        status.textContent = 'Choose a star rating first.';
        return;
      }
      const submit = dialog.querySelector('.pleyz-feedback-submit');
      submit.disabled = true;
      status.textContent = 'Sending feedback...';
      try {
        const { sendPleyzFeedback } = await import('/feedback-client.js');
        await sendPleyzFeedback(user, 'games', gameId, {
          rating,
          tags: [...selectedTags],
          text: dialog.querySelector('textarea').value
        });
        status.textContent = 'Thanks! Your feedback is saved.';
      } catch (error) {
        status.textContent = error.message || 'Could not save your feedback.';
      } finally {
        submit.disabled = false;
      }
    });

    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.textContent = 'Game feedback';
    launcher.setAttribute('aria-label', 'Open game feedback');
    launcher.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483001;border:1px solid #28b9ff;border-radius:7px;padding:9px 12px;background:#0b1125;color:#edf4ff;font:600 15px Rajdhani,sans-serif;';
    launcher.hidden = true;
    launcher.addEventListener('click', () => dialog.showModal());
    document.body.appendChild(launcher);
    window.setTimeout(() => {
      launcher.hidden = false;
      dialog.showModal();
    }, 5 * 60 * 1000 + 5000);
  }

  const startFeedback = async () => {
    try {
      const [appModule, authModule] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js')
      ]);
      const { getApp, getApps, initializeApp } = appModule;
      const app = getApps().length ? getApp() : initializeApp({
        apiKey: 'AIzaSyAZeHHIF2uOS-K5s6kZEffx-itN6xyxFk8',
        authDomain: 'pleyz-dd9f8.firebaseapp.com',
        projectId: 'pleyz-dd9f8',
        storageBucket: 'pleyz-dd9f8.firebasestorage.app',
        messagingSenderId: '386766168723',
        appId: '1:386766168723:web:bffbdec0ad82394f64a366',
        measurementId: 'G-HT57V3EZPP'
      });
      const auth = authModule.getAuth(app);
      await auth.authStateReady();
      if (!auth.currentUser) return;

      const firestoreModule = await import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js');
      window.firebaseDb = firestoreModule.getFirestore(app);
      let gameId = location.pathname.replace(/^\/+|\/+$/g, '') || 'game';
      gameId = gameId.split('/').pop();
      try {
        const activeGame = JSON.parse(sessionStorage.getItem('pleyz_active_game') || 'null');
        if (activeGame && activeGame.path === location.pathname) gameId = String(activeGame.id);
      } catch (_) {}
      createFeedbackPopup(auth.currentUser, gameId);
      const username = localStorage.getItem('nikunj_current_username')
        || auth.currentUser.displayName
        || auth.currentUser.email?.split('@')[0]
        || 'Player';
      const userRef = firestoreModule.doc(window.firebaseDb, 'users', auth.currentUser.uid);
      const leaderboardRef = firestoreModule.doc(window.firebaseDb, 'leaderboard', auth.currentUser.uid);
      await firestoreModule.runTransaction(window.firebaseDb, async transaction => {
        const [userSnapshot, leaderboardSnapshot] = await Promise.all([
          transaction.get(userRef),
          transaction.get(leaderboardRef)
        ]);
        const profile = userSnapshot.data() || {};
        const leaderboard = leaderboardSnapshot.data() || {};
        const score = Math.max(
          Number(profile.pleyzScore) || 0,
          Number(leaderboard.pleyzScore) || 0
        ) + 1;
        const gamesPlayed = Math.max(
          Number(profile.gamesPlayed) || 0,
          Number(leaderboard.gamesPlayed) || 0
        ) + 1;
        const savedUsername = String(profile.username || leaderboard.username || username).trim().slice(0, 40) || 'Player';
        const now = firestoreModule.serverTimestamp();

        transaction.set(userRef, {
          email: auth.currentUser.email || profile.email || '',
          username: savedUsername,
          createdAt: profile.createdAt || now,
          pleyzScore: score,
          gamesPlayed,
          lastPlayed: now
        });
        transaction.set(leaderboardRef, {
          uid: auth.currentUser.uid,
          username: savedUsername,
          pleyzScore: score,
          gamesPlayed,
          updatedAt: now
        });
      });
    } catch (error) {
      console.warn('PleyZ game feedback or score update is unavailable:', error);
    }
  };

  let started = false;
  const startOnce = () => {
    if (started) return;
    started = true;
    startFeedback();
  };
  const frame = document.querySelector('.game-frame iframe, iframe[src]');
  frame?.addEventListener('load', startOnce, { once: true });
  window.addEventListener('load', startOnce, { once: true });
  window.setTimeout(startOnce, 12000);
})();