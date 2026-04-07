import { tracker } from '../wasm/bridge.js';
import { showToast } from '../ui/toast.js';
import { exportToCSV } from '../utils/helpers.js';

export function showSettings(container) {
  return new Promise((resolve) => {
    container.innerHTML = buildHTML();
    bindEvents(container);
    loadSettings(container);
    resolve();
  });
}

function buildHTML() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Customize your experience</p>
      </div>
    </div>

    <div class="page-body">
      <div class="settings-section">
        <div class="settings-section-title">
          <span>Settings</span> General
        </div>

        <div class="settings-row">
          <div class="settings-info">
            <div class="settings-row-title">Currency Symbol</div>
            <div class="settings-row-desc">Used across all displays</div>
          </div>
          <select class="form-control" id="currency-select" style="width:120px;">
            <option value="₹">₹ INR</option>
            <option value="$">$ USD</option>
            <option value="€">€ EUR</option>
            <option value="£">£ GBP</option>
          </select>
        </div>

        <div class="settings-row">
          <div class="settings-info">
            <div class="settings-row-title">User Name</div>
            <div class="settings-row-desc">Shows the signed-in username from your account</div>
          </div>
          <div class="flex gap-2" style="align-items:center;">
            <input type="text" class="form-control" id="user-name" placeholder="Your username" style="width:180px;" />
            <button class="btn btn-secondary btn-sm" id="save-name-btn">Save</button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">
          <span>Data</span> Management
        </div>

        <div class="settings-row">
          <div class="settings-info">
            <div class="settings-row-title">Export All Expenses</div>
            <div class="settings-row-desc">Download your data as CSV</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="export-data-btn">Export CSV</button>
        </div>

        <div class="settings-row">
          <div class="settings-info">
            <div class="settings-row-title">Import Sample Data</div>
            <div class="settings-row-desc">Load sample expenses for testing</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="import-sample-btn">Load Samples</button>
        </div>

        <div class="settings-row">
          <div class="settings-info">
            <div class="settings-row-title">Clear All Data</div>
            <div class="settings-row-desc" style="color:var(--pink);">Permanently deletes all expenses and budgets</div>
          </div>
          <button class="btn btn-danger btn-sm" id="clear-data-btn">Clear All</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">
          <span>Engine</span> Info
        </div>

        <div class="settings-row">
          <div class="settings-info">
            <div class="settings-row-title">WebAssembly Status</div>
            <div class="settings-row-desc" id="wasm-status-desc">Checking...</div>
          </div>
          <div id="wasm-status-badge"></div>
        </div>

        <div class="settings-row">
          <div class="settings-info">
            <div class="settings-row-title">Storage Mode</div>
            <div class="settings-row-desc">How data is persisted</div>
          </div>
          <span class="stat-badge orange" id="storage-mode-badge">localStorage</span>
        </div>

        <div class="settings-row">
          <div class="settings-info">
            <div class="settings-row-title">Total Records</div>
            <div class="settings-row-desc">Expenses in storage</div>
          </div>
          <span id="total-records" style="font-family:var(--font-mono); font-size:14px; color:var(--green);"></span>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">
          <span>About</span> App
        </div>
        <div style="color:var(--text-2); font-size:14px; line-height:1.8;">
          <p><strong class="text-green">Monthly Money Coach</strong> - DA2 Project</p>
          <p>Built with: C++ (OOP) + WebAssembly + Vanilla JS + GSAP + Chart.js</p>
          <p style="margin-top:8px;">OOP Concepts: <span class="stat-badge green">class Expense</span> <span class="stat-badge orange">class BudgetManager</span></p>
          <p>Features: File handling, STL containers, constructors, and encapsulation</p>
          <p style="margin-top:12px; color:var(--text-3); font-size:12px;">
            Subject: SOOPDA2 · Assignment: DA2 · Type: C++ Mini Project
          </p>
        </div>
      </div>
    </div>
  `;
}

function loadSettings(container) {
  const signedInUser = window.getCurrentUser?.();
  const name = signedInUser?.username || localStorage.getItem('mmc_username') || '';
  const currency = localStorage.getItem('mmc_currency') || '₹';
  container.querySelector('#user-name').value = name;
  container.querySelector('#currency-select').value = currency;

  const wasmActive = document.querySelector('.wasm-badge')?.classList.contains('active');
  container.querySelector('#wasm-status-desc').textContent = wasmActive
    ? 'Running C++ compiled code via Emscripten'
    : 'WASM not loaded. Using JavaScript fallback (localStorage)';
  container.querySelector('#wasm-status-badge').innerHTML = `
    <span class="stat-badge ${wasmActive ? 'green' : 'orange'}">
      ${wasmActive ? 'WASM Active' : 'JS Fallback'}
    </span>
  `;

  if (wasmActive) {
    container.querySelector('#storage-mode-badge').textContent = 'File System (C++)';
  }

  const total = tracker.getAllExpenses().length;
  container.querySelector('#total-records').textContent = `${total} expenses`;
}

function bindEvents(container) {
  container.querySelector('#save-name-btn').addEventListener('click', () => {
    const name = container.querySelector('#user-name').value.trim();
    localStorage.setItem('mmc_username', name);
    showToast('Displayed username saved!', 'success');
  });

  container.querySelector('#currency-select').addEventListener('change', (event) => {
    localStorage.setItem('mmc_currency', event.target.value);
    showToast('Currency updated!', 'success');
  });

  container.querySelector('#export-data-btn').addEventListener('click', () => {
    const all = tracker.getAllExpenses();
    if (!all.length) {
      showToast('No data to export', 'warning');
      return;
    }
    exportToCSV(all);
    showToast('Exported successfully!', 'success');
  });

  container.querySelector('#import-sample-btn').addEventListener('click', () => {
    importSampleData();
    showToast('Sample data loaded!', 'success');
    loadSettings(container);
  });

  container.querySelector('#clear-data-btn').addEventListener('click', () => {
    openModal(`
      <div class="modal-header">
        <h3 class="modal-title" style="color:var(--pink);">Clear All Data?</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <p style="color:var(--text-2); margin-bottom:24px; font-size:14px;">
        This will permanently delete all expenses and budgets. This action cannot be undone.
      </p>
      <div class="flex gap-2">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger w-full" id="confirm-clear">Yes, Delete Everything</button>
      </div>
    `);

    document.getElementById('confirm-clear').addEventListener('click', () => {
      localStorage.removeItem('mmc_expenses');
      localStorage.removeItem('mmc_budgets');
      closeModal();
      showToast('All data cleared', 'info');
      loadSettings(container);
    });
  });
}

function importSampleData() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();

  const samples = [
    { date: `01-${mm}-${yyyy}`, category: 'Food', amount: 450, note: 'Groceries from DMart' },
    { date: `02-${mm}-${yyyy}`, category: 'Transport', amount: 220, note: 'Uber to office' },
    { date: `05-${mm}-${yyyy}`, category: 'Food', amount: 180, note: 'Lunch with team' },
    { date: `08-${mm}-${yyyy}`, category: 'Shopping', amount: 1200, note: 'New headphones' },
    { date: `10-${mm}-${yyyy}`, category: 'Bills', amount: 650, note: 'Electricity bill' },
    { date: `12-${mm}-${yyyy}`, category: 'Health', amount: 380, note: 'Pharmacy' },
    { date: `14-${mm}-${yyyy}`, category: 'Entertainment', amount: 299, note: 'Netflix subscription' },
    { date: `15-${mm}-${yyyy}`, category: 'Food', amount: 320, note: 'Swiggy order' },
    { date: `18-${mm}-${yyyy}`, category: 'Education', amount: 999, note: 'Udemy course' },
    { date: `20-${mm}-${yyyy}`, category: 'Transport', amount: 150, note: 'Metro card recharge' },
    { date: `22-${mm}-${yyyy}`, category: 'Travel', amount: 2500, note: 'Weekend trip to Pondicherry' },
    { date: `25-${mm}-${yyyy}`, category: 'Food', amount: 500, note: 'Birthday dinner' },
    { date: `28-${mm}-${yyyy}`, category: 'Bills', amount: 300, note: 'Internet bill' },
    { date: `30-${mm}-${yyyy}`, category: 'Shopping', amount: 800, note: 'Clothes' }
  ];

  samples.forEach((sample) => tracker.addExpense(sample.date, sample.category, sample.amount, sample.note));
  tracker.setBudget(`${mm}-${yyyy}`, 10000);
}
