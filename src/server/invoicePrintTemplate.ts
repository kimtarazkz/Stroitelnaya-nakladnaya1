import { formatCurrency } from '../utils/cipherAndParser';

export interface PrintableInvoiceData {
  invoiceNumber: string;
  date: string;
  managerName: string;
  customerName?: string;
  items: Array<{
    name: string;
    unit: string;
    quantity: number;
    price: number;
  }>;
  totalSum: number;
}

export function renderKazakhstanInvoiceHtml(data: PrintableInvoiceData): string {
  const itemsRows = data.items
    .map(
      (it, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${escapeHtml(it.name)}</td>
        <td style="text-align: center;">${escapeHtml(it.unit)}</td>
        <td style="text-align: right; font-weight: 600;">${it.quantity}</td>
        <td style="text-align: right;">${formatCurrency(it.price)} ₸</td>
        <td style="text-align: right; font-weight: 700;">${formatCurrency(it.quantity * it.price)} ₸</td>
      </tr>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Товарная накладная № ${escapeHtml(data.invoiceNumber)} — СтройКомплект</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #111827;
      background: #f3f4f6;
      padding: 24px;
      line-height: 1.4;
    }
    .invoice-card {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      padding: 36px 44px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border-radius: 8px;
    }
    .toolbar {
      max-width: 860px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-print {
      background: #0f172a;
      color: #ffffff;
      border: none;
      padding: 10px 22px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-print:hover {
      background: #334155;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .store-title {
      font-size: 18px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .store-sub {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .doc-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 14px;
    }
    .doc-num {
      font-family: monospace;
      color: #0284c7;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 16px 0;
      font-size: 13px;
    }
    .meta-row {
      display: flex;
      gap: 6px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 500;
    }
    .meta-value {
      color: #0f172a;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 12.5px;
    }
    th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }
    td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
    }
    .total-row td {
      background: #f8fafc;
      font-size: 14px;
      font-weight: 800;
      border-top: 2px solid #0f172a;
    }
    .in-words {
      font-size: 12.5px;
      color: #334155;
      margin: 16px 0;
      padding: 10px 14px;
      background: #f8fafc;
      border-radius: 4px;
      border-left: 3px solid #0f172a;
    }
    .signatures {
      margin-top: 36px;
      padding-top: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      font-size: 13px;
    }
    .sig-block {
      display: flex;
      flex-direction: column;
    }
    .sig-title {
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 24px;
    }
    .sig-line {
      border-bottom: 1px solid #64748b;
      display: flex;
      justify-content: flex-end;
      padding-bottom: 4px;
    }
    .sig-note {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 4px;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .toolbar {
        display: none !important;
      }
      .invoice-card {
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div style="font-size: 13px; color: #64748b;">
      📄 Печатная форма товарной накладной (Республика Казахстан)
    </div>
    <button class="btn-print" onclick="window.print()">
      🖨 Распечатать накладную (Ctrl+P)
    </button>
  </div>

  <div class="invoice-card">
    <div class="header">
      <div class="store-title">Строительный магазин «СтройКомплект»</div>
      <div class="store-sub">Склад материалов и сантехники · Казахстан · Валюта: тенге (₸)</div>
      <div class="doc-title">
        ТОВАРНАЯ НАКЛАДНАЯ № <span class="doc-num">${escapeHtml(data.invoiceNumber)}</span>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-row">
        <span class="meta-label">Дата составления:</span>
        <span class="meta-value">${escapeHtml(data.date)}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Отправил (склад):</span>
        <span class="meta-value">Склад №1 «СтройКомплект»</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Менеджер отпуска:</span>
        <span class="meta-value">${escapeHtml(data.managerName)}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Получатель (клиент):</span>
        <span class="meta-value">${escapeHtml(data.customerName || 'Розничный покупатель / Прораб')}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 36px; text-align: center;">№</th>
          <th>Наименование товара</th>
          <th style="width: 48px; text-align: center;">Ед.</th>
          <th style="width: 64px; text-align: right;">Кол-во</th>
          <th style="width: 90px; text-align: right;">Цена, ₸</th>
          <th style="width: 110px; text-align: right;">Сумма, ₸</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="5" style="text-align: right; text-transform: uppercase;">Итого к оплате:</td>
          <td style="text-align: right;">${formatCurrency(data.totalSum)} ₸</td>
        </tr>
      </tfoot>
    </table>

    <div class="in-words">
      Всего отпущено <strong>${data.items.length}</strong> позиций на общую сумму <strong>${formatCurrency(
    data.totalSum
  )} тенге 00 тиын</strong>.
    </div>

    <div class="signatures">
      <div class="sig-block">
        <div class="sig-title">Отпустил (Менеджер склада):</div>
        <div class="sig-line">
          <span style="font-size: 12px; color: #475569;">/ ${escapeHtml(data.managerName)} /</span>
        </div>
        <div class="sig-note">подпись ответственного лица (М.П.)</div>
      </div>

      <div class="sig-block">
        <div class="sig-title">Получил (Покупатель):</div>
        <div class="sig-line">
          <span style="font-size: 12px; color: #475569;">/ Покупатель /</span>
        </div>
        <div class="sig-note">претензий по количеству и качеству не имею</div>
      </div>
    </div>
  </div>

  <script>
    // Автоматический вызов диалога печати при загрузке страницы, если передано ?autoPrint=1
    if (new URLSearchParams(window.location.search).get('autoPrint') === '1') {
      setTimeout(() => {
        window.print();
      }, 300);
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
