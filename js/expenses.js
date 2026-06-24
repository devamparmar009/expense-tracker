let _categories = [];
let _allExpenses = [];
let _currentMonth = getCurrentMonthKey();
let _editingId = null;
let _selectedCatId = null;
let _selectedPm = 'upi';
let _deleteTargetId = null;

async function initExpenses() {
  setActiveNav();

  // Static icons
  document.getElementById('add-btn').innerHTML = `${icon('plus', { size: 18 })} Add Expense`;
  document.getElementById('fab-btn').innerHTML = icon('plus', { size: 26 });
  document.getElementById('prev-month-btn').innerHTML = icon('chevronLeft', { size: 18 });
  document.getElementById('next-month-btn').innerHTML = icon('chevronRight', { size: 18 });
  document.getElementById('search-ico').innerHTML = icon('search', { size: 17 });

  const [data, cats] = await Promise.all([getData(), getCategories()]);
  _categories = cats;
  _allExpenses = data.expenses;

  populateCatFilter();
  buildCategoryGrid();
  buildPmTabs();
  document.getElementById('exp-date').value = getTodayStr();

  renderMonth();
}

function populateCatFilter() {
  document.getElementById('cat-filter').innerHTML = '<option value="">All Categories</option>' +
    _categories.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
}

function renderMonth() {
  document.getElementById('month-label').textContent = getMonthLabel(_currentMonth);
  const isCurrent = _currentMonth === getCurrentMonthKey();
  const nextBtn = document.getElementById('next-month-btn');
  nextBtn.disabled = isCurrent;
  nextBtn.style.opacity = isCurrent ? '0.3' : '1';

  const monthExpenses = _allExpenses.filter(e => getMonthKey(e.date) === _currentMonth);
  updateSummary(monthExpenses);
  applyFilters();
}

async function updateSummary(expenses) {
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const budget = await getBudget(_currentMonth);
  const remaining = budget - spent;
  document.getElementById('sum-budget').textContent = formatCurrency(budget);
  document.getElementById('sum-spent').textContent = formatCurrency(spent);
  document.getElementById('sum-remaining').textContent = formatCurrency(remaining);
  document.getElementById('sum-remaining').style.color = remaining < 0 ? 'var(--danger)' : 'var(--success)';
  document.getElementById('sum-count').textContent = expenses.length;
}

function changeMonth(dir) {
  if (dir === 1 && _currentMonth === getCurrentMonthKey()) return;
  _currentMonth = dir === -1 ? getPrevMonthKey(_currentMonth) : getNextMonthKey(_currentMonth);
  renderMonth();
}

function applyFilters() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const catFilter = document.getElementById('cat-filter').value;
  const pmFilter = document.getElementById('pm-filter').value;

  let filtered = _allExpenses.filter(e => getMonthKey(e.date) === _currentMonth);
  if (search) filtered = filtered.filter(e => (e.note || '').toLowerCase().includes(search));
  if (catFilter) filtered = filtered.filter(e => e.categoryId === catFilter);
  if (pmFilter) filtered = filtered.filter(e => e.paymentMethod === pmFilter);

  renderTransactionList(filtered);
}

function renderTransactionList(expenses) {
  const catMap = Object.fromEntries(_categories.map(c => [c.id, c]));
  const container = document.getElementById('tx-list');

  if (!expenses.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('inbox', { size: 26 })}</div><h3>No expenses found</h3><p>Add your first expense for this month</p></div>`;
    return;
  }

  const groups = {};
  [...expenses].sort((a, b) => b.date.localeCompare(a.date) || new Date(b.createdAt) - new Date(a.createdAt))
    .forEach(e => { (groups[e.date] = groups[e.date] || []).push(e); });

  container.innerHTML = Object.entries(groups).map(([date, items]) => `
    <div class="tx-date-group">
      <div class="tx-date-label">${formatDate(date)} · ${formatCurrency(items.reduce((s, e) => s + e.amount, 0))}</div>
      ${items.map(e => renderTxItem(e, catMap)).join('')}
    </div>`).join('');
}

function renderTxItem(e, catMap) {
  const cat = catMap[e.categoryId] || { color: '#8B93FF', label: 'Other' };
  const pm = PAYMENT_METHODS.find(p => p.id === e.paymentMethod) || { icon: 'card', label: e.paymentMethod };
  return `
    <div class="tx-item">
      ${categoryChip(cat, 20)}
      <div class="tx-info">
        <div class="tx-note">${escapeHtml(e.note) || cat.label}</div>
        <div class="tx-meta"><span style="color:var(--text-muted)">${cat.label}</span><span class="pm-pill">${icon(pm.icon, { size: 12 })} ${pm.label}</span></div>
      </div>
      <div class="tx-amount" style="color:var(--danger)">−${formatCurrency(e.amount)}</div>
      <div class="tx-actions">
        <button class="tx-action-btn edit" onclick="editExpense('${e.id}')" title="Edit">${icon('edit', { size: 15 })}</button>
        <button class="tx-action-btn delete" onclick="confirmDelete('${e.id}')" title="Delete">${icon('trash', { size: 15 })}</button>
      </div>
    </div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ─── Modal ───

function buildCategoryGrid() {
  document.getElementById('cat-grid').innerHTML = _categories.map(c => `
    <button class="cat-btn ${_selectedCatId === c.id ? 'selected' : ''}" data-id="${c.id}" onclick="selectCat('${c.id}')">
      <span class="cat-ico" style="background:color-mix(in oklch,${c.color} 18%,transparent);color:${c.color}">${icon(categoryIconName(c), { size: 20 })}</span>
      <span>${c.label}</span>
    </button>`).join('');
}

function selectCat(id) {
  _selectedCatId = id;
  document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.toggle('selected', btn.dataset.id === id));
}

function buildPmTabs() {
  document.getElementById('pm-tabs').innerHTML = PAYMENT_METHODS.map(p => `
    <button class="pm-tab ${p.id === _selectedPm ? 'selected' : ''}" data-id="${p.id}" onclick="selectPm('${p.id}')">
      ${icon(p.icon, { size: 22 })}<span>${p.label}</span>
    </button>`).join('');
}

function selectPm(id) {
  _selectedPm = id;
  document.querySelectorAll('.pm-tab').forEach(btn => btn.classList.toggle('selected', btn.dataset.id === id));
}

function openExpenseModal() {
  _editingId = null;
  document.getElementById('modal-title').textContent = 'Add Expense';
  document.getElementById('exp-submit').textContent = 'Add Expense';
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-note').value = '';
  document.getElementById('exp-date').value = getTodayStr();
  _selectedCatId = null;
  _selectedPm = 'upi';
  buildCategoryGrid();
  buildPmTabs();
  document.getElementById('expense-modal').classList.add('open');
  setTimeout(() => document.getElementById('exp-amount').focus(), 400);
}

function closeExpenseModal() {
  document.getElementById('expense-modal').classList.remove('open');
  _editingId = null;
}

function editExpense(id) {
  const expense = _allExpenses.find(e => e.id === id);
  if (!expense) return;
  _editingId = id;
  _selectedCatId = expense.categoryId;
  _selectedPm = expense.paymentMethod;
  document.getElementById('modal-title').textContent = 'Edit Expense';
  document.getElementById('exp-submit').textContent = 'Save Changes';
  document.getElementById('exp-amount').value = expense.amount;
  document.getElementById('exp-note').value = expense.note || '';
  document.getElementById('exp-date').value = expense.date;
  buildCategoryGrid();
  buildPmTabs();
  document.getElementById('expense-modal').classList.add('open');
  setTimeout(() => document.getElementById('exp-amount').focus(), 400);
}

async function submitExpense() {
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const note = document.getElementById('exp-note').value.trim();
  const date = document.getElementById('exp-date').value;
  const btn = document.getElementById('exp-submit');

  if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
  if (!_selectedCatId) { showToast('Select a category', 'error'); return; }
  if (!date) { showToast('Select a date', 'error'); return; }

  btn.textContent = 'Saving…';
  btn.classList.add('btn-loading');
  const expense = { amount, categoryId: _selectedCatId, note, paymentMethod: _selectedPm, date };

  try {
    if (_editingId) { await updateExpense(_editingId, expense); showToast('Expense updated', 'success'); }
    else { await addExpense(expense); showToast('Expense added', 'success'); }
    closeExpenseModal();
    _allExpenses = (await getData()).expenses;
    renderMonth();
  } catch {
    showToast('Failed to save expense', 'error');
  } finally {
    btn.textContent = _editingId ? 'Save Changes' : 'Add Expense';
    btn.classList.remove('btn-loading');
  }
}

function confirmDelete(id) {
  _deleteTargetId = id;
  document.getElementById('delete-modal').classList.add('open');
  document.getElementById('delete-confirm-btn').onclick = async () => {
    await deleteExpense(_deleteTargetId);
    _allExpenses = (await getData()).expenses;
    closeDeleteModal();
    renderMonth();
    showToast('Expense deleted', 'info');
  };
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.remove('open');
  _deleteTargetId = null;
}

document.getElementById('expense-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('expense-modal')) closeExpenseModal();
});
document.getElementById('delete-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
});

requireAuth(initExpenses);
