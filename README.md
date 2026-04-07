# 💰 Monthly Money Coach — DA2 Project

A premium Expense & Budget Tracker built with C++ (OOP + WASM) + Vanilla JS + GSAP + Chart.js

---

## 📁 Folder Structure

```
expense-tracker/
├── cpp/
│   └── main.cpp              ← C++ source (Expense + BudgetManager classes)
├── public/
│   └── wasm/                 ← WASM output goes here (after compile)
│       ├── tracker.js
│       └── tracker.wasm
├── scripts/
│   └── build-wasm.js         ← WASM build script
├── src/
│   ├── main.js               ← App entry, router, sidebar
│   ├── wasm/
│   │   └── bridge.js         ← WASM ↔ JS bridge + localStorage fallback
│   ├── pages/
│   │   ├── dashboard.js
│   │   ├── expenses.js
│   │   ├── budget.js
│   │   ├── analytics.js
│   │   ├── reports.js
│   │   └── settings.js
│   ├── ui/
│   │   ├── toast.js
│   │   └── expenseForm.js
│   ├── utils/
│   │   └── helpers.js
│   └── styles/
│       └── main.css
├── index.html
├── package.json
└── vite.config.js
```

---

## 🚀 Quick Start (Dev Mode — No WASM needed)

> Works immediately with localStorage. No Emscripten required for development.

### Step 1: Install Node.js
Download: https://nodejs.org (v18+)

### Step 2: Install dependencies
```bash
cd expense-tracker
npm install
```

### Step 3: Start dev server
```bash
npm run dev
```

Open: http://localhost:3000

That's it! The app runs fully in JS fallback mode.

---

## ⚡ Building WASM (Optional — for full C++ integration)

### Prerequisites

#### Install Git
https://git-scm.com/downloads

#### Install Python
https://www.python.org/downloads/
✔ Check "Add Python to PATH" during install

#### Install Emscripten
```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
emsdk install latest
emsdk activate latest
emsdk_env.bat          # Windows
# OR
source ./emsdk_env.sh  # Mac/Linux
```

Verify:
```bash
em++ -v
```

### Build WASM
Go back to project folder:
```bash
cd expense-tracker
node scripts/build-wasm.js
```

This creates `public/wasm/tracker.js` and `public/wasm/tracker.wasm`

### Run with WASM
```bash
npm run dev
```

The sidebar will show **"WASM Active"** in green when WASM is loaded.

---

## 🌐 GitHub Pages Deployment

### Step 1: Build the project
```bash
npm run build
```
Output goes to `dist/` folder.

### Step 2: Create GitHub repo
Name: `monthly-money-coach-<RegNo>`
Set to Public.

### Step 3: Upload dist/ contents
Upload everything inside `dist/` to the repo root.
Also upload `main.cpp` for documentation.

### Step 4: Enable GitHub Pages
Settings → Pages → Branch: main → Folder: root → Save

### Step 5: Access your site
`https://username.github.io/repo-name/`

---

## 🎮 Pages

| Page | Features |
|------|---------|
| Dashboard | Stats, budget health, donut chart, trend chart, recent expenses |
| Expenses | Add/Edit/Delete, search, filter by category, sort, export CSV |
| Budget | Set monthly budget, progress bars, category breakdown, all-months overview |
| Analytics | Bar chart, polar chart, daily chart, trend chart, insight cards |
| Reports | All-time summary, monthly breakdown, category report, full transaction list |
| Settings | Name, currency, import samples, export all, clear data, WASM status |

---

## 💡 C++ OOP Concepts Used

- **class Expense** — private data members (id, date, category, amount, note, month), public getters/setters, constructor, static validation methods, CSV/JSON serialization
- **class BudgetManager** — manages `vector<Expense>`, `map<string,double>` budgets, file handling with `fstream`, CRUD operations, reports generation
- **Encapsulation** — private members, public interface only
- **STL** — `vector`, `map`, `string`, `algorithm` (find_if, sort), `sstream`, `fstream`
- **File handling** — CSV-based persistence (expenses.csv, budgets.csv)
- **Constructors** — parameterized constructors for Expense, BudgetManager
- **Static members** — VALID_CATEGORIES list, isValidCategory method

---

## 🎨 Frontend Stack

- **Vite** — build tool / dev server
- **GSAP 3** — page transitions, animations, counters
- **Chart.js 4** — donut, bar, line, polar charts
- **Vanilla JS** — no framework, pure ESM modules
- **CSS Variables** — consistent theming

Theme: Dark (#080b0f) + Neon Green (#00ff87) + Coral Orange (#ff6b35) + Hot Pink (#ff3d9a)
Fonts: Syne (display) + Space Mono (mono) + DM Sans (body)

---

## 📧 Submission Details

Subject: `SOOPDA2 – <RegNo> – <Name>`
To: dinakaran.m@vit.ac.in
Attach: PDF documentation (see template)
