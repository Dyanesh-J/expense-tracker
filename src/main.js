import { tracker } from './wasm/bridge.js';
import { showDashboard } from './pages/dashboard.js';
import { showExpenses } from './pages/expenses.js';
import { showBudget } from './pages/budget.js';
import { showGoals } from './pages/goals.js';
import { showAnalytics } from './pages/analytics.js';
import { showReports } from './pages/reports.js';
import { showHistory } from './pages/history.js';
import { showSettings } from './pages/settings.js';
import { showToast } from './ui/toast.js';
import { gsap } from 'gsap';

const STORAGE_USERS_KEY = 'mmc_users';
const STORAGE_SESSION_KEY = 'mmc_current_user';
const STORAGE_SELECTED_DATE_KEY = 'mmc_selected_date';
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DEMO_USER = {
  name: 'Demo Presenter',
  username: 'demo',
  email: 'demo@moneycoach.app',
  password: 'demo123',
  createdAt: '2026-01-01T00:00:00.000Z'
};

let currentPage = 'dashboard';
let isTransitioning = false;
let currentUser = null;
let shellEventsBound = false;

const loader = document.getElementById('global-loader');
const app = document.getElementById('app');
const pageContainer = document.getElementById('page-container');
const transition = document.getElementById('page-transition');
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('sidebar-toggle');
const navItems = [...document.querySelectorAll('.nav-item')];
const wasmBadge = document.getElementById('wasm-badge');
const sidebarMonth = document.getElementById('sidebar-month');
const sidebarUser = document.getElementById('sidebar-user');
const sidebarUserName = document.getElementById('sidebar-user-name');
const sidebarUserEmail = document.getElementById('sidebar-user-email');
const logoutBtn = document.getElementById('logout-btn');

const pages = {
  dashboard: showDashboard,
  expenses: showExpenses,
  budget: showBudget,
  goals: showGoals,
  analytics: showAnalytics,
  reports: showReports,
  history: showHistory,
  settings: showSettings
};

function init() {
  ensureDefaultUser();
  bindShellEvents();

  currentUser = getStoredUsers().find((user) => normalizeValue(user.email) === normalizeValue(DEMO_USER.email)) || { ...DEMO_USER };
  saveStoredSession(currentUser);

  tracker.seedPresentationData(true);
  setSelectedDate(getPresentationDateString());
  updateSidebarMonth();
  updateSidebarUser();
  updateRuntimeBadge();

  loader?.classList.add('hidden');
  app?.classList.remove('hidden');

  routeFromHash(false);

  if (app) {
    gsap.from(app, {
      opacity: 0,
      duration: 0.45,
      ease: 'power2.out'
    });
  }
}

function bindShellEvents() {
  if (shellEventsBound) return;
  shellEventsBound = true;

  toggleBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('collapsed');
    gsap.from('#main-content', { x: 5, duration: 0.25, ease: 'power2.out' });
  });

  navItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      const page = item.dataset.page;
      if (page && page !== currentPage) {
        navigateTo(page);
      }
    });
  });

  logoutBtn?.addEventListener('click', () => {
    tracker.seedPresentationData(true);
    setSelectedDate(getPresentationDateString());
    showToast('Demo data refreshed for presentation.', 'success');
    navigateTo('dashboard', false);
  });

  window.addEventListener('hashchange', () => {
    routeFromHash(false);
  });
}

function routeFromHash(animate = false) {
  const hash = location.hash.replace('#', '').trim();
  const targetPage = hash in pages ? hash : 'dashboard';
  navigateTo(targetPage, animate);
}

export async function navigateTo(page, animate = true) {
  if (isTransitioning || !(page in pages) || !pageContainer) return;
  isTransitioning = true;

  app?.classList.remove('auth-mode');

  if (animate && transition) {
    await gsap.to(transition, {
      scaleX: 1,
      duration: 0.28,
      ease: 'power2.in',
      transformOrigin: 'left'
    });
  }

  navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  currentPage = page;
  if (location.hash !== `#${page}`) {
    location.hash = page;
  }

  pageContainer.innerHTML = '';

  try {
    await pages[page](pageContainer);
  } catch (error) {
    console.error('PAGE ERROR:', error);
    pageContainer.innerHTML = `
      <div style="color:white; padding:20px">
        <h2>Error loading page</h2>
        <pre>${escapeHtml(error.message)}</pre>
      </div>
    `;
  }

  if (animate && transition) {
    await gsap.to(transition, {
      scaleX: 0,
      duration: 0.32,
      ease: 'power2.out',
      transformOrigin: 'right'
    });
    gsap.set(transition, { scaleX: 0 });
  }

  pageContainer
    .querySelectorAll('.page-header, .stats-grid, .card, .settings-section')
    .forEach((element, index) => {
      gsap.from(element, {
        y: 20,
        opacity: 0,
        duration: 0.35,
        delay: index * 0.04,
        ease: 'power2.out'
      });
    });

  isTransitioning = false;
}

function updateSidebarMonth() {
  if (!sidebarMonth) return;
  const now = new Date();
  sidebarMonth.textContent = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()} demo story`;
}

function updateSidebarUser() {
  if (!currentUser || !sidebarUser || !sidebarUserName || !sidebarUserEmail) return;
  sidebarUser.classList.remove('hidden');
  sidebarUserName.textContent = currentUser.name || currentUser.username;
  sidebarUserEmail.textContent = currentUser.email;
  logoutBtn?.classList.remove('hidden');
  if (logoutBtn) {
    logoutBtn.textContent = 'Refresh Demo';
  }
}

function updateRuntimeBadge() {
  if (!wasmBadge) return;
  wasmBadge.classList.add('active');
  const label = wasmBadge.querySelector('.wasm-label');
  if (label) {
    label.textContent = 'Demo Ready';
  }
}

function ensureDefaultUser() {
  const users = getStoredUsers();
  const demoExists = users.some((user) => normalizeValue(user.email) === normalizeValue(DEMO_USER.email));
  if (demoExists) return;
  users.push({ ...DEMO_USER });
  saveStoredUsers(users);
}

function getPresentationDateString() {
  const now = new Date();
  return `10-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
}

function setSelectedDate(dateStr) {
  const parsed = parseDateString(dateStr) || parseDateString(getTodayDateString());
  const safeDate = `${parsed.dd}-${parsed.mm}-${parsed.yyyy}`;
  localStorage.setItem(STORAGE_SELECTED_DATE_KEY, safeDate);
  window.dispatchEvent(new CustomEvent('mmc:selected-date-change', { detail: { date: safeDate } }));
}

function getSelectedDate() {
  const stored = localStorage.getItem(STORAGE_SELECTED_DATE_KEY);
  const parsed = parseDateString(stored);
  return parsed ? `${parsed.dd}-${parsed.mm}-${parsed.yyyy}` : getPresentationDateString();
}

function getCurrentUser() {
  return currentUser;
}

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Could not read stored users:', error);
    return [];
  }
}

function saveStoredUsers(users) {
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
}

function saveStoredSession(user) {
  localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify({
    username: user.username,
    email: user.email
  }));
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function parseDateString(dateStr) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(dateStr || '').trim());
  if (!match) return null;

  const ddNumber = Number(match[1]);
  const mmNumber = Number(match[2]);
  const yyyy = Number(match[3]);
  const maxDay = getDaysInMonth(mmNumber, yyyy);

  if (mmNumber < 1 || mmNumber > 12 || ddNumber < 1 || ddNumber > maxDay) {
    return null;
  }

  return {
    dd: match[1],
    mm: match[2],
    yyyy,
    ddNumber,
    mmNumber
  };
}

function getDaysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function getTodayDateString() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function openModal(html) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  if (!overlay || !box) return;
  box.innerHTML = html;
  overlay.classList.remove('hidden');
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  }, { once: true });
}

export function closeModal() {
  document.getElementById('modal-overlay')?.classList.add('hidden');
}

window.closeModal = closeModal;
window.openModal = openModal;
window.navigateTo = navigateTo;
window.getSelectedDate = getSelectedDate;
window.setSelectedDate = setSelectedDate;
window.getCurrentUser = getCurrentUser;

init();
