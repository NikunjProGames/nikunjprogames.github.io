(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const lowPower = document.documentElement.classList.contains('low-power-device');
  const desktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const targetSelector = [
    'header a[href]:not(.logo):not(.brand):not(.site-brand)',
    'header button:not(.mobile-nav-item):not(:disabled)',
    '#pleyz-category-rail a.pleyz-category-link',
    '#recommendations .recommendation-mode',
    '#recommendations .mood-option',
    '.category-directory a[href]',
    '.category-jump',
    '.category-links a[href]',
    '.related-categories a[href]',
    '.game-action-bar [data-fullscreen]',
    '.game-toolbar .btn',
    '.game-preferences button',
    '#random-game-button'
  ].join(',');
  const materialColors = {
    blue: { idle: 0x347caf, selected: 0x6bbbe7 },
    purple: { idle: 0x66527f, selected: 0x9d7fc3 },
    neutral: { idle: 0x626671, selected: 0x9c9eaa },
    frame: { idle: 0x6955a1, selected: 0x8778bd }
  };
  let instance = null;
  let initializationToken = 0;

  async function initialize() {
    if (instance || !document.body) return;
    const token = ++initializationToken;
    let renderer = null;
    let scene = null;
    let controller = null;
    let resizeObserver = null;
    let mutationObserver = null;
    let frameId = 0;
    let layoutDirty = true;
    let renderDirty = true;
    let records = [];
    let geometryCache = new Map();
    let frontMaterial = null;
    const materials = new Map();
    let canvas = null;
    let gsapObserver = null;
    let gsapInstance = null;

    function releaseGeometry(key) {
      const cached = geometryCache.get(key);
      if (!cached) return;
      cached.references -= 1;
      if (cached.references === 0) {
        cached.geometry.dispose();
        geometryCache.delete(key);
      }
    }

    function releaseRecordGeometry(record) {
      if (record.geometryKey) releaseGeometry(record.geometryKey);
      else record.mesh.geometry.dispose();
      record.geometryKey = '';
    }

    try {
      const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
      if (token !== initializationToken || !document.body) return;

      scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(0, innerWidth, innerHeight, 0, 0.1, 2000);
      camera.position.z = 900;
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight(0xe4efff, 0x11131b, 1.5));
      const keyLight = new THREE.DirectionalLight(0xf4f7ff, 2.2);
      keyLight.position.set(-180, 280, 420);
      scene.add(keyLight);

      const cursorLight = new THREE.PointLight(0x82dfff, 0, 420, 2);
      scene.add(cursorLight);

      frontMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.08,
        depthWrite: false
      });
      Object.entries(materialColors).forEach(([key, colors]) => {
        materials.set(`${key}:idle`, new THREE.MeshStandardMaterial({
          color: colors.idle,
          emissive: colors.idle,
          emissiveIntensity: 0.05,
          metalness: 0.48,
          roughness: 0.3
        }));
        materials.set(`${key}:selected`, new THREE.MeshStandardMaterial({
          color: colors.selected,
          emissive: colors.selected,
          emissiveIntensity: 0.16,
          metalness: 0.5,
          roughness: 0.26
        }));
      });

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !lowPower && !coarsePointer,
        powerPreference: 'low-power',
        stencil: false
      });
      canvas = renderer.domElement;
      canvas.className = 'pleyz-3d-scene';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.tabIndex = -1;
      Object.assign(canvas.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '1405',
        display: 'block',
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none'
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1 : lowPower ? 1.15 : 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;
      document.body.appendChild(canvas);

      controller = new AbortController();
      const materialFor = record => {
        const key = `${record.palette}:${record.selected ? 'selected' : 'idle'}`;
        const sideMaterial = materials.get(key);
        return [frontMaterial, sideMaterial];
      };

      function acquireGeometry(width, height, radius, depth) {
        const key = `${width.toFixed(1)}:${height.toFixed(1)}:${radius.toFixed(1)}:${depth}`;
        let cached = geometryCache.get(key);
        if (!cached) {
          const bevel = Math.min(2.4, depth * 0.18, radius * 0.2);
          const shape = new THREE.Shape();
          shape.moveTo(-width / 2 + radius, -height / 2);
          shape.lineTo(width / 2 - radius, -height / 2);
          shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
          shape.lineTo(width / 2, height / 2 - radius);
          shape.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
          shape.lineTo(-width / 2 + radius, height / 2);
          shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
          shape.lineTo(-width / 2, -height / 2 + radius);
          shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
          const geometry = new THREE.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: true,
            bevelSegments: 3,
            bevelSize: bevel,
            bevelThickness: bevel,
            curveSegments: 4,
            steps: 1
          });
          geometry.translate(0, 0, -depth / 2);
          cached = { geometry, references: 0 };
          geometryCache.set(key, cached);
        }
        cached.references += 1;
        return { key, geometry: cached.geometry };
      }

      function getPalette(element, isFrame) {
        if (isFrame) return 'frame';
        if (element.closest('#recommendations')) return 'neutral';
        if (element.closest('#pleyz-category-rail, .category-directory, .category-jump, .category-links, .related-categories')) return 'purple';
        if (element.closest('header')) return 'blue';
        return 'neutral';
      }

      function selectedState(element) {
        return element.getAttribute('aria-pressed') === 'true'
          || element.getAttribute('aria-selected') === 'true'
          || element.classList.contains('is-active')
          || element.classList.contains('active');
      }

      function addRecord(element, isFrame) {
        const record = {
          element,
          isFrame,
          palette: getPalette(element, isFrame),
          mesh: new THREE.Mesh(new THREE.BufferGeometry(), materialFor({ palette: getPalette(element), selected: false })),
          geometryKey: '',
          selected: selectedState(element),
          hovered: false,
          pressed: false,
          bounds: null,
          baseX: THREE.MathUtils.degToRad(isFrame ? 1.6 : 2.8),
          target: { x: 0, y: 0, z: 0, lift: 0, scale: 1 },
          current: { x: 0, y: 0, z: 0, lift: 0, scale: 1 }
        };
        record.mesh.material = materialFor(record);
        record.mesh.rotation.order = 'XYZ';
        record.mesh.rotation.x = record.baseX;
        record.current.x = record.baseX;
        record.target.x = record.baseX;
        record.mesh.visible = false;
        scene.add(record.mesh);
        records.push(record);
        resizeObserver?.observe(element);

        element.classList.add(isFrame ? 'pleyz-3d-frame' : 'pleyz-3d-target');
        if (!isFrame) element.classList.remove('pleyz-depth-target', 'pleyz-pointer-tilt');

        const aimAtPointer = (event, touch = false) => {
          if (!record.bounds || reducedMotion || (!touch && !desktopPointer)) return;
          const rect = element.getBoundingClientRect();
          const x = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
          const y = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
          const maxTilt = THREE.MathUtils.degToRad(touch ? 3 : record.isFrame ? 3 : 5.5);
          record.target.x = record.baseX - y * maxTilt;
          record.target.y = x * maxTilt;
          cursorLight.position.set(event.clientX, innerHeight - event.clientY, 70);
          cursorLight.userData.active = !touch;
        };

        element.addEventListener('pointerenter', event => {
          if (event.pointerType === 'touch') return;
          record.hovered = true;
          aimAtPointer(event);
          layoutDirty = true;
          updateTarget(record);
        }, { signal: controller.signal });
        element.addEventListener('pointermove', event => {
          if (event.pointerType === 'touch') return;
          record.hovered = true;
          aimAtPointer(event);
          updateTarget(record);
        }, { passive: true, signal: controller.signal });
        element.addEventListener('pointerdown', event => {
          record.pressed = true;
          record.hovered = event.pointerType !== 'touch';
          aimAtPointer(event, event.pointerType === 'touch');
          layoutDirty = true;
          updateTarget(record);
        }, { signal: controller.signal });
        const release = event => {
          record.pressed = false;
          if (event.pointerType === 'touch') {
            record.hovered = false;
            record.target.x = record.baseX;
            record.target.y = 0;
            cursorLight.userData.active = false;
          }
          layoutDirty = true;
          updateTarget(record);
        };
        element.addEventListener('pointerup', release, { signal: controller.signal });
        element.addEventListener('pointercancel', release, { signal: controller.signal });
        element.addEventListener('pointerleave', () => {
          record.hovered = element === document.activeElement;
          if (!record.hovered) {
            record.target.x = record.baseX;
            record.target.y = 0;
            cursorLight.userData.active = false;
          }
          layoutDirty = true;
          updateTarget(record);
        }, { signal: controller.signal });
        element.addEventListener('focus', () => {
          record.hovered = true;
          layoutDirty = true;
          updateTarget(record);
        }, { signal: controller.signal });
        element.addEventListener('blur', () => {
          record.hovered = false;
          record.target.x = record.baseX;
          record.target.y = 0;
          cursorLight.userData.active = false;
          layoutDirty = true;
          updateTarget(record);
        }, { signal: controller.signal });
        element.addEventListener('keydown', event => {
          if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
            record.pressed = true;
            updateTarget(record);
          }
        }, { signal: controller.signal });
        element.addEventListener('keyup', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            record.pressed = false;
            updateTarget(record);
          }
        }, { signal: controller.signal });
        element.addEventListener('click', () => updateSelection(record), { signal: controller.signal });
        return record;
      }

      function updateTarget(record) {
        if (reducedMotion) {
          record.target.z = record.pressed ? -2 : record.selected ? 1.5 : 0;
          record.target.lift = 0;
          record.target.scale = record.pressed ? 0.985 : 1;
          scheduleFrame();
          return;
        }
        record.target.z = record.pressed ? -3 : record.hovered ? 5 : record.selected ? 1.5 : 0;
        record.target.lift = record.pressed ? -1 : record.hovered ? 2 : record.selected ? 0.5 : 0;
        record.target.scale = record.pressed ? 0.985 : record.hovered ? 1.006 : 1;
        scheduleFrame();
      }

      function updateSelection(record) {
        record.selected = selectedState(record.element);
        record.mesh.material = materialFor(record);
        updateTarget(record);
      }

      function syncTargets() {
        const nextTargets = new Set(document.querySelectorAll(targetSelector));
        document.querySelectorAll('.game-frame:not(.native-game-frame)').forEach(element => {
          if (element.querySelector('iframe')) nextTargets.add(element);
        });
        nextTargets.forEach(element => {
          if (element.closest('.mobile-bottom-nav, .site-footer, footer, #pleyz-mobile-bar, #pleyz-nav-backdrop, [role="dialog"], .page-ad-section')) {
            return;
          }
          if (records.some(record => record.element === element)) return;
          addRecord(element, element.matches('.game-frame'));
        });
        records = records.filter(record => {
          if (record.element.isConnected) return true;
          resizeObserver?.unobserve(record.element);
          releaseRecordGeometry(record);
          scene.remove(record.mesh);
          record.element.classList.remove('pleyz-3d-target', 'pleyz-3d-frame');
          return false;
        });
        layoutDirty = true;
        scheduleFrame();
      }

      function syncLayout() {
        const viewportWidth = Math.max(1, window.innerWidth);
        const viewportHeight = Math.max(1, window.innerHeight);
        renderer.setSize(viewportWidth, viewportHeight, false);
        camera.left = 0;
        camera.right = viewportWidth;
        camera.top = viewportHeight;
        camera.bottom = 0;
        camera.updateProjectionMatrix();

        records.forEach(record => {
          const rect = record.element.getBoundingClientRect();
          const visible = rect.width > 0
            && rect.height > 0
            && rect.bottom > 0
            && rect.right > 0
            && rect.top < viewportHeight
            && rect.left < viewportWidth
            && !record.element.closest('[hidden]');
          record.mesh.visible = visible;
          if (!visible) return;

          const computed = window.getComputedStyle(record.element);
          const targetWidth = Math.max(1, Math.round(rect.width * 2) / 2);
          const targetHeight = Math.max(1, Math.round(rect.height * 2) / 2);
          const radius = Math.max(2, Math.min(
            Number.parseFloat(computed.borderTopLeftRadius) || 10,
            Math.min(targetWidth, targetHeight) * 0.24
          ));
          const depth = record.isFrame ? 15 : 9;
          const key = `${targetWidth.toFixed(1)}:${targetHeight.toFixed(1)}:${radius.toFixed(1)}:${depth}`;
          if (record.geometryKey !== key) {
            const acquired = acquireGeometry(targetWidth, targetHeight, radius, depth);
            releaseRecordGeometry(record);
            record.mesh.geometry = acquired.geometry;
            record.geometryKey = acquired.key;
          }
          record.bounds = rect;
          record.mesh.position.x = rect.left + rect.width / 2;
          record.mesh.position.y = viewportHeight - rect.top - rect.height / 2 + record.current.lift;
          record.selected = selectedState(record.element);
          record.mesh.material = materialFor(record);
        });
      }

      function scheduleFrame() {
        renderDirty = true;
        if (!frameId && !document.hidden) frameId = window.requestAnimationFrame(drawFrame);
      }

      let lastTimestamp = 0;
      function drawFrame(timestamp) {
        frameId = 0;
        if (document.hidden) return;
        if (layoutDirty) {
          syncLayout();
          layoutDirty = false;
          renderDirty = true;
        }
        const delta = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 1000, 0.05) : 1 / 60;
        lastTimestamp = timestamp;
        const easing = reducedMotion ? 1 : Math.min(1, delta * (lowPower || coarsePointer ? 18 : 15));
        let animating = false;
        records.forEach(record => {
          if (!record.mesh.visible) return;
          const { current, target, mesh } = record;
          current.x += (target.x - current.x) * easing;
          current.y += (target.y - current.y) * easing;
          current.z += (target.z - current.z) * easing;
          current.lift += (target.lift - current.lift) * easing;
          current.scale += (target.scale - current.scale) * easing;
          mesh.rotation.x = current.x;
          mesh.rotation.y = current.y;
          mesh.position.z = current.z;
          mesh.position.y = innerHeight - record.bounds.top - record.bounds.height / 2 + current.lift;
          mesh.scale.set(current.scale, current.scale, 1);
          if (Math.abs(target.x - current.x) > 0.002
            || Math.abs(target.y - current.y) > 0.002
            || Math.abs(target.z - current.z) > 0.03
            || Math.abs(target.lift - current.lift) > 0.02
            || Math.abs(target.scale - current.scale) > 0.002) animating = true;
        });
        const lightTarget = cursorLight.userData.active ? 0.75 : 0;
        cursorLight.intensity += (lightTarget - cursorLight.intensity) * easing;
        if (Math.abs(cursorLight.intensity - lightTarget) > 0.01) animating = true;
        if (renderDirty || animating) {
          renderer.render(scene, camera);
          renderDirty = false;
        }
        if (animating) scheduleFrame();
      }

      function markLayoutDirty() {
        layoutDirty = true;
        scheduleFrame();
      }

      resizeObserver = new ResizeObserver(markLayoutDirty);
      mutationObserver = new MutationObserver(changes => {
        const shouldRescan = changes.some(change => change.type === 'childList');
        if (shouldRescan) syncTargets();
        else markLayoutDirty();
      });
      mutationObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['aria-pressed', 'aria-selected', 'class', 'disabled', 'hidden'],
        childList: true,
        subtree: true
      });
      window.addEventListener('resize', markLayoutDirty, { passive: true, signal: controller.signal });
      window.addEventListener('scroll', markLayoutDirty, { passive: true, signal: controller.signal });
      document.addEventListener('scroll', markLayoutDirty, { capture: true, passive: true, signal: controller.signal });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (frameId) window.cancelAnimationFrame(frameId);
          frameId = 0;
          lastTimestamp = 0;
        } else {
          lastTimestamp = 0;
          markLayoutDirty();
        }
      }, { signal: controller.signal });
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        console.warn('PleyZ 3D visuals are unavailable; standard HTML controls remain active.');
        records.forEach(record => record.element.classList.remove('pleyz-3d-target', 'pleyz-3d-frame'));
        instance?.dispose();
        instance = null;
      }, { once: true });

      syncTargets();
      syncLayout();
      layoutDirty = false;
      renderer.render(scene, camera);
      instance = {
        dispose() {
          controller.abort();
          resizeObserver?.disconnect();
          mutationObserver?.disconnect();
          if (frameId) window.cancelAnimationFrame(frameId);
          records.forEach(record => {
            releaseRecordGeometry(record);
            scene.remove(record.mesh);
          });
          geometryCache.clear();
          frontMaterial.dispose();
          materials.forEach(material => material.dispose());
          renderer.dispose();
          canvas.remove();
          gsapObserver?.disconnect();
          gsapInstance?.killTweensOf?.('.pleyz-text-reveal');
        }
      };

      initializeTextMotion();

      async function initializeTextMotion() {
        if (reducedMotion || !('IntersectionObserver' in window)) return;
        try {
          const module = await import('https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm');
          if (token !== initializationToken || !instance) return;
          gsapInstance = module.gsap || module.default?.gsap || module.default;
          if (!gsapInstance?.fromTo) return;
          const headings = [...new Set(document.querySelectorAll(
            'h1, h2.section-title, .section-title, .category-hero h1, .mood-discovery-title'
          ))].filter(element => !element.closest('footer, .mobile-bottom-nav, #pleyz-mobile-bar'));
          gsapObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
              if (!entry.isIntersecting) return;
              gsapInstance.fromTo(entry.target,
                { autoAlpha: 0, y: 16 },
                {
                  autoAlpha: 1,
                  y: 0,
                  duration: 0.68,
                  ease: 'power2.out',
                  overwrite: 'auto',
                  clearProps: 'opacity,visibility,transform'
                });
              entry.target.classList.add('pleyz-text-reveal');
              gsapObserver.unobserve(entry.target);
            });
          }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
          headings.forEach(heading => gsapObserver.observe(heading));
        } catch (error) {
          console.warn('PleyZ scroll text motion is unavailable; page content remains unchanged.', error);
        }
      }

      window.addEventListener('pagehide', () => {
        initializationToken += 1;
        instance?.dispose();
        instance = null;
      }, { once: true });
    } catch (error) {
      controller?.abort();
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
      records.forEach(record => {
        releaseRecordGeometry(record);
        scene?.remove(record.mesh);
        record.element.classList.remove('pleyz-3d-target', 'pleyz-3d-frame');
      });
      geometryCache.forEach(cached => cached.geometry.dispose());
      geometryCache.clear();
      frontMaterial?.dispose();
      materials.forEach(material => material.dispose());
      renderer?.dispose();
      canvas?.remove();
      console.warn('PleyZ 3D visuals are unavailable; standard HTML controls remain active.', error);
    }
  }

  window.addEventListener('pageshow', event => {
    if (event.persisted) initialize();
  });
  initialize();
})();
