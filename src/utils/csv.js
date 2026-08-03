/**
 * Utilitário de exportação CSV leve, zero dependências.
 * Uso: exportCSV('clientes-2026', [['Nome','Telefone'], ['Ana','11 9999...']]);
 */

function escapeCsvCell(val) {
  if (val == null) return '';
  const str = typeof val === 'string' ? val : String(val);
  const needsQuotes = /[",;\n\r\t]/.test(str);
  if (!needsQuotes) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function dateStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * @param {string} fileNamePrefix    ex: 'clientes'
 * @param {Array<Array<string|number|null>>} rows   matriz: [headers, ...dataRows]
 * @param {'\n'|'\r\n'} [lineSep]
 */
export function exportCsv(fileNamePrefix, rows, lineSep = '\r\n') {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('[exportCsv] Sem linhas para exportar.');
    return;
  }
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const csv = rows.map(row => (Array.isArray(row) ? row.map(escapeCsvCell).join(',') : '')).join(lineSep) + lineSep;
  // BOM para Excel PT-BR reconhecer UTF-8 corretamente
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const stamp = dateStamp();
  const safe = String(fileNamePrefix || 'exportacao').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safe}-${stamp}.csv`;

  try {
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', filename);
    a.style.position = 'absolute';
    a.style.left = '-9999px';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  } catch (e) {
    console.error('[exportCsv] Erro ao acionar download:', e);
    window.open(url, '_blank');
  }
}

export default exportCsv;
