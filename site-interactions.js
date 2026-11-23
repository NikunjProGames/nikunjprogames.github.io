(() => {
  const isDesktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const depthBoundElements = new WeakSet();
  const revealBoundElements = new WeakSet();
  let revealObserver = null;

  function elementsWithin(root, selector) {
    const matchesRoot = root instanceof Element && root.matches(selector) ? [root] : [];
    return [...matchesRoot, ...root.querySelectorAll(selector)];
  }

  function addInteractiveTreatment(root = document) {
    elementsWithin(root, [
      'button:not(:disabled)',
      'a[href]',
      '[role="button"]:not([aria-disabled="true"])',
      '[role="tab"]',
      'input:not([type="hidden"]):not(:disabled)',
      'select:not(:disabled)',
      'textarea:not(:disabled)'
    ].join(',')).forEach(element => {
      if (element.closest('.game-shell, .game-viewport, [data-pleyz-game-runtime]')) return;
      element.classList.add('pleyz-interactive');
      if (element.matches('input:not([type="hidden"]), select, textarea')) {
        element.classList.add('pleyz-form-control');
      }
    });
  }

  function initializeDepthTargets(root = document) {
    if (!isDesktopPointer || reducedMotion || document.documentElement.classList.contains('low-power-device')) return;

    const depthTargets = [
      ['.page-shell .related-game', 3],
      ['.game-card', 2],
      ['button:not(:disabled), .btn, .btn-primary, .submit-btn, [role="button"], .nav-actions a, .nav-actions button, .footer-links a, .social-icon, #random-game-button, #pleyz-category-rail a, #pleyz-mobile-bar a', 1.35],
      ['h1, h2, .section-title, .page-title, .hero-title, .mood-discovery-title', .7],
      ['.pleyz-developer-page .right-card, .pleyz-developer-page .step, .pleyz-developer-page .permission', 1.8],
      ['.pleyz-account-page .metric', 1.4],
      ['input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)', .6],
      ['[role="tab"]', 1],
      ['.pleyz-developer-page .logo, .pleyz-account-page .brand, .page-shell .site-brand, #pleyz-site-nav .pleyz-rail-brand, .footer-brand .logo', 1]
    ];

    depthTargets.forEach(([selector, strength]) => {
      elementsWithin(root, selector).forEach(element => {
        if (depthBoundElements.has(element)) return;
        depthBoundElements.add(element);
        element.classList.add('pleyz-depth-target');
        if (element.matches('.page-shell .related-game')) {
          element.classList.add('pleyz-tilt-target');
        } else if (element.matches('button:not(:disabled), .btn, .btn-primary, .submit-btn, [role="button"], .nav-actions a, .nav-actions button, .footer-links a, .social-icon, #random-game-button, #pleyz-category-rail a, #pleyz-mobile-bar a')) {
          element.classList.add('pleyz-pointer-tilt', 'pleyz-3d-control');
        } else if (element.matches('h1, h2, .section-title, .page-title, .hero-title, .mood-discovery-title')) {
          element.classList.add('pleyz-pointer-tilt', 'pleyz-3d-heading');
        } else if (element.matches('.game-card')) {
          element.classList.add('pleyz-3d-card');
        } else if (element.matches('input:not([type="hidden"]), select, textarea')) {
          element.classList.add('pleyz-form-control');
        } else if (element.matches('[role="tab"]')) {
          element.classList.add('pleyz-3d-control');
        } else if (element.matches('.pleyz-developer-page .logo, .pleyz-account-page .brand, .page-shell .site-brand, #pleyz-site-nav .pleyz-rail-brand, .footer-brand .logo')) {
          element.classList.add('pleyz-pointer-tilt', 'pleyz-3d-logo');
        }
        element.addEventListener('pointermove', event => {
          if (event.pointerType !== 'mouse') return;
          const bounds = element.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / Math.max(bounds.width, 1) - .5;
          const y = (event.clientY - bounds.top) / Math.max(bounds.height, 1) - .5;
          element.style.setProperty('--pleyz-depth-x', `${(x * strength).toFixed(2)}px`);
          element.style.setProperty('--pleyz-depth-y', `${(y * strength).toFixed(2)}px`);
          if (element.classList.contains('pleyz-tilt-target')) {
            element.style.setProperty('--pleyz-rotate-x', `${(-y * 4).toFixed(2)}deg`);
            element.style.setProperty('--pleyz-rotate-y', `${(x * 4).toFixed(2)}deg`);
          } else if (element.classList.contains('pleyz-pointer-tilt')) {
            const maxAngle = element.classList.contains('pleyz-3d-heading') ? 1.1 : 2.8;
            const rotateX = -y * maxAngle;
            const rotateY = x * maxAngle;
            const angle = Math.hypot(rotateX, rotateY);
            if (angle > 0.01) {
              element.style.setProperty('--pleyz-tilt-axis', `${(rotateX / angle).toFixed(3)} ${(rotateY / angle).toFixed(3)} 0`);
              element.style.setProperty('--pleyz-tilt-angle', `${angle.toFixed(2)}deg`);
            }
          }
        }, { passive: true });
        element.addEventListener('pointerleave', () => {
          element.style.removeProperty('--pleyz-depth-x');
          element.style.removeProperty('--pleyz-depth-y');
          element.style.removeProperty('--pleyz-rotate-x');
          element.style.removeProperty('--pleyz-rotate-y');
          element.style.removeProperty('--pleyz-tilt-axis');
          element.style.removeProperty('--pleyz-tilt-angle');
        }, { passive: true });
      });
    });
  }

  function initializeReveals(root = document) {
    if (!('IntersectionObserver' in window) || reducedMotion || window.matchMedia('(max-width: 768px)').matches) return;
    if (!revealObserver) revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -7% 0px', threshold: .08 });
    const targets = elementsWithin(root,
      '.page-shell .game-layout, .page-shell .info-card, .page-shell .site-footer, .pleyz-developer-page .hero-content, .pleyz-developer-page > section'
    );
    if (!targets.length) return;
    targets.forEach(element => {
      if (revealBoundElements.has(element) || element.closest('[hidden]')) return;
      revealBoundElements.add(element);
      element.classList.add('pleyz-reveal');
      revealObserver.observe(element);
    });
  }

  function initialize() {
    addInteractiveTreatment();
    initializeDepthTargets();
    initializeReveals();

    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        addInteractiveTreatment(node);
        initializeDepthTargets(node);
        initializeReveals(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
