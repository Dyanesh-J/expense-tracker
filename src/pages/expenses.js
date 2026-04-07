// src/pages/expenses.js
import { tracker } from '../wasm/bridge.js';
import {
  formatCurrency, sortExpensesDesc, renderCatPill,
  CAT_ICONS, exportToCSV
} from '../utils/helpers.js';
import { renderExpenseForm } from '../ui/expenseForm.js';
import { showToast } from '../ui/toast.js';
import { gsap } from 'gsap';

let filterCat = 'All';
let searchQuery = '';
let sortField = 'date';
let sortDir = -1; // -1 = desc

export function showExpenses(container) {
  return new Promise(resolve => {
    container.innerHTML = buildHTML();
    bindEvents(container);
    renderTable(container);
    resolve();
  });
}

function buildHTML() {
  const cats = ['All', ...tracker.getCategories()];
  const chips = cats.map(c => `
    <button class="chip ${c === filterCat ? 'active' : ''}" data-cat="${c}">${c}</button>
  `).join('');

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Expenses</h1>
        <p class="page-subtitle">Track and manage all your transactions</p>
      </div>
      <div class="flex gap-3" style="flex-wrap:wrap; align-items:center;">
        <button class="btn btn-secondary btn-sm" id="export-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
        <button class="btn btn-primary btn-sm" id="add-expense-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Expense
        </button>
      </div>
    </div>

    <div class="page-body">
      <!-- Filters -->
      <div class="action-row">
        <div class="search-bar" style="flex:1; max-width:300px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" class="form-control" id="search-input" placeholder="Search expenses..." />
        </div>
        <div id="total-display" style="font-family:var(--font-mono); font-size:13px; color:var(--text-2);"></div>
      </div>

      <div class="filter-chips" id="cat-chips">${chips}</div>

      <!-- Table -->
      <div class="card" style="padding:0; overflow:hidden;">
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="padding-left:24px;">
                  <button class="sort-btn" data-field="date" style="background:none;border:none;color:inherit;font:inherit;cursor:pointer;display:flex;align-items:center;gap:4px;">
                    DATE <span id="sort-date">↓</span>
                  </button>
                </th>
                <th>CATEGORY</th>
                <th>NOTE</th>
                <th>
                  <button class="sort-btn" data-field="amount" style="background:none;border:none;color:inherit;font:inherit;cursor:pointer;display:flex;align-items:center;gap:4px;">
                    AMOUNT <span id="sort-amount"></span>
                  </button>
                </th>
                <th style="text-align:right; padding-right:24px;">ACTIONS</th>
              </tr>
            </thead>
            <tbody id="expense-tbody"></tbody>
          </table>
        </div>
        <div id="expenses-empty" class="empty-state hidden">
          <div class="empty-icon">🔍</div>
          <p>No expenses found</p>
        </div>
      </div>
    </div>
  `;
}

function bindEvents(container) {
  container.querySelector('#add-expense-btn').addEventListener('click', () => {
    renderExpenseForm(null, () => renderTable(container));
  });

  container.querySelector('#export-btn').addEventListener('click', () => {
    const expenses = getFiltered();
    if (!expenses.length) { showToast('No data to export', 'warning'); return; }
    exportToCSV(expenses);
    showToast('Exported to CSV!', 'success');
  });

  container.querySelector('#search-input').addEventListener('input', e => {
    searchQuery = e.target.value.toLowerCase();
    renderTable(container);
  });

  container.querySelector('#cat-chips').addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    filterCat = btn.dataset.cat;
    container.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.cat === filterCat));
    renderTable(container);
  });

  container.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      if (sortField === field) sortDir *= -1;
      else { sortField = field; sortDir = -1; }
      container.querySelectorAll('[id^=sort-]').forEach(s => s.textContent = '');
      container.querySelector(`#sort-${field}`).textContent = sortDir === -1 ? '↓' : '↑';
      renderTable(container);
    });
  });
}

function getFiltered() {
  let expenses = tracker.getAllExpenses();
  if (filterCat !== 'All') expenses = expenses.filter(e => e.category === filterCat);
  if (searchQuery) expenses = expenses.filter(e =>
    e.note.toLowerCase().includes(searchQuery) ||
    e.category.toLowerCase().includes(searchQuery) ||
    e.date.includes(searchQuery)
  );

  // Sort
  expenses.sort((a, b) => {
    if (sortField === 'amount') return (a.amount - b.amount) * sortDir;
    // date: DD-MM-YYYY
    const toTs = s => {
      const [d,m,y] = s.date.split('-');
      return new Date(+y, +m-1, +d).getTime();
    };
    return (toTs(a) - toTs(b)) * sortDir;
  });

  return expenses;
}

function renderTable(container) {
  const expenses = getFiltered();
  const tbody = container.querySelector('#expense-tbody');
  const empty = container.querySelector('#expenses-empty');
  const totalDisplay = container.querySelector('#total-display');

  const total = expenses.reduce((s,e) => s + e.amount, 0);
  totalDisplay.textContent = `${expenses.length} results · Total: ${formatCurrency(total)}`;

  if (!expenses.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = expenses.map(e => `
    <tr data-id="${e.id}">
      <td style="padding-left:24px; font-family:var(--font-mono); font-size:12px; color:var(--text-3);">${e.date}</td>
      <td>${renderCatPill(e.category)}</td>
      <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-1);">
        ${e.note || '<span style="color:var(--text-3)">—</span>'}
      </td>
      <td style="font-family:var(--font-mono); font-size:14px; font-weight:700; color:var(--orange);">
        ${formatCurrency(e.amount)}
      </td>
      <td style="text-align:right; padding-right:24px;">
        <div class="flex" style="justify-content:flex-end; gap:6px;">
          <button class="btn-icon edit-btn" data-id="${e.id}" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon delete-btn" data-id="${e.id}" title="Delete" style="color:var(--pink); border-color:rgba(255,61,154,0.2);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  // Animate rows
  gsap.from(tbody.querySelectorAll('tr'), {
    opacity: 0, y: 10, duration: 0.25, stagger: 0.03, ease: 'power2.out'
  });

  // Edit buttons
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const expense = expenses.find(e => e.id === id);
      if (expense) renderExpenseForm(expense, () => renderTable(container));
    });
  });

  // Delete buttons
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      openModal(`
        <div class="modal-header">
          <h3 class="modal-title">Delete Expense?</h3>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <p style="color:var(--text-2); margin-bottom:24px; font-size:14px;">
          This action cannot be undone.
        </p>
        <div class="flex gap-2">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-danger w-full" id="confirm-delete">Delete</button>
        </div>
      `);
      document.getElementById('confirm-delete').addEventListener('click', () => {
        const result = tracker.deleteExpense(id);
        if (result.success) {
          showToast('Expense deleted', 'success');
          closeModal();
          renderTable(container);
        }
      });
    });
  });
}
