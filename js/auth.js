// ─── In-memory session key ───
let _sessionKey = null;

// Shared, app-wide salt. The AES key is derived from (password + salt). Using
// one fixed salt means the SAME password produces the SAME key on every
// device — which is what lets encrypted data sync across devices. Earlier
// builds used a random per-device salt, so a blob encrypted on one device
// could not be decrypted on another even with the identical password.
const APP_SALT_STR = 'expense-tracker::shared-salt::v1';
const APP_SALT = new TextEncoder().encode(APP_SALT_STR);
const APP_SALT_B64 = btoa(APP_SALT_STR);

// ─── Crypto helpers ───

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(data))
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedStr, key) {
  try {
    const combined = Uint8Array.from(atob(encryptedStr), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  }
}

async function hashForVerification(password, salt) {
  const enc = new TextEncoder();
  const combined = new Uint8Array([...enc.encode(password + 'etverify'), ...salt]);
  const hash = await crypto.subtle.digest('SHA-256', combined);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

// ─── Session persistence (survives page navigation within tab) ───

async function storeSessionKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  sessionStorage.setItem('et_sk', btoa(String.fromCharCode(...new Uint8Array(raw))));
}

async function restoreSessionKey() {
  const stored = sessionStorage.getItem('et_sk');
  if (!stored) return null;
  try {
    const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
    _sessionKey = key;
    return key;
  } catch {
    return null;
  }
}

// ─── Public API ───

function isInitialized() {
  return !!localStorage.getItem('et_meta');
}

function getSessionKey() {
  if (!_sessionKey) throw new Error('Not authenticated');
  return _sessionKey;
}

async function initializeApp(password) {
  const salt = APP_SALT;
  const key = await deriveKey(password, salt);
  const verificationHash = await hashForVerification(password, salt);

  localStorage.setItem('et_meta', JSON.stringify({
    salt: APP_SALT_B64,
    verificationHash
  }));

  const initialData = {
    version: 1,
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    budgets: { [getCurrentMonthKey()]: DEFAULT_BUDGET },
    expenses: []
  };

  const encrypted = await encryptData(initialData, key);
  localStorage.setItem('etd', encrypted);

  _sessionKey = key;
  await storeSessionKey(key);
  return key;
}

async function login(password) {
  const meta = JSON.parse(localStorage.getItem('et_meta'));
  const salt = Uint8Array.from(atob(meta.salt), c => c.charCodeAt(0));
  const verificationHash = await hashForVerification(password, salt);

  if (verificationHash !== meta.verificationHash) {
    throw new Error('Invalid password');
  }

  let key = await deriveKey(password, salt);

  // Migrate a legacy per-device random salt to the shared app salt, so this
  // device's data becomes portable and can sync. Done here because login is
  // the one place we have the plaintext password to re-derive the key.
  if (meta.salt !== APP_SALT_B64) {
    const data = await decryptData(localStorage.getItem('etd'), key);
    key = await deriveKey(password, APP_SALT);
    if (data) localStorage.setItem('etd', await encryptData(data, key));
    localStorage.setItem('et_meta', JSON.stringify({
      salt: APP_SALT_B64,
      verificationHash: await hashForVerification(password, APP_SALT)
    }));
    if (typeof clearDataCache === 'function') clearDataCache();
  }

  _sessionKey = key;
  await storeSessionKey(key);
  return key;
}

async function changePassword(currentPassword, newPassword) {
  await login(currentPassword);
  const encryptedData = localStorage.getItem('etd');
  const data = await decryptData(encryptedData, _sessionKey);

  const newKey = await deriveKey(newPassword, APP_SALT);
  const newVerificationHash = await hashForVerification(newPassword, APP_SALT);

  const newEncrypted = await encryptData(data, newKey);

  localStorage.setItem('et_meta', JSON.stringify({
    salt: APP_SALT_B64,
    verificationHash: newVerificationHash
  }));
  localStorage.setItem('etd', newEncrypted);

  _sessionKey = newKey;
  await storeSessionKey(newKey);
  if (typeof clearDataCache === 'function') clearDataCache();
}

// ─── Auth Gate UI ───
// Each page calls requireAuth() on load. It shows the overlay, checks for
// a valid session key, and resolves only when authenticated.

async function requireAuth(onAuthenticated) {
  const overlay = document.getElementById('auth-overlay');
  const main = document.getElementById('main-content');

  // A legacy per-device salt must migrate to the shared app salt before sync
  // can work. Migration needs the password, so drop any restored session and
  // require one fresh login (which performs the migration transparently).
  let needsMigration = false;
  if (isInitialized()) {
    try { needsMigration = JSON.parse(localStorage.getItem('et_meta')).salt !== APP_SALT_B64; } catch {}
  }
  if (needsMigration) sessionStorage.removeItem('et_sk');

  // Try restoring session from sessionStorage first
  const restoredKey = needsMigration ? null : await restoreSessionKey();
  if (restoredKey) {
    if (overlay) overlay.style.display = 'none';
    if (main) main.style.display = 'block';
    onAuthenticated();
    if (typeof syncInBackground === 'function') syncInBackground().catch(() => {});
    return;
  }

  // Show overlay
  if (overlay) overlay.style.display = 'flex';
  if (main) main.style.display = 'none';

  if (!isInitialized()) {
    renderSetupForm(overlay, onAuthenticated, main);
  } else {
    renderLoginForm(overlay, onAuthenticated, main);
  }
}

function renderSetupForm(overlay, onAuthenticated, main) {
  overlay.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <div class="logo-ring"><svg class="icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg></div>
        <h1>Expense Tracker</h1>
        <p>Set a password to secure your data</p>
      </div>
      <div class="auth-error" id="auth-error"></div>
      <div class="form-group">
        <label>Create Password</label>
        <input type="password" id="auth-pw" placeholder="Choose a strong password" autocomplete="new-password" />
      </div>
      <div class="form-group">
        <label>Confirm Password</label>
        <input type="password" id="auth-pw2" placeholder="Repeat your password" autocomplete="new-password" />
      </div>
      <button class="btn btn-primary btn-full" id="auth-submit" onclick="handleSetup()">
        Get Started
      </button>
    </div>`;
  setTimeout(() => document.getElementById('auth-pw')?.focus(), 100);

  window.handleSetup = async function () {
    const pw = document.getElementById('auth-pw').value;
    const pw2 = document.getElementById('auth-pw2').value;
    const err = document.getElementById('auth-error');
    const btn = document.getElementById('auth-submit');

    if (pw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; err.style.display = 'block'; return; }
    if (pw !== pw2) { err.textContent = 'Passwords do not match.'; err.style.display = 'block'; return; }

    btn.textContent = 'Setting up…';
    btn.classList.add('btn-loading');
    err.style.display = 'none';

    try {
      await initializeApp(pw);
      if (typeof syncOnLogin === 'function') {
        await Promise.race([syncOnLogin(), new Promise(r => setTimeout(r, 5000))]);
      }
      overlay.style.display = 'none';
      if (main) main.style.display = 'block';
      onAuthenticated();
    } catch (e) {
      err.textContent = 'Setup failed. Please try again.';
      err.style.display = 'block';
      btn.textContent = 'Get Started';
      btn.classList.remove('btn-loading');
    }
  };

  document.addEventListener('keydown', function kd(e) {
    if (e.key === 'Enter') { window.handleSetup(); document.removeEventListener('keydown', kd); }
  });
}

function renderLoginForm(overlay, onAuthenticated, main) {
  overlay.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <div class="logo-ring"><svg class="icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg></div>
        <h1>Expense Tracker</h1>
        <p>Enter your password to continue</p>
      </div>
      <div class="auth-error" id="auth-error"></div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="auth-pw" placeholder="Your password" autocomplete="current-password" />
      </div>
      <button class="btn btn-primary btn-full" id="auth-submit" onclick="handleLogin()">
        Unlock
      </button>
    </div>`;
  setTimeout(() => document.getElementById('auth-pw')?.focus(), 100);

  window.handleLogin = async function () {
    const pw = document.getElementById('auth-pw').value;
    const err = document.getElementById('auth-error');
    const btn = document.getElementById('auth-submit');

    if (!pw) { err.textContent = 'Please enter your password.'; err.style.display = 'block'; return; }

    btn.textContent = 'Unlocking…';
    btn.classList.add('btn-loading');
    err.style.display = 'none';

    try {
      await login(pw);
      if (typeof syncOnLogin === 'function') {
        await Promise.race([syncOnLogin(), new Promise(r => setTimeout(r, 5000))]);
      }
      overlay.style.display = 'none';
      if (main) main.style.display = 'block';
      onAuthenticated();
    } catch {
      err.textContent = 'Incorrect password. Try again.';
      err.style.display = 'block';
      document.getElementById('auth-pw').value = '';
      document.getElementById('auth-pw').focus();
      btn.textContent = 'Unlock';
      btn.classList.remove('btn-loading');
    }
  };

  document.addEventListener('keydown', function kd(e) {
    if (e.key === 'Enter') { window.handleLogin(); document.removeEventListener('keydown', kd); }
  });
}
