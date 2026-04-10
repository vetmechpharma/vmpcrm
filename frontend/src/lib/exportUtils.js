/**
 * Client-side CSV export and Print utilities.
 * No server storage - generates and downloads directly in browser.
 */

export function exportToCSV(headers, rows, filename = 'export.csv') {
  const escape = (val) => {
    const str = val == null ? '' : String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const csvContent = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function printTable(title, headers, rows, subtitle = '') {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  const html = `<!DOCTYPE html><html><head><title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 11px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
  th { background: #f0f0f0; font-weight: 600; font-size: 10px; }
  td { font-size: 10px; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .print-date { text-align: right; font-size: 9px; color: #999; margin-bottom: 8px; }
  @media print { body { padding: 10px; } }
</style></head><body>
<div class="print-date">Printed: ${new Date().toLocaleString()}</div>
<h1>${title}</h1>
${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
<table>
  <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
</table>
</body></html>`;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export function getDatePreset(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const fmt = (dt) => dt.toISOString().split('T')[0];

  switch (preset) {
    case 'week': {
      const start = new Date(y, m, d - now.getDay());
      return { from: fmt(start), to: fmt(now) };
    }
    case 'month':
      return { from: fmt(new Date(y, m, 1)), to: fmt(now) };
    case 'year':
      return { from: fmt(new Date(y, 0, 1)), to: fmt(now) };
    case 'last_month': {
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case 'last_year':
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default:
      return { from: '', to: '' };
  }
}
