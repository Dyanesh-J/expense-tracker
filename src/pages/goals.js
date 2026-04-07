import { tracker } from '../wasm/bridge.js';
import { formatCurrency, getCurrentDate, parseDate } from '../utils/helpers.js';
import { showToast } from '../ui/toast.js';
import { gsap } from 'gsap';

export function showGoals(container) {
  return new Promise((resolve) => {
    container.innerHTML = buildHTML();
    bindEvents(container);
    renderGoals(container);
    resolve();
  });
}

function buildHTML() {
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title" style="background: linear-gradient(135deg, var(--green), var(--yellow)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;">Goals</h1>
        <p class="page-subtitle">Save toward a laptop, phone, bike, or any big purchase with clear progress tracking</p>
      </div>
      <div class="flex gap-3" style="align-items:center; flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" id="add-goal-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Goal
        </button>
      </div>
    </div>

    <div class="page-body">
      <div id="goals-summary" class="stats-grid mb-3"></div>
      <div id="goals-list" class="grid-2"></div>
    </div>
  `;
}

function bindEvents(container) {
  container.querySelector('#add-goal-btn').addEventListener('click', () => {
    openGoalForm(() => renderGoals(container));
  });
}

function renderGoals(container) {
  const goals = tracker.getAllGoals();
  const summaryEl = container.querySelector('#goals-summary');
  const listEl = container.querySelector('#goals-list');

  if (!goals.length) {
    summaryEl.innerHTML = `
      <div class="stat-card" style="--accent-color: var(--green);">
        <div class="stat-label">Goals</div>
        <div class="stat-value">0</div>
        <div class="stat-sub">Add your first savings goal</div>
        <div class="stat-icon">G</div>
      </div>
    `;
    listEl.innerHTML = `
      <div class="card" style="grid-column:1 / -1;">
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <p>Create a goal and start adding money toward it.</p>
        </div>
      </div>
    `;
    return;
  }

  const totalTarget = goals.reduce((sum, goal) => sum + Number(goal.targetAmount || 0), 0);
  const totalSaved = goals.reduce((sum, goal) => sum + Number(goal.savedAmount || 0), 0);
  const completedCount = goals.filter((goal) => Number(goal.savedAmount || 0) >= Number(goal.targetAmount || 0)).length;
  const nearestGoal = [...goals].sort((a, b) => getRemainingDays(a) - getRemainingDays(b))[0];

  summaryEl.innerHTML = `
    <div class="stat-card" style="--accent-color: var(--green);">
      <div class="stat-label">Total Saved</div>
      <div class="stat-value" style="font-size:24px;">${formatCurrency(totalSaved)}</div>
      <div class="stat-sub">Across ${goals.length} goal(s)</div>
      <div class="stat-icon">₹</div>
    </div>
    <div class="stat-card" style="--accent-color: var(--orange);">
      <div class="stat-label">Target Amount</div>
      <div class="stat-value" style="font-size:24px;">${formatCurrency(totalTarget)}</div>
      <div class="stat-sub">Combined savings target</div>
      <div class="stat-icon">T</div>
    </div>
    <div class="stat-card" style="--accent-color: var(--pink);">
      <div class="stat-label">Completed</div>
      <div class="stat-value" style="font-size:24px;">${completedCount}</div>
      <div class="stat-sub">${completedCount === 1 ? 'goal reached' : 'goals reached'}</div>
      <div class="stat-icon">✓</div>
    </div>
    <div class="stat-card" style="--accent-color: var(--yellow);">
      <div class="stat-label">Closest ETA</div>
      <div class="stat-value" style="font-size:24px;">${Math.max(0, getRemainingDays(nearestGoal))}</div>
      <div class="stat-sub">${nearestGoal?.name || 'No goals'} remaining day(s)</div>
      <div class="stat-icon">D</div>
    </div>
  `;

  listEl.innerHTML = goals
    .sort((a, b) => getProgressPercent(b) - getProgressPercent(a))
    .map((goal) => renderGoalCard(goal))
    .join('');

  gsap.from(listEl.querySelectorAll('.goal-card'), {
    opacity: 0,
    y: 16,
    duration: 0.35,
    stagger: 0.05,
    ease: 'power2.out'
  });

  listEl.querySelectorAll('.goal-add-btn').forEach((button) => {
    button.addEventListener('click', () => {
      openContributionForm(button.dataset.id, () => renderGoals(container));
    });
  });

  listEl.querySelectorAll('.goal-edit-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const goal = goals.find((item) => item.id === button.dataset.id);
      if (goal) openGoalForm(() => renderGoals(container), goal);
    });
  });

  listEl.querySelectorAll('.goal-delete-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const goal = goals.find((item) => item.id === button.dataset.id);
      if (goal) openDeleteGoalModal(goal, () => renderGoals(container));
    });
  });
}

function renderGoalCard(goal) {
  const progress = getProgressPercent(goal);
  const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.savedAmount || 0));
  const remainingDays = Math.max(0, getRemainingDays(goal));
  const targetDate = getTargetDateLabel(goal);
  const complete = progress >= 100;

  return `
    <div class="card goal-card ${complete ? 'goal-card-complete' : ''}">
      <div class="flex-between mb-2" style="align-items:flex-start;">
        <div>
          <div class="goal-title">${escapeHtml(goal.name)}</div>
          <div class="goal-meta">Added ${goal.createdDate} · ETA ${goal.etaDays} day(s)</div>
        </div>
        <div class="goal-status-wrap">
          ${complete ? '<div class="goal-success-tick">✓</div>' : ''}
          <span class="stat-badge ${complete ? 'green' : progress >= 65 ? 'orange' : 'pink'}">
            ${progress.toFixed(0)}%
          </span>
        </div>
      </div>

      <div class="goal-amount-row">
        <div>
          <div class="goal-amount-label">Saved</div>
          <div class="goal-amount-value">${formatCurrency(goal.savedAmount || 0)}</div>
        </div>
        <div>
          <div class="goal-amount-label">Target</div>
          <div class="goal-amount-value">${formatCurrency(goal.targetAmount || 0)}</div>
        </div>
      </div>

      <div class="budget-bar-wrap goal-progress-wrap">
        <div class="budget-bar ${complete ? 'safe' : progress >= 70 ? 'warning' : 'danger'}" style="width:${Math.min(progress, 100)}%"></div>
      </div>

      <div class="goal-details">
        <div>${formatCurrency(remaining)} left</div>
        <div>${complete ? 'Goal successfully achieved' : `${remainingDays} day(s) left`}</div>
      </div>
      <div class="goal-details" style="margin-top:6px;">
        <div>Expected by ${targetDate}</div>
        <div>Last update ${goal.updatedAt || goal.createdDate}</div>
      </div>

      <div class="goal-actions">
        ${complete ? '' : `<button class="btn btn-primary btn-sm goal-add-btn" data-id="${goal.id}">Add Amount</button>`}
        ${complete ? '' : `<button class="btn btn-secondary btn-sm goal-edit-btn" data-id="${goal.id}">Edit Goal</button>`}
        <button class="btn btn-danger btn-sm goal-delete-btn" data-id="${goal.id}">Delete</button>
      </div>
    </div>
  `;
}

function openGoalForm(onSave, goal = null) {
  const isEdit = Boolean(goal);
  const html = `
    <div class="modal-header">
      <h3 class="modal-title">${isEdit ? 'Update Goal' : 'Add New Goal'}</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <form id="goal-form" onsubmit="return false;">
      <div class="form-group">
        <label class="form-label">Goal Name</label>
        <input type="text" class="form-control" id="goal-name" placeholder="Laptop, Phone, Bike..." value="${escapeAttr(goal?.name || '')}" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Created Date</label>
          <input type="text" class="form-control" id="goal-created-date" value="${goal?.createdDate || getCurrentDate()}" readonly />
        </div>
        <div class="form-group">
          <label class="form-label">ETA In Days</label>
          <input type="number" class="form-control" id="goal-eta-days" min="1" step="1" value="${goal?.etaDays || ''}" placeholder="How many days?" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Total Amount Required</label>
          <input type="number" class="form-control" id="goal-target-amount" min="1" step="0.01" value="${goal?.targetAmount || ''}" placeholder="Target amount" required />
        </div>
        <div class="form-group">
          <label class="form-label">Amount Already Saved</label>
          <input type="number" class="form-control" id="goal-saved-amount" min="0" step="0.01" value="${goal?.savedAmount || ''}" placeholder="Saved so far" />
        </div>
      </div>
      <div class="flex gap-2">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary w-full">${isEdit ? 'Save Changes' : 'Create Goal'}</button>
      </div>
    </form>
  `;

  openModal(html);

  document.getElementById('goal-form').addEventListener('submit', () => {
    const name = document.getElementById('goal-name').value.trim();
    const createdDate = document.getElementById('goal-created-date').value.trim();
    const etaDays = Number(document.getElementById('goal-eta-days').value);
    const targetAmount = Number(document.getElementById('goal-target-amount').value);
    const savedAmount = Number(document.getElementById('goal-saved-amount').value || 0);

    if (!parseDate(createdDate)) {
      showToast('Goal date is invalid', 'error');
      return;
    }

    let result;
    if (isEdit) {
      result = tracker.updateGoal(goal.id, {
        name,
        createdDate,
        etaDays,
        targetAmount,
        savedAmount,
        updatedAt: getCurrentDate()
      });
    } else {
      result = tracker.addGoal(name, targetAmount, etaDays, createdDate, savedAmount);
    }

    if (!result.success) {
      showToast(result.error || 'Could not save goal', 'error');
      return;
    }

    showToast(isEdit ? 'Goal updated!' : 'Goal created!', 'success');
    closeModal();
    onSave?.();
  });
}

function openContributionForm(goalId, onSave) {
  const goal = tracker.getAllGoals().find((item) => item.id === goalId);
  if (!goal) {
    showToast('Goal not found', 'error');
    return;
  }

  const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.savedAmount || 0));
  if (remaining <= 0) {
    showToast('Goal successfully achieved', 'success');
    return;
  }

  const html = `
    <div class="modal-header">
      <h3 class="modal-title">Add Money To Goal</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <form id="goal-contribution-form" onsubmit="return false;">
      <div class="form-group">
        <label class="form-label">Amount</label>
        <input type="number" class="form-control" id="goal-contribution-amount" min="0.01" max="${remaining}" step="0.01" placeholder="How much are you adding?" required />
        <div class="goal-form-help">You can add up to ${formatCurrency(remaining)} for this goal.</div>
      </div>
      <div class="flex gap-2">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary w-full">Add Amount</button>
      </div>
    </form>
  `;

  openModal(html);

  document.getElementById('goal-contribution-form').addEventListener('submit', () => {
    const amount = Number(document.getElementById('goal-contribution-amount').value);
    if (amount > remaining) {
      showToast(`You can only add up to ${formatCurrency(remaining)}`, 'error');
      return;
    }
    const result = tracker.addGoalContribution(goalId, amount, getCurrentDate());

    if (!result.success) {
      showToast(result.error || 'Could not update goal', 'error');
      return;
    }

    showToast(amount === remaining ? 'Goal successfully achieved!' : 'Saved amount updated!', 'success');
    closeModal();
    onSave?.();
  });
}

function openDeleteGoalModal(goal, onSave) {
  openModal(`
    <div class="modal-header">
      <h3 class="modal-title">Delete Goal?</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <p style="color:var(--text-2); margin-bottom:24px; font-size:14px;">
      Remove <strong>${escapeHtml(goal.name)}</strong> from your goals list?
    </p>
    <div class="flex gap-2">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger w-full" id="confirm-delete-goal">Delete</button>
    </div>
  `);

  document.getElementById('confirm-delete-goal').addEventListener('click', () => {
    const result = tracker.deleteGoal(goal.id);
    if (!result.success) {
      showToast(result.error || 'Could not delete goal', 'error');
      return;
    }
    showToast('Goal deleted', 'success');
    closeModal();
    onSave?.();
  });
}

function getProgressPercent(goal) {
  const saved = Number(goal.savedAmount || 0);
  const target = Number(goal.targetAmount || 0);
  if (!target) return 0;
  return (saved / target) * 100;
}

function getRemainingDays(goal) {
  const created = parseDate(goal.createdDate);
  if (!created) return 0;
  const targetDate = new Date(created.year, created.month - 1, created.day + Number(goal.etaDays || 0));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
}

function getTargetDateLabel(goal) {
  const created = parseDate(goal.createdDate);
  if (!created) return goal.createdDate;
  const targetDate = new Date(created.year, created.month - 1, created.day + Number(goal.etaDays || 0));
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const yyyy = targetDate.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
