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