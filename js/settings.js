let _editingCatId = null;
let _selectedColor = PRESET_COLORS[0];
let _selectedIcon = CATEGORY_ICON_CHOICES[0];
let _pendingImportData = null;
let _budgets = {};
let _budgetMonth = getCurrentMonthKey();

async function initSettings() {
  setActiveNav();
  decorateSettingIcons();
  document.getElementById('bud-prev').innerHTML = icon('chevronLeft', { size: 18 });
  document.getElementById('bud-next').innerHTML = icon('chevronRight', { size: 18 });

  const [data, cats] = await Promise.all([getData(), getCategories()]);
  _budgets = data.budgets;
  _budgetMonth = getCurrentMonthKey();

  renderBudgetEditor();
  renderPastBudgets(_budgets, getCurrentMonthKey());
  renderCategories(cats);
  buildIconPicker();
  buildColorPicker();
  initSyncSection();
}

function renderBudgetEditor() {
  document.getElementById('bud-month-label').textContent = getMonthLabel(_budgetMonth);
  document.getElementById('current-month-label').textContent = getMonthLabel(_budgetMonth);
  const val = _budgets[_budgetMonth];
  const input = document.getElementById('budget-input');
  input.value = val ? val : '';
  document.getElementById('save-budget-btn').textContent = val ? 'Update Budget' : 'Save Budget';
}

function budgetMonth(dir) {
  _budgetMonth = dir === -1 ? getPrevMonthKey(_budgetMonth) : getNextMonthKey(_budgetMonth);
  renderBudgetEditor();
}

function editBudgetMonth(key) {
  _budgetMonth = key;
  renderBudgetEditor();
  document.getElementById('budget-input').focus();
}

function decorateSettingIcons() {
  document.getElementById('add-cat-btn').innerHTML = `${icon('plus', { size: 18 })} Add Category`;
  document.getElementById('ico-export').innerHTML = icon('download', { size: 18 });
  document.getElementById('ico-import').innerHTML = icon('upload', { size: 18 });
  document.getElementById('ico-clear').innerHTML = icon('trash', { size: 18 });
  document.getElementById('ico-lock').innerHTML = icon('lock', { size: 18 });

  document.getElementById('merge-btn').innerHTML = `${icon('merge', { size: 20 })}<div style="text-align:left"><div style="font-weight:700;">Merge</div><div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">Add imported data to existing data</div></div>`;
  document.getElementById('replace-btn').innerHTML = `${icon('replace', { size: 20 })}<div style="text-align:left"><div style="font-weight:700;">Replace</div><div style="font-size:0.8rem;margin-top:2px;opacity:0.85;">Overwrite all existing data</div></div>`;
}

function renderPastBudgets(budgets, currentMonthKey) {
  const others = Object.entries(budgets).filter(([k]) => k !== currentMonthKey)
    .sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  const container = document.getElementById('past-budgets');
  if (!others.length) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <div style="font-size:0.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin:16px 0 8px;">Other Months</div>
    ${others.map(([k, v]) => `
      <div class="budget-list-item" style="cursor:pointer" onclick="editBudgetMonth('${k}')" title="Edit ${getMonthLabel(k)}">
        <span class="budget-list-month">${getMonthLabel(k)}</span>
        <span style="display:inline-flex;align-items:center;gap:10px;">
          <span class="budget-list-amount">${formatCurrency(v)}</span>
          <span style="color:var(--text-muted);display:inline-grid;">${icon('edit', { size: 15 })}</span>
        </span>
      </div>`).join('')}`;
}

async function saveBudget() {
  const val = parseFloat(document.getElementById('budget-input').value);
  if (!val || val <= 0) { showToast('Enter a valid budget amount', 'error'); return; }
  await setBudget(_budgetMonth, val);
  _budgets[_budgetMonth] = val;
  showToast(`Budget for ${getMonthLabel(_budgetMonth)} saved`, 'success');
  renderBudgetEditor();
  renderPastBudgets(_budgets, getCurrentMonthKey());
}

// ─── Categories ───

function renderCategories(cats) {
  document.getElementById('cat-list').innerHTML = cats.map(c => `
    <div class="cat-manage-item">
      ${categoryChip(c, 18)}
      <span class="cat-manage-label">${c.label}</span>
      <button class="btn btn-ghost btn-sm" onclick="openEditCatModal('${c.id}')">Edit</button>
      <button class="btn btn-danger btn-sm btn-icon" onclick="handleDeleteCat('${c.id}', '${c.label.replace(/'/g, "\\'")}')">${icon('close', { size: 15 })}</button>
    </div>`).join('');
}

function buildIconPicker() {
  document.getElementById('icon-grid').innerHTML = CATEGORY_ICON_CHOICES.map(name => `
    <button type="button" class="icon-choice ${name === _selectedIcon ? 'selected' : ''}" data-icon="${name}" onclick="selectIcon('${name}')">${icon(name, { size: 20 })}</button>`).join('');
}

function selectIcon(name) {
  _selectedIcon = name;
  document.querySelectorAll('.icon-choice').forEach(el => el.classList.toggle('selected', el.dataset.icon === name));
}

function buildColorPicker() {
  document.getElementById('color-options').innerHTML = PRESET_COLORS.map(color => `
    <div class="color-swatch ${color === _selectedColor ? 'selected' : ''}" style="background:${color};" data-color="${color}" onclick="selectColor('${color}')"></div>`).join('');
}

function selectColor(color) {
  _selectedColor = color;
  document.querySelectorAll('.color-swatch').forEach(el => el.classList.toggle('selected', el.dataset.color === color));
}

function openAddCatModal() {
  _editingCatId = null;
  document.getElementById('cat-modal-title').textContent = 'Add Category';
  document.getElementById('cat-submit').textContent = 'Add Category';
  document.getElementById('cat-name').value = '';
  _selectedColor = PRESET_COLORS[0];
  _selectedIcon = CATEGORY_ICON_CHOICES[0];
  buildIconPicker();
  buildColorPicker();
  document.getElementById('cat-modal').classList.add('open');
  setTimeout(() => document.getElementById('cat-name').focus(), 300);
}

async function openEditCatModal(id) {
  const cat = (await getCategories()).find(c => c.id === id);
  if (!cat) return;
  _editingCatId = id;
  _selectedColor = cat.color;
  _selectedIcon = categoryIconName(cat);
  document.getElementById('cat-modal-title').textContent = 'Edit Category';
  document.getElementById('cat-submit').textContent = 'Save Changes';
  document.getElementById('cat-name').value = cat.label;
  buildIconPicker();
  buildColorPicker();
  document.getElementById('cat-modal').classList.add('open');
}

function closeCatModal() {
  document.getElementById('cat-modal').classList.remove('open');
  _editingCatId = null;
}

async function submitCategory() {
  const label = document.getElementById('cat-name').value.trim();
  const btn = document.getElementById('cat-submit');
  if (!label) { showToast('Enter a category name', 'error'); return; }

  btn.textContent = 'Saving…';
  btn.classList.add('btn-loading');
  try {
    if (_editingCatId) { await updateCategory(_editingCatId, { icon: _selectedIcon, label, color: _selectedColor }); showToast('Category updated', 'success'); }
    else { await addCategory({ icon: _selectedIcon, label, color: _selectedColor }); showToast('Category added', 'success'); }
    closeCatModal();
    renderCategories(await getCategories());
  } catch {
    showToast('Failed to save category', 'error');
  } finally {
    btn.textContent = _editingCatId ? 'Save Changes' : 'Add Category';
    btn.classList.remove('btn-loading');
  }
}

async function handleDeleteCat(id, label) {
  const data = await getData();
  if (data.expenses.some(e => e.categoryId === id)) {
    showToast(`"${label}" has expenses — reassign them first`, 'error');
    return;
  }
  await deleteCategory(id);
  showToast('Category deleted', 'info');
  renderCategories(await getCategories());
}

// ─── Export / Import ───

async function handleExport() {
  try { await exportJSON(); showToast('Backup downloaded', 'success'); }
  catch { showToast('Export failed', 'error'); }
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try { _pendingImportData = JSON.parse(e.target.result); document.getElementById('import-modal').classList.add('open'); }
    catch { showToast('Invalid JSON file', 'error'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

async function confirmImport(mode) {
  closeImportModal();
  try { await importJSON(_pendingImportData, mode); showToast('Data imported', 'success'); await initSettings(); }
  catch (e) { showToast(e.message || 'Import failed', 'error'); }
  finally { _pendingImportData = null; }
}

function closeImportModal() { document.getElementById('import-modal').classList.remove('open'); }

// ─── Clear All ───

function openClearModal() { document.getElementById('clear-modal').classList.add('open'); }
function closeClearModal() { document.getElementById('clear-modal').classList.remove('open'); }

async function confirmClearAll() {
  try { await clearAllData(); closeClearModal(); showToast('All data cleared', 'info'); await initSettings(); }
  catch { showToast('Failed to clear data', 'error'); }
}

// ─── Password ───

function openChangePasswordModal() {
  document.getElementById('pw-error').style.display = 'none';
  ['pw-current', 'pw-new', 'pw-confirm'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pw-modal').classList.add('open');
  setTimeout(() => document.getElementById('pw-current').focus(), 300);
}

function closePwModal() { document.getElementById('pw-modal').classList.remove('open'); }

async function submitPasswordChange() {
  const current = document.getElementById('pw-current').value;
  const newPw = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  const err = document.getElementById('pw-error');
  const btn = document.getElementById('pw-submit');

  err.style.display = 'none';
  if (!current) { err.textContent = 'Enter your current password.'; err.style.display = 'block'; return; }
  if (newPw.length < 6) { err.textContent = 'New password must be at least 6 characters.'; err.style.display = 'block'; return; }
  if (newPw !== confirm) { err.textContent = 'Passwords do not match.'; err.style.display = 'block'; return; }

  btn.textContent = 'Updating…';
  btn.classList.add('btn-loading');
  try {
    await changePassword(current, newPw);
    closePwModal();
    showToast('Password updated', 'success');
  } catch {
    err.textContent = 'Current password is incorrect.';
    err.style.display = 'block';
  } finally {
    btn.textContent = 'Update Password';
    btn.classList.remove('btn-loading');
  }
}

['cat-modal', 'pw-modal', 'import-modal', 'clear-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target === document.getElementById(id)) document.getElementById(id).classList.remove('open');
  });
});

// ─── Cloud Sync ───

function initSyncSection() {
  document.getElementById('ico-sync').innerHTML = icon('cloudSync', { size: 18 });
  if (isSyncEnabled()) {
    document.getElementById('sync-connect-card').style.display = 'none';
    document.getElementById('sync-status-card').style.display = 'block';
    const last = getSyncLastTime();
    document.getElementById('sync-last-text').textContent = last ? 'Last synced ' + last : 'Never synced';
  } else {
    document.getElementById('sync-connect-card').style.display = 'block';
    document.getElementById('sync-status-card').style.display = 'none';
  }
}

async function connectGistSync() {
  const token = document.getElementById('sync-token-input').value.trim();
  if (!token) { showToast('Enter your GitHub token', 'error'); return; }
  const btn = document.getElementById('sync-connect-btn');
  btn.textContent = 'Connecting…';
  btn.classList.add('btn-loading');
  try {
    const result = await connectSync(token);
    showToast('Cloud sync connected', 'success');
    initSyncSection();
    if (result.action === 'pulled') {
      showToast('Newer data found in cloud — reloading…', 'info');
      setTimeout(() => location.reload(), 1800);
    }
  } catch (e) {
    showToast(e.message || 'Connection failed', 'error');
    btn.textContent = 'Connect';
    btn.classList.remove('btn-loading');
  }
}

async function manualSync() {
  const btn = document.getElementById('sync-now-btn');
  btn.textContent = 'Syncing…';
  try {
    const updated = await pullFromGist();
    if (!updated) await pushToGist();
    const last = getSyncLastTime();
    document.getElementById('sync-last-text').textContent = last ? 'Last synced ' + last : 'Synced';
    showToast(updated ? 'Data updated from cloud' : 'Already up to date', updated ? 'success' : 'info');
    if (updated) setTimeout(() => location.reload(), 1200);
  } catch (e) {
    showToast('Sync failed — check your connection', 'error');
  } finally {
    btn.textContent = 'Sync Now';
  }
}

async function disconnectGistSync() {
  await disconnectSync();
  initSyncSection();
  showToast('Cloud sync disconnected', 'info');
}

requireAuth(initSettings);
