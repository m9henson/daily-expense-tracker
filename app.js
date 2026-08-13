(() => {
  'use strict';

  const STORAGE_KEY = 'dailySpend.expenses.v1';
  const BUDGET_KEY = 'dailySpend.budgets.v1';

  const CATEGORIES = [
    { id: 'eating-out', name: 'Eating Out', short: 'Eating', emoji: '🍔' },
    { id: 'groceries', name: 'Groceries', short: 'Groceries', emoji: '🛒' },
    { id: 'gas', name: 'Gas', short: 'Gas', emoji: '⛽' },
    { id: 'golf', name: 'Golf / Fun', short: 'Golf', emoji: '⛳' },
    { id: 'household', name: 'Household', short: 'House', emoji: '🏠' },
    { id: 'kids', name: 'Kids', short: 'Kids', emoji: '👧' },
    { id: 'goodwill', name: 'Goodwill', short: 'Goodwill', emoji: '🛍️' },
    { id: 'other', name: 'Other', short: 'Other', emoji: '💵' }
  ];

  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

  let expenses = loadJSON(STORAGE_KEY, []);
  let budgets = loadJSON(BUDGET_KEY, {});
  let selectedCategory = 'eating-out';
  let editingId = null;
  let visibleMonth = new Date();
  let deferredInstallPrompt = null;

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
  }

  function localDateISO(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseLocalDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function expenseMonthKey(expense) {
    return expense.date.slice(0, 7);
  }

  function getCategory(id) {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
  }

  function escapeHTML(value = '') {
    return String(value).replace(/[&<>'"]/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
  }

  function uid() {
    return (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function initCategories() {
    $('categoryGrid').innerHTML = CATEGORIES.map(cat => `
      <button class="category-btn ${cat.id === selectedCategory ? 'active' : ''}" type="button" data-category="${cat.id}" role="radio" aria-checked="${cat.id === selectedCategory}">
        <span class="emoji">${cat.emoji}</span><small>${cat.short}</small>
      </button>
    `).join('');
    $('category').value = selectedCategory;

    $('categoryGrid').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-category]');
      if (!btn) return;
      selectCategory(btn.dataset.category);
    });

    $('historyCategory').innerHTML = `<option value="">All categories</option>` + CATEGORIES.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
  }

  function selectCategory(id) {
    selectedCategory = id;
    $('category').value = id;
    document.querySelectorAll('.category-btn').forEach(btn => {
      const active = btn.dataset.category === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function renderAll() {
    renderSummary();
    renderCategorySummary();
    renderHistory();
    renderBudgets();
    $('monthLabel').textContent = monthName.format(visibleMonth);
  }

  function renderSummary() {
    const today = localDateISO();
    const mk = monthKey(visibleMonth);
    const todayTotal = expenses.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount), 0);
    const monthExpenses = expenses.filter(e => expenseMonthKey(e) === mk);
    const total = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const budgetTotal = Object.values(budgets).reduce((s, b) => s + (Number(b) || 0), 0);

    $('todayTotal').textContent = money.format(todayTotal);
    $('monthTotal').textContent = money.format(total);

    if (budgetTotal > 0) {
      const left = budgetTotal - total;
      $('budgetLeft').textContent = money.format(left);
      $('budgetLeft').style.color = left < 0 ? 'var(--danger)' : '';
      $('budgetProgressCard').classList.remove('hidden');
      $('budgetProgressText').textContent = `${money.format(total)} of ${money.format(budgetTotal)}`;
      const percent = Math.round((total / budgetTotal) * 100);
      $('budgetPercent').textContent = `${percent}%`;
      $('budgetProgressBar').style.width = `${Math.min(percent, 100)}%`;
    } else {
      $('budgetLeft').textContent = 'Set budgets';
      $('budgetLeft').style.color = '';
      $('budgetProgressCard').classList.add('hidden');
    }
  }

  function renderCategorySummary() {
    const mk = monthKey(visibleMonth);
    const monthExpenses = expenses.filter(e => expenseMonthKey(e) === mk);
    const container = $('categorySummary');

    container.innerHTML = CATEGORIES.map(cat => {
      const spent = monthExpenses.filter(e => e.category === cat.id).reduce((s, e) => s + Number(e.amount), 0);
      const budget = Number(budgets[cat.id] || 0);
      const pct = budget > 0 ? Math.min(Math.round(spent / budget * 100), 100) : 0;
      const detail = budget > 0 ? `${money.format(Math.max(budget - spent, 0))} left of ${money.format(budget)}` : 'No budget set';
      return `
        <div class="category-summary-row">
          <span class="emoji">${cat.emoji}</span>
          <div class="meta">
            <strong>${cat.name}</strong><span>${detail}</span>
            ${budget > 0 ? `<div class="mini-progress"><div style="width:${pct}%"></div></div>` : ''}
          </div>
          <span class="amount">${money.format(spent)}</span>
        </div>`;
    }).join('');
  }

  function renderHistory() {
    const search = $('historySearch').value.trim().toLowerCase();
    const category = $('historyCategory').value;
    let filtered = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

    if (search) {
      filtered = filtered.filter(e => `${e.merchant || ''} ${e.note || ''}`.toLowerCase().includes(search));
    }
    if (category) filtered = filtered.filter(e => e.category === category);

    $('historyEmpty').classList.toggle('hidden', filtered.length > 0);
    $('historyList').innerHTML = filtered.map(e => {
      const cat = getCategory(e.category);
      const title = e.merchant?.trim() || cat.name;
      const subtitle = `${cat.name} · ${shortDate.format(parseLocalDate(e.date))}${e.note ? ` · ${escapeHTML(e.note)}` : ''}`;
      return `
        <article class="history-item" data-id="${e.id}">
          <div class="history-icon">${cat.emoji}</div>
          <div class="history-main"><strong>${escapeHTML(title)}</strong><span>${subtitle}</span></div>
          <div class="history-right">
            <strong>${money.format(Number(e.amount))}</strong>
            <div class="item-actions">
              <button type="button" data-action="edit">Edit</button>
              <button type="button" data-action="delete" class="delete">Delete</button>
            </div>
          </div>
        </article>`;
    }).join('');
  }

  function renderBudgets() {
    const form = $('budgetForm');
    const total = CATEGORIES.reduce((sum, cat) => sum + Number(budgets[cat.id] || 0), 0);
    form.innerHTML = CATEGORIES.map(cat => `
      <label class="budget-row">
        <span class="emoji">${cat.emoji}</span>
        <strong>${cat.name}</strong>
        <input type="number" inputmode="decimal" min="0" step="1" data-budget="${cat.id}" value="${Number(budgets[cat.id] || 0)}" aria-label="${cat.name} monthly budget" />
      </label>
    `).join('') + `
      <div class="budget-total"><span>Monthly budget</span><strong id="budgetTotalValue">${money.format(total)}</strong></div>
      <button class="primary-btn" type="submit">Save budgets</button>`;
  }

  function resetForm() {
    editingId = null;
    $('expenseForm').reset();
    $('date').value = localDateISO();
    selectCategory('eating-out');
    $('formTitle').textContent = 'Add expense';
    $('saveExpenseBtn').textContent = 'Save expense';
    $('cancelEditBtn').classList.add('hidden');
  }

  function editExpense(id) {
    const e = expenses.find(x => x.id === id);
    if (!e) return;
    editingId = id;
    $('amount').value = e.amount;
    $('merchant').value = e.merchant || '';
    $('date').value = e.date;
    $('note').value = e.note || '';
    selectCategory(e.category);
    $('formTitle').textContent = 'Edit expense';
    $('saveExpenseBtn').textContent = 'Save changes';
    $('cancelEditBtn').classList.remove('hidden');
    switchView('homeView');
    window.scrollTo({ top: document.querySelector('.add-card').offsetTop - 8, behavior: 'smooth' });
    setTimeout(() => $('amount').focus(), 250);
  }

  function deleteExpense(id) {
    const e = expenses.find(x => x.id === id);
    if (!e) return;
    if (!confirm(`Delete ${money.format(Number(e.amount))}${e.merchant ? ` at ${e.merchant}` : ''}?`)) return;
    expenses = expenses.filter(x => x.id !== id);
    saveData();
    renderAll();
    showToast('Expense deleted');
  }

  function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
    if (viewId === 'historyView') renderHistory();
    if (viewId === 'budgetsView') renderBudgets();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportCSV() {
    const header = ['Date','Amount','Category','Merchant','Note'];
    const rows = [...expenses].sort((a,b) => a.date.localeCompare(b.date)).map(e => [
      e.date, Number(e.amount).toFixed(2), getCategory(e.category).name, e.merchant || '', e.note || ''
    ]);
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    download(`daily-spend-${localDateISO()}.csv`, csv, 'text/csv;charset=utf-8');
    showToast('CSV exported');
  }

  function backupJSON() {
    const backup = { version: 1, exportedAt: new Date().toISOString(), expenses, budgets };
    download(`daily-spend-backup-${localDateISO()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    showToast('Backup downloaded');
  }

  async function restoreJSON(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.expenses) || typeof parsed.budgets !== 'object') throw new Error('Invalid backup');
      expenses = parsed.expenses;
      budgets = parsed.budgets || {};
      saveData();
      renderAll();
      showToast('Backup restored');
    } catch {
      alert('That file does not look like a valid Daily Spend backup.');
    }
  }

  $('expenseForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const amount = Number($('amount').value);
    if (!amount || amount <= 0) return;

    const payload = {
      amount: Math.round(amount * 100) / 100,
      category: selectedCategory,
      merchant: $('merchant').value.trim(),
      date: $('date').value,
      note: $('note').value.trim()
    };

    if (editingId) {
      expenses = expenses.map(e => e.id === editingId ? { ...e, ...payload, updatedAt: Date.now() } : e);
      showToast('Expense updated');
    } else {
      expenses.push({ id: uid(), ...payload, createdAt: Date.now() });
      showToast('Expense saved');
    }
    saveData();
    resetForm();
    renderAll();
  });

  $('cancelEditBtn').addEventListener('click', resetForm);
  $('historySearch').addEventListener('input', renderHistory);
  $('historyCategory').addEventListener('change', renderHistory);
  $('clearFilters').addEventListener('click', () => {
    $('historySearch').value = '';
    $('historyCategory').value = '';
    renderHistory();
  });

  $('historyList').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const item = event.target.closest('[data-id]');
    if (!item) return;
    action.dataset.action === 'edit' ? editExpense(item.dataset.id) : deleteExpense(item.dataset.id);
  });

  $('budgetForm').addEventListener('input', () => {
    const total = [...document.querySelectorAll('[data-budget]')].reduce((s, el) => s + (Number(el.value) || 0), 0);
    $('budgetTotalValue').textContent = money.format(total);
  });

  $('budgetForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const next = {};
    document.querySelectorAll('[data-budget]').forEach(input => { next[input.dataset.budget] = Math.max(0, Number(input.value) || 0); });
    budgets = next;
    saveData();
    renderAll();
    showToast('Budgets saved');
  });

  $('prevMonth').addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1); renderAll(); });
  $('nextMonth').addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1); renderAll(); });
  $('monthLabel').addEventListener('click', () => { visibleMonth = new Date(); renderAll(); });

  document.querySelector('.bottom-nav').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-view]');
    if (btn) switchView(btn.dataset.view);
  });

  $('exportBtn').addEventListener('click', exportCSV);
  $('backupBtn').addEventListener('click', backupJSON);
  $('restoreInput').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) restoreJSON(file);
    event.target.value = '';
  });

  $('clearAllBtn').addEventListener('click', () => {
    if (!confirm('Clear every expense and every budget from this device? This cannot be undone.')) return;
    expenses = [];
    budgets = {};
    saveData();
    renderAll();
    showToast('All data cleared');
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $('installBtn').classList.remove('hidden');
  });
  $('installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('installBtn').classList.add('hidden');
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  initCategories();
  resetForm();
  renderAll();
})();
