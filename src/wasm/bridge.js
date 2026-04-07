// src/wasm/bridge.js
// WASM bridge with localStorage fallback
// This handles both real WASM mode (after Emscripten compile) and dev mode

let wasmModule = null;
let wasmReady = false;
let wasmCallbacks = [];

// ── Try to load WASM ──────────────────────────────────────────────────────────
export async function initWASM() {
  try {
    // ✅ MUST BE BEFORE loading script
    window.Module = {
      locateFile: (path) => `/wasm/${path}`
    };

    // Load script manually
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/wasm/tracker.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    // ✅ IMPORTANT FIX HERE
    if (typeof window.Module !== 'object') {
      throw new Error('Module not initialized');
    }

    wasmModule = window.Module;

    // Wait for runtime ready (VERY IMPORTANT)
    await new Promise((resolve) => {
      if (wasmModule.calledRun) {
        resolve();
      } else {
        wasmModule.onRuntimeInitialized = resolve;
      }
    });

    wasmModule._init_manager();

    wasmReady = true;
    console.log('[WASM] ✅ Emscripten module loaded');

    wasmCallbacks.forEach(cb => cb());
    return true;

  } catch (e) {
    console.error("REAL WASM ERROR:", e);
    console.warn('[WASM] ⚠️ WASM not found, using JS fallback');
    wasmReady = false;
    wasmCallbacks.forEach(cb => cb());
    return false;
  }
}

export function onWasmReady(cb) {
  if (wasmReady !== null) cb();
  else wasmCallbacks.push(cb);
}

// ── Helper to call WASM C functions ──────────────────────────────────────────
function wasmCall(fn, ...args) {
  if (!wasmModule) return null;
  // Convert string args to C strings
  const cArgs = args.map(a => {
    if (typeof a === 'string') {
      const len = wasmModule.lengthBytesUTF8(a) + 1;
      const ptr = wasmModule._malloc(len);
      wasmModule.stringToUTF8(a, ptr, len);
      return { ptr, isStr: true };
    }
    return { val: a, isStr: false };
  });

  const rawArgs = cArgs.map(a => a.isStr ? a.ptr : a.val);
  const resultPtr = wasmModule[fn](...rawArgs);
  const result = wasmModule.UTF8ToString(resultPtr);

  cArgs.forEach(a => { if (a.isStr) wasmModule._free(a.ptr); });
  return result;
}

// ── JS Fallback (localStorage) ────────────────────────────────────────────────
const STORAGE_KEY = 'mmc_expenses';
const BUDGET_KEY  = 'mmc_budgets';
const GOALS_KEY   = 'mmc_goals';

function getStoredExpenses() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveStoredExpenses(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}
function getStoredBudgets() {
  try { return JSON.parse(localStorage.getItem(BUDGET_KEY) || '{}'); } catch { return {}; }
}
function saveStoredBudgets(obj) {
  localStorage.setItem(BUDGET_KEY, JSON.stringify(obj));
}
function getStoredGoals() {
  try { return JSON.parse(localStorage.getItem(GOALS_KEY) || '[]'); } catch { return []; }
}
function saveStoredGoals(arr) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(arr));
}

const VALID_CATEGORIES = ['Food','Transport','Shopping','Entertainment','Health','Bills','Education','Travel','Other'];

function monthFromDate(date) {
  // date: DD-MM-YYYY → MM-YYYY
  if (!date || date.length < 10) return '';
  return date.substring(3);
}

function generateId(expenses) {
  let max = 0;
  expenses.forEach(e => {
    const n = parseInt((e.id || '').replace('EXP',''));
    if (!isNaN(n) && n > max) max = n;
  });
  return 'EXP' + (max + 1);
}

function generateGoalId(goals) {
  let max = 0;
  goals.forEach(g => {
    const n = parseInt((g.id || '').replace('GOAL',''));
    if (!isNaN(n) && n > max) max = n;
  });
  return 'GOAL' + (max + 1);
}

// ── Unified API ───────────────────────────────────────────────────────────────
export const tracker = {
  // Add expense
  addExpense(date, category, amount, note) {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_add_expense', date, category, amount, note));
    }
    // JS fallback
    if (amount <= 0) return { success: false, error: 'Amount must be positive' };
    if (!VALID_CATEGORIES.includes(category)) return { success: false, error: 'Invalid category' };
    const expenses = getStoredExpenses();
    const id = generateId(expenses);
    expenses.push({ id, date, category, amount, note, month: monthFromDate(date) });
    saveStoredExpenses(expenses);
    return { success: true, id };
  },

  // Delete expense
  deleteExpense(id) {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_delete_expense', id));
    }
    const expenses = getStoredExpenses();
    const idx = expenses.findIndex(e => e.id === id);
    if (idx === -1) return { success: false, error: 'Not found' };
    expenses.splice(idx, 1);
    saveStoredExpenses(expenses);
    return { success: true };
  },

  // Edit expense
  editExpense(id, date, category, amount, note) {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_edit_expense', id, date, category, amount, note));
    }
    const expenses = getStoredExpenses();
    const idx = expenses.findIndex(e => e.id === id);
    if (idx === -1) return { success: false, error: 'Not found' };
    if (amount <= 0) return { success: false, error: 'Amount must be positive' };
    expenses[idx] = { id, date, category, amount, note, month: monthFromDate(date) };
    saveStoredExpenses(expenses);
    return { success: true };
  },

  // Get all expenses
  getAllExpenses() {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_get_all_expenses'));
    }
    return getStoredExpenses();
  },

  // Get by category
  getExpensesByCategory(category) {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_get_expenses_by_category', category));
    }
    return getStoredExpenses().filter(e => e.category === category);
  },

  // Get by month
  getExpensesByMonth(month) {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_get_expenses_by_month', month));
    }
    return getStoredExpenses().filter(e => e.month === month);
  },

  // Monthly total
  getMonthlyTotal(month) {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_get_monthly_total', month));
    }
    const expenses = getStoredExpenses();
    const budgets = getStoredBudgets();
    const total = expenses.filter(e => e.month === month).reduce((s,e) => s + e.amount, 0);
    const budget = budgets[month] || 0;
    return { month, total, budget, remaining: budget - total, exceeded: total > budget && budget > 0, percentage: budget > 0 ? (total/budget*100) : 0 };
  },

  // Category totals
  getCategoryTotals(month = '') {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_get_category_totals', month));
    }
    const expenses = getStoredExpenses();
    const result = {};
    VALID_CATEGORIES.forEach(c => result[c] = 0);
    expenses.forEach(e => {
      if (!month || e.month === month) result[e.category] = (result[e.category] || 0) + e.amount;
    });
    return result;
  },

  // All monthly totals
  getAllMonthlyTotals() {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_get_all_monthly_totals'));
    }
    const expenses = getStoredExpenses();
    const budgets = getStoredBudgets();
    const map = {};
    expenses.forEach(e => {
      if (!map[e.month]) map[e.month] = 0;
      map[e.month] += e.amount;
    });
    return Object.entries(map).map(([month, total]) => ({ month, total, budget: budgets[month] || 0 }));
  },

  // Set budget
  setBudget(month, budget) {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_set_budget', month, budget));
    }
    const budgets = getStoredBudgets();
    budgets[month] = budget;
    saveStoredBudgets(budgets);
    return { success: true };
  },

  // Get budget
  getBudget(month) {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_get_budget', month));
    }
    const budgets = getStoredBudgets();
    return { month, budget: budgets[month] || 0 };
  },

  // Get all budgets
  getAllBudgets() {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_get_all_budgets'));
    }
    const budgets = getStoredBudgets();
    return Object.entries(budgets).map(([month, budget]) => ({ month, budget }));
  },

  // Categories
  getCategories() {
    return VALID_CATEGORIES;
  },

  // Goals
  addGoal(name, targetAmount, etaDays, createdDate, savedAmount = 0) {
    const goals = getStoredGoals();
    if (!name || !String(name).trim()) return { success: false, error: 'Goal name is required' };
    if (targetAmount <= 0) return { success: false, error: 'Target amount must be positive' };
    if (etaDays <= 0) return { success: false, error: 'ETA days must be positive' };
    if (savedAmount < 0) return { success: false, error: 'Saved amount cannot be negative' };
    if (savedAmount > targetAmount) return { success: false, error: 'Saved amount cannot be more than the goal amount' };

    const id = generateGoalId(goals);
    goals.push({
      id,
      name: String(name).trim(),
      targetAmount,
      savedAmount,
      etaDays,
      createdDate,
      updatedAt: createdDate
    });
    saveStoredGoals(goals);
    return { success: true, id };
  },

  getAllGoals() {
    return getStoredGoals();
  },

  updateGoal(id, updates = {}) {
    const goals = getStoredGoals();
    const idx = goals.findIndex(g => g.id === id);
    if (idx === -1) return { success: false, error: 'Goal not found' };

    const current = goals[idx];
    const next = {
      ...current,
      ...updates,
      name: updates.name !== undefined ? String(updates.name).trim() : current.name,
      updatedAt: updates.updatedAt || current.updatedAt
    };

    if (!next.name) return { success: false, error: 'Goal name is required' };
    if (Number(next.targetAmount) <= 0) return { success: false, error: 'Target amount must be positive' };
    if (Number(next.etaDays) <= 0) return { success: false, error: 'ETA days must be positive' };
    if (Number(next.savedAmount) < 0) return { success: false, error: 'Saved amount cannot be negative' };
    if (Number(next.savedAmount) > Number(next.targetAmount)) return { success: false, error: 'Saved amount cannot be more than the goal amount' };

    goals[idx] = next;
    saveStoredGoals(goals);
    return { success: true };
  },

  addGoalContribution(id, amount, updatedAt) {
    const goals = getStoredGoals();
    const idx = goals.findIndex(g => g.id === id);
    if (idx === -1) return { success: false, error: 'Goal not found' };
    if (amount <= 0) return { success: false, error: 'Amount must be positive' };
    if (Number(goals[idx].savedAmount || 0) >= Number(goals[idx].targetAmount || 0)) {
      return { success: false, error: 'Goal already achieved' };
    }

    const remaining = Number(goals[idx].targetAmount || 0) - Number(goals[idx].savedAmount || 0);
    if (amount > remaining) {
      return { success: false, error: `You can only add up to ${remaining.toFixed(2)} for this goal` };
    }

    goals[idx].savedAmount = Number(goals[idx].savedAmount || 0) + Number(amount);
    goals[idx].updatedAt = updatedAt || goals[idx].updatedAt;
    saveStoredGoals(goals);
    return { success: true };
  },

  deleteGoal(id) {
    const goals = getStoredGoals();
    const idx = goals.findIndex(g => g.id === id);
    if (idx === -1) return { success: false, error: 'Goal not found' };
    goals.splice(idx, 1);
    saveStoredGoals(goals);
    return { success: true };
  },

  // Dashboard stats
  getDashboardStats(month) {
    if (wasmReady && wasmModule) {
      return JSON.parse(wasmCall('_get_dashboard_stats', month));
    }
    const expenses = getStoredExpenses();
    const budgets = getStoredBudgets();
    const monthExpenses = expenses.filter(e => e.month === month);
    const monthTotal = monthExpenses.reduce((s,e) => s + e.amount, 0);
    const allTimeTotal = expenses.reduce((s,e) => s + e.amount, 0);
    const budget = budgets[month] || 0;
    const catMap = {};
    monthExpenses.forEach(e => catMap[e.category] = (catMap[e.category] || 0) + e.amount);
    let topCategory = '', topCategoryAmount = 0;
    Object.entries(catMap).forEach(([c,a]) => { if (a > topCategoryAmount) { topCategoryAmount = a; topCategory = c; } });
    return {
      monthTotal, monthCount: monthExpenses.length, allTimeTotal,
      totalExpenses: expenses.length, budget, remaining: budget - monthTotal,
      topCategory, topCategoryAmount
    };
  }
};

export { VALID_CATEGORIES };
