#!/usr/bin/env node
// scripts/build-wasm.js
// Run: node scripts/build-wasm.js
// Requires: Emscripten SDK installed and activated

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const outDir = join(process.cwd(), 'public', 'wasm');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const cmd = [
  'em++',
  'cpp/main.cpp',
  '-o', 'public/wasm/tracker.js',
  '-s', 'WASM=1',
  '-s', 'EXPORTED_RUNTIME_METHODS=["ccall","cwrap","UTF8ToString","stringToUTF8","allocate","ALLOC_NORMAL"]',
  '-s', 'EXPORTED_FUNCTIONS=["_init_manager","_add_expense","_delete_expense","_edit_expense","_get_all_expenses","_get_expenses_by_category","_get_expenses_by_month","_get_monthly_total","_get_category_totals","_get_all_monthly_totals","_set_budget","_get_budget","_get_all_budgets","_get_categories","_get_dashboard_stats","_malloc","_free"]',
  '-s', 'ALLOW_MEMORY_GROWTH=1',
  '-s', 'MODULARIZE=1',
  '-s', 'EXPORT_NAME="TrackerModule"',
  '-s', 'ENVIRONMENT=web',
  '-s', 'NO_EXIT_RUNTIME=1',
  '-O2',
  '--no-entry'
].join(' ');

console.log('🔨 Building WASM...');
console.log(cmd);

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('✅ WASM build complete! Files in public/wasm/');
} catch (e) {
  console.error('❌ WASM build failed. Make sure Emscripten is installed and activated.');
  console.error('   Run: emsdk_env.bat (Windows) or source emsdk_env.sh (Mac/Linux)');
  process.exit(1);
}
