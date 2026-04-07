import { tracker } from '../wasm/bridge.js';
import {
  formatCurrency,
  parseMonth,
  CAT_ICONS,
  exportToCSV,
  exportToJSON,
  exportExpensesToPDF,
  sortExpensesDesc
} from '../utils/helpers.js';
import { showToast } from '../ui/toast.js';

export function showReports(container) {
  return new Promise((resolve) => {
    container.innerHTML = buildHTML();
    bindEvents(container);
    renderReports(container);
    resolve();
  });
}

function buildHTML() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title" style="background: linear-gradient(135deg, var(--yellow), var(--green)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;">Reports</h1>
        <p class="page-subtitle">Comprehensive financial summaries</p>
      </div>
      <div class="flex gap-3" style="align-items:center; flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" id="export-csv-btn">Export CSV</button>
        <button class="btn btn-secondary btn-sm" id="export-json-btn">Export JSON</button>
        <button class="btn btn-primary btn-sm" id="export-pdf-btn">Download PDF</button>
      </div>
    </div>

    <div class="page-body">
      <div class="card mb-3">
        <div class="card-title">ALL-TIME SUMMARY</div>
        <div id="alltime-summary"></div>
      </div>

      <div class="card mb-3">
        <div class="card-title">MONTHLY BREAKDOWN</div>
        <div id="monthly-report"></div>
      </div>

      <div class="card mb-3">
        <div class="card-title">CATEGORY REPORT (ALL TIME)</div>
        <div id="category-report"></div>
      </div>

      <div class="card">
        <div class="flex-between mb-3">
          <div class="card-title" style="margin-bottom:0;">FULL TRANSACTION LIST</div>
          <div class="search-bar" style="max-width:240px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="form-control" id="report-search" placeholder="Search..." />
          </div>
        </div>
        <div id="full-list"></div>
      </div>
    </div>
  `;
}

function bindEvents(container) {
  container.querySelector('#export-csv-btn').addEventListener('click', () => {
    const all = tracker.getAllExpenses();
    if (!all.length) {
      showToast('No data to export', 'warning');
      return;
    }
    exportToCSV(all, 'all-expenses.csv');
    showToast('CSV exported!', 'success');
  });

  container.querySelector('#export-json-btn').addEventListener('click', () => {
    const all = tracker.getAllExpenses();
    if (!all.length) {
      showToast('No data to export', 'warning');
      return;
    }
    exportToJSON(all, 'all-expenses.json');
    showToast('JSON exported!', 'success');
  });

  container.querySelector('#export-pdf-btn').addEventListener('click', () => {
    const all = sortExpensesDesc(tracker.getAllExpenses());
    if (!all.length) {
      showToast('No data to export', 'warning');
      return;
    }
    exportExpensesToPDF(all, 'expense-report.pdf', 'Monthly Money Coach Report');
    showToast('PDF downloaded!', 'success');
  });

  container.querySelector('#report-search').addEventListener('input', (event) => {
    renderFullList(container, event.target.value.toLowerCase());
  });
}

function renderReports(container) {
  const all = tracker.getAllExpenses();
  const monthly = tracker.getAllMonthlyTotals();
  const catAll = tracker.getCategoryTotals('');

  renderAlltimeSummary(container, all, monthly);
  renderMonthlyReport(container, monthly);
  renderCategoryReport(container, catAll, all);
  renderFullList(container, '');
}

function renderAlltimeSummary(container, all, monthly) {
  const el = container.querySelector('#alltime-summary');
  if (!all.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">R</div><p>No expenses yet</p></div>`;
    return;
  }

  const total = all.reduce((sum, expense) => sum + expense.amount, 0);
  const avg = total / (monthly.length || 1);
  const maxMonth = monthly.reduce((a, b) => a.total > b.total ? a : b, monthly[0]);
  const minMonth = monthly.reduce((a, b) => a.total < b.total ? a : b, monthly[0]);

  el.innerHTML = `
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
      <div class="stat-card" style="--accent-color:var(--green);">
        <div class="stat-label">Total Spent</div>
        <div class="stat-value" style="font-size:22px;">${formatCurrency(total)}</div>
        <div class="stat-sub">All time</div>
        <div class="stat-icon">T</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--orange);">
        <div class="stat-label">Avg/Month</div>
        <div class="stat-value" style="font-size:22px;">${formatCurrency(avg)}</div>
        <div class="stat-sub">Over ${monthly.length} month(s)</div>
        <div class="stat-icon">A</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--pink);">
        <div class="stat-label">Highest Month</div>
        <div class="stat-value" style="font-size:22px;">${formatCurrency(maxMonth?.total || 0)}</div>
        <div class="stat-sub">${maxMonth ? parseMonth(maxMonth.month).label : '—'}</div>
        <div class="stat-icon">H</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--yellow);">
        <div class="stat-label">Lowest Month</div>
        <div class="stat-value" style="font-size:22px;">${formatCurrency(minMonth?.total || 0)}</div>
        <div class="stat-sub">${minMonth ? parseMonth(minMonth.month).label : '—'}</div>
        <div class="stat-icon">L</div>
      </div>
    </div>
  `;
}

function renderMonthlyReport(container, monthly) {
  const el = container.querySelector('#monthly-report');
  if (!monthly.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">M</div><p>No monthly data</p></div>`;
    return;
  }

  const sorted = [...monthly].sort((a, b) => {
    const [am, ay] = a.month.split('-').map(Number);
    const [bm, by] = b.month.split('-').map(Number);
    return ay !== by ? by - ay : bm - am;
  });

  el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>MONTH</th>
        <th>TOTAL SPENT</th>
        <th>BUDGET</th>
        <th>OVER/UNDER</th>
        <th>STATUS</th>
      </tr></thead>
      <tbody>
        ${sorted.map((monthItem) => {
          const diff = monthItem.budget > 0 ? monthItem.total - monthItem.budget : null;
          const pct = monthItem.budget > 0 ? (monthItem.total / monthItem.budget * 100) : null;
          return `
            <tr>
              <td style="font-weight:600; color:var(--text-1);">${parseMonth(monthItem.month).label}</td>
              <td style="font-family:var(--font-mono); color:var(--orange);">${formatCurrency(monthItem.total)}</td>
              <td style="font-family:var(--font-mono);">${monthItem.budget ? formatCurrency(monthItem.budget) : '—'}</td>
              <td style="font-family:var(--font-mono); color:${diff > 0 ? 'var(--pink)' : 'var(--green)'}">
                ${diff !== null ? `${diff > 0 ? '+' : ''}${formatCurrency(diff)}` : '—'}
              </td>
              <td>
                ${pct !== null ? `
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div class="budget-bar-wrap" style="width:80px; margin:0;">
                      <div class="budget-bar ${pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'safe'}" style="width:${Math.min(pct, 100)}%"></div>
                    </div>
                    <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-3);">${pct.toFixed(0)}%</span>
                  </div>
                ` : '<span style="color:var(--text-3);">No budget</span>'}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderCategoryReport(container, catData, all) {
  const el = container.querySelector('#category-report');
  const total = all.reduce((sum, expense) => sum + expense.amount, 0);
  const entries = Object.entries(catData)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">C</div><p>No data</p></div>`;
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>CATEGORY</th>
        <th>TOTAL SPENT</th>
        <th>% OF TOTAL</th>
        <th>TRANSACTIONS</th>
        <th>AVG/TRANSACTION</th>
      </tr></thead>
      <tbody>
        ${entries.map(([category, amount]) => {
          const pct = total > 0 ? (amount / total * 100) : 0;
          const txns = all.filter((expense) => expense.category === category).length;
          return `
            <tr>
              <td style="padding-left:16px;">${CAT_ICONS[category] || ''} <strong>${category}</strong></td>
              <td style="font-family:var(--font-mono); color:var(--orange);">${formatCurrency(amount)}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="budget-bar-wrap" style="width:80px;margin:0;">
                    <div class="budget-bar safe" style="width:${pct}%; background:linear-gradient(90deg,var(--green),var(--orange));"></div>
                  </div>
                  <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-2);">${pct.toFixed(1)}%</span>
                </div>
              </td>
              <td style="font-family:var(--font-mono);">${txns}</td>
              <td style="font-family:var(--font-mono); color:var(--text-2);">${formatCurrency(amount / txns)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderFullList(container, query = '') {
  const el = container.querySelector('#full-list');
  let expenses = sortExpensesDesc(tracker.getAllExpenses());

  if (query) {
    expenses = expenses.filter((expense) =>
      expense.note.toLowerCase().includes(query)
      || expense.category.toLowerCase().includes(query)
      || expense.date.includes(query)
    );
  }

  if (!expenses.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">S</div><p>No results</p></div>`;
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>ID</th>
        <th>DATE</th>
        <th>CATEGORY</th>
        <th>NOTE</th>
        <th>AMOUNT</th>
      </tr></thead>
      <tbody>
        ${expenses.map((expense) => `
          <tr>
            <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-3);">${expense.id}</td>
            <td style="font-family:var(--font-mono);font-size:12px;color:var(--text-3);">${expense.date}</td>
            <td><span class="cat-pill cat-${expense.category}">${CAT_ICONS[expense.category] || ''} ${expense.category}</span></td>
            <td style="color:var(--text-1);">${expense.note || '—'}</td>
            <td style="font-family:var(--font-mono);font-weight:700;color:var(--orange);">${formatCurrency(expense.amount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
