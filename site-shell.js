(() => {
  if (!document.body || document.getElementById('pleyz-site-nav')) return;

  const categories = [
    ['Action', '/action-games/'],
    ['Adventure', '/adventure-games/'],
    ['Arcade', '/arcade-games/'],
    ['Casual', '/casual-games/'],
    ['Horror', '/scary-games/'],
    ['Multiplayer', '/multiplayer-games/'],
    ['Puzzle', '/puzzle-games/'],
    ['Racing', '/racing-games/'],
    ['Simulation', '/simulation-games/'],
    ['Sports', '/sports-games/'],
    ['Strategy', '/strategy-games/'],
    ['Skill', '/skill-games/']
  ];

  const shell = document.createElement('div');
  shell.id = 'pleyz-site-nav';
  shell.innerHTML = `
    <style>
      #pleyz-site-nav { --nav-bg: #0b0d16; --nav-panel: #111522; --nav-border: rgba(139,0,255,.3); --nav-text: #e8e8ff; --nav-muted: #a5a9c0; --nav-cyan: #00bfff; --nav-purple: #8b00ff; }
      #pleyz-mobile-bar { display: none; }
      #pleyz-category-rail { position: fixed; z-index: 1400; inset: 12px auto 12px 12px; display: flex; flex-direction: column; width: 204px; overflow: hidden; border: 1px solid var(--nav-border); border-radius: 10px; background: rgba(8,10,18,.96); color: var(--nav-text); box-shadow: 0 16px 44px rgba(0,0,0,.4); font-family: 'Rajdhani', sans-serif; }
      #pleyz-category-rail .pleyz-rail-brand { padding: 17px 15px 13px; border-bottom: 1px solid rgba(255,255,255,.08); color: var(--nav-text); font: 900 1.05rem 'Orbitron', sans-serif; text-decoration: none; }
      #pleyz-category-rail .pleyz-rail-heading { padding: 14px 15px 7px; color: var(--nav-muted); font: 700 .64rem 'Orbitron', sans-serif; text-transform: uppercase; }
      #pleyz-category-rail nav { display: grid; gap: 2px; padding: 0 8px 10px; overflow: auto; }
      #pleyz-category-rail a.pleyz-category-link { display: flex; align-items: center; min-height: 36px; padding: 7px 9px; border-radius: 6px; color: var(--nav-muted); font-size: .92rem; font-weight: 700; text-decoration: none; transition: color .15s ease, background .15s ease; }
      #pleyz-category-rail a.pleyz-category-link:hover, #pleyz-category-rail a.pleyz-category-link:focus-visible { background: rgba(139,0,255,.12); color: #fff; outline: 1px solid var(--nav-cyan); outline-offset: -1px; }
      #pleyz-nav-backdrop { display: none; }
      body.pleyz-site-shell-active { padding-left: 232px !important; }
      body.pleyz-immersive-game .game-header { left: 232px; width: calc(100% - 232px); }
      body.pleyz-immersive-game .game-viewport { width: calc(100vw - 232px); }
      @media (max-width: 900px) {
        body.pleyz-site-shell-active { padding: 68px 0 0 !important; }
        body.pleyz-immersive-game { padding: 58px 0 0 !important; }
        #pleyz-mobile-bar { position: fixed; z-index: 1402; inset: 0 0 auto; display: flex; align-items: center; justify-content: space-between; height: 58px; padding: 0 14px; border-bottom: 1px solid var(--nav-border); background: rgba(8,10,18,.97); color: var(--nav-text); font-family: 'Rajdhani', sans-serif; }
        #pleyz-mobile-bar a { color: inherit; font: 900 .95rem 'Orbitron', sans-serif; text-decoration: none; }
        #pleyz-nav-toggle { display: inline-flex; align-items: center; gap: 9px; min-height: 40px; padding: 0 12px; border: 1px solid rgba(0,191,255,.4); border-radius: 7px; background: rgba(0,191,255,.08); color: var(--nav-text); font: 700 .9rem 'Rajdhani', sans-serif; cursor: pointer; }
        #pleyz-nav-toggle:focus-visible { outline: 2px solid var(--nav-cyan); outline-offset: 2px; }
        .pleyz-menu-icon, .pleyz-menu-icon::before, .pleyz-menu-icon::after { display: block; width: 15px; height: 2px; border-radius: 2px; background: var(--nav-cyan); }
        .pleyz-menu-icon { position: relative; }
        .pleyz-menu-icon::before, .pleyz-menu-icon::after { position: absolute; left: 0; content: ''; }
        .pleyz-menu-icon::before { top: -5px; }
        .pleyz-menu-icon::after { top: 5px; }
        #pleyz-category-rail { z-index: 1404; top: 58px; right: auto; bottom: 0; left: 0; width: min(300px, 86vw); border-width: 0 1px 0 0; border-radius: 0; transform: translateX(-102%); transition: transform .2s ease; }
        body.pleyz-immersive-game .game-header { top: 58px; left: 0; width: 100%; }
        body.pleyz-immersive-game .game-viewport { width: 100vw; height: calc(100dvh - 58px); }
        body.pleyz-nav-open #pleyz-category-rail { transform: translateX(0); }
        #pleyz-nav-backdrop { position: fixed; z-index: 1403; inset: 58px 0 0; display: block; background: rgba(0,0,0,.6); opacity: 0; visibility: hidden; transition: opacity .2s ease, visibility .2s ease; }
        body.pleyz-nav-open #pleyz-nav-backdrop { opacity: 1; visibility: visible; }
      }
      @media (prefers-reduced-motion: reduce) { #pleyz-category-rail, #pleyz-nav-backdrop { transition: none; } }
    </style>
    <div id="pleyz-mobile-bar"><a href="/">PleyZ</a><button id="pleyz-nav-toggle" type="button" aria-expanded="false" aria-controls="pleyz-category-rail"><span class="pleyz-menu-icon" aria-hidden="true"></span>Browse categories</button></div>
    <aside id="pleyz-category-rail" aria-label="PleyZ navigation">
      <a class="pleyz-rail-brand" href="/">PleyZ Games</a>
      <span class="pleyz-rail-heading">Browse categories</span>
      <nav aria-label="Game categories"></nav>
    </aside>
    <div id="pleyz-nav-backdrop" aria-hidden="true"></div>
  `;
  document.body.prepend(shell);
  document.body.classList.add('pleyz-site-shell-active');
  document.body.classList.toggle('pleyz-immersive-game', Boolean(document.querySelector('.game-viewport')));

  const categoryNav = shell.querySelector('#pleyz-category-rail nav');
  categories.forEach(([label, slug]) => {
    const link = document.createElement('a');
    link.className = 'pleyz-category-link';
    link.href = slug;
    link.textContent = label;
    categoryNav.appendChild(link);
  });

  const toggle = shell.querySelector('#pleyz-nav-toggle');
  const backdrop = shell.querySelector('#pleyz-nav-backdrop');
  const setOpen = open => {
    document.body.classList.toggle('pleyz-nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  backdrop.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setOpen(false);
  });
  categoryNav.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false);
  });
})();
