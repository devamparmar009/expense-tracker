const _SYNC_TOKEN = 'et_sync_token';
const _SYNC_GIST  = 'et_sync_gist';
const _SYNC_TS    = 'et_sync_ts';
const _GIST_FILE  = 'expense-tracker.json';
const _GIST_DESC  = 'Expense Tracker Sync';

function isSyncEnabled() {
  return !!(localStorage.getItem(_SYNC_TOKEN) && localStorage.getItem(_SYNC_GIST));
}

function getSyncLastTime() {
  const ts = localStorage.getItem(_SYNC_TS);
  if (!ts) return null;
  const diff = Date.now() - parseInt(ts);
  if (diff < 60000)     return 'just now';
  if (diff < 3600000)   return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000)  return Math.floor(diff / 3600000) + 'h ago';
  return new Date(parseInt(ts)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

async function _api(method, path, body, token) {
  const tok = token || localStorage.getItem(_SYNC_TOKEN);
  const res = await fetch('https://api.github.com/gists' + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + tok,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || 'GitHub API ' + res.status);
  }
  return res.json();
}

async function _findGist(token) {
  for (let page = 1; page <= 5; page++) {
    const list = await _api('GET', '?per_page=100&page=' + page, null, token);
    if (!list.length) break;
    const found = list.find(g => g.description === _GIST_DESC && g.files[_GIST_FILE]);
    if (found) return found;
    if (list.length < 100) break;
  }
  return null;
}

async function _verifyBlob(blob) {
  try {
    const key = getSessionKey();
    const data = await decryptData(blob, key);
    if (!data) throw new Error('bad decrypt');
  } catch {
    throw new Error('Password mismatch — both devices must use the same app password for sync to work.');
  }
}

async function connectSync(token) {
  token = token.trim();
  const userRes = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
  });
  if (!userRes.ok) throw new Error('Invalid token — make sure it has the "gist" scope.');

  localStorage.setItem(_SYNC_TOKEN, token);

  const existing = await _findGist(token);

  if (existing) {
    localStorage.setItem(_SYNC_GIST, existing.id);
    const content = existing.files[_GIST_FILE] && existing.files[_GIST_FILE].content;
    if (content) {
      const { ts, blob } = JSON.parse(content);
      const localTs = parseInt(localStorage.getItem(_SYNC_TS) || '0');
      if (ts > localTs) {
        await _verifyBlob(blob);
        localStorage.setItem('etd', blob);
        localStorage.setItem(_SYNC_TS, ts);
        clearDataCache();
        return { action: 'pulled', gistId: existing.id };
      }
    }
    await pushToGist();
    return { action: 'pushed', gistId: existing.id };
  }

  // No existing gist — create one with current local data
  const blob = localStorage.getItem('etd') || '';
  const ts = Date.now();
  const gist = await _api('POST', '', {
    description: _GIST_DESC,
    public: false,
    files: { [_GIST_FILE]: { content: JSON.stringify({ ts, blob }) } }
  }, token);
  localStorage.setItem(_SYNC_GIST, gist.id);
  localStorage.setItem(_SYNC_TS, ts);
  return { action: 'created', gistId: gist.id };
}

async function pushToGist(blobParam) {
  if (!isSyncEnabled()) return;
  const blob = blobParam || localStorage.getItem('etd');
  if (!blob) return;
  const gistId = localStorage.getItem(_SYNC_GIST);
  const ts = Date.now();
  await _api('PATCH', '/' + gistId, {
    files: { [_GIST_FILE]: { content: JSON.stringify({ ts, blob }) } }
  });
  localStorage.setItem(_SYNC_TS, ts);
}

async function pullFromGist() {
  if (!isSyncEnabled()) return false;
  const gistId = localStorage.getItem(_SYNC_GIST);
  const gist = await _api('GET', '/' + gistId);
  const content = gist.files[_GIST_FILE] && gist.files[_GIST_FILE].content;
  if (!content) return false;
  const { ts, blob } = JSON.parse(content);
  const localTs = parseInt(localStorage.getItem(_SYNC_TS) || '0');
  if (ts > localTs) {
    await _verifyBlob(blob);
    localStorage.setItem('etd', blob);
    localStorage.setItem(_SYNC_TS, ts);
    clearDataCache();
    return true;
  }
  return false;
}

async function syncOnLogin() {
  if (!isSyncEnabled()) return false;
  sessionStorage.setItem('et_synced', '1');
  try { return await pullFromGist(); } catch (e) { console.warn('Sync pull failed:', e); return false; }
}

async function syncInBackground() {
  if (!isSyncEnabled() || sessionStorage.getItem('et_synced')) return;
  sessionStorage.setItem('et_synced', '1');
  try {
    const updated = await pullFromGist();
    if (updated) location.reload();
  } catch (e) { console.warn('Background sync failed:', e); }
}

async function disconnectSync() {
  [_SYNC_TOKEN, _SYNC_GIST, _SYNC_TS].forEach(k => localStorage.removeItem(k));
}
