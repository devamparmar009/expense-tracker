// All reads/writes go through auth.js encrypt/decrypt.
// Call getData() to get the decrypted data object.
// Call saveData(data) to encrypt and persist.

let _dataCache = null;

function clearDataCache() { _dataCache = null; }

async function getData() {
  if (_dataCache) return _dataCache;
  const key = getSessionKey();
  const encrypted = localStorage.getItem('etd');
  if (!encrypted) return null;
  const data = await decryptData(encrypted, key);
  _dataCache = data ? migrateData(data) : null;
  return _dataCache;
}

// Upgrade legacy emoji-based categories to icon keys (non-destructive,
// in-memory; persisted next time the data is saved).
function migrateData(data) {
  if (Array.isArray(data.categories)) {
    data.categories.forEach(c => {
      if (!c.icon || (typeof ICONS !== 'undefined' && !ICONS[c.icon])) {
        c.icon = (typeof categoryIconName === 'function') ? categoryIconName(c) : 'tag';
      }
    });
  }
  return data;
}

async function saveData(data) {
  _dataCache = data;
  const key = getSessionKey();
  const encrypted = await encryptData(data, key);
  localStorage.setItem('etd', encrypted);
  if (typeof pushToGist === 'function') pushToGist(encrypted).catch(() => {});
}

// ─── Expenses ───

async function addExpense(expense) {
  const data = await getData();
  expense.id = generateUUID();
  expense.createdAt = new Date().toISOString();
  data.expenses.push(expense);
  await saveData(data);
  return expense;
}

async function updateExpense(id, updates) {
  const data = await getData();
  const idx = data.expenses.findIndex(e => e.id === id);
  if (idx === -1) return;
  data.expenses[idx] = { ...data.expenses[idx], ...updates };
  await saveData(data);
}

async function deleteExpense(id) {
  const data = await getData();
  data.expenses = data.expenses.filter(e => e.id !== id);
  await saveData(data);
}

async function getExpensesForMonth(yearMonth) {
  const data = await getData();
  return data.expenses.filter(e => getMonthKey(e.date) === yearMonth);
}

// ─── Budgets ───

async function setBudget(yearMonth, amount) {
  const data = await getData();
  data.budgets[yearMonth] = Number(amount);
  await saveData(data);
}

async function getBudget(yearMonth) {
  const data = await getData();
  return data.budgets[yearMonth] || 0;
}

// ─── Categories ───

async function getCategories() {
  const data = await getData();
  return data.categories;
}

async function addCategory(cat) {
  const data = await getData();
  cat.id = generateUUID();
  data.categories.push(cat);
  await saveData(data);
  return cat;
}

async function updateCategory(id, updates) {
  const data = await getData();
  const idx = data.categories.findIndex(c => c.id === id);
  if (idx === -1) return;
  data.categories[idx] = { ...data.categories[idx], ...updates };
  await saveData(data);
}

async function deleteCategory(id) {
  const data = await getData();
  data.categories = data.categories.filter(c => c.id !== id);
  await saveData(data);
}

// ─── Export / Import ───

async function exportJSON() {
  const data = await getData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = getTodayStr();
  a.href = url;
  a.download = `expense-tracker-backup-${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importJSON(jsonData, mode = 'replace') {
  let imported;
  try {
    imported = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  } catch {
    throw new Error('Invalid JSON file');
  }

  if (!imported.expenses || !imported.categories) {
    throw new Error('Invalid backup file format');
  }

  if (mode === 'replace') {
    _dataCache = null;
    await saveData({ ...imported, version: 1 });
    return;
  }

  // merge mode
  const current = await getData();
  const existingIds = new Set(current.expenses.map(e => e.id));
  const newExpenses = imported.expenses.filter(e => !existingIds.has(e.id));
  current.expenses.push(...newExpenses);

  // Merge budgets
  Object.assign(current.budgets, imported.budgets || {});

  await saveData(current);
}

async function clearAllData() {
  const key = getSessionKey();
  const blankData = {
    version: 1,
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    budgets: {},
    expenses: []
  };
  _dataCache = blankData;
  const encrypted = await encryptData(blankData, key);
  localStorage.setItem('etd', encrypted);
}

// ─── Analytics helpers ───

async function getSpendingByCategory(yearMonth) {
  const [data, cats] = await Promise.all([getData(), getCategories()]);
  const expenses = data.expenses.filter(e => getMonthKey(e.date) === yearMonth);
  const map = {};
  cats.forEach(c => { map[c.id] = 0; });
  expenses.forEach(e => { if (map[e.categoryId] !== undefined) map[e.categoryId] += e.amount; });
  return cats.map(c => ({ ...c, total: map[c.id] || 0 }));
}

async function getMonthlyTotals(numMonths = 6) {
  const data = await getData();
  const results = [];
  const current = getCurrentMonthKey();
  let key = current;
  for (let i = 0; i < numMonths; i++) {
    const monthExpenses = data.expenses.filter(e => getMonthKey(e.date) === key);
    const total = monthExpenses.reduce((s, e) => s + e.amount, 0);
    results.unshift({ month: key, label: getShortMonthLabel(key), total });
    key = getPrevMonthKey(key);
  }
  return results;
}

async function getPaymentMethodBreakdown(yearMonth) {
  const expenses = await getExpensesForMonth(yearMonth);
  const totals = { upi: 0, cash: 0, card: 0, netbanking: 0 };
  expenses.forEach(e => { if (totals[e.paymentMethod] !== undefined) totals[e.paymentMethod] += e.amount; });
  return totals;
}

async function getHighestSpendDay(yearMonth) {
  const expenses = await getExpensesForMonth(yearMonth);
  const byDay = {};
  expenses.forEach(e => { byDay[e.date] = (byDay[e.date] || 0) + e.amount; });
  const entries = Object.entries(byDay);
  if (!entries.length) return null;
  const [date, amount] = entries.sort((a, b) => b[1] - a[1])[0];
  return { date, amount };
}
