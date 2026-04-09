import { initWASM } from './wasm/bridge.js';
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
const AUTH_HASHES = new Set(['signin', 'register']);
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
const sidebarCalendarMonth = document.getElementById('sidebar-calendar-month');
const sidebarCalendarYear = document.getElementById('sidebar-calendar-year');
const sidebarCalendarDay = document.getElementById('sidebar-calendar-day');

const pages = {
  dashboard: showDashboard,
  expenses: showExpenses,
  budget: showBudget,
  goals: showGoals,
  analytics: showAnalytics,
  reports: showReports,
  history: showHistory,
  settings: showSettings,
};

async function init() {
  const statusEl = loader?.querySelector('.loader-status');
  const messages = [
    'Initializing engine...',
    'Loading C++ core...',
    'Connecting modules...',
    'Ready to launch!'
  ];

  let messageIndex = 0;
  const messageInterval = setInterval(() => {
    messageIndex += 1;
    if (statusEl && messageIndex < messages.length) {
      statusEl.textContent = messages[messageIndex];
    } else {
      clearInterval(messageInterval);
    }
  }, 500);

  const wasmLoaded = await initWASM();
  clearInterval(messageInterval);

  if (wasmLoaded) {
    wasmBadge.classList.add('active');
    wasmBadge.querySelector('.wasm-label').textContent = 'WASM Active';
  }

  updateSidebarMonth();
  initializeSidebarCalendar();
  bindShellEvents();

  currentUser = getStoredSession();
  ensurePresentationData();
  updateSidebarUser();

  setTimeout(() => {
    loader?.classList.add('hidden');
    app.classList.remove('hidden');
    gsap.from(app, { opacity: 0, duration: 0.6, ease: 'power2.out' });
    routeFromHash(false);
  }, 200);
}

function bindShellEvents() {
  if (shellEventsBound) return;
  shellEventsBound = true;

  toggleBtn?.addEventListener('click', () => {
    if (app.classList.contains('auth-mode')) return;
    sidebar.classList.toggle('collapsed');
    gsap.from('#main-content', { x: 5, duration: 0.3, ease: 'power2.out' });
  });

  navItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();

      if (!currentUser) {
        renderAuthPage('signin');
        return;
      }

      const page = item.dataset.page;
      if (page && page !== currentPage) {
        navigateTo(page);
      }
    });
  });

  logoutBtn?.addEventListener('click', () => {
    signOut();
  });

  sidebarCalendarMonth?.addEventListener('change', handleSidebarDateInput);
  sidebarCalendarYear?.addEventListener('change', handleSidebarDateInput);
  sidebarCalendarDay?.addEventListener('change', handleSidebarDateInput);
  sidebarCalendarDay?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSidebarDateInput();
    }
  });

  window.addEventListener('hashchange', () => {
    routeFromHash(false);
  });
}

function routeFromHash(animate = false) {
  const hash = location.hash.replace('#', '').trim();

  if (!currentUser) {
    renderAuthPage(hash === 'register' ? 'register' : 'signin');
    return;
  }

  if (AUTH_HASHES.has(hash)) {
    navigateTo('dashboard', animate);
    return;
  }

  const targetPage = hash in pages ? hash : 'dashboard';
  navigateTo(targetPage, animate);
}

export async function navigateTo(page, animate = true) {
  if (!currentUser || isTransitioning || !(page in pages)) return;
  isTransitioning = true;

  app.classList.remove('auth-mode');

  if (animate) {
    await gsap.to(transition, {
      scaleX: 1,
      duration: 0.3,
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

  if (animate) {
    await gsap.to(transition, {
      scaleX: 0,
      duration: 0.35,
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
        duration: 0.4,
        delay: index * 0.05,
        ease: 'power2.out'
      });
    });

  isTransitioning = false;
}

function renderAuthPage(mode = 'signin', status = null) {
  app.classList.add('auth-mode');
  currentPage = '';
  isTransitioning = false;
  navItems.forEach((item) => item.classList.remove('active'));

  const normalizedMode = mode === 'register' ? 'register' : 'signin';
  if (location.hash !== `#${normalizedMode}`) {
    history.replaceState(null, '', `#${normalizedMode}`);
  }

  pageContainer.innerHTML = buildAuthMarkup(normalizedMode, status);

  pageContainer.querySelectorAll('[data-auth-switch="signin"]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      renderAuthPage('signin');
    });
  });

  pageContainer.querySelectorAll('[data-auth-switch="register"]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      renderAuthPage('register');
    });
  });

  pageContainer.querySelector('#signin-form')?.addEventListener('submit', handleSignInSubmit);
  pageContainer.querySelector('#register-form')?.addEventListener('submit', handleRegisterSubmit);

  gsap.from('.auth-card', {
    y: 24,
    opacity: 0,
    duration: 0.45,
    ease: 'power2.out'
  });
}

function buildAuthMarkup(mode, status) {
  const statusMarkup = buildAuthStatusMarkup(status);

  if (mode === 'register' && status?.type === 'success') {
    return `
      <section class="auth-shell">
        <div class="auth-card">
          <div class="auth-brand">Money Coach</div>
          <h1 class="auth-title grad-text">Registration complete</h1>
          <p class="auth-subtitle">Your account is saved on this device. Use the button below to go back and sign in.</p>
          ${statusMarkup}
          <div class="auth-actions">
            <button class="btn btn-primary" type="button" data-auth-switch="signin">Back To Sign In</button>
          </div>
        </div>
      </section>
    `;
  }

  if (mode === 'register') {
    return `
      <section class="auth-shell">
        <div class="auth-card">
          <div class="auth-brand">Money Coach</div>
          <h1 class="auth-title grad-text">Create your account</h1>
          <p class="auth-subtitle">Register once on this device, then sign in with your username, email, and password.</p>
          ${statusMarkup}
          <form class="auth-form" id="register-form">
            <div class="form-group">
              <label class="form-label" for="register-name">Full Name</label>
              <input class="form-control" id="register-name" name="name" placeholder="Enter your name" required />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="register-username">Username</label>
                <input class="form-control" id="register-username" name="username" placeholder="Choose a username" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="register-email">Email Id</label>
                <input class="form-control" id="register-email" name="email" type="email" placeholder="name@example.com" required />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="register-password">Password</label>
              <input class="form-control" id="register-password" name="password" type="password" placeholder="Minimum 6 characters" required />
            </div>
            <div class="auth-actions">
              <button class="btn btn-primary" type="submit">Register</button>
              <button class="btn btn-secondary" type="button" data-auth-switch="signin">Back To Sign In</button>
            </div>
          </form>
          <div class="auth-footer">
            Already registered?
            <button class="auth-switch" type="button" data-auth-switch="signin">Sign In</button>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="auth-shell">
      <div class="auth-card">
        <div class="auth-brand">Money Coach</div>
        <h1 class="auth-title grad-text">Sign in first</h1>
        <p class="auth-subtitle">Use the username, email id, and password you registered on this device with.</p>
        ${statusMarkup}
        <form class="auth-form" id="signin-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="signin-username">Username</label>
              <input class="form-control" id="signin-username" name="username" placeholder="Your username" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="signin-email">Email Id</label>
              <input class="form-control" id="signin-email" name="email" type="email" placeholder="name@example.com" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="signin-password">Password</label>
            <input class="form-control" id="signin-password" name="password" type="password" placeholder="Enter your password" required />
          </div>
          <div class="auth-actions">
            <button class="btn btn-primary" type="submit">Sign In</button>
          </div>
        </form>
        <div class="auth-footer">
          New user?
          <button class="auth-switch" type="button" data-auth-switch="register">Register</button>
          <div class="auth-help">Accounts are stored in local storage in this browser, which is fine for a demo but not for real production security.</div>
        </div>
      </div>
    </section>
  `;
}

function buildAuthStatusMarkup(status) {
  if (!status?.message) return '';
  const title = status.title ? `<strong>${escapeHtml(status.title)}</strong><br />` : '';
  return `
    <div class="auth-status ${status.type || 'error'}">
      ${title}${escapeHtml(status.message)}
    </div>
  `;
}

function handleRegisterSubmit(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const name = String(formData.get('name') || '').trim();
  const username = String(formData.get('username') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!name || !username || !email || !password) {
    renderAuthPage('register', {
      type: 'error',
      title: 'Missing details.',
      message: 'Please fill in name, username, email id, and password.'
    });
    return;
  }

  if (!isValidEmail(email)) {
    renderAuthPage('register', {
      type: 'error',
      title: 'Email looks invalid.',
      message: 'Enter a valid email id before registering.'
    });
    return;
  }

  if (password.length < 6) {
    renderAuthPage('register', {
      type: 'error',
      title: 'Password too short.',
      message: 'Use at least 6 characters for the password.'
    });
    return;
  }

  const users = getStoredUsers();
  const normalizedUsername = normalizeValue(username);
  const normalizedEmail = normalizeValue(email);

  const usernameTaken = users.some((user) => normalizeValue(user.username) === normalizedUsername);
  if (usernameTaken) {
    renderAuthPage('register', {
      type: 'error',
      title: 'Username already exists.',
      message: 'Pick a different username and try again.'
    });
    return;
  }

  const emailTaken = users.some((user) => normalizeValue(user.email) === normalizedEmail);
  if (emailTaken) {
    renderAuthPage('register', {
      type: 'error',
      title: 'Email already registered.',
      message: 'Sign in with that email id or use a different one.'
    });
    return;
  }

  users.push({
    name,
    username,
    email,
    password,
    createdAt: new Date().toISOString()
  });

  saveStoredUsers(users);
  showToast('Successfully registered. Please sign in.', 'success');

  renderAuthPage('register', {
    type: 'success',
    title: 'Successfully registered.',
    message: `${name}, your account has been created.`
  });
}

function handleSignInSubmit(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const username = String(formData.get('username') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!username || !email || !password) {
    renderAuthPage('signin', {
      type: 'error',
      title: 'Missing sign-in details.',
      message: 'Enter username, email id, and password to continue.'
    });
    return;
  }

  const user = getStoredUsers().find((entry) => {
    const usernameMatches = normalizeValue(entry.username) === normalizeValue(username);
    const emailMatches = normalizeValue(entry.email) === normalizeValue(email);
    return emailMatches && usernameMatches && entry.password === password;
  });

  const fallbackUser = user || getStoredUsers().find((entry) => {
    return normalizeValue(entry.email) === normalizeValue(email)
      && entry.password === password;
  });

  if (!fallbackUser) {
    renderAuthPage('signin', {
      type: 'error',
      title: 'Sign-in failed.',
      message: 'We could not match that username, email id, and password.'
    });
    return;
  }

  currentUser = fallbackUser;
  saveStoredSession(fallbackUser);
  ensurePresentationData();
  updateSidebarUser();
  showToast(`Welcome back, ${fallbackUser.name}!`, 'success');
  navigateTo('dashboard', false);
}

function signOut() {
  clearStoredSession();
  currentUser = null;
  updateSidebarUser();
  showToast('Signed out successfully.', 'info');
  renderAuthPage('signin', {
    type: 'success',
    title: 'You are signed out.',
    message: 'Sign in again whenever you want to continue.'
  });
}

function updateSidebarMonth() {
  const now = new Date();
  sidebarMonth.textContent = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
}

function updateSidebarUser() {
  if (!currentUser) {
    sidebarUser?.classList.add('hidden');
    sidebarUserName.textContent = '';
    sidebarUserEmail.textContent = '';
    return;
  }

  sidebarUser?.classList.remove('hidden');
  sidebarUserName.textContent = currentUser.name || currentUser.username;
  sidebarUserEmail.textContent = currentUser.email;
}

function ensurePresentationData() {
  if (!currentUser) return;
  const result = tracker.seedPresentationData(false);
  if (result?.seeded) {
    showToast('Presentation data loaded automatically.', 'info');
  }
}

function initializeSidebarCalendar() {
  if (!sidebarCalendarMonth || !sidebarCalendarYear || !sidebarCalendarDay) return;

  if (!sidebarCalendarMonth.options.length) {
    sidebarCalendarMonth.innerHTML = MONTH_NAMES.map((name, index) => {
      return `<option value="${String(index + 1).padStart(2, '0')}">${name}</option>`;
    }).join('');
  }

  if (!sidebarCalendarYear.options.length) {
    const baseYear = new Date().getFullYear();
    const years = [];
    for (let year = baseYear - 5; year <= baseYear + 5; year += 1) {
      years.push(`<option value="${year}">${year}</option>`);
    }
    sidebarCalendarYear.innerHTML = years.join('');
  }

  syncSidebarCalendar(getSelectedDate());
}

function handleSidebarDateInput() {
  const month = sidebarCalendarMonth.value;
  const year = sidebarCalendarYear.value;
  const maxDay = getDaysInMonth(Number(month), Number(year));
  const day = Math.max(1, Math.min(maxDay, Number(sidebarCalendarDay.value) || 1));
  const nextDate = `${String(day).padStart(2, '0')}-${month}-${year}`;
  setSelectedDate(nextDate);
}

function syncSidebarCalendar(dateStr) {
  const parsed = parseDateString(dateStr);
  if (!parsed || !sidebarCalendarMonth || !sidebarCalendarYear || !sidebarCalendarDay) return;

  sidebarCalendarMonth.value = parsed.mm;
  sidebarCalendarYear.value = String(parsed.yyyy);
  sidebarCalendarDay.max = String(getDaysInMonth(parsed.mmNumber, parsed.yyyy));
  sidebarCalendarDay.value = String(parsed.ddNumber);
}

function setSelectedDate(dateStr) {
  const parsed = parseDateString(dateStr) || parseDateString(getTodayDateString());
  const safeDate = `${parsed.dd}-${parsed.mm}-${parsed.yyyy}`;
  localStorage.setItem(STORAGE_SELECTED_DATE_KEY, safeDate);
  syncSidebarCalendar(safeDate);
  window.dispatchEvent(new CustomEvent('mmc:selected-date-change', { detail: { date: safeDate } }));
}

function getSelectedDate() {
  const stored = localStorage.getItem(STORAGE_SELECTED_DATE_KEY);
  const parsed = parseDateString(stored);
  return parsed ? `${parsed.dd}-${parsed.mm}-${parsed.yyyy}` : getTodayDateString();
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

function clearStoredSession() {
  localStorage.removeItem(STORAGE_SESSION_KEY);
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw);
    if (!session?.username || !session?.email) return null;

    return getStoredUsers().find((user) => {
      return normalizeValue(user.username) === normalizeValue(session.username)
        && normalizeValue(user.email) === normalizeValue(session.email);
    }) || null;
  } catch (error) {
    console.error('Could not read saved session:', error);
    return null;
  }
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
  box.innerHTML = html;
  overlay.classList.remove('hidden');
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  }, { once: true });
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

window.closeModal = closeModal;
window.openModal = openModal;
window.navigateTo = navigateTo;
window.getSelectedDate = getSelectedDate;
window.setSelectedDate = setSelectedDate;
window.getCurrentUser = getCurrentUser;

init();
