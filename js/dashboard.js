let _categories = [];
let _editingId = null;
let _selectedCatId = null;
let _selectedPm = 'upi';

async function initDashboard() {
  setActiveNav();
  initParticles();
  decorateStaticIcons();

  const monthKey = getCurrentMonthKey();
  document.getElementById('month-label').textContent = getMonthLabel(monthKey);

  const [data, cats] = await Promise.all([getData(), getCategories()]);
  _categories = cats;

  const expenses = data.expenses.filter(e => getMonthKey(e.date) === monthKey);
  const budget = data.budgets[monthKey] || 0;
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = budget - spent;
  const pct = budget > 0 ? clamp((spent / budget) * 100, 0, 100) : 0;
  const daysLeft = getDaysLeftInMonth();

  // Hero
  animateCountUp(document.getElementById('hero-remaining'), Math.abs(remaining), 900, remaining < 0 ? '-₹' : '₹');
  document.getElementById('hero-remaining').style.color = remaining < 0 ? 'var(--danger)' : 'var(--text-primary)';
  document.getElementById('hero-budget').textContent = formatCurrency(budget);
  document.getElementById('donut-remaining').textContent = formatCurrency(remaining);
  document.getElementById('hero-add-btn').innerHTML = `${icon('plus', { size: 18 })} Add Expense`;
  document.getElementById('fab-btn').innerHTML = icon('plus', { size: 26 });

  // Budget fill
  const fill = document.getElementById('budget-fill');
  setTimeout(() => { fill.style.width = pct + '%'; }, 100);
  fill.classList.toggle('danger', pct >= 100);
  fill.classList.toggle('warning', pct >= 80 && pct < 100);

  // Overspent banner
  const banner = document.getElementById('overspent-banner');
  if (remaining < 0) {
    banner.style.display = 'flex';
    banner.innerHTML = `${icon('alert', { size: 18 })} You've exceeded your budget this month`;
  } else {
    banner.style.display = 'none';
  }

  // Donut ring
  const offset = 502 - (pct / 100) * 502;
  const donutFill = document.getElementById('donut-fill');
  setTimeout(() => { donutFill.style.strokeDashoffset = offset; }, 150);
  donutFill.classList.toggle('danger', pct >= 100);

  // Stat cards
  renderStatCards({ spent, remaining, budget, pct, daysLeft });

  // Sections
  renderTopCategories(expenses, cats);
  renderRecentTransactions(expenses, cats);

  // Modal scaffolding
  buildCategoryGrid();
  buildPmTabs();
  document.getElementById('exp-date').value = getTodayStr();
}

function decorateStaticIcons() {
  const tl = document.getElementById('topcat-link');
  if (tl && !tl.querySelector('svg')) tl.innerHTML = `See all ${icon('arrowRight', { size: 15 })}`;
  const rl = document.getElementById('recent-link');
  if (rl && !rl.querySelector('svg')) rl.innerHTML = `View all ${icon('arrowRight', { size: 15 })}`;
}

function renderStatCards({ spent, remaining, budget, pct, daysLeft }) {
  const dailyLeft = (daysLeft > 0 && remaining > 0) ? formatCurrency(Math.round(remaining / daysLeft)) + '/day left' : '—';

  document.getElementById('card-spent').innerHTML = `
    <div class="stat-head"><span class="stat-ico" style="background:color-mix(in oklch,var(--danger) 16%,transparent);color:var(--danger)">${icon('trendingUp', { size: 18 })}</span><span class="stat-label">Total Spent</span></div>
    <div class="stat-value" id="stat-spent" style="color:var(--danger)">₹0</div>
    <div class="stat-sub">${budget > 0 ? Math.round(pct) + '% of budget' : 'No budget set'}</div>`;

  document.getElementById('card-remaining').innerHTML = `
    <div class="stat-head"><span class="stat-ico" style="background:color-mix(in oklch,var(--success) 16%,transparent);color:var(--success)">${icon('wallet', { size: 18 })}</span><span class="stat-label">Remaining</span></div>
    <div class="stat-value" id="stat-remaining" style="color:${remaining < 0 ? 'var(--danger)' : 'var(--success)'}">₹0</div>
    <div class="stat-sub">${dailyLeft}</div>`;

  document.getElementById('card-days').innerHTML = `
    <div class="stat-head"><span class="stat-ico">${icon('calendar', { size: 18 })}</span><span class="stat-label">Days Left</span></div>
    <div class="stat-value">${daysLeft}</div>
    <div class="stat-sub">in this month</div>`;

  animateCountUp(document.getElementById('stat-spent'), spent, 900);
  animateCountUp(document.getElementById('stat-remaining'), Math.abs(remaining), 900, remaining < 0 ? '-₹' : '₹');
}

function renderTopCategories(expenses, cats) {
  const totals = {};
  cats.forEach(c => { totals[c.id] = 0; });
  expenses.forEach(e => { if (totals[e.categoryId] !== undefined) totals[e.categoryId] += e.amount; });

  const sorted = cats.map(c => ({ ...c, total: totals[c.id] || 0 }))
    .filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 4);

  const container = document.getElementById('top-categories');
  if (!sorted.length) {
    container.innerHTML = emptyState('chart', 'No expenses yet', 'Add one to see your top categories');
    return;
  }

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  container.innerHTML = sorted.map(c => {
    const pct = totalSpent > 0 ? (c.total / totalSpent) * 100 : 0;
    return `
      <div class="cat-bar-item">
        ${categoryChip(c, 20)}
        <div class="cat-bar-info">
          <div class="cat-bar-label"><span>${c.label}</span><span style="color:var(--text-secondary)">${formatCurrency(c.total)}</span></div>
          <div class="cat-bar-track"><div class="cat-bar-fill" style="width:0%;background:${c.color}" data-width="${pct}"></div></div>
        </div>
      </div>`;
  }).join('');

  setTimeout(() => container.querySelectorAll('.cat-bar-fill').forEach(el => { el.style.width = el.dataset.width + '%'; }), 200);
}

function renderRecentTransactions(expenses, cats) {
  const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const container = document.getElementById('recent-transactions');

  if (!sorted.length) {
    container.innerHTML = emptyState('inbox', 'No transactions yet', 'Your recent expenses will appear here');
    return;
  }

  container.innerHTML = sorted.map(e => {
    const cat = catMap[e.categoryId] || { color: '#8B93FF', label: 'Other' };
    const pm = PAYMENT_METHODS.find(p => p.id === e.paymentMethod) || { icon: 'card', label: e.paymentMethod };
    return `
      <div class="tx-item">
        ${categoryChip(cat, 20)}
        <div class="tx-info">
          <div class="tx-note">${escapeHtml(e.note) || cat.label}</div>
          <div class="tx-meta"><span>${formatDate(e.date)}</span><span class="pm-pill">${icon(pm.icon, { size: 12 })} ${pm.label}</span></div>
        </div>
        <div class="tx-amount" style="color:var(--danger)">−${formatCurrency(e.amount)}</div>
      </div>`;
  }).join('');
}

function emptyState(iconName, title, sub) {
  return `<div class="empty-state"><div class="empty-icon">${icon(iconName, { size: 26 })}</div><h3>${title}</h3><p>${sub}</p></div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ─── Modal ───

function buildCategoryGrid() {
  const grid = document.getElementById('cat-grid');
  grid.innerHTML = _categories.map(c => `
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

  try {
    await addExpense({ amount, categoryId: _selectedCatId, note, paymentMethod: _selectedPm, date });
    showToast('Expense added', 'success');
    closeExpenseModal();
    await initDashboard();
  } catch {
    showToast('Failed to save', 'error');
  } finally {
    btn.textContent = 'Add Expense';
    btn.classList.remove('btn-loading');
  }
}

document.getElementById('expense-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('expense-modal')) closeExpenseModal();
});

// ─── Particles ───

function initParticles() {
  if (typeof particlesJS === 'undefined') return;
  particlesJS('particles-js', {
    particles: {
      number: { value: 44, density: { enable: true, value_area: 900 } },
      color: { value: '#8B9CFF' },
      shape: { type: 'circle' },
      opacity: { value: 0.3, random: true },
      size: { value: 2, random: true },
      line_linked: { enable: true, distance: 150, color: '#8B9CFF', opacity: 0.08, width: 1 },
      move: { enable: true, speed: 0.5, random: true, out_mode: 'out' }
    },
    interactivity: {
      detect_on: 'canvas',
      events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: false } },
      modes: { grab: { distance: 150, line_linked: { opacity: 0.25 } } }
    },
    retina_detect: true
  });
}

requireAuth(initDashboard);
