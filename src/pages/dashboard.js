// src/pages/dashboard.js
import { tracker } from '../wasm/bridge.js';
import {
  formatCurrency, getCurrentMonth, parseMonth,
  prevMonth, nextMonth, sortExpensesDesc,
  CAT_ICONS, CAT_COLORS, animateCounter, renderCatPill
} from '../utils/helpers.js';
import { renderExpenseForm } from '../ui/expenseForm.js';
import { gsap } from 'gsap';
import { Chart } from 'chart.js/auto';

let currentMonth = getCurrentMonth();
let donutChart = null;
let spendChart = null;

export function showDashboard(container) {
  return new Promise(resolve => {
    container.innerHTML = buildHTML();
    bindEvents(container);
    loadData(container);
    resolve();
  });
}

function buildHTML() {
  const { label } = parseMonth(currentMonth);
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title grad-text">Dashboard</h1>
        <p class="page-subtitle">Your financial overview at a glance</p>
      </div>
      <div class="flex gap-3" style="align-items:center; flex-wrap:wrap;">
        <div class="month-picker" id="month-picker">
          <button id="prev-month">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="month-label" id="month-label">${label}</span>
          <button id="next-month">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <button class="btn btn-primary btn-sm" id="dash-add-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Expense
        </button>
      </div>
    </div>

    <div class="page-body">
      <!-- Stat cards -->
      <div class="stats-grid" id="stats-grid">
        <div class="stat-card" style="--accent-color: var(--green);">
          <div class="stat-label">Month Spending</div>
          <div class="stat-value" id="stat-month-total">₹0</div>
          <div class="stat-sub" id="stat-month-count">0 transactions</div>
          <div class="stat-icon">💸</div>
        </div>
        <div class="stat-card" style="--accent-color: var(--orange);">
          <div class="stat-label">Budget Left</div>
          <div class="stat-value" id="stat-remaining">₹0</div>
          <div class="stat-sub" id="stat-budget-label">of ₹0 budget</div>
          <div class="stat-icon">🎯</div>
        </div>
        <div class="stat-card" style="--accent-color: var(--pink);">
          <div class="stat-label">Top Category</div>
          <div class="stat-value" id="stat-top-cat" style="font-size:20px;">—</div>
          <div class="stat-sub" id="stat-top-amt">₹0 spent</div>
          <div class="stat-icon">📊</div>
        </div>
        <div class="stat-card" style="--accent-color: var(--yellow);">
          <div class="stat-label">All-Time Total</div>
          <div class="stat-value" id="stat-alltime">₹0</div>
          <div class="stat-sub" id="stat-alltime-count">0 total expenses</div>
          <div class="stat-icon">🏦</div>
        </div>
      </div>

      <!-- Budget progress -->
      <div class="card mb-3" id="budget-section">
        <div class="card-title">BUDGET HEALTH</div>
        <div id="budget-health-content"></div>
      </div>

      <!-- Charts + recent -->
      <div class="grid-7-5 mb-3">
        <div class="card">
          <div class="card-title">SPENDING BY CATEGORY</div>
          <div class="chart-wrap" style="height:260px;">
            <canvas id="donut-chart"></canvas>
          </div>
          <div id="donut-legend" style="margin-top:16px;"></div>
        </div>
        <div class="card">
          <div class="flex-between mb-2">
            <div class="card-title" style="margin-bottom:0;">RECENT EXPENSES</div>
            <button class="btn btn-secondary btn-sm" onclick="navigateTo('expenses')">View All</button>
          </div>
          <div id="recent-expenses"></div>
        </div>
      </div>

      <!-- Monthly trend -->
      <div class="card">
        <div class="flex-between mb-3">
          <div class="card-title" style="margin-bottom:0;">MONTHLY SPENDING TREND</div>
        </div>
        <div class="chart-wrap" style="height:200px;">
          <canvas id="trend-chart"></canvas>
        </div>
      </div>
    </div>
  `;
}

function bindEvents(container) {
  container.querySelector('#dash-add-btn').addEventListener('click', () => {
    renderExpenseForm(null, () => loadData(container));
  });

  container.querySelector('#prev-month').addEventListener('click', () => {
    currentMonth = prevMonth(currentMonth);
    container.querySelector('#month-label').textContent = parseMonth(currentMonth).label;
    loadData(container);
  });

  container.querySelector('#next-month').addEventListener('click', () => {
    currentMonth = nextMonth(currentMonth);
    container.querySelector('#month-label').textContent = parseMonth(currentMonth).label;
    loadData(container);
  });
}

function loadData(container) {
  try {
    const stats   = tracker.getDashboardStats(currentMonth) || {};
    const catData = tracker.getCategoryTotals(currentMonth) || {};
    const monthly = tracker.getAllMonthlyTotals() || [];
    const recent  = sortExpensesDesc(
      tracker.getExpensesByMonth(currentMonth) || []
    ).slice(0, 6);

    console.log("DEBUG:", stats, catData, monthly, recent);

    // SAFE defaults
    const safeStats = {
      monthTotal: stats.monthTotal || 0,
      remaining: stats.remaining || 0,
      monthCount: stats.monthCount || 0,
      budget: stats.budget || 0,
      topCategory: stats.topCategory || null,
      topCategoryAmount: stats.topCategoryAmount || 0,
      allTimeTotal: stats.allTimeTotal || 0,
      totalExpenses: stats.totalExpenses || 0
    };

    // ✅ USE safeStats everywhere
    animateCounter(container.querySelector('#stat-month-total'), safeStats.monthTotal);
    animateCounter(container.querySelector('#stat-remaining'), Math.max(0, safeStats.remaining));
    container.querySelector('#stat-month-count').textContent = `${safeStats.monthCount} transactions`;
    container.querySelector('#stat-budget-label').textContent = `of ${formatCurrency(safeStats.budget)} budget`;

    container.querySelector('#stat-top-cat').textContent =
      safeStats.topCategory ? `${CAT_ICONS[safeStats.topCategory]} ${safeStats.topCategory}` : '—';

    container.querySelector('#stat-top-amt').textContent =
      formatCurrency(safeStats.topCategoryAmount) + ' spent';

    animateCounter(container.querySelector('#stat-alltime'), safeStats.allTimeTotal);
    container.querySelector('#stat-alltime-count').textContent =
      `${safeStats.totalExpenses} total expenses`;

    // Continue normal rendering
    renderBudgetHealth(container, safeStats);
    renderDonutChart(container, catData);
    renderRecent(container, recent);
    renderTrendChart(container, monthly);

  } catch (e) {
    console.error("🔥 DASHBOARD CRASH:", e);

    container.innerHTML = `
      <div style="padding:40px; color:white;">
        <h2>Dashboard crashed</h2>
        <pre>${e.message}</pre>
      </div>
    `;
  }
}

function renderBudgetHealth(container, stats) {
  const el = container.querySelector('#budget-health-content');
  if (!stats.budget || stats.budget === 0) {
    el.innerHTML = `
      <div style="color:var(--text-3); font-size:13px; padding:8px 0;">
        No budget set for this month.
        <button class="btn btn-secondary btn-sm" style="margin-left:12px;" onclick="navigateTo('budget')">Set Budget →</button>
      </div>`;
    return;
  }
  const pct = Math.min((stats.monthTotal / stats.budget) * 100, 100);
  const status = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'safe';
  const statusText = pct >= 100 ? '🚨 Over Budget!' : pct >= 80 ? '⚠️ Approaching Limit' : '✓ On Track';
  el.innerHTML = `
    <div class="flex-between mb-1">
      <span style="font-size:13px; color:var(--text-2);">
        ${formatCurrency(stats.monthTotal)} of ${formatCurrency(stats.budget)}
      </span>
      <span class="stat-badge ${status === 'safe' ? 'green' : status === 'warning' ? 'orange' : 'pink'}">
        ${statusText}
      </span>
    </div>
    <div class="budget-bar-wrap">
      <div class="budget-bar ${status}" style="width:${pct}%"></div>
    </div>
    <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-3);">
      ${pct.toFixed(1)}% used · ${formatCurrency(Math.max(0, stats.remaining))} remaining
    </div>
  `;
}

function renderDonutChart(container, catData) {
  const entries = Object.entries(catData).filter(([,v]) => v > 0);
  const labels = entries.map(([k]) => k);
  const values = entries.map(([,v]) => v);
  const colors = labels.map(l => CAT_COLORS[l] || '#888');

  if (donutChart) { donutChart.destroy(); donutChart = null; }

  const canvas = container.querySelector('#donut-chart');

if (!canvas) return;  // 👈 prevents crash

const ctx = canvas.getContext('2d');
  if (values.length === 0) {
    ctx.canvas.parentElement.innerHTML = `
      <div class="empty-state" style="padding:40px 0;">
        <div class="empty-icon">📊</div>
        <p>No expenses this month</p>
      </div>`;
    container.querySelector('#donut-legend').innerHTML = '';
    return;
  }

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${formatCurrency(ctx.raw)}`
          },
          backgroundColor: '#1c2533',
          titleColor: '#f0f4f8',
          bodyColor: '#8a9bb0',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8
        }
      }
    }
  });

  // Legend
  const total = values.reduce((a,b) => a+b, 0);
  container.querySelector('#donut-legend').innerHTML = labels.slice(0,5).map((l,i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      <span>${CAT_ICONS[l] || ''} ${l}</span>
      <span class="legend-amt">${((values[i]/total)*100).toFixed(1)}%</span>
    </div>
  `).join('');
}

function renderRecent(container, expenses) {
  const el = container.querySelector('#recent-expenses');
  if (!expenses.length) {
  el.innerHTML = `
    <div class="empty-state">
      <div style="font-size:18px; margin-bottom:10px;">📭 No data yet</div>
      <p>Add your first expense to see insights</p>
    </div>
  `;
}
  el.innerHTML = expenses.map(e => `
    <div class="expense-list-item">
      <div class="expense-icon" style="background: ${CAT_COLORS[e.category]}18;">
        ${CAT_ICONS[e.category] || '📦'}
      </div>
      <div class="expense-info">
        <div class="expense-name">${e.note || e.category}</div>
        <div class="expense-meta">${e.date} · ${e.category}</div>
      </div>
      <div class="expense-amount">${formatCurrency(e.amount)}</div>
    </div>
  `).join('');
}

function renderTrendChart(container, monthly) {
  if (spendChart) { spendChart.destroy(); spendChart = null; }
  const canvas = container.querySelector('#trend-chart');

if (!canvas) return;

const ctx = canvas.getContext('2d');

  // Sort months
  const sorted = monthly.sort((a,b) => {
    const [am,ay] = a.month.split('-').map(Number);
    const [bm,by] = b.month.split('-').map(Number);
    return ay !== by ? ay - by : am - bm;
  }).slice(-8);

  if (!sorted.length) return;

  const labels = sorted.map(m => parseMonth(m.month).label);
  const data   = sorted.map(m => m.total);
  const budgets = sorted.map(m => m.budget || 0);

  spendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Spending',
          data,
          borderColor: '#ff6b35',
          backgroundColor: 'rgba(255,107,53,0.08)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#ff6b35',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Budget',
          data: budgets,
          borderColor: 'rgba(0,255,135,0.5)',
          borderDash: [6,4],
          fill: false,
          tension: 0.4,
          pointRadius: 0,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: '#8a9bb0', font: { family: 'Space Mono', size: 11 } } },
        tooltip: {
          backgroundColor: '#1c2533', titleColor: '#f0f4f8',
          bodyColor: '#8a9bb0', borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1, padding: 12, cornerRadius: 8,
          callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5a70', font: { family: 'Space Mono', size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5a70', font: { family: 'Space Mono', size: 10 }, callback: v => '₹' + v.toLocaleString('en-IN') } }
      }
    }
  });
}
