// ─── Utilities ───

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function formatCurrency(amount) {
  const n = Number(amount);
  const sign = n < 0 ? '−' : '';
  return sign + '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthKey(dateStr) {
  return dateStr.substring(0, 7);
}

function getMonthLabel(key) {
  const [year, month] = key.split('-');
  return new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function getShortMonthLabel(key) {
  const [year, month] = key.split('-');
  return new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function formatDate(dateStr) {
  const today = getTodayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getDaysLeftInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

function getPrevMonthKey(key) {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getNextMonthKey(key) {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

// ─── Defaults ───

const DEFAULT_CATEGORIES = [
  { id: 'food',          label: 'Food',          icon: 'food',          color: '#FF7A85' },
  { id: 'transport',     label: 'Transport',     icon: 'transport',     color: '#3DD4C7' },
  { id: 'shopping',      label: 'Shopping',       icon: 'shopping',      color: '#4DA8F0' },
  { id: 'bills',         label: 'Bills',         icon: 'bills',         color: '#6FD79A' },
  { id: 'health',        label: 'Health',        icon: 'health',        color: '#FFC24B' },
  { id: 'entertainment', label: 'Entertainment', icon: 'entertainment', color: '#B98CF5' }
];

const PAYMENT_METHODS = [
  { id: 'upi',        label: 'UPI',         icon: 'upi' },
  { id: 'cash',       label: 'Cash',        icon: 'cash' },
  { id: 'card',       label: 'Card',        icon: 'card' },
  { id: 'netbanking', label: 'Net Banking', icon: 'netbanking' }
];

// Budget every fresh install starts with (fully editable in Settings).
const DEFAULT_BUDGET = 10000;

const PRESET_COLORS = [
  '#FF7A85','#FF9F45','#FFC24B','#6FD79A',
  '#3DD4C7','#4DA8F0','#6E8BFF','#8B7BFF',
  '#B98CF5','#F178C6','#7C8499','#E8ECF5'
];

// ─── Toast ───

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ─── CountUp animation ───

function animateCountUp(el, targetValue, duration = 900, prefix = '₹') {
  const start = performance.now();
  const startVal = 0;
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startVal + (targetValue - startVal) * eased);
    el.textContent = prefix + current.toLocaleString('en-IN');
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ─── Mark active nav ───

function setActiveNav() {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(el => {
    const href = el.getAttribute('href') || '';
    const isActive =
      (path === 'index.html' || path === '') && (href === 'index.html' || href === './') ||
      path !== 'index.html' && href.includes(path);
    el.classList.toggle('active', isActive);
  });
}
