(() => {
  const imageSelector = '.game-card img, .game-item img, .game-cover img, .trending-thumb img, .related-game-media img';
  const saveData = navigator.connection?.saveData === true;
  const imageObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const image = entry.target;
        image.loading = 'eager';
        if (!saveData) image.fetchPriority = 'high';
        imageObserver.unobserve(image);
      });
    }, { rootMargin: saveData ? '180px 0px' : '720px 0px' })
    : null;

  function createFallbackUrl(image) {
    const source = image.alt || image.closest('a')?.textContent || 'PleyZ game';
    const initials = source.trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map(word => word.replace(/[^a-z0-9]/gi, '').slice(0, 1).toUpperCase()).join('') || 'PZ';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 336"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#155e75"/><stop offset="1" stop-color="#312e81"/></linearGradient></defs><rect width="448" height="336" rx="18" fill="url(#g)"/><circle cx="224" cy="168" r="100" fill="#ffffff" fill-opacity=".08"/><text x="224" y="195" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="84" font-weight="700">${initials}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function replaceFailedImage(image) {
    if (image.dataset.pleyzFallback === 'true') return;
    image.dataset.pleyzFallback = 'true';
    image.removeAttribute('srcset');
    image.src = createFallbackUrl(image);
  }

  function prepareImage(image) {
    if (!(image instanceof HTMLImageElement) || !image.matches(imageSelector)) return;
    image.decoding = 'async';
    if (image.complete && image.naturalWidth === 0) replaceFailedImage(image);
    if (imageObserver && !image.complete) imageObserver.observe(image);
    image.addEventListener('error', () => replaceFailedImage(image), { once: true });
  }

  function prepareImages(root) {
    if (root instanceof HTMLImageElement) prepareImage(root);
    root.querySelectorAll?.(imageSelector).forEach(prepareImage);
  }

  prepareImages(document);
  if ('MutationObserver' in window) {
    const imageMutationObserver = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) prepareImages(node);
      }));
    });
    imageMutationObserver.observe(document.body, { childList: true, subtree: true });
  }
})();