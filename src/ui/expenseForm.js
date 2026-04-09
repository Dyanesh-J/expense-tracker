// src/ui/expenseForm.js
import { tracker } from '../wasm/bridge.js';
import { showToast } from './toast.js';
import { formatCurrency, getCurrentDate } from '../utils/helpers.js';

export function renderExpenseForm(expense = null, onSave = null) {
  const isEdit = !!expense;
  const categories = tracker.getCategories();
  const catOptions = categories.map(c =>
    `<option value="${c}" ${expense?.category === c ? 'selected' : ''}>${c}</option>`
  ).join('');

  const html = `
    <div class="modal-header">
      <h3 class="modal-title">${isEdit ? '✏️ Edit Expense' : '+ New Expense'}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <form id="expense-form" onsubmit="return false;">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="text" class="form-control" id="ef-date"
            placeholder="DD-MM-YYYY" maxlength="10"
            value="${expense?.date || getCurrentDate()}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-control" id="ef-category">
            ${catOptions}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Amount (₹)</label>
        <div class="input-prefix">
          <span class="prefix">₹</span>
          <input type="number" class="form-control" id="ef-amount"
            placeholder="0.00" step="0.01" min="0.01"
            value="${expense?.amount || ''}" required />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Note</label>
        <input type="text" class="form-control" id="ef-note"
          placeholder="What was this for?"
          value="${expense?.note || ''}" />
      </div>
      <div class="flex" style="gap:10px; margin-top:8px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary w-full" id="ef-submit">
          ${isEdit ? 'Save Changes' : 'Add Expense'}
        </button>
      </div>
    </form>
  `;

  openModal(html);

  // Auto-format date input
  const dateInput = document.getElementById('ef-date');
  dateInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 2) v = v.slice(0,2) + '-' + v.slice(2);
    if (v.length > 5) v = v.slice(0,5) + '-' + v.slice(5);
    e.target.value = v.slice(0, 10);
  });

  document.getElementById('expense-form').addEventListener('submit', () => {
    const date     = document.getElementById('ef-date').value.trim();
    const category = document.getElementById('ef-category').value;
    const amount   = parseFloat(document.getElementById('ef-amount').value);
    const note     = document.getElementById('ef-note').value.trim();

    if (!date || date.length < 10) {
      showToast('Enter a valid date (DD-MM-YYYY)', 'error');
      return;
    }

    let result;
    if (isEdit) {
      result = tracker.editExpense(expense.id, date, category, amount, note);
    } else {
      result = tracker.addExpense(date, category, amount, note);
    }

    if (result.success) {
      showToast(isEdit ? 'Expense updated!' : 'Expense added!', 'success');
      const monthKey = date.substring(3);
      const monthly = tracker.getMonthlyTotal(monthKey);
      if (monthly.budget > 0 && monthly.total > monthly.budget) {
        showToast(`Budget limit warning: exceeded by ${formatCurrency(monthly.total - monthly.budget)}`, 'warning');
      }
      closeModal();
      if (onSave) onSave();
    } else {
      showToast(result.error || 'Something went wrong', 'error');
    }
  });
}
