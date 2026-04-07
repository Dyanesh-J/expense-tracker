// src/pages/analytics.js
import { tracker } from '../wasm/bridge.js';
import {
  formatCurrency, getCurrentMonth, parseMonth,
  prevMonth, nextMonth, CAT_COLORS, CAT_ICONS
} from '../utils/helpers.js';
import { Chart } from 'chart.js/auto';
import { gsap } from 'gsap';

let currentMonth = getCurrentMonth();
let charts = [];

function destroyCharts() { charts.forEach(c => c.destroy()); charts = []; }

export function showAnalytics(container) {
  return new Promise(resolve => {
    destroyCharts();
    container.innerHTML = buildHTML();
    bindEvents(container);
    renderAnalytics(container);
    resolve();
  });
}

function buildHTML() {
  const { label } = parseMonth(currentMonth);
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title" style="background: linear-gradient(135deg, var(--pink), var(--orange)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;">Analytics</h1>
        <p class="page-subtitle">Deep insights into your spending patterns</p>
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
      <div class="grid-2 mb-3">
        <!-- Bar chart -->
        <div class="card">
          <div class="card-title">CATEGORY SPENDING (BAR)</div>
          <div class="chart-wrap" style="height:280px;">
            <canvas id="bar-chart"></canvas>
          </div>
        </div>

        <!-- Pie/Donut -->
        <div class="card">
          <div class="card-title">SPENDING DISTRIBUTION</div>
          <div class="chart-wrap" style="height:280px;">
            <canvas id="pie-chart"></canvas>
          </div>
        </div>
      </div>

      <!-- Daily spending heatmap-style chart -->
      <div class="card mb-3">
        <div class="card-title">DAILY SPENDING THIS MONTH</div>
        <div class="chart-wrap" style="height:200px;">
          <canvas id="daily-chart"></canvas>
        </div>
      </div>

      <!-- Category comparison over time -->
      <div class="card mb-3">
        <div class="card-title">TOP CATEGORIES - MONTHLY TREND</div>
        <div class="chart-wrap" style="height:240px;">
          <canvas id="trend-cat-chart"></canvas>
        </div>
      </div>

      <!-- Insight cards -->
      <div id="insights-grid" class="grid-3"></div>
    </div>
  `;
}

function bindEvents(container) {
  container.querySelector('#prev-month').addEventListener('click', () => {
    currentMonth = prevMonth(currentMonth);
    container.querySelector('#month-label').textContent = parseMonth(currentMonth).label;
    destroyCharts();
    renderAnalytics(container);
  });
  container.querySelector('#next-month').addEventListener('click', () => {
    currentMonth = nextMonth(currentMonth);
    container.querySelector('#month-label').textContent = parseMonth(currentMonth).label;
    destroyCharts();
    renderAnalytics(container);
  });
}

function renderAnalytics(container) {
  const catData  = tracker.getCategoryTotals(currentMonth);
  const allExp   = tracker.getExpensesByMonth(currentMonth);
  const allMonths = tracker.getAllMonthlyTotals();

  renderBarChart(container, catData);
  renderPieChart(container, catData);
  renderDailyChart(container, allExp);
  renderTrendCatChart(container);
  renderInsights(container, catData, allExp, allMonths);
}

function renderBarChart(container, catData) {
  const entries = Object.entries(catData).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
  const ctx = container.querySelector('#bar-chart').getContext('2d');

  if (!entries.length) {
    ctx.canvas.parentElement.innerHTML = `<div class="empty-state" style="padding:40px 0;"><div class="empty-icon">📊</div><p>No data this month</p></div>`;
    return;
  }

  const c = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{
        data: entries.map(([,v]) => v),
        backgroundColor: entries.map(([k]) => CAT_COLORS[k] + 'cc'),
        borderColor: entries.map(([k]) => CAT_COLORS[k]),
        borderWidth: 2,
        borderRadius: 8,
        hoverBackgroundColor: entries.map(([k]) => CAT_COLORS[k]),
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c2533', titleColor: '#f0f4f8',
          bodyColor: '#8a9bb0', borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1, padding: 12, cornerRadius: 8,
          callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#4a5a70', font: { size: 11 } } },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#4a5a70', font: { size: 10 }, callback: v => '₹' + v.toLocaleString('en-IN') }
        }
      }
    }
  });
  charts.push(c);
}

function renderPieChart(container, catData) {
  const entries = Object.entries(catData).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
  const ctx = container.querySelector('#pie-chart').getContext('2d');

  if (!entries.length) {
    ctx.canvas.parentElement.innerHTML = `<div class="empty-state" style="padding:40px 0;"><div class="empty-icon">🥧</div><p>No data this month</p></div>`;
    return;
  }

  const c = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{
        data: entries.map(([,v]) => v),
        backgroundColor: entries.map(([k]) => CAT_COLORS[k] + '88'),
        borderColor: entries.map(([k]) => CAT_COLORS[k]),
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#8a9bb0', font: { size: 11 }, boxWidth: 12, padding: 12 } },
        tooltip: {
          backgroundColor: '#1c2533', titleColor: '#f0f4f8',
          bodyColor: '#8a9bb0', borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1, padding: 12, cornerRadius: 8,
          callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` }
        }
      },
      scales: {
        r: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { display: false } }
      }
    }
  });
  charts.push(c);
}

function renderDailyChart(container, expenses) {
  const ctx = container.querySelector('#daily-chart').getContext('2d');

  // Aggregate by day
  const dayMap = {};
  expenses.forEach(e => {
    const day = e.date.substring(0,2);
    dayMap[day] = (dayMap[day] || 0) + e.amount;
  });

  if (!Object.keys(dayMap).length) {
    ctx.canvas.parentElement.innerHTML = `<div class="empty-state" style="padding:30px 0;"><div class="empty-icon">📅</div><p>No daily data</p></div>`;
    return;
  }

  const days = Object.keys(dayMap).sort();
  const vals = days.map(d => dayMap[d]);

  const c = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days.map(d => d),
      datasets: [{
        data: vals,
        backgroundColor: 'rgba(255,61,154,0.4)',
        borderColor: '#ff3d9a',
        borderWidth: 2,
        borderRadius: 4,
        hoverBackgroundColor: '#ff3d9a',
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: {
          backgroundColor: '#1c2533', titleColor: '#f0f4f8', bodyColor: '#8a9bb0',
          borderColor: 'rgba(255,255,255,0.07)', borderWidth: 1, padding: 10, cornerRadius: 8,
          callbacks: { title: ctx => `Day ${ctx[0].label}`, label: ctx => ` ${formatCurrency(ctx.raw)}` }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#4a5a70', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5a70', font: { size: 10 }, callback: v => '₹' + v.toLocaleString('en-IN') } }
      }
    }
  });
  charts.push(c);
}

function renderTrendCatChart(container) {
  const ctx = container.querySelector('#trend-cat-chart').getContext('2d');
  const allExp = tracker.getAllExpenses();

  // Get all months
  const months = [...new Set(allExp.map(e => e.month))].sort().slice(-6);
  if (months.length < 2) {
    ctx.canvas.parentElement.innerHTML = `<div class="empty-state" style="padding:30px 0;"><div class="empty-icon">📈</div><p>Need at least 2 months of data</p></div>`;
    return;
  }

  // Get top 4 categories by total
  const catTotals = {};
  allExp.forEach(e => catTotals[e.category] = (catTotals[e.category] || 0) + e.amount);
  const topCats = Object.entries(catTotals).sort((a,b) => b[1]-a[1]).slice(0,4).map(([k])=>k);

  const datasets = topCats.map(cat => ({
    label: cat,
    data: months.map(m => {
      const exp = allExp.filter(e => e.month === m && e.category === cat);
      return exp.reduce((s,e) => s + e.amount, 0);
    }),
    borderColor: CAT_COLORS[cat],
    backgroundColor: CAT_COLORS[cat] + '20',
    fill: false, tension: 0.4,
    pointBackgroundColor: CAT_COLORS[cat], pointRadius: 4, pointHoverRadius: 7,
  }));

  const c = new Chart(ctx, {
    type: 'line',
    data: { labels: months.map(m => parseMonth(m).label), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#8a9bb0', font: { size: 11 }, boxWidth: 12, padding: 16 } },
        tooltip: {
          backgroundColor: '#1c2533', titleColor: '#f0f4f8', bodyColor: '#8a9bb0',
          borderColor: 'rgba(255,255,255,0.07)', borderWidth: 1, padding: 12, cornerRadius: 8,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5a70', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5a70', font: { size: 10 }, callback: v => '₹' + v.toLocaleString('en-IN') } }
      }
    }
  });
  charts.push(c);
}

function renderInsights(container, catData, expenses, allMonths) {
  const el = container.querySelector('#insights-grid');

  const total = expenses.reduce((s,e) => s + e.amount, 0);
  const avgPerDay = total / 30;
  const highestDay = (() => {
    const dm = {}; expenses.forEach(e => dm[e.date] = (dm[e.date]||0)+e.amount);
    const max = Object.entries(dm).sort((a,b)=>b[1]-a[1])[0];
    return max ? { date: max[0], amt: max[1] } : null;
  })();

  const entries = Object.entries(catData).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const topCat = entries[0];
  const lowestCat = entries.at(-1);

  // Month-over-month
  const sorted = allMonths.sort((a,b) => {
    const [am,ay] = a.month.split('-').map(Number);
    const [bm,by] = b.month.split('-').map(Number);
    return ay !== by ? ay-by : am-bm;
  });
  const lastTwo = sorted.slice(-2);
  const mom = lastTwo.length === 2
    ? ((lastTwo[1].total - lastTwo[0].total) / lastTwo[0].total * 100)
    : null;

  const cards = [
    {
      title: 'Avg Daily Spend',
      value: formatCurrency(avgPerDay),
      sub: `This month so far`,
      icon: '📅',
      color: 'var(--green)'
    },
    {
      title: 'Highest Spend Day',
      value: highestDay ? formatCurrency(highestDay.amt) : '—',
      sub: highestDay ? `on ${highestDay.date}` : 'No data',
      icon: '🔥',
      color: 'var(--orange)'
    },
    {
      title: 'Top Category',
      value: topCat ? `${CAT_ICONS[topCat[0]]} ${topCat[0]}` : '—',
      sub: topCat ? formatCurrency(topCat[1]) + ' spent' : 'No data',
      icon: '📊',
      color: 'var(--pink)'
    },
    {
      title: 'Month vs Last',
      value: mom !== null ? `${mom > 0 ? '+' : ''}${mom.toFixed(1)}%` : '—',
      sub: mom !== null ? (mom > 0 ? 'Higher than last month' : 'Lower than last month') : 'Need more data',
      icon: mom !== null ? (mom > 0 ? '📈' : '📉') : '—',
      color: mom !== null ? (mom > 0 ? 'var(--orange)' : 'var(--green)') : 'var(--text-3)'
    },
    {
      title: 'Total Expenses',
      value: String(expenses.length),
      sub: `in ${parseMonth(currentMonth).label}`,
      icon: '🧾',
      color: 'var(--yellow)'
    },
    {
      title: 'Lowest Category',
      value: lowestCat ? `${CAT_ICONS[lowestCat[0]]} ${lowestCat[0]}` : '—',
      sub: lowestCat ? formatCurrency(lowestCat[1]) + ' spent' : 'No data',
      icon: '💡',
      color: 'var(--green)'
    },
  ];

  el.innerHTML = cards.map(c => `
    <div class="card" style="padding:20px;">
      <div class="stat-label">${c.title}</div>
      <div style="font-family:var(--font-display); font-size:22px; font-weight:800; color:${c.color}; margin:8px 0 4px; line-height:1.1;">
        ${c.value}
      </div>
      <div style="font-size:12px; color:var(--text-3);">${c.sub}</div>
    </div>
  `).join('');

  gsap.from(el.querySelectorAll('.card'), {
    opacity:0, y:15, duration:0.4, stagger:0.05, ease:'power2.out', delay:0.1
  });
}
