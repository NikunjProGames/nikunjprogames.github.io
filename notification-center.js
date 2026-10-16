(() => {
  if (!document.body || document.getElementById('pleyz-notification-bell')) return;

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyAZeHHIF2uOS-K5s6kZEffx-itN6xyxFk8',
    authDomain: 'pleyz-dd9f8.firebaseapp.com',
    projectId: 'pleyz-dd9f8',
    storageBucket: 'pleyz-dd9f8.firebasestorage.app',
    messagingSenderId: '386766168723',
    appId: '1:386766168723:web:bffbdec0ad82394f64a366'
  };
  const WEB_PUSH_VAPID_KEY = 'BCp61iyn72YVTEZbEtwNrDlWJqNO-3fz2_LQJL_7kYu-2fPsBbmwq3eX43e14Rwk9vTPo18Uj_Eozl8QccHGCk8';
  const SETTINGS_KEY = 'pleyz_notification_settings_v1';
  const SETTINGS_MIGRATION_KEY = 'pleyz_notification_settings_version';
  const SETTINGS_SYNC_PENDING_KEY = 'pleyz_notification_settings_sync_pending';
  const SEEN_KEY = 'pleyz_notification_seen_v1';
  const RECOMMENDATIONS_KEY = 'pleyz_notification_recommendations_v1';
  const defaults = {
    categories: { newGames: true, recommendations: true, reminders: true },
    pushEnabled: false,
    reminderDays: 7
  };
  const settings = readJson(SETTINGS_KEY, defaults);
  settings.categories = { ...defaults.categories, ...(settings.categories || {}) };
  settings.pushEnabled = settings.pushEnabled === true;
  settings.reminderDays = [7, 14, 21, 30, 60].includes(Number(settings.reminderDays))
    ? Number(settings.reminderDays)
    : defaults.reminderDays;
  let preferencesNeedSync = false;
  try {
    preferencesNeedSync = localStorage.getItem(SETTINGS_SYNC_PENDING_KEY) === 'true';
    if (localStorage.getItem(SETTINGS_MIGRATION_KEY) !== '2') {
      if (settings.reminderDays === 21) settings.reminderDays = 7;
      if (settings.pushEnabled) {
        settings.categories.reminders = true;
        preferencesNeedSync = true;
        localStorage.setItem(SETTINGS_SYNC_PENDING_KEY, 'true');
      }
      saveSettings();
      localStorage.setItem(SETTINGS_MIGRATION_KEY, '2');
    }
  } catch (error) {
    console.warn('PleyZ notification preferences could not be migrated:', error);
  }
  const seen = new Set(readJson(SEEN_KEY, []));
  let newGames = [];
  let hasLoadedGames = false;
  let verifiedUid = '';
  let authListenerAttached = false;
  let authPromise;
  let firebasePromise;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function saveRecommendationsForPush(items) {
    if (!settings.pushEnabled || !settings.categories.recommendations || !Array.isArray(items)) return;
    loadFirebase().then(sdk => {
      if (!sdk.auth.currentUser) return;
      return sdk.functionsSdk.httpsCallable(sdk.functions, 'savePleyzNotificationRecommendations')({ items });
    }).catch(error => console.warn('PleyZ push recommendations could not be saved:', error));
  }

  function markSeen(id) {
    seen.add(String(id));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
    renderBellCount();
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  const style = document.createElement('style');
  style.textContent = `
    #pleyz-notification-bell { position: fixed; z-index: 1505; right: 16px; bottom: 18px; display: grid; place-items: center; width: 46px; height: 46px; border: 1px solid rgba(0,191,255,.55); border-radius: 50%; background: #101525; color: #e8f8ff; box-shadow: 0 5px 20px #0008; cursor: pointer; }
    #pleyz-notification-bell:focus-visible, #pleyz-notification-panel button:focus-visible, #pleyz-notification-panel a:focus-visible { outline: 2px solid #00bfff; outline-offset: 2px; }
    #pleyz-notification-bell svg { width: 21px; height: 21px; }
    #pleyz-notification-count { position: absolute; top: -4px; right: -4px; display: grid; place-items: center; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 99px; background: #ff5470; color: #fff; font: 700 11px Arial,sans-serif; }
    #pleyz-notification-count[hidden] { display: none; }
    #pleyz-notification-panel { position: fixed; z-index: 1506; right: 16px; bottom: 74px; display: none; width: min(380px, calc(100vw - 28px)); max-height: min(76vh, 620px); overflow: auto; padding: 16px; border: 1px solid rgba(0,191,255,.35); border-radius: 14px; background: #0d1120; color: #eef2ff; box-shadow: 0 18px 55px #000b; font: 16px 'Rajdhani',sans-serif; }
    #pleyz-notification-panel[data-open="true"] { display: block; }
    .pleyz-notification-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .pleyz-notification-head h2 { margin: 0; font: 700 1rem 'Orbitron',sans-serif; }
    #pleyz-notification-panel button { color: inherit; font: inherit; cursor: pointer; }
    .pleyz-notification-quiet { padding: 5px 8px; border: 1px solid #ffffff26; border-radius: 6px; background: transparent; font-size: .78rem!important; }
    .pleyz-notification-feed { display: grid; gap: 8px; }
    .pleyz-notification-item { display: block; padding: 10px 12px; border: 1px solid #ffffff15; border-radius: 9px; background: #ffffff08; color: inherit; text-decoration: none; }
    .pleyz-notification-item:hover { border-color: #00bfff88; background: #00bfff10; }
    .pleyz-notification-item small { display: block; margin-top: 3px; color: #adb6cb; line-height: 1.3; }
    .pleyz-notification-item.unread { border-left: 3px solid #00bfff; }
    .pleyz-notification-section { margin: 16px 0 7px; color: #92a1bd; font: 700 .68rem 'Orbitron',sans-serif; letter-spacing: .08em; text-transform: uppercase; }
    .pleyz-notification-empty, #pleyz-notification-status { color: #aeb6cb; font-size: .88rem; line-height: 1.4; }
    .pleyz-notification-controls { display: grid; gap: 7px; margin-top: 15px; padding-top: 13px; border-top: 1px solid #ffffff1c; }
    .pleyz-notification-controls label { display: flex; align-items: center; gap: 8px; color: #c5cbe0; font-size: .9rem; }
    .pleyz-notification-controls input { accent-color: #00bfff; }
    .pleyz-notification-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .pleyz-notification-actions button { min-height: 36px; padding: 6px 9px; border: 1px solid #00bfff66; border-radius: 7px; background: #00bfff12; }
    .pleyz-notification-actions button:disabled { opacity: .55; cursor: not-allowed; }
    @media (max-width: 768px) { #pleyz-notification-bell { right: 12px; bottom: calc(82px + env(safe-area-inset-bottom)); } #pleyz-notification-panel { right: 12px; bottom: calc(138px + env(safe-area-inset-bottom)); } }
    @media (prefers-reduced-motion: reduce) { #pleyz-notification-panel, #pleyz-notification-bell { scroll-behavior: auto; } }
  `;
  document.head.appendChild(style);

  const bell = createElement('button');
  bell.id = 'pleyz-notification-bell';
  bell.type = 'button';
  bell.setAttribute('aria-label', 'Open PleyZ notifications');
  bell.setAttribute('aria-expanded', 'false');
  bell.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span id="pleyz-notification-count" hidden></span>';
  const panel = createElement('section');
  panel.id = 'pleyz-notification-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-label', 'PleyZ notifications');
  panel.dataset.open = 'false';
  panel.innerHTML = `
    <div class="pleyz-notification-head"><h2>Notifications</h2><button class="pleyz-notification-quiet" type="button" data-close>Close</button></div>
    <div class="pleyz-notification-feed" id="pleyz-notification-feed"><p class="pleyz-notification-empty">Updates appear here when available.</p></div>
    <div class="pleyz-notification-controls">
      <strong>Manage updates</strong>
      <label><input type="checkbox" data-category="newGames"> New games</label>
      <label><input type="checkbox" data-category="recommendations"> Game recommendations (every 2 weeks)</label>
      <label><input type="checkbox" data-category="reminders"> Weekly return reminder</label>
      <label>Reminder after <select id="pleyz-reminder-days"><option value="7">7 days</option><option value="14">14 days</option><option value="21">21 days</option><option value="30">30 days</option><option value="60">60 days</option></select> away</label>
      <div class="pleyz-notification-actions"><button id="pleyz-push-enable" type="button">Enable device notifications</button><button id="pleyz-push-disable" type="button">Turn off push</button></div>
      <p id="pleyz-notification-status" role="status">Browser notifications are optional and stay off until you enable them.</p>
    </div>`;
  document.body.append(bell, panel);

  function renderBellCount() {
    const count = bell.querySelector('#pleyz-notification-count');
    const unreadGames = settings.categories.newGames ? newGames.filter(game => !seen.has(game.id)).length : 0;
    const recommendationData = settings.categories.recommendations ? getRecommendations() : null;
    const unreadRecommendations = recommendationData && recommendationData.updatedAt > Number(localStorage.getItem('pleyz_notification_recommendations_seen') || 0) ? 1 : 0;
    const unread = unreadGames + unreadRecommendations;
    count.textContent = unread > 9 ? '9+' : String(unread);
    count.hidden = unread === 0;
  }

  function getRecommendations() {
    if (!verifiedUid) return null;
    const stored = readJson(RECOMMENDATIONS_KEY, null);
    if (!stored || stored.uid !== verifiedUid || !Array.isArray(stored.items)) return null;
    return stored;
  }

  function renderFeed() {
    const feed = panel.querySelector('#pleyz-notification-feed');
    feed.replaceChildren();
    let visibleCount = 0;
    if (settings.categories.newGames && newGames.length) {
      feed.appendChild(createElement('h3', 'pleyz-notification-section', 'New on PleyZ'));
      newGames.forEach(game => {
        const link = createElement('a', `pleyz-notification-item${seen.has(game.id) ? '' : ' unread'}`);
        link.href = game.href;
        link.append(
          createElement('strong', '', game.name),
          createElement('small', '', game.announced ? 'Recently added to the PleyZ catalog.' : 'Recently featured in our New in 2026 collection.')
        );
        link.addEventListener('click', () => markSeen(game.id));
        feed.appendChild(link);
        visibleCount += 1;
      });
    }
    if (settings.categories.recommendations) {
      const recommendations = getRecommendations();
      if (recommendations?.items.length) {
        feed.appendChild(createElement('h3', 'pleyz-notification-section', 'Picked for your play style'));
        recommendations.items.slice(0, 3).forEach(game => {
          const href = safeInternalHref(game.href);
          if (!href) return;
          const link = createElement('a', 'pleyz-notification-item');
          link.href = href;
          link.append(createElement('strong', '', game.name), createElement('small', '', 'Based on your PleyZ plays and preferences.'));
          feed.appendChild(link);
          visibleCount += 1;
        });
      } else if (verifiedUid) {
        feed.append(createElement('p', 'pleyz-notification-empty', 'Your personalized picks will appear here after PleyZ has enough play or preference history.'));
      } else {
        const link = createElement('a', 'pleyz-notification-item');
        link.href = '/?signin=1';
        link.append(createElement('strong', '', 'Sign in for personalized picks'), createElement('small', '', 'Recommendations use your PleyZ gameplay and preferences.'));
        feed.append(link);
        visibleCount += 1;
      }
    }
    if (!visibleCount && !settings.categories.recommendations) {
      feed.appendChild(createElement('p', 'pleyz-notification-empty', 'You have no update categories enabled.'));
    } else if (!visibleCount && settings.categories.recommendations) {
      feed.appendChild(createElement('p', 'pleyz-notification-empty', 'No updates yet. You can keep playing without enabling notifications.'));
    }
    panel.querySelectorAll('[data-category]').forEach(input => {
      input.checked = settings.categories[input.dataset.category] === true;
    });
    panel.querySelector('#pleyz-reminder-days').value = String(settings.reminderDays);
    panel.querySelector('#pleyz-push-enable').hidden = settings.pushEnabled;
    panel.querySelector('#pleyz-push-disable').hidden = !settings.pushEnabled;
    renderBellCount();
  }

  function safeInternalHref(value) {
    try {
      const url = new URL(value, location.origin);
      return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : '';
    } catch {
      return '';
    }
  }

  async function loadNewGames() {
    if (hasLoadedGames) return;
    hasLoadedGames = true;
    try {
      const response = await fetch('/new-in-2026-games/', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Could not load new games (${response.status}).`);
      const documentPage = new DOMParser().parseFromString(await response.text(), 'text/html');
      const jsonLd = [...documentPage.querySelectorAll('script[type="application/ld+json"]')]
        .map(script => {
          try { return JSON.parse(script.textContent); } catch { return null; }
        })
        .find(data => data?.mainEntity?.itemListElement);
      newGames = (jsonLd?.mainEntity?.itemListElement || [])
        .map(item => {
          const href = safeInternalHref(item.url);
          return href ? { id: href, href, name: String(item.name || '').trim(), announced: false } : null;
        })
        .filter(game => game?.name)
        .slice(0, 20);
      const auth = await loadAuth();
      const firestoreSdk = await import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js');
      const database = firestoreSdk.getFirestore(auth.app);
      const result = await firestoreSdk.getDocs(firestoreSdk.query(
        firestoreSdk.collection(database, 'notificationAnnouncements'),
        firestoreSdk.orderBy('createdAt', 'desc'),
        firestoreSdk.limit(20)
      ));
      const seenHrefs = new Set(newGames.map(game => game.href));
      const announcements = result.docs
        .map(game => {
          const data = game.data();
          const href = safeInternalHref(data.href);
          if (!href || seenHrefs.has(href)) return null;
          seenHrefs.add(href);
          return { id: game.id, href, name: String(data.name || '').trim(), announced: true };
        })
        .filter(game => game?.name);
      newGames = [...announcements, ...newGames].slice(0, 20);
    } catch (error) {
      const status = panel.querySelector('#pleyz-notification-status');
      status.textContent = error?.code === 'permission-denied'
        ? 'Firestore denied the notification updates read. Check that project pleyz-dd9f8 has the notificationAnnouncements list rule published. Catalog games are still available.'
        : error?.message || 'New games could not be loaded.';
    }
  }

  function updateRecommendationReadState() {
    const recommendations = getRecommendations();
    if (!recommendations) return;
    localStorage.setItem('pleyz_notification_recommendations_seen', String(recommendations.updatedAt));
  }

  async function loadFirebase() {
    if (!firebasePromise) {
      firebasePromise = loadAuth().then(async auth => {
        const [functionsSdk, messagingSdk] = await Promise.all([
          import('https://www.gstatic.com/firebasejs/12.17.1/firebase-functions.js'),
          import('https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging.js')
        ]);
        return {
          ...auth,
          functions: functionsSdk.getFunctions(auth.app, 'asia-southeast1'),
          functionsSdk,
          messagingSdk
        };
      });
    }
    return firebasePromise;
  }

  function loadAuth() {
    if (!authPromise) {
      authPromise = Promise.all([
        import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js')
      ]).then(([appSdk, authSdk]) => {
        const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(FIREBASE_CONFIG);
        return {
          app,
          authSdk,
          auth: authSdk.getAuth(app)
        };
      });
    }
    return authPromise;
  }

  async function verifyRecommendationUser() {
    try {
      const sdk = await loadAuth();
      if (!authListenerAttached) {
        sdk.authSdk.onAuthStateChanged(sdk.auth, user => {
          verifiedUid = user?.uid || '';
          renderFeed();
          renderBellCount();
        }, error => {
          verifiedUid = '';
          panel.querySelector('#pleyz-notification-status').textContent =
            `Personalized recommendations could not be verified: ${error.message || 'account services are unavailable.'}`;
          renderFeed();
        });
        authListenerAttached = true;
      }
      await sdk.auth.authStateReady();
      verifiedUid = sdk.auth.currentUser?.uid || '';
    } catch (error) {
      verifiedUid = '';
      panel.querySelector('#pleyz-notification-status').textContent =
        `Personalized recommendations could not be verified: ${error.message || 'account services are unavailable.'}`;
    }
  }

  async function getSignedInFirebase() {
    const sdk = await loadFirebase();
    if (!sdk.auth.currentUser) {
      await new Promise(resolve => {
        const unsubscribe = sdk.authSdk.onAuthStateChanged(sdk.auth, user => {
          unsubscribe();
          resolve(user);
        }, () => resolve(null));
      });
    }
    if (!sdk.auth.currentUser) throw new Error('Sign in to enable notifications across devices.');
    return sdk;
  }

  async function syncSettings(sdk) {
    const save = sdk.functionsSdk.httpsCallable(sdk.functions, 'savePleyzNotificationPreferences');
    await save({
      categories: settings.categories,
      pushEnabled: settings.pushEnabled,
      reminderDays: settings.reminderDays
    });
  }

  async function enablePush() {
    const status = panel.querySelector('#pleyz-notification-status');
    const button = panel.querySelector('#pleyz-push-enable');
    if (!WEB_PUSH_VAPID_KEY) {
      status.textContent = 'Push delivery needs the public Web Push key from Firebase Console. The notification panel still works without it.';
      return;
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      status.textContent = 'This browser does not support push notifications. The notification panel remains available.';
      return;
    }
    button.disabled = true;
    let sdk;
    let token;
    try {
      sdk = await getSignedInFirebase();
      if (!await sdk.messagingSdk.isSupported()) {
        throw new Error('Firebase push messaging is not supported in this browser.');
      }
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') {
        status.textContent = permission === 'denied'
          ? 'Notifications are blocked in browser settings. You can still use this panel.'
          : 'Push notifications were not enabled.';
        return;
      }
      const serviceWorkerRegistration = await navigator.serviceWorker.register('/service-worker.js');
      const messaging = sdk.messagingSdk.getMessaging(sdk.app);
      token = await sdk.messagingSdk.getToken(messaging, {
        vapidKey: WEB_PUSH_VAPID_KEY,
        serviceWorkerRegistration
      });
      if (!token) throw new Error('The browser did not create a push subscription.');
      settings.pushEnabled = true;
      saveSettings();
      await syncSettings(sdk);
      preferencesNeedSync = false;
      localStorage.removeItem(SETTINGS_SYNC_PENDING_KEY);
      await sdk.functionsSdk.httpsCallable(sdk.functions, 'savePleyzNotificationToken')({ token });
      const recommendations = getRecommendations();
      if (recommendations) {
        await sdk.functionsSdk.httpsCallable(sdk.functions, 'savePleyzNotificationRecommendations')({
          items: recommendations.items
        });
      }
      sdk.messagingSdk.onMessage(messaging, payload => {
        status.textContent = payload.data?.body || payload.notification?.body || 'You have a new PleyZ update.';
      });
      status.textContent = 'Device notifications are enabled. Manage them here or in your browser settings.';
      renderFeed();
    } catch (error) {
      settings.pushEnabled = false;
      saveSettings();
      if (sdk) {
        try {
          if (token) {
            await sdk.functionsSdk.httpsCallable(sdk.functions, 'removePleyzNotificationToken')({ token });
          }
          await syncSettings(sdk);
        } catch (rollbackError) {
          console.warn('PleyZ push setup rollback failed:', rollbackError);
        }
      }
      status.textContent = error.message || 'Push notifications could not be enabled.';
    } finally {
      button.disabled = false;
    }
  }

  async function disablePush() {
    const status = panel.querySelector('#pleyz-notification-status');
    const button = panel.querySelector('#pleyz-push-disable');
    button.disabled = true;
    try {
      const sdk = await getSignedInFirebase();
      const wasPushEnabled = settings.pushEnabled;
      settings.pushEnabled = false;
      try {
        await syncSettings(sdk);
      } catch (error) {
        settings.pushEnabled = wasPushEnabled;
        throw error;
      }
      saveSettings();
      let cleanupWarning = '';
      try {
        if (await sdk.messagingSdk.isSupported()) {
          const messaging = sdk.messagingSdk.getMessaging(sdk.app);
          const token = await sdk.messagingSdk.getToken(messaging, { vapidKey: WEB_PUSH_VAPID_KEY }).catch(() => '');
          if (token) {
            await sdk.functionsSdk.httpsCallable(sdk.functions, 'removePleyzNotificationToken')({ token });
            await sdk.messagingSdk.deleteToken(messaging);
          }
        }
      } catch (error) {
        cleanupWarning = ' Push is disabled on your account, but this device subscription could not be removed.';
        console.warn('PleyZ push subscription cleanup failed:', error);
      }
      status.textContent = `Push notifications are turned off.${cleanupWarning}`;
      renderFeed();
    } catch (error) {
      settings.pushEnabled = true;
      saveSettings();
      status.textContent = error.message || 'Push notifications could not be turned off.';
    } finally {
      button.disabled = false;
    }
  }

  bell.addEventListener('click', async () => {
    const open = panel.dataset.open !== 'true';
    panel.dataset.open = String(open);
    bell.setAttribute('aria-expanded', String(open));
    if (open) {
      await Promise.all([loadNewGames(), verifyRecommendationUser()]);
      if (preferencesNeedSync && settings.pushEnabled) {
        try {
          await syncSettings(await getSignedInFirebase());
          preferencesNeedSync = false;
          localStorage.removeItem(SETTINGS_SYNC_PENDING_KEY);
        } catch (error) {
          panel.querySelector('#pleyz-notification-status').textContent =
            error.message || 'Notification preferences could not be synchronized.';
        }
      }
      const recommendations = getRecommendations();
      if (recommendations) saveRecommendationsForPush(recommendations.items);
      renderFeed();
      updateRecommendationReadState();
      renderBellCount();
    }
  });
  panel.querySelector('[data-close]').addEventListener('click', () => {
    panel.dataset.open = 'false';
    bell.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('click', event => {
    if (panel.dataset.open === 'true' && !panel.contains(event.target) && !bell.contains(event.target)) {
      panel.dataset.open = 'false';
      bell.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.dataset.open === 'true') {
      panel.dataset.open = 'false';
      bell.setAttribute('aria-expanded', 'false');
      bell.focus();
    }
  });
  panel.querySelectorAll('[data-category]').forEach(input => {
    input.addEventListener('change', async () => {
      settings.categories[input.dataset.category] = input.checked;
      saveSettings();
      renderFeed();
      if (settings.pushEnabled) {
        try {
          await syncSettings(await getSignedInFirebase());
          if (input.dataset.category === 'recommendations' && input.checked) {
            const recommendations = getRecommendations();
            if (recommendations) saveRecommendationsForPush(recommendations.items);
          }
          panel.querySelector('#pleyz-notification-status').textContent = 'Notification preferences saved.';
        } catch (error) {
          panel.querySelector('#pleyz-notification-status').textContent = error.message || 'Preferences saved on this device but could not sync.';
        }
      }
    });
  });
  panel.querySelector('#pleyz-reminder-days').addEventListener('change', async event => {
    settings.reminderDays = Number(event.target.value);
    saveSettings();
    if (settings.pushEnabled) {
      try {
        await syncSettings(await getSignedInFirebase());
        panel.querySelector('#pleyz-notification-status').textContent = 'Reminder schedule saved.';
      } catch (error) {
        panel.querySelector('#pleyz-notification-status').textContent = error.message || 'Schedule saved on this device but could not sync.';
      }
    }
  });
  panel.querySelector('#pleyz-push-enable').addEventListener('click', enablePush);
  panel.querySelector('#pleyz-push-disable').addEventListener('click', disablePush);
  document.addEventListener('pleyz-notification-recommendations-updated', () => {
    renderBellCount();
    const recommendations = getRecommendations();
    if (recommendations) saveRecommendationsForPush(recommendations.items);
  });
  renderBellCount();
})();
