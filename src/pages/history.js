import { tracker } from '../wasm/bridge.js';
import {
  formatCurrency,
  parseDate,
  parseMonth,
  sortExpensesDesc,
  renderCatPill
} from '../utils/helpers.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function showHistory(container) {
  return new Promise((resolve) => {
    const selectedDate = window.getSelectedDate ? window.getSelectedDate() : getToday();
    container.innerHTML = buildHTML(selectedDate);
    bindEvents(container);
    renderHistory(container);
    resolve();
  });
}

function buildHTML(selectedDate) {
  const parsed = parseDate(selectedDate) || parseDate(getToday());
  const yearOptions = buildYearOptions(parsed.year);
  const monthOptions = MONTHS.map((label, index) => `
    <option value="${String(index + 1).padStart(2, '0')}" ${index + 1 === parsed.month ? 'selected' : ''}>${label}</option>
  `).join('');

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">History</h1>
        <p class="page-subtitle">Browse expenses by exact date or by the selected month</p>
      </div>
    </div>

    <div class="page-body">
      <div class="card mb-3">
        <div class="card-title">DATE FILTERS</div>
        <div class="history-toolbar">
          <div class="history-picker">
            <label class="form-label" for="history-month">Month</label>
            <select class="form-control history-select" id="history-month">${monthOptions}</select>
          </div>
          <div class="history-picker">
            <label class="form-label" for="history-year">Year</label>
            <select class="form-control history-select" id="history-year">${yearOptions}</select>
          </div>
          <div class="history-picker history-date-box-wrap">
            <label class="form-label" for="history-date-box">Date</label>
            <input class="form-control history-date-box" id="history-date-box" type="number" min="1" max="31" value="${parsed.day}" />
          </div>
          <div class="history-picker history-action-wrap">
            <button class="btn btn-primary" id="history-apply-btn">Apply</button>
          </div>
        </div>
      </div>

      <div class="stats-grid mb-3" id="history-summary"></div>

      <div class="card mb-3">
        <div class="flex-between mb-3">
          <div class="card-title" style="margin-bottom:0;">EXPENSES ON SELECTED DATE</div>
          <div class="text-mono text-muted" id="history-selected-label"></div>
        </div>
        <div id="history-date-results"></div>
      </div>

      <div class="card">
        <div class="flex-between mb-3">
          <div class="card-title" style="margin-bottom:0;">FULL MONTH HISTORY</div>
          <div class="text-mono text-muted" id="history-month-label"></div>
        </div>
        <div id="history-month-results"></div>
      </div>
    </div>
  `;
}

function bindEvents(container) {
  if (!container.dataset.historyBound) {
    window.addEventListener('mmc:selected-date-change', () => {
      if (container.isConnected) {
        renderHistory(container);
      }
    });
    container.dataset.historyBound = 'true';
  }

  container.querySelector('#history-apply-btn').addEventListener('click', () => {
    applySelection(container);
  });

  ['#history-month', '#history-year'].forEach((selector) => {
    container.querySelector(selector).addEventListener('change', () => {
      syncDayBounds(container);
    });
  });

  container.querySelector('#history-date-box').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applySelection(container);
    }
  });
}

function applySelection(container) {
  const month = container.querySelector('#history-month').value;
  const year = container.querySelector('#history-year').value;
  const dayInput = container.querySelector('#history-date-box');
  const maxDay = getDaysInMonth(Number(month), Number(year));
  const safeDay = Math.max(1, Math.min(maxDay, Number(dayInput.value) || 1));
  dayInput.value = String(safeDay);

  const selectedDate = `${String(safeDay).padStart(2, '0')}-${month}-${year}`;
  window.setSelectedDate?.(selectedDate);
  renderHistory(container);
}

function syncDayBounds(container) {
  const month = Number(container.querySelector('#history-month').value);
  const year = Number(container.querySelector('#history-year').value);
  const dayInput = container.querySelector('#history-date-box');
  const maxDay = getDaysInMonth(month, year);
  dayInput.max = String(maxDay);
  if (Number(dayInput.value) > maxDay) {
    dayInput.value = String(maxDay);
  }
}

function renderHistory(container) {
  const selectedDate = window.getSelectedDate ? window.getSelectedDate() : getToday();
  const parsed = parseDate(selectedDate) || parseDate(getToday());
  const monthKey = parsed.monthKey;
  const monthLabel = parseMonth(monthKey).label;
  const allForMonth = sortExpensesDesc(tracker.getExpensesByMonth(monthKey));
  const selectedDayExpenses = allForMonth.filter((expense) => expense.date === selectedDate);
  const monthTotal = allForMonth.reduce((sum, expense) => sum + expense.amount, 0);
  const dayTotal = selectedDayExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  container.querySelector('#history-selected-label').textContent = parsed.label;
  container.querySelector('#history-month-label').textContent = monthLabel;
  container.querySelector('#history-month').value = String(parsed.month).padStart(2, '0');
  container.querySelector('#history-year').value = String(parsed.year);
  container.querySelector('#history-date-box').value = String(parsed.day);
  syncDayBounds(container);

  container.querySelector('#history-summary').innerHTML = `
    <div class="stat-card" style="--accent-color: var(--green);">
      <div class="stat-label">Selected Date</div>
      <div class="stat-value" style="font-size:22px;">${formatCurrency(dayTotal)}</div>
      <div class="stat-sub">${selectedDayExpenses.length} transaction(s) on ${parsed.label}</div>
      <div class="stat-icon">D</div>
    </div>
    <div class="stat-card" style="--accent-color: var(--orange);">
      <div class="stat-label">Selected Month</div>
      <div class="stat-value" style="font-size:22px;">${formatCurrency(monthTotal)}</div>
      <div class="stat-sub">${allForMonth.length} transaction(s) in ${monthLabel}</div>
      <div class="stat-icon">M</div>
    </div>
    <div class="stat-card" style="--accent-color: var(--pink);">
      <div class="stat-label">Highest Day Expense</div>
      <div class="stat-value" style="font-size:22px;">${formatCurrency(getPeakAmount(selectedDayExpenses))}</div>
      <div class="stat-sub">${selectedDayExpenses[0]?.category || 'No category yet'}</div>
      <div class="stat-icon">H</div>
    </div>
  `;

  renderDayTable(container.querySelector('#history-date-results'), selectedDayExpenses);
  renderMonthTable(container.querySelector('#history-month-results'), allForMonth, selectedDate);
}

function renderDayTable(element, expenses) {
  if (!expenses.length) {
    element.innerHTML = `<div class="empty-state"><div class="empty-icon">0</div><p>No expenses found for this exact date</p></div>`;
    return;
  }

  element.innerHTML = buildExpenseTable(expenses, true);
}

function renderMonthTable(element, expenses, selectedDate) {
  if (!expenses.length) {
    element.innerHTML = `<div class="empty-state"><div class="empty-icon">0</div><p>No history available for this month</p></div>`;
    return;
  }

  element.innerHTML = buildExpenseTable(expenses, false, selectedDate);
}

function buildExpenseTable(expenses, hideDate, selectedDate = '') {
  return `
    <table class="data-table">
      <thead>
        <tr>
          ${hideDate ? '' : '<th>DATE</th>'}
          <th>CATEGORY</th>
          <th>NOTE</th>
          <th>AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${expenses.map((expense) => `
          <tr class="${!hideDate && expense.date === selectedDate ? 'history-highlight-row' : ''}">
            ${hideDate ? '' : `<td style="font-family:var(--font-mono); color:${expense.date === selectedDate ? 'var(--green)' : 'var(--text-3)'};">${expense.date}</td>`}
            <td>${renderCatPill(expense.category)}</td>
            <td style="color:var(--text-1);">${expense.note || '—'}</td>
            <td style="font-family:var(--font-mono); font-weight:700; color:var(--orange);">${formatCurrency(expense.amount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function buildYearOptions(activeYear) {
  const years = [];
  for (let year = activeYear - 5; year <= activeYear + 3; year += 1) {
    years.push(`<option value="${year}" ${year === activeYear ? 'selected' : ''}>${year}</option>`);
  }
  return years.join('');
}

function getDaysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function getPeakAmount(expenses) {
  return expenses.reduce((max, expense) => Math.max(max, expense.amount), 0);
}

function getToday() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
}
