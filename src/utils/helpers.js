// src/utils/helpers.js

export function formatCurrency(amount, symbol = '₹') {
  return symbol + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function getCurrentMonth() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${mm}-${yyyy}`;
}

export function getCurrentDate() {
  const now = new Date();
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function parseDate(dateStr) {
  const [dd, mm, yyyy] = String(dateStr || '').split('-').map(Number);
  if (!dd || !mm || !yyyy) {
    return null;
  }

  const date = new Date(yyyy, mm - 1, dd);
  if (
    date.getFullYear() !== yyyy
    || date.getMonth() !== mm - 1
    || date.getDate() !== dd
  ) {
    return null;
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return {
    day: dd,
    month: mm,
    year: yyyy,
    date,
    monthKey: `${String(mm).padStart(2, '0')}-${yyyy}`,
    iso: `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
    label: `${String(dd).padStart(2, '0')} ${months[mm - 1]} ${yyyy}`
  };
}

export function parseMonth(monthStr) {
  // MM-YYYY → { month: num, year: num, label: 'Jan 2024' }
  const [mm, yyyy] = monthStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return {
    month: parseInt(mm),
    year:  parseInt(yyyy),
    label: `${months[parseInt(mm) - 1]} ${yyyy}`
  };
}

export function prevMonth(monthStr) {
  const [mm, yyyy] = monthStr.split('-').map(Number);
  const d = new Date(yyyy, mm - 2, 1);
  return `${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

export function nextMonth(monthStr) {
  const [mm, yyyy] = monthStr.split('-').map(Number);
  const d = new Date(yyyy, mm, 1);
  return `${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

export function sortExpensesDesc(expenses) {
  return [...expenses].sort((a, b) => {
    // Compare DD-MM-YYYY
    const toDate = s => {
      const [d,m,y] = s.split('-');
      return new Date(+y, +m-1, +d);
    };
    return toDate(b.date) - toDate(a.date);
  });
}

export const CAT_ICONS = {
  Food:          '🍔',
  Transport:     '🚌',
  Shopping:      '🛍️',
  Entertainment: '🎮',
  Health:        '💊',
  Bills:         '📄',
  Education:     '📚',
  Travel:        '✈️',
  Other:         '📦'
};

export const CAT_COLORS = {
  Food:          '#ff6b35',
  Transport:     '#00c3ff',
  Shopping:      '#ff3d9a',
  Entertainment: '#9333ea',
  Health:        '#00ff87',
  Bills:         '#ffd93d',
  Education:     '#63b3ed',
  Travel:        '#48bb78',
  Other:         '#a0aec0'
};

export function animateCounter(el, target, duration = 800, prefix = '₹') {
  const start = 0;
  const startTime = performance.now();
  function update(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * ease;
    el.textContent = prefix + current.toLocaleString('en-IN', {
      minimumFractionDigits: 0, maximumFractionDigits: 0
    });
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = prefix + target.toLocaleString('en-IN', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }
  requestAnimationFrame(update);
}

export function renderCatPill(category) {
  return `<span class="cat-pill cat-${category}">${CAT_ICONS[category] || ''} ${category}</span>`;
}

export function exportToCSV(expenses, filename = 'expenses.csv') {
  const header = 'ID,Date,Category,Amount,Note\n';
  const rows = expenses.map(e =>
    `${e.id},${e.date},${e.category},${e.amount},"${e.note}"`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON(data, filename = 'expenses.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportExpensesToPDF(expenses, filename = 'expenses-report.pdf', title = 'Expense Report') {
  const lines = [
    title,
    '',
    ...expenses.map((expense) => {
      const note = (expense.note || '-').replace(/\s+/g, ' ').trim();
      return `${expense.date} | ${expense.category} | ${formatCurrency(expense.amount)} | ${note}`;
    })
  ];

  let y = 780;
  const content = [];

  lines.forEach((line, index) => {
    const safeLine = String(line)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

    if (index === 0) {
      content.push(`BT /F1 18 Tf 50 ${y} Td (${safeLine}) Tj ET`);
      y -= 28;
      return;
    }

    if (y < 60) {
      return;
    }

    content.push(`BT /F1 10 Tf 50 ${y} Td (${safeLine}) Tj ET`);
    y -= 16;
  });

  const stream = content.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  });

  const xrefPosition = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
