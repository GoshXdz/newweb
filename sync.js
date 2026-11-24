const SyncEngine = (() => {
  const STORAGE_KEY = 'live_catalog_data_v3';
  const SESSION_KEY = 'firebase_admin_session_v1';
  const CHANNEL_NAME = 'live_catalog_sync_channel';

  // =========================================================================
  // KONFIGURASI FIREBASE
  // 1. FIREBASE_URL: URL Realtime Database + "/catalog.json"
  //    Contoh: "https://newprojects-7a3dc-default-rtdb.asia-southeast1.firebasedatabase.app/catalog.json"
  // 2. FIREBASE_API_KEY: Web API Key dari Project Settings -> General di Firebase Console
  // =========================================================================
  const FIREBASE_URL = 'https://newprojects-7a3dc-default-rtdb.asia-southeast1.firebasedatabase.app/catalog.json';
  const FIREBASE_API_KEY = 'AIzaSyDm1FoWUi-AJ5ZNv9eMRJyYVEJN82yVfeM';

  const channel = new BroadcastChannel(CHANNEL_NAME);
  let listeners = [];
  let lastSnapshot = '';
  let lastFocusPullAt = 0;

  const defaultData = [];

  // -------------------------------------------------------------------------
  // STATUS KONEKSI BROWSER (ONLINE / OFFLINE)
  // -------------------------------------------------------------------------
  function isOnline() {
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  }

  function updateNetworkIndicator() {
    const online = isOnline();
    const banner = document.getElementById('offlineBanner');
    if (banner) {
      banner.style.display = online ? 'none' : 'block';
    }
    document.querySelectorAll('.live-dot').forEach((dot) => {
      dot.classList.toggle('offline', !online);
      dot.title = online ? 'Terhubung' : 'Offline';
    });
  }

  // -------------------------------------------------------------------------
  // AUTENTIKASI ADMIN VIA FIREBASE AUTH (EMAIL & PASSWORD)
  // -------------------------------------------------------------------------
  async function loginAdmin(email, password) {
    if (!FIREBASE_API_KEY) {
      throw new Error('FIREBASE_API_KEY belum diisi di sync.js.');
    }

    const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password,
        returnSecureToken: true
      })
    });

    const data = await res.json();
    if (!res.ok || !data.idToken) {
      const msg = data?.error?.message || 'Login gagal.';
      throw new Error(`Autentikasi gagal: ${msg}`);
    }

    const sessionData = {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      email: data.email,
      expiresAt: Date.now() + (Number(data.expiresIn || 3600) - 60) * 1000
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    return sessionData;
  }

  async function getValidIdToken() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    let session;
    try {
      session = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!session?.idToken) return null;

    if (Date.now() >= Number(session.expiresAt || 0) && session.refreshToken && FIREBASE_API_KEY && isOnline()) {
      try {
        const refreshRes = await fetch(
          `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refreshToken)}`
          }
        );
        const refreshed = await refreshRes.json();
        if (refreshRes.ok && refreshed.id_token) {
          session.idToken = refreshed.id_token;
          session.refreshToken = refreshed.refresh_token || session.refreshToken;
          session.expiresAt = Date.now() + (Number(refreshed.expires_in || 3600) - 60) * 1000;
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } else {
          logoutAdmin();
          return null;
        }
      } catch {
        return session.idToken;
      }
    }

    return session.idToken;
  }

  function isAdminAuthenticated() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return Boolean(parsed?.idToken);
    } catch {
      return false;
    }
  }

  function logoutAdmin() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // -------------------------------------------------------------------------
  // BACA DATA (LOCAL CACHE + FALLBACK KOSONG)
  // -------------------------------------------------------------------------
  function getProducts() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const serialized = JSON.stringify(defaultData);
      localStorage.setItem(STORAGE_KEY, serialized);
      lastSnapshot = serialized;
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // SIMPAN DATA DARI ADMIN -> PUSH KE FIREBASE & BROADCAST KE SEMUA USER
  // -------------------------------------------------------------------------
  async function saveProducts(products) {
    const idToken = await getValidIdToken();
    if (!idToken) {
      throw new Error('Akses ditolak: Silakan login sebagai admin terlebih dahulu.');
    }

    const cleanData = Array.isArray(products) ? products : [];
    const serialized = JSON.stringify(cleanData);

    localStorage.setItem(STORAGE_KEY, serialized);
    lastSnapshot = serialized;

    channel.postMessage({
      type: 'SYNC_UPDATE',
      products: cleanData,
      timestamp: Date.now()
    });
    notifyListeners(cleanData);

    if (FIREBASE_URL && isOnline()) {
      const separator = FIREBASE_URL.includes('?') ? '&' : '?';
      const writeUrl = `${FIREBASE_URL}${separator}auth=${encodeURIComponent(idToken)}`;

      const res = await fetch(writeUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: serialized
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gagal menyimpan ke cloud (${res.status}): ${errText || 'Periksa Firebase Rules & Login'}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // TARIK DATA TERBARU DARI FIREBASE (UNTUK SEMUA USER)
  // -------------------------------------------------------------------------
  async function pullFromCloud() {
    if (!FIREBASE_URL || !isOnline()) return;

    try {
      const res = await fetch(FIREBASE_URL, { cache: 'no-store' });
      if (!res.ok) return;

      const data = await res.json();
      const normalized = Array.isArray(data) ? data : [];

      const serialized = JSON.stringify(normalized);
      if (serialized !== lastSnapshot) {
        lastSnapshot = serialized;
        localStorage.setItem(STORAGE_KEY, serialized);
        channel.postMessage({
          type: 'SYNC_UPDATE',
          products: normalized,
          timestamp: Date.now()
        });
        notifyListeners(normalized);
      }
    } catch (err) {
      console.warn('Sinkronisasi cloud tertunda:', err);
    }
  }

  function triggerActiveSync() {
    if (!FIREBASE_URL || !isOnline()) return;
    const now = Date.now();
    if (now - lastFocusPullAt < 800) return;
    lastFocusPullAt = now;
    pullFromCloud();
  }

  function onUpdate(callback) {
    if (typeof callback === 'function') {
      listeners.push(callback);
    }
  }

  function notifyListeners(products) {
    listeners.forEach((cb) => {
      try {
        cb(products);
      } catch (err) {
        console.error('Error pada listener update:', err);
      }
    });
  }

  channel.onmessage = (event) => {
    if (event.data?.type === 'SYNC_UPDATE' && Array.isArray(event.data.products)) {
      const serialized = JSON.stringify(event.data.products);
      lastSnapshot = serialized;
      localStorage.setItem(STORAGE_KEY, serialized);
      notifyListeners(event.data.products);
    }
  };

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
          lastSnapshot = e.newValue;
          notifyListeners(parsed);
        }
      } catch {
        // Abaikan jika JSON tidak valid
      }
    }
  });

  window.addEventListener('online', () => {
    updateNetworkIndicator();
    triggerActiveSync();
  });

  window.addEventListener('offline', () => {
    updateNetworkIndicator();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateNetworkIndicator();
      triggerActiveSync();
    }
  });

  window.addEventListener('focus', () => {
    updateNetworkIndicator();
    triggerActiveSync();
  });

  async function resetToDefault() {
    return saveProducts([]);
  }

  const initial = getProducts();
  lastSnapshot = JSON.stringify(initial);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateNetworkIndicator, { once: true });
  } else {
    updateNetworkIndicator();
  }

  if (FIREBASE_URL) {
    pullFromCloud();
    setInterval(pullFromCloud, 3000);
  }

  return {
    loginAdmin,
    isAdminAuthenticated,
    logoutAdmin,
    isOnline,
    getProducts,
    saveProducts,
    pullFromCloud,
    onUpdate,
    resetToDefault
  };
})();