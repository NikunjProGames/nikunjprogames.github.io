(() => {
  const revealSelector = '.scroll-reveal, .pleyz-reveal';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowPower = document.documentElement.classList.contains('low-power-device');
  const motionEnabled = !reducedMotion && !lowPower;
  const observed = new WeakSet();
  const pendingReveals = new Set();
  let gsap = null;
  let revealObserver = null;
  let titleObserver = null;
  let revealFallbackTimer = 0;

  function markVisible(element) {
    element.classList.add('is-visible');
  }

  function reveal(element) {
    if (!gsap) {
      pendingReveals.add(element);
      if (!revealFallbackTimer) {
        revealFallbackTimer = window.setTimeout(() => {
          pendingReveals.forEach(markVisible);
          pendingReveals.clear();
          revealFallbackTimer = 0;
        }, 1200);
      }
      return;
    }

    gsap.fromTo(element,
      { autoAlpha: 0, y: 18 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.62,
        ease: 'power2.out',
        overwrite: 'auto',
        onComplete() {
          markVisible(element);
          gsap.set(element, { clearProps: 'opacity,visibility,transform' });
        }
      });
  }

  function observeReveal(element) {
    if (!(element instanceof Element) || !element.matches(revealSelector)) return;
    if (observed.has(element) || element.classList.contains('is-visible')) return;
    observed.add(element);
    if (!motionEnabled || !revealObserver) {
      markVisible(element);
    } else {
      revealObserver.observe(element);
    }
  }

  function observeReveals(root = document) {
    const rootMatch = root instanceof Element && root.matches(revealSelector) ? [root] : [];
    [...rootMatch, ...root.querySelectorAll(revealSelector)].forEach(observeReveal);
  }

  function splitIntoCharacters(element) {
    const label = element.textContent.trim();
    if (!label) return [];

    element.setAttribute('aria-label', label);
    const characters = Array.from(label, character => {
      const span = document.createElement('span');
      span.className = 'pleyz-title-character';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = character === ' ' ? '\u00a0' : character;
      return span;
    });
    element.replaceChildren(...characters);
    return characters;
  }

  function animateTitle(title) {
    if (title.matches('#trending .trending-intro .section-title')) {
      const characters = splitIntoCharacters(title);
      if (!characters.length) return;
      gsap.fromTo(characters,
        { autoAlpha: 0, y: 14, rotateX: -65 },
        {
          autoAlpha: 1,
          y: 0,
          rotateX: 0,
          duration: 0.42,
          stagger: 0.045,
          ease: 'power2.out',
          onComplete() {
            gsap.set(characters, { clearProps: 'opacity,visibility,transform' });
          }
        });
      return;
    }

    gsap.fromTo(title,
      { autoAlpha: 0, x: -56 },
      {
        autoAlpha: 1,
        x: 0,
        duration: 0.72,
        ease: 'power3.out',
        onComplete() {
          gsap.set(title, { clearProps: 'opacity,visibility,transform' });
        }
      });
  }

  function initializeTitleAnimations() {
    const titles = document.querySelectorAll('.section-title, #about-heading');
    if (!titles.length) return;

    if (!('IntersectionObserver' in window)) {
      titles.forEach(animateTitle);
      return;
    }

    titleObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        titleObserver.unobserve(entry.target);
        animateTitle(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });

    titles.forEach(title => titleObserver.observe(title));
  }

  if ('IntersectionObserver' in window && motionEnabled) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        revealObserver.unobserve(entry.target);
        reveal(entry.target);
      });
    }, { rootMargin: '0px 0px -7% 0px', threshold: 0.08 });
  }

  observeReveals();
  if ('MutationObserver' in window) {
    const discoveryObserver = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'attributes') observeReveal(record.target);
        else record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) observeReveals(node);
        });
      });
    });
    discoveryObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });
  }

  if (!motionEnabled || (!revealObserver && !document.querySelector('.section-title, #about-heading'))) return;

  async function loadGsap() {
    try {
      const module = await import('https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm');
      gsap = module.gsap || module.default?.gsap || module.default;
      if (typeof gsap?.fromTo !== 'function') {
        throw new Error('GSAP loaded without its core animation API.');
      }
      document.documentElement.classList.add('pleyz-gsap-active');
      initializeTitleAnimations();
      pendingReveals.forEach(reveal);
      pendingReveals.clear();
      window.clearTimeout(revealFallbackTimer);
      revealFallbackTimer = 0;
    } catch (error) {
      console.warn('GSAP scroll effects are unavailable; native reveals remain active.', error);
      pendingReveals.forEach(markVisible);
      pendingReveals.clear();
      window.clearTimeout(revealFallbackTimer);
      revealFallbackTimer = 0;
    }
  }

  void loadGsap();
})();
