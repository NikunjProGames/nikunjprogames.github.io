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
  const startHeartbeat = async () => {
    try {
      const [appModule, authModule, functionsModule] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/12.17.1/firebase-functions.js')
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

      const functions = functionsModule.getFunctions(app, 'asia-southeast1');
      const startSession = functionsModule.httpsCallable(functions, 'startGameplaySession');
      const sendHeartbeat = functionsModule.httpsCallable(functions, 'gameplayHeartbeat');
      const username = localStorage.getItem('nikunj_current_username')
        || auth.currentUser.displayName
        || auth.currentUser.email?.split('@')[0]
        || 'Player';
      const gameId = location.pathname.slice(0, 180);
      const start = async () => (await startSession({ username, gameId })).data.sessionId;
      let sessionId = await start();
      let pending = false;

      const ping = async () => {
        if (pending || document.visibilityState !== 'visible' || !auth.currentUser) return;
        pending = true;
        try {
          await sendHeartbeat({ sessionId });
        } catch (error) {
          if (error.code === 'functions/failed-precondition') {
            try { sessionId = await start(); } catch (restartError) {
              console.warn('PleyZ gameplay session could not restart:', restartError);
            }
          } else {
            console.warn('PleyZ gameplay heartbeat failed:', error);
          }
        } finally {
          pending = false;
        }
      };

      const interval = window.setInterval(ping, 30000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') ping();
      });
      window.addEventListener('pagehide', () => window.clearInterval(interval), { once: true });
    } catch (error) {
      console.warn('PleyZ gameplay rewards are unavailable:', error);
    }
  };

  let started = false;
  const startOnce = () => {
    if (started) return;
    started = true;
    startHeartbeat();
  };
  const frame = document.querySelector('.game-frame iframe, iframe[src]');
  frame?.addEventListener('load', startOnce, { once: true });
  window.addEventListener('load', startOnce, { once: true });
  window.setTimeout(startOnce, 12000);
})();