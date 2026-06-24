let _currentMonth = getCurrentMonthKey();
let _trendChart = null;
let _pmChart = null;

async function initAnalytics() {
  setActiveNav();
  document.getElementById('prev-month-btn').innerHTML = icon('chevronLeft', { size: 18 });
  document.getElementById('next-month-btn').innerHTML = icon('chevronRight', { size: 18 });
  await renderAnalytics();
}

async function renderAnalytics() {
  document.getElementById('month-label').textContent = getMonthLabel(_currentMonth);
  document.getElementById('analytics-subtitle').textContent = `Insights for ${getMonthLabel(_currentMonth)}`;

  const isCurrentMonth = _currentMonth === getCurrentMonthKey();
  document.getElementById('next-month-btn').disabled = isCurrentMonth;
  document.getElementById('next-month-btn').style.opacity = isCurrentMonth ? '0.3' : '1';

  const [data, cats] = await Promise.all([getData(), getCategories()]);
  const expenses = data.expenses.filter(e => getMonthKey(e.date) === _currentMonth);
  const budget = data.budgets[_currentMonth] || 0;
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = budget - spent;
  const pct = budget > 0 ? clamp((spent / budget) * 100, 0, 100) : 0;

  // Donut
  document.getElementById('donut-pct').textContent = Math.round(pct) + '%';
  document.getElementById('a-budget').textContent = formatCurrency(budget);
  document.getElementById('a-spent').textContent = formatCurrency(spent);
  document.getElementById('a-remaining').textContent = formatCurrency(remaining);
  document.getElementById('a-remaining').style.color = remaining < 0 ? 'var(--danger)' : 'var(--success)';

  const circumference = 502;
  const offset = circumference - (pct / 100) * circumference;
  const donutFill = document.getElementById('donut-fill');
  setTimeout(() => { donutFill.style.strokeDashoffset = offset; }, 150);
  if (pct >= 100) donutFill.classList.add('danger'); else donutFill.classList.remove('danger');

  // Category bars
  renderCategoryBars(expenses, cats, spent);

  // Trend chart
  await renderTrendChart();

  // Payment method chart
  renderPmChart(expenses);

  // Insights
  renderInsights(expenses, budget, spent);

  // Comparison table
  await renderCompareTable(cats, data);
}

function renderCategoryBars(expenses, cats, totalSpent) {
  const totals = {};
  cats.forEach(c => { totals[c.id] = 0; });
  expenses.forEach(e => { if (totals[e.categoryId] !== undefined) totals[e.categoryId] += e.amount; });

  const sorted = cats
    .map(c => ({ ...c, total: totals[c.id] || 0 }))
    .sort((a, b) => b.total - a.total);

  const container = document.getElementById('cat-bars');
  if (!sorted.some(c => c.total > 0)) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:16px 0;">No expenses this month</p>';
    return;
  }

  container.innerHTML = sorted.map(c => {
    if (c.total === 0) return '';
    const pct = totalSpent > 0 ? (c.total / totalSpent) * 100 : 0;
    return `
      <div class="cat-bar-item">
        ${categoryChip(c, 20)}
        <div class="cat-bar-info">
          <div class="cat-bar-label">
            <span>${c.label}</span>
            <span style="color:var(--text-secondary)">${formatCurrency(c.total)}</span>
          </div>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:0%;background:${c.color};" data-width="${pct}"></div>
          </div>
        </div>
      </div>`;
  }).join('');

  setTimeout(() => {
    container.querySelectorAll('.cat-bar-fill').forEach(el => {
      el.style.width = el.dataset.width + '%';
    });
  }, 200);
}

async function renderTrendChart() {
  const months = await getMonthlyTotals(6);
  const ctx = document.getElementById('trend-chart').getContext('2d');

  if (_trendChart) { _trendChart.destroy(); _trendChart = null; }

  _trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label: 'Total Spent',
        data: months.map(m => m.total),
        borderColor: '#8B9CFF',
        backgroundColor: 'rgba(139,156,255,0.13)',
        borderWidth: 2.5,
        pointBackgroundColor: '#8B9CFF',
        pointBorderColor: '#15161f',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e1f2b',
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.7)',
          padding: 12,
          callbacks: {
            label: ctx => formatCurrency(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 12 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: 'rgba(255,255,255,0.5)',
            font: { size: 12 },
            callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v)
          }
        }
      }
    }
  });
}

function renderPmChart(expenses) {
  const totals = { upi: 0, cash: 0, card: 0, netbanking: 0 };
  expenses.forEach(e => { if (totals[e.paymentMethod] !== undefined) totals[e.paymentMethod] += e.amount; });

  const pmColors = { upi: '#6E8BFF', cash: '#6FD79A', card: '#B98CF5', netbanking: '#FFC24B' };
  const labels = PAYMENT_METHODS.map(p => p.label);
  const values = PAYMENT_METHODS.map(p => totals[p.id]);
  const colors = PAYMENT_METHODS.map(p => pmColors[p.id]);

  const canvas = document.getElementById('pm-chart');
  if (_pmChart) { _pmChart.destroy(); _pmChart = null; }

  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) {
    canvas.style.display = 'none';
    document.getElementById('pm-legend').innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:30px 0;">No expenses yet</p>';
    return;
  }

  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  _pmChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#1a1b26',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e1f2b',
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${formatCurrency(ctx.parsed)} (${Math.round(ctx.parsed / total * 100)}%)`
          }
        }
      }
    }
  });

  // Legend
  document.getElementById('pm-legend').innerHTML = PAYMENT_METHODS
    .filter((_, i) => values[i] > 0)
    .map(p => {
      const i = PAYMENT_METHODS.indexOf(p);
      const pct = Math.round(values[i] / total * 100);
      return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;">
        <div style="display:flex;align-items:center;gap:9px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${colors[i]};flex-shrink:0;"></div>
          <span style="font-size:0.82rem;color:var(--text-secondary);display:inline-flex;align-items:center;gap:6px;">${icon(p.icon, { size: 14 })} ${p.label}</span>
        </div>
        <span style="font-size:0.82rem;font-weight:600;">${pct}%</span>
      </div>`;
    }).join('');
}

function renderInsights(expenses, budget, spent) {
  const container = document.getElementById('insights-list');
  if (!expenses.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:16px 0;">No data for this month</p>';
    return;
  }

  // Highest spend day
  const byDay = {};
  expenses.forEach(e => { byDay[e.date] = (byDay[e.date] || 0) + e.amount; });
  const highDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];

  // Most expensive transaction
  const maxTx = expenses.reduce((m, e) => e.amount > m.amount ? e : m, expenses[0]);

  // Daily average
  const daysInMonth = new Date(new Date(_currentMonth + '-01').getFullYear(), new Date(_currentMonth + '-01').getMonth() + 1, 0).getDate();
  const avgDaily = spent / daysInMonth;

  const budgetPerDay = budget > 0 ? budget / daysInMonth : 0;

  const items = [
    { ico: 'flame', label: 'Highest spend day', value: highDay ? `${formatDate(highDay[0])} · ${formatCurrency(highDay[1])}` : '—' },
    { ico: 'coins', label: 'Biggest transaction', value: formatCurrency(maxTx.amount) + (maxTx.note ? ` · ${maxTx.note}` : '') },
    { ico: 'trendingUp', label: 'Daily average', value: formatCurrency(Math.round(avgDaily)) },
    { ico: 'target', label: 'Budget per day', value: budgetPerDay > 0 ? formatCurrency(Math.round(budgetPerDay)) : 'No budget set' },
    { ico: 'receipt', label: 'Total transactions', value: expenses.length },
    { ico: 'layers', label: 'Avg per transaction', value: formatCurrency(Math.round(spent / expenses.length)) }
  ];

  container.innerHTML = items.map(item => `
    <div class="insight-item">
      <span class="insight-label"><span class="ico">${icon(item.ico, { size: 15 })}</span>${item.label}</span>
      <span class="insight-value">${item.value}</span>
    </div>`).join('');
}

async function renderCompareTable(cats, data) {
  const months = [];
  let key = _currentMonth;
  for (let i = 0; i < 3; i++) { months.push(key); key = getPrevMonthKey(key); }

  const head = document.getElementById('compare-head');
  head.innerHTML = '<th>Category</th>' + months.map(m => `<th>${getShortMonthLabel(m)}</th>`).join('');

  // Total row first
  const totals = months.map(m => data.expenses.filter(e => getMonthKey(e.date) === m).reduce((s, e) => s + e.amount, 0));

  const catRows = cats.map(c => {
    const vals = months.map(m => data.expenses.filter(e => getMonthKey(e.date) === m && e.categoryId === c.id).reduce((s, e) => s + e.amount, 0));
    if (vals.every(v => v === 0)) return null;
    return { cat: c, vals };
  }).filter(Boolean);

  const body = document.getElementById('compare-body');
  body.innerHTML = [
    `<tr>
      <td><span class="compare-cat" style="font-weight:700;">Total</span></td>
      ${totals.map(v => `<td style="font-weight:700;color:var(--accent-blue)">${formatCurrency(v)}</td>`).join('')}
    </tr>`,
    ...catRows.map(({ cat, vals }) => `
      <tr>
        <td><span class="compare-cat"><span class="compare-dot" style="background:${cat.color}"></span>${cat.label}</span></td>
        ${vals.map(v => `<td>${v > 0 ? formatCurrency(v) : '<span style="color:var(--text-muted);">—</span>'}</td>`).join('')}
      </tr>`)
  ].join('');
}

function changeMonth(dir) {
  if (dir === 1 && _currentMonth === getCurrentMonthKey()) return;
  _currentMonth = dir === -1 ? getPrevMonthKey(_currentMonth) : getNextMonthKey(_currentMonth);
  renderAnalytics();
}

requireAuth(initAnalytics);
