// src/pages/budget.js
import { tracker } from '../wasm/bridge.js';
import {
  formatCurrency, getCurrentMonth, parseMonth,
  prevMonth, nextMonth, animateCounter
} from '../utils/helpers.js';
import { showToast } from '../ui/toast.js';
import { gsap } from 'gsap';

let currentMonth = getCurrentMonth();

export function showBudget(container) {
  return new Promise(resolve => {
    container.innerHTML = buildHTML();
    bindEvents(container);
    renderBudgetData(container);
    resolve();
  });
}

function buildHTML() {
  const { label } = parseMonth(currentMonth);
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title grad-text-pop">Budget</h1>
        <p class="page-subtitle">Set and monitor your monthly spending limits</p>
      </div>
      <div class="month-picker">
        <button id="prev-month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="month-label" id="month-label">${label}</span>
        <button id="next-month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>

    <div class="page-body">
      <!-- Set budget card -->
      <div class="card mb-3">
        <div class="card-title">SET MONTHLY BUDGET</div>
        <div class="form-row" style="align-items:flex-end;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Budget Amount (₹)</label>
            <div class="input-prefix">
              <span class="prefix">₹</span>
              <input type="number" class="form-control" id="budget-input"
                placeholder="Enter budget..." step="100" min="0" />
            </div>
          </div>
          <button class="btn btn-primary" id="set-budget-btn" style="height:46px; flex-shrink:0;">
            Set Budget
          </button>
        </div>
      </div>

      <!-- Budget overview -->
      <div id="budget-overview" class="mb-3"></div>

      <!-- Category breakdown card -->
      <div class="card">
        <div class="card-title">SPENDING BY CATEGORY THIS MONTH</div>
        <div id="cat-breakdown"></div>
      </div>

      <!-- All months budgets -->
      <div class="card mt-3">
        <div class="card-title">ALL BUDGETS OVERVIEW</div>
        <div id="all-budgets-table"></div>
      </div>
    </div>
  `;
}

function bindEvents(container) {
  container.querySelector('#prev-month').addEventListener('click', () => {
    currentMonth = prevMonth(currentMonth);
    container.querySelector('#month-label').textContent = parseMonth(currentMonth).label;
    renderBudgetData(container);
  });

  container.querySelector('#next-month').addEventListener('click', () => {
    currentMonth = nextMonth(currentMonth);
    container.querySelector('#month-label').textContent = parseMonth(currentMonth).label;
    renderBudgetData(container);
  });

  container.querySelector('#set-budget-btn').addEventListener('click', () => {
    const val = parseFloat(container.querySelector('#budget-input').value);
    if (isNaN(val) || val < 0) {
      showToast('Enter a valid budget amount', 'error');
      return;
    }
    const result = tracker.setBudget(currentMonth, val);
    if (result.success) {
      showToast(`Budget set to ${formatCurrency(val)} for ${parseMonth(currentMonth).label}`, 'success');
      renderBudgetData(container);
    }
  });
}

function renderBudgetData(container) {
  const monthly  = tracker.getMonthlyTotal(currentMonth);
  const catData  = tracker.getCategoryTotals(currentMonth);
  const allBudgets = tracker.getAllBudgets();
  const allMonthly = tracker.getAllMonthlyTotals();

  // Update input
  container.querySelector('#budget-input').value = monthly.budget || '';

  // Budget overview
  renderOverview(container, monthly);

  // Category breakdown
  renderCatBreakdown(container, catData, monthly.total);

  // All budgets
  renderAllBudgets(container, allBudgets, allMonthly);
}

function renderOverview(container, monthly) {
  const el = container.querySelector('#budget-overview');
  if (!monthly.budget) {
    el.innerHTML = `
      <div class="card" style="border-color:rgba(255,211,61,0.2); background: rgba(255,211,61,0.04);">
        <p style="color:var(--text-2); font-size:14px;">
          ⚡ No budget set for <strong>${parseMonth(currentMonth).label}</strong>.
          Use the form above to set your spending limit.
        </p>
      </div>`;
    return;
  }

  const pct = Math.min((monthly.total / monthly.budget) * 100, 100);
  const status = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'safe';

  el.innerHTML = `
    <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="stat-card" style="--accent-color:var(--green);">
        <div class="stat-label">Budget</div>
        <div class="stat-value" id="bov-budget">₹0</div>
        <div class="stat-sub">${parseMonth(currentMonth).label}</div>
        <div class="stat-icon">🎯</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--orange);">
        <div class="stat-label">Spent</div>
        <div class="stat-value" id="bov-spent">₹0</div>
        <div class="stat-sub">${monthly.monthCount || monthly.count || ''} transactions</div>
        <div class="stat-icon">💳</div>
      </div>
      <div class="stat-card" style="--accent-color:${status === 'safe' ? 'var(--green)' : status === 'warning' ? 'var(--yellow)' : 'var(--pink)'}">
        <div class="stat-label">Remaining</div>
        <div class="stat-value" id="bov-remaining" style="color:${status === 'danger' ? 'var(--pink)' : 'var(--green)'}">₹0</div>
        <div class="stat-sub">${pct.toFixed(1)}% used</div>
        <div class="stat-icon">${status === 'safe' ? '✅' : status === 'warning' ? '⚠️' : '🚨'}</div>
      </div>
    </div>
    <div class="card" style="margin-top:0; padding:20px 24px;">
      <div class="flex-between" style="margin-bottom:10px;">
        <span style="font-size:13px; color:var(--text-2);">Monthly Progress</span>
        <span class="stat-badge ${status === 'safe' ? 'green' : status === 'warning' ? 'orange' : 'pink'}">
          ${pct >= 100 ? '🚨 Over Budget' : pct >= 80 ? '⚠️ Almost There' : '✓ On Track'}
        </span>
      </div>
      <div class="budget-bar-wrap" style="height:12px;">
        <div class="budget-bar ${status}" style="width:0%" id="main-progress-bar"></div>
      </div>
      <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-3); margin-top:8px;">
        ${formatCurrency(monthly.total)} spent of ${formatCurrency(monthly.budget)}
      </div>
    </div>
  `;

  animateCounter(container.querySelector('#bov-budget'), monthly.budget);
  animateCounter(container.querySelector('#bov-spent'), monthly.total);
  animateCounter(container.querySelector('#bov-remaining'), Math.abs(monthly.remaining));

  setTimeout(() => {
    gsap.to(container.querySelector('#main-progress-bar'), {
      width: `${pct}%`, duration: 1, ease: 'power2.out', delay: 0.2
    });
  }, 100);
}

function renderCatBreakdown(container, catData, monthTotal) {
  const el = container.querySelector('#cat-breakdown');
  const entries = Object.entries(catData).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);

  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>No expenses this month</p></div>`;
    return;
  }

  el.innerHTML = entries.map(([cat, amt]) => {
    const pct = monthTotal > 0 ? (amt / monthTotal * 100) : 0;
    return `
      <div style="margin-bottom:16px;">
        <div class="flex-between" style="margin-bottom:6px;">
          <span style="font-size:13px; color:var(--text-1);">${cat}</span>
          <span style="font-family:var(--font-mono); font-size:13px; color:var(--text-2);">
            ${formatCurrency(amt)} <span style="color:var(--text-3);">(${pct.toFixed(1)}%)</span>
          </span>
        </div>
        <div class="budget-bar-wrap" style="height:6px;">
          <div class="budget-bar safe" style="width:${pct}%; background: linear-gradient(90deg, var(--green), var(--orange));"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAllBudgets(container, budgets, monthly) {
  const el = container.querySelector('#all-budgets-table');

  // Merge budgets with monthly totals
  const allMonths = new Set([
    ...budgets.map(b => b.month),
    ...monthly.map(m => m.month)
  ]);

  const rows = [...allMonths].sort().reverse().map(month => {
    const budget = budgets.find(b => b.month === month)?.budget || 0;
    const spent  = monthly.find(m => m.month === month)?.total || 0;
    const pct    = budget > 0 ? Math.min((spent/budget)*100, 100) : 0;
    const status = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'safe';
    return { month, budget, spent, pct, status };
  });

  if (!rows.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>No data yet</p></div>`;
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>MONTH</th>
        <th>BUDGET</th>
        <th>SPENT</th>
        <th>REMAINING</th>
        <th>STATUS</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td style="font-weight:600; color:var(--text-1);">${parseMonth(r.month).label}</td>
            <td style="font-family:var(--font-mono);">${r.budget ? formatCurrency(r.budget) : '—'}</td>
            <td style="font-family:var(--font-mono); color:var(--orange);">${formatCurrency(r.spent)}</td>
            <td style="font-family:var(--font-mono); color:${r.pct >= 100 ? 'var(--pink)' : 'var(--green)'}">
              ${r.budget ? formatCurrency(Math.abs(r.budget - r.spent)) : '—'}
            </td>
            <td>
              ${r.budget ? `
                <span class="stat-badge ${r.status === 'safe' ? 'green' : r.status === 'warning' ? 'orange' : 'pink'}">
                  ${r.pct.toFixed(0)}% used
                </span>
              ` : '<span style="color:var(--text-3);">No budget</span>'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
