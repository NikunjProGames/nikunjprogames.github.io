(() => {
  const section = document.getElementById('recommendations');
  const moodOptions = section?.querySelector('.mood-options');
  const buttons = [...(section?.querySelectorAll('.mood-option[data-mood]') || [])];
  if (!section || !moodOptions || !buttons.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowPower = document.documentElement.classList.contains('low-power-device');
  const mobile = window.matchMedia('(pointer: coarse)').matches;
  let activeInstance = null;
  let initializationToken = 0;

  async function initialize() {
    if (activeInstance || !section.isConnected) return;
    const token = ++initializationToken;
    let renderer = null;
    let canvas = null;
    let scene = null;
    let idleMaterial = null;
    let selectedMaterial = null;
    let geometryCache = null;
    let records = [];
    let sectionObserver = null;
    let resizeObserver = null;
    let mutationObserver = null;
    let controller = null;
    let frameId = 0;

    try {
      const [THREE, { RoundedBoxGeometry }] = await Promise.all([
        import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js'),
        import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/geometries/RoundedBoxGeometry.js')
      ]);
      if (token !== initializationToken || !section.isConnected) return;

      scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 1200);
      camera.position.z = 700;
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight(0xdce9ff, 0x11131b, 1.7));
      const keyLight = new THREE.DirectionalLight(0xf4f7ff, 2.2);
      keyLight.position.set(-180, 260, 420);
      scene.add(keyLight);

      const cursorLight = new THREE.PointLight(0x86ddff, 0, 360, 2);
      scene.add(cursorLight);

      idleMaterial = new THREE.MeshStandardMaterial({
        color: 0x30343a,
        emissive: 0x090b0f,
        emissiveIntensity: 0.35,
        metalness: 0.2,
        roughness: 0.34
      });
      selectedMaterial = new THREE.MeshStandardMaterial({
        color: 0x35343c,
        emissive: 0x32134a,
        emissiveIntensity: 0.9,
        metalness: 0.24,
        roughness: 0.3
      });

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !lowPower,
        powerPreference: 'low-power',
        stencil: false
      });
      canvas = renderer.domElement;
      canvas.className = 'pleyz-3d-mood-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : mobile ? 1.25 : 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;

      geometryCache = new Map();
      controller = new AbortController();
      records = buttons.map(button => {
        const mesh = new THREE.Mesh(new THREE.BufferGeometry(), idleMaterial);
        mesh.rotation.x = THREE.MathUtils.degToRad(4);
        mesh.position.z = 0;
        scene.add(mesh);
        return {
          button,
          mesh,
          geometryKey: '',
          bounds: null,
          selected: button.getAttribute('aria-pressed') === 'true',
          hovered: false,
          pressed: false,
          target: { x: mesh.rotation.x, y: 0, z: 0, scale: 1 },
          current: { x: mesh.rotation.x, y: 0, z: 0, scale: 1 }
        };
      });
      const recordsForButton = new Map(records.map(record => [record.button, record]));

      function acquireGeometry(width, height, radius) {
        const key = `${width.toFixed(1)}:${height.toFixed(1)}:${radius.toFixed(1)}`;
        let cached = geometryCache.get(key);
        if (!cached) {
          const depth = 11;
          const bevel = Math.min(2.2, depth * 0.22, radius * 0.2);
          cached = {
            geometry: new RoundedBoxGeometry(width, height, depth, 4, bevel),
            references: 0
          };
          geometryCache.set(key, cached);
        }
        cached.references += 1;
        return { key, geometry: cached.geometry };
      }

      function releaseGeometry(key) {
        if (!key) return;
        const cached = geometryCache.get(key);
        if (!cached) return;
        cached.references -= 1;
        if (cached.references === 0) {
          cached.geometry.dispose();
          geometryCache.delete(key);
        }
      }

      function syncLayout() {
        const canvasRect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(canvas.clientWidth));
        const height = Math.max(1, Math.round(canvas.clientHeight));
        renderer.setSize(width, height, false);
        camera.left = 0;
        camera.right = width;
        camera.bottom = 0;
        camera.top = height;
        camera.updateProjectionMatrix();

        records.forEach(record => {
          const button = record.button;
          const rect = button.getBoundingClientRect();
          const visible = !button.disabled
            && !button.closest('[hidden]')
            && rect.width > 0
            && rect.height > 0;
          record.selected = button.getAttribute('aria-pressed') === 'true';
          record.mesh.visible = visible;
          if (!visible) return;

          const left = rect.left - canvasRect.left;
          const top = rect.top - canvasRect.top;
          const width = Math.max(1, rect.width);
          const height = Math.max(1, rect.height);
          const computed = window.getComputedStyle(button);
          const radius = Math.min(
            Number.parseFloat(computed.borderTopLeftRadius) || 12,
            Math.min(width, height) * 0.24
          );
          const geometryWidth = Math.round(width * 2) / 2;
          const geometryHeight = Math.round(height * 2) / 2;
          const geometryRadius = Math.round(radius * 2) / 2;
          const geometryKey = `${geometryWidth.toFixed(1)}:${geometryHeight.toFixed(1)}:${geometryRadius.toFixed(1)}`;

          if (record.geometryKey !== geometryKey) {
            const acquired = acquireGeometry(geometryWidth, geometryHeight, geometryRadius);
            if (!record.geometryKey) record.mesh.geometry.dispose();
            record.mesh.geometry = acquired.geometry;
            releaseGeometry(record.geometryKey);
            record.geometryKey = acquired.key;
          }

          record.bounds = { left, top, width, height };
          record.mesh.position.x = left + width / 2;
          record.mesh.position.y = height - top - height / 2;
          record.mesh.material = record.selected ? selectedMaterial : idleMaterial;
        });
      }

      function setTarget(record) {
        record.target.z = reducedMotion
          ? (record.selected ? 1.5 : 0)
          : record.pressed ? -3 : record.hovered ? 5 : record.selected ? 1.5 : 0;
        record.target.scale = reducedMotion ? 1 : record.pressed ? 0.975 : record.hovered ? 1.008 : 1;
      }

      function aimAtPointer(record, event) {
        if (!record.bounds || event.pointerType === 'touch') return;
        const x = (event.clientX - canvas.getBoundingClientRect().left - record.bounds.left)
          / record.bounds.width - 0.5;
        const y = (event.clientY - canvas.getBoundingClientRect().top - record.bounds.top)
          / record.bounds.height - 0.5;
        const maxTilt = reducedMotion ? 0 : THREE.MathUtils.degToRad(6);
        record.target.x = THREE.MathUtils.degToRad(4) - y * maxTilt;
        record.target.y = x * maxTilt;

        const lightX = record.bounds.left + (x + 0.5) * record.bounds.width;
        const lightY = canvas.clientHeight - (record.bounds.top + (y + 0.5) * record.bounds.height);
        cursorLight.position.set(lightX, lightY, 82);
        cursorLight.userData.active = !reducedMotion;
      }

      function updateSelected(record) {
        record.selected = record.button.getAttribute('aria-pressed') === 'true';
        record.mesh.material = record.selected ? selectedMaterial : idleMaterial;
        setTarget(record);
        scheduleFrame();
      }

      function setPressed(record, pressed) {
        record.pressed = pressed;
        setTarget(record);
        if (pressed && record.button.matches(':active')) {
          const rect = record.button.getBoundingClientRect();
          const canvasRect = canvas.getBoundingClientRect();
          record.bounds = {
            left: rect.left - canvasRect.left,
            top: rect.top - canvasRect.top,
            width: rect.width,
            height: rect.height
          };
        }
        scheduleFrame();
      }

      records.forEach(record => {
        const { button } = record;
        button.addEventListener('pointerenter', event => {
          record.hovered = event.pointerType !== 'touch';
          if (record.hovered) aimAtPointer(record, event);
          setTarget(record);
          scheduleFrame();
        }, { signal: controller.signal });
        button.addEventListener('pointermove', event => {
          if (event.pointerType === 'touch') return;
          record.hovered = true;
          aimAtPointer(record, event);
          setTarget(record);
          scheduleFrame();
        }, { passive: true, signal: controller.signal });
        button.addEventListener('pointerdown', event => {
          record.hovered = true;
          if (event.pointerType === 'touch') {
            const rect = button.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            record.bounds = {
              left: rect.left - canvasRect.left,
              top: rect.top - canvasRect.top,
              width: rect.width,
              height: rect.height
            };
            const x = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
            const y = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
            const maxTilt = reducedMotion ? 0 : THREE.MathUtils.degToRad(4);
            record.target.x = THREE.MathUtils.degToRad(4) - y * maxTilt;
            record.target.y = x * maxTilt;
            cursorLight.position.set(
              record.bounds.left + (x + 0.5) * record.bounds.width,
              canvas.clientHeight - (record.bounds.top + (y + 0.5) * record.bounds.height),
              82
            );
            cursorLight.userData.active = !reducedMotion;
          } else {
            aimAtPointer(record, event);
          }
          setPressed(record, true);
        }, { signal: controller.signal });
        const releasePointer = event => {
          setPressed(record, false);
          if (event.pointerType === 'touch') {
            record.hovered = false;
            record.target.x = THREE.MathUtils.degToRad(4);
            record.target.y = 0;
            cursorLight.userData.active = false;
            setTarget(record);
          }
        };
        button.addEventListener('pointerup', releasePointer, { signal: controller.signal });
        button.addEventListener('pointercancel', releasePointer, { signal: controller.signal });
        button.addEventListener('pointerleave', () => {
          record.hovered = button === document.activeElement;
          if (!record.hovered) {
            cursorLight.userData.active = false;
            record.target.x = THREE.MathUtils.degToRad(4);
            record.target.y = 0;
          }
          setTarget(record);
          scheduleFrame();
        }, { signal: controller.signal });
        button.addEventListener('focus', () => {
          record.hovered = true;
          if (record.bounds) {
            cursorLight.position.set(
              record.bounds.left + record.bounds.width / 2,
              canvas.clientHeight - record.bounds.top - record.bounds.height / 2,
              82
            );
            cursorLight.userData.active = !reducedMotion;
          }
          setTarget(record);
          scheduleFrame();
        }, { signal: controller.signal });
        button.addEventListener('blur', () => {
          record.hovered = false;
          cursorLight.userData.active = false;
          record.target.x = THREE.MathUtils.degToRad(4);
          record.target.y = 0;
          setTarget(record);
          scheduleFrame();
        }, { signal: controller.signal });
        button.addEventListener('keydown', event => {
          if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) setPressed(record, true);
        }, { signal: controller.signal });
        button.addEventListener('keyup', event => {
          if (event.key === 'Enter' || event.key === ' ') setPressed(record, false);
        }, { signal: controller.signal });
        button.addEventListener('click', () => updateSelected(record), { signal: controller.signal });
      });

      moodOptions.insertBefore(canvas, moodOptions.firstChild);

      let layoutDirty = true;
      let renderDirty = true;
      let sectionVisible = !('IntersectionObserver' in window);
      let lastFrameTime = 0;
      let cursorLightTarget = 0;

      function scheduleFrame() {
        renderDirty = true;
        if (!frameId && sectionVisible && !document.hidden) {
          frameId = window.requestAnimationFrame(drawFrame);
        }
      }

      function drawFrame(timestamp) {
        frameId = 0;
        if (!sectionVisible || document.hidden) return;
        const frameInterval = lowPower ? 1000 / 30 : 1000 / 60;
        if (lastFrameTime && timestamp - lastFrameTime < frameInterval) {
          frameId = window.requestAnimationFrame(drawFrame);
          return;
        }
        const delta = lastFrameTime ? Math.min((timestamp - lastFrameTime) / 1000, 0.05) : 1 / 60;
        lastFrameTime = timestamp;

        if (layoutDirty) {
          syncLayout();
          layoutDirty = false;
          renderDirty = true;
        }

        const easing = reducedMotion ? 1 : Math.min(1, delta * 14);
        let animating = false;
        records.forEach(record => {
          if (!record.mesh.visible) return;
          const { current, target, mesh } = record;
          current.x += (target.x - current.x) * easing;
          current.y += (target.y - current.y) * easing;
          current.z += (target.z - current.z) * easing;
          current.scale += (target.scale - current.scale) * easing;
          mesh.rotation.x = current.x;
          mesh.rotation.y = current.y;
          mesh.position.z = current.z;
          mesh.scale.set(current.scale, current.scale, 1);
          if (Math.abs(target.x - current.x) > 0.002
            || Math.abs(target.y - current.y) > 0.002
            || Math.abs(target.z - current.z) > 0.02
            || Math.abs(target.scale - current.scale) > 0.002) animating = true;
        });
        cursorLightTarget = cursorLight.userData.active ? 1050 : 0;
        const previousLightIntensity = cursorLight.intensity;
        cursorLight.intensity += (cursorLightTarget - cursorLight.intensity) * easing;
        if (Math.abs(cursorLight.intensity - cursorLightTarget) > 1) animating = true;
        if (renderDirty || animating || previousLightIntensity !== cursorLight.intensity) {
          renderer.render(scene, camera);
          renderDirty = false;
        }
        if (animating) scheduleFrame();
      }

      function markLayoutDirty() {
        layoutDirty = true;
        scheduleFrame();
      }

      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(markLayoutDirty);
        resizeObserver.observe(section);
        resizeObserver.observe(moodOptions);
        buttons.forEach(button => resizeObserver.observe(button));
      }
      mutationObserver = new MutationObserver(records => {
        records.forEach(change => {
          if (change.attributeName !== 'aria-pressed') return;
          const record = buttons.includes(change.target)
            ? recordsForButton.get(change.target)
            : null;
          if (record) {
            record.selected = record.button.getAttribute('aria-pressed') === 'true';
            setTarget(record);
            record.mesh.material = record.selected ? selectedMaterial : idleMaterial;
          }
        });
        markLayoutDirty();
      });
      mutationObserver.observe(section, {
        attributes: true,
        attributeFilter: ['aria-pressed', 'hidden'],
        childList: true,
        subtree: true
      });
      section.addEventListener('transitionend', event => {
        if (event.target === section) markLayoutDirty();
      }, { signal: controller.signal });
      window.addEventListener('resize', markLayoutDirty, { passive: true, signal: controller.signal });
      if (!resizeObserver) {
        window.addEventListener('orientationchange', markLayoutDirty, { passive: true, signal: controller.signal });
      }
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (frameId) window.cancelAnimationFrame(frameId);
          frameId = 0;
        } else {
          lastFrameTime = 0;
          markLayoutDirty();
        }
      }, { signal: controller.signal });
      if ('IntersectionObserver' in window) {
        sectionObserver = new IntersectionObserver(entries => {
          sectionVisible = entries.some(entry => entry.isIntersecting);
          if (sectionVisible) {
            lastFrameTime = 0;
            markLayoutDirty();
          } else if (frameId) {
            window.cancelAnimationFrame(frameId);
            frameId = 0;
          }
        }, { threshold: 0.01 });
        sectionObserver.observe(section);
      }

      syncLayout();
      layoutDirty = false;
      renderer.render(scene, camera);
      section.classList.add('pleyz-3d-mood-ready');
      renderDirty = false;
      activeInstance = {
        dispose() {
          controller.abort();
          resizeObserver?.disconnect();
          mutationObserver.disconnect();
          sectionObserver?.disconnect();
          if (frameId) window.cancelAnimationFrame(frameId);
          records.forEach(record => {
            releaseGeometry(record.geometryKey);
            scene.remove(record.mesh);
          });
          idleMaterial.dispose();
          selectedMaterial.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          canvas.remove();
          section.classList.remove('pleyz-3d-mood-ready');
        }
      };
      canvas.addEventListener('webglcontextlost', () => {
        console.warn('PleyZ 3D mood controls lost WebGL; keeping the standard controls.');
        activeInstance?.dispose();
        activeInstance = null;
      }, { once: true });
    } catch (error) {
      controller?.abort();
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      sectionObserver?.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
      records.forEach(record => {
        if (record.geometryKey) {
          const cached = geometryCache?.get(record.geometryKey);
          cached?.geometry.dispose();
          geometryCache?.delete(record.geometryKey);
        }
        scene?.remove(record.mesh);
        record.mesh.geometry.dispose();
      });
      idleMaterial?.dispose();
      selectedMaterial?.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
      canvas?.remove();
      section.classList.remove('pleyz-3d-mood-ready');
      console.warn('PleyZ 3D mood controls are unavailable; keeping the standard controls.', error);
    }
  }

  window.addEventListener('pagehide', () => {
    initializationToken += 1;
    activeInstance?.dispose();
    activeInstance = null;
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) initialize();
  });
  initialize();
})();
