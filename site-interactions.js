(() => {
  const desktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowPower = document.documentElement.classList.contains('low-power-device');
  const pointerBound = new WeakSet();
  const interactiveSelector = [
    'button:not(:disabled)',
    'a[href]',
    '[role="button"]:not([aria-disabled="true"])',
    '[role="tab"]',
    'input:not([type="hidden"]):not(:disabled)',
    'select:not(:disabled)',
    'textarea:not(:disabled)'
  ].join(',');
  const retroButtonSelector = [
    'button:not(:disabled):not(.game-card)',
    'button.submit-gate-button',
    'a.btn[href]',
    'a.cta[href]',
    '.recommendation-mode',
    '.btn-primary',
    '.submit-btn',
    '.nav-actions a[href]',
    '.nav-actions button:not(:disabled)',
    '.footer-links a[href]',
    '.social-icon',
    '.category-jump',
    '.category-links a[href]',
    '.category-directory a[href]',
    '.related-categories a[href]',
    '#random-game-button'
  ].join(',');
  const cardTiltSelector = [
    '.page-shell .related-game',
    'body.pleyz-legacy-game-page #pleyz-standard-game .related-game',
    '.game-card'
  ].join(',');
  const revealSelector = [
    '.page-shell .game-layout',
    '.page-shell .info-card',
    '.page-shell .site-footer',
    '.pleyz-developer-page .hero-content',
    '.pleyz-developer-page > section'
  ].join(',');

  function elementsWithin(root, selector) {
    const rootMatch = root instanceof Element && root.matches(selector) ? [root] : [];
    return [...rootMatch, ...root.querySelectorAll(selector)];
  }

  function addInteractiveTreatment(root = document) {
    elementsWithin(root, interactiveSelector).forEach(element => {
      if (element.closest('.game-shell, .game-viewport, [data-pleyz-game-runtime], .recent-panel')) return;
      element.classList.add('pleyz-interactive');
      if (element.matches('input:not([type="hidden"]), select, textarea')) {
        element.classList.add('pleyz-form-control');
      }
    });

    elementsWithin(root, retroButtonSelector).forEach(element => {
      if (element.closest('.game-shell, .game-viewport, [data-pleyz-game-runtime], .recent-panel')) return;
      element.classList.add('pleyz-retro-button');
    });
  }

  function bindPointerEffect(element, kind) {
    if (pointerBound.has(element)) return;
    pointerBound.add(element);
    element.classList.add(kind);
    element.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      const bounds = element.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5;
      const y = (event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5;

      if (kind === 'pleyz-reactive-text') {
        element.style.setProperty('--pleyz-text-glow-x', `${(x * 5).toFixed(1)}px`);
        element.style.setProperty('--pleyz-text-glow-y', `${(y * 5).toFixed(1)}px`);
        element.style.setProperty('--pleyz-text-glow', `${(0.16 + (1 - Math.hypot(x, y)) * 0.18).toFixed(2)}`);
        if (element.classList.contains('pleyz-title-tilt')) {
          element.style.setProperty('--pleyz-tilt-x', `${(-y * 8).toFixed(2)}deg`);
          element.style.setProperty('--pleyz-tilt-y', `${(x * 8).toFixed(2)}deg`);
        }
        return;
      }

      const maxTilt = kind === 'pleyz-card-tilt' ? 10 : 4.5;
      const tiltX = `${(-y * maxTilt).toFixed(2)}deg`;
      const tiltY = `${(x * maxTilt).toFixed(2)}deg`;
      if (element.matches('.game-card')) {
        element.style.setProperty('--tilt-x', tiltX);
        element.style.setProperty('--tilt-y', tiltY);
      } else {
        element.style.setProperty('--pleyz-tilt-x', tiltX);
        element.style.setProperty('--pleyz-tilt-y', tiltY);
      }
      if (kind === 'pleyz-button-tilt') {
        element.style.setProperty('--pleyz-depth-x', `${(x * 1.4).toFixed(2)}px`);
        element.style.setProperty('--pleyz-depth-y', `${(y * 1.4).toFixed(2)}px`);
      }
    }, { passive: true });

    element.addEventListener('pointerleave', () => {
      element.style.removeProperty('--pleyz-tilt-x');
      element.style.removeProperty('--pleyz-tilt-y');
      element.style.removeProperty('--tilt-x');
      element.style.removeProperty('--tilt-y');
      element.style.removeProperty('--pleyz-depth-x');
      element.style.removeProperty('--pleyz-depth-y');
      element.style.removeProperty('--pleyz-text-glow-x');
      element.style.removeProperty('--pleyz-text-glow-y');
      element.style.removeProperty('--pleyz-text-glow');
    }, { passive: true });
  }

  function initializePointerEffects(root = document) {
    if (!desktopPointer || reducedMotion || lowPower) return;

    elementsWithin(root, [
      '.pleyz-retro-button',
      cardTiltSelector,
      'h1',
      'h2.section-title',
      '.page-title',
      '.hero-title',
      '.mood-discovery-title',
      '.pleyz-developer-page .logo',
      '.pleyz-account-page .brand',
      '#about-heading'
    ].join(',')).forEach(element => {
      if (element.closest('.recent-panel, #pleyz-category-rail')) return;
      if (element.matches(cardTiltSelector)) {
        if (element.matches('.game-card') && element.closest('#games-grid, #recommended-grid, #popular-country-grid')) return;
        bindPointerEffect(element, 'pleyz-card-tilt');
      } else if (element.matches('.pleyz-retro-button')) {
        bindPointerEffect(element, 'pleyz-button-tilt');
      } else {
        bindPointerEffect(element, 'pleyz-reactive-text');
        if (element.matches('h1, h2.section-title, .page-title, .hero-title, .mood-discovery-title, #about-heading')) {
          element.classList.add('pleyz-title-tilt');
        }
      }
    });
  }

  function initializeReveals(root = document) {
    elementsWithin(root, revealSelector).forEach(element => {
      if (element.matches('.page-shell .game-layout') && element.querySelector('.game-frame:not(.native-game-frame)')) return;
      if (!element.closest('[hidden]')) element.classList.add('pleyz-reveal');
    });
  }

  function initialize() {
    addInteractiveTreatment();
    initializePointerEffects();
    initializeReveals();

    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'attributes') {
          addInteractiveTreatment(record.target);
          initializePointerEffects(record.target);
          initializeReveals(record.target);
          return;
        }
        record.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          addInteractiveTreatment(node);
          initializePointerEffects(node);
          initializeReveals(node);
        });
      });
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['disabled'],
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
