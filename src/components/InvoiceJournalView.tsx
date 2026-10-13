import React from 'react';
import { SavedInvoice } from '../types';
import { formatCurrency } from '../utils/cipherAndParser';
import { Printer, KeyRound } from 'lucide-react';

interface InvoiceJournalViewProps {
  savedInvoices: SavedInvoice[];
  onLoadInvoiceToPrint: (inv: SavedInvoice) => void;
  onInspectReturn: (inv: SavedInvoice) => void;
}

export const InvoiceJournalView: React.FC<InvoiceJournalViewProps> = ({
  savedInvoices,
  onLoadInvoiceToPrint,
  onInspectReturn,
}) => {
  const totalRetail = savedInvoices.reduce((acc, inv) => acc + inv.retailTotal, 0);
  const totalActualPaid = savedInvoices.reduce((acc, inv) => acc + inv.actualPaidTotal, 0);
  const totalContractorBonus = savedInvoices.reduce((acc, inv) => acc + inv.contractorMargin, 0);

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              Учёт выписанных документов · Внутренний реестр кассы (Google Лист #2)
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
              Журнал товарных накладных и скрытых скидок
            </h1>
          </div>
          <div className="text-xs text-slate-500">
            Всего документов за смену: <span className="font-mono font-bold text-slate-900">{savedInvoices.length}</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs text-slate-500">
              Сумма по напечатанным накладным (розница 100%)
            </div>
            <div className="text-2xl font-mono font-bold text-slate-900 mt-1 tabular-nums">
              {formatCurrency(totalRetail)} ₸
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Цифры на бумажных бланках для заказчиков ремонта
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs text-slate-500">
              Фактически принято в кассу магазина
            </div>
            <div className="text-2xl font-mono font-bold text-emerald-700 mt-1 tabular-nums">
              {formatCurrency(totalActualPaid)} ₸
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              За вычетом предоставленных скидок мастерам
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs text-slate-500">
              Сумма скрытых скидок (выгода сантехников / прорабов)
            </div>
            <div className="text-2xl font-mono font-bold text-amber-700 mt-1 tabular-nums">
              {formatCurrency(totalContractorBonus)} ₸
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Защищено от переплаты при возврате шифром в номере
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-3 px-4">№ накладной (с шифром)</th>
                <th className="py-3 px-4">Время / Менеджер</th>
                <th className="py-3 px-4">Внутренняя пометка</th>
                <th className="py-3 px-4 text-center">Позиций</th>
                <th className="py-3 px-4 text-right">В бланке (Розница)</th>
                <th className="py-3 px-4 text-center">Скрытая скидка</th>
                <th className="py-3 px-4 text-right">В кассу (Факт)</th>
                <th className="py-3 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {savedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                    <div>{inv.createdAt}</div>
                    <div className="text-[11px] text-slate-400">{inv.managerName}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    {inv.contractorNote || 'Розничный покупатель'}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-slate-600 tabular-nums">
                    {inv.items.length}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-900 tabular-nums whitespace-nowrap">
                    {formatCurrency(inv.retailTotal)} ₸
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-semibold text-amber-800 tabular-nums whitespace-nowrap">
                    {inv.discountPercent}% ({inv.discountMode === 'hidden_contractor' ? 'скрыта в №' : 'прямая'})
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                    {formatCurrency(inv.actualPaidTotal)} ₸
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onLoadInvoiceToPrint(inv)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200 transition-colors flex items-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Бланк
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectReturn(inv)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors flex items-center gap-1"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Возврат
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
