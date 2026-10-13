import React, { useState, useEffect } from 'react';
import { SavedInvoice } from '../types';
import {
  decodeInvoiceNumber,
  formatCurrency,
  TABLE_SUBSTITUTION_ENCODE,
} from '../utils/cipherAndParser';
import {
  ShieldAlert,
  KeyRound,
  Calculator,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

interface ReturnCipherDecoderProps {
  savedInvoices: SavedInvoice[];
}

export const ReturnCipherDecoder: React.FC<ReturnCipherDecoderProps> = ({
  savedInvoices,
}) => {
  const [inputNumber, setInputNumber] = useState<string>(
    savedInvoices[0]?.invoiceNumber || 'РН-0418-78-34'
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    savedInvoices[0]?.id || ''
  );
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [manualRetailReturnSum, setManualRetailReturnSum] = useState<string>('1260');

  const activeInvoice = savedInvoices.find(
    (inv) =>
      inv.id === selectedInvoiceId ||
      inv.invoiceNumber.toUpperCase() === inputNumber.trim().toUpperCase()
  );

  useEffect(() => {
    if (activeInvoice) {
      const initialMap: Record<string, number> = {};
      activeInvoice.items.forEach((item, idx) => {
        initialMap[item.id] = idx === 0 ? Math.min(2, item.quantity) : idx === 1 ? Math.min(3, item.quantity) : 0;
      });
      setReturnQuantities(initialMap);
    }
  }, [activeInvoice?.id]);

  const decoded = decodeInvoiceNumber(inputNumber);

  const paperReturnSum = activeInvoice
    ? activeInvoice.items.reduce((acc, item) => {
        const retQty = returnQuantities[item.id] || 0;
        return acc + retQty * item.retailPrice;
      }, 0)
    : Number(manualRetailReturnSum) || 0;

  const actualRefundSum = Math.round(
    paperReturnSum * (1 - decoded.discountPercent / 100)
  );
  const storeSavedLoss = paperReturnSum - actualRefundSum;

  const handleSelectInvoice = (inv: SavedInvoice) => {
    setSelectedInvoiceId(inv.id);
    setInputNumber(inv.invoiceNumber);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
        <div className="max-w-3xl">
          <div className="text-xs font-medium text-slate-500 mb-1">
            Защита кассы при возврате товара · Расшифровка скрытого кода скидки
          </div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
            Проверка номера накладной и пересчёт возврата
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
            Когда сантехник или его клиент приносит излишки труб/фитингов обратно в магазин, в бумажной накладной указаны <strong>полные розничные цены</strong>. Введите номер с бланка ниже — система выделит зашитую между тире цифру и покажет, сколько денег реально нужно вернуть из кассы.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between p-5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Введите номер с бумажной накладной клиента:
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={inputNumber}
                      onChange={(e) => {
                        setInputNumber(e.target.value);
                        setSelectedInvoiceId('');
                      }}
                      placeholder="РН-0418-78-34"
                      className="w-full pl-10 pr-4 py-2.5 text-base font-mono font-bold tracking-wider uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">
                  Или выберите одну из недавно выписанных накладных:
                </div>
                <div className="flex flex-wrap gap-2">
                  {savedInvoices.map((inv) => (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => handleSelectInvoice(inv)}
                      className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                        inputNumber.trim().toUpperCase() === inv.invoiceNumber
                          ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {inv.invoiceNumber} ({inv.discountPercent}%)
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200">
              <div className="text-xs font-semibold text-slate-700 mb-2">
                Шпаргалка для кассира (2-я цифра в среднем блоке между тире):
              </div>
              <div className="grid grid-cols-5 gap-2 text-center font-mono text-xs">
                {([0, 5, 10, 15, 20] as const).map((pct) => {
                  const codeDigit = TABLE_SUBSTITUTION_ENCODE[pct];
                  const isCurrent = decoded.isValid && decoded.discountPercent === pct;
                  return (
                    <div
                      key={pct}
                      className={`p-2 rounded-lg border ${
                        isCurrent
                          ? 'bg-amber-50 border-amber-400 text-slate-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="text-[11px] text-slate-500">Скидка {pct}%</div>
                      <div className="text-sm font-bold mt-0.5">Цифра «{codeDigit}»</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 p-6 bg-slate-900 text-white rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-3">
                <span>РЕЗУЛЬТАТ ДЕШИФРОВКИ НОМЕРА</span>
                <span>{decoded.isValid ? 'КОД ПОДТВЕРЖДЁН' : 'ОЖИДАНИЕ ВВОДА'}</span>
              </div>

              {decoded.isValid ? (
                <>
                  <div className="p-4 bg-slate-800/90 border border-slate-700 rounded-lg">
                    <div className="text-xs text-slate-400 mb-1.5">
                      Структура номера документа:
                    </div>
                    <div className="flex flex-wrap items-baseline gap-1 font-mono text-2xl font-bold tracking-wider">
                      <span>{decoded.rawInput.split('-')[0] || 'РН'}</span>
                      <span className="text-slate-500">-</span>
                      <span className="text-slate-300">
                        {decoded.rawInput.split('-')[1] || '0418'}
                      </span>
                      <span className="text-slate-500">-</span>
                      <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-400/50 rounded text-amber-300">
                        {decoded.cipherBlock}
                      </span>
                      {decoded.rawInput.split('-')[3] && (
                        <>
                          <span className="text-slate-500">-</span>
                          <span className="text-emerald-400">
                            {decoded.rawInput.split('-')[3]}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-slate-300 leading-relaxed">
                      {decoded.explanation}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-800/70 border border-slate-700 rounded-lg">
                      <div className="text-xs text-slate-400">
                        Зашитая скидка при покупке:
                      </div>
                      <div className="text-2xl font-mono font-bold text-amber-400 mt-1 tabular-nums">
                        {decoded.discountPercent}%
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Секретная цифра: «{decoded.secretDigit}»
                      </div>
                    </div>

                    <div className="p-4 bg-slate-800/70 border border-slate-700 rounded-lg">
                      <div className="text-xs text-slate-400">
                        Коэффициент возврата денег:
                      </div>
                      <div className="text-2xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
                        {100 - decoded.discountPercent}% от чека
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Удерживается {decoded.discountPercent}% агентской скидки
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300">
                  {decoded.explanation}
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Для клиента на бумаге напечатана 100% розничная цена, но при возврате мы умножаем цену на {(1 - decoded.discountPercent / 100).toFixed(2)}.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              Калькулятор пересчёта возврата по позициям
            </div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-slate-700" />
              {activeInvoice
                ? `Пересчёт возврата по накладной ${activeInvoice.invoiceNumber}`
                : 'Быстрый пересчёт суммы возврата по зашифрованному номеру'}
            </h2>
          </div>

          {activeInvoice && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const allMap: Record<string, number> = {};
                  activeInvoice.items.forEach((it) => {
                    allMap[it.id] = it.quantity;
                  });
                  setReturnQuantities(allMap);
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
              >
                Вернуть всю накладную целиком
              </button>
              <button
                type="button"
                onClick={() => setReturnQuantities({})}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Очистить
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8">
            {activeInvoice ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2.5 px-3">Товар в накладной</th>
                      <th className="py-2.5 px-3 text-right">Куплено</th>
                      <th className="py-2.5 px-3 text-right">Цена в бумаге</th>
                      <th className="py-2.5 px-3 text-center">Кол-во на возврат</th>
                      <th className="py-2.5 px-3 text-right">К возврату (с учётом -{decoded.discountPercent}%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeInvoice.items.map((item) => {
                      const retQty = returnQuantities[item.id] || 0;
                      const linePaperSum = retQty * item.retailPrice;
                      const lineActualRefund = Math.round(
                        linePaperSum * (1 - decoded.discountPercent / 100)
                      );
                      return (
                        <tr
                          key={item.id}
                          className={retQty > 0 ? 'bg-amber-50/30' : ''}
                        >
                          <td className="py-3 px-3 font-medium text-slate-900">
                            {item.name}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                            {formatCurrency(item.retailPrice)} ₸
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setReturnQuantities({
                                    ...returnQuantities,
                                    [item.id]: Math.max(0, retQty - 1),
                                  })
                                }
                                className="w-6 h-6 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-mono font-bold"
                              >
                                -
                              </button>
                              <span className="w-10 text-center font-mono font-semibold text-slate-900 tabular-nums">
                                {retQty}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setReturnQuantities({
                                    ...returnQuantities,
                                    [item.id]: Math.min(item.quantity, retQty + 1),
                                  })
                                }
                                className="w-6 h-6 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-mono font-bold"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            {retQty > 0 ? (
                              <div>
                                <span className="font-bold text-slate-900">
                                  {formatCurrency(lineActualRefund)} ₸
                                </span>
                                {decoded.discountPercent > 0 && (
                                  <span className="block text-[11px] text-slate-400 line-through">
                                    в бумаге: {formatCurrency(linePaperSum)} ₸
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">0 ₸</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Сумма возвращаемых товаров по бумажной накладной (розничная сумма, ₸):
                </label>
                <input
                  type="number"
                  value={manualRetailReturnSum}
                  onChange={(e) => setManualRetailReturnSum(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 text-base font-mono font-bold bg-white border border-slate-300 rounded-lg"
                />
              </div>
            )}
          </div>

          <div className="lg:col-span-4 p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="text-xs font-semibold text-slate-500">
              ИТОГОВЫЙ РАСЧЁТ ДЛЯ КАССИРА
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Сумма возврата по бумаге:</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(paperReturnSum)} ₸
                </span>
              </div>

              <div className="flex items-center justify-between text-amber-800">
                <span>Скрытая скидка (код «{decoded.secretDigit}»):</span>
                <span className="font-mono font-semibold tabular-nums">
                  -{decoded.discountPercent}% (-{formatCurrency(storeSavedLoss)} ₸)
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
                <span className="font-bold text-slate-900">Выдать из кассы:</span>
                <span className="text-2xl font-mono font-bold text-emerald-700 tabular-nums">
                  {formatCurrency(actualRefundSum)} ₸
                </span>
              </div>
            </div>

            {storeSavedLoss > 0 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  Благодаря шифру в номере магазин <strong>не переплатил {formatCurrency(storeSavedLoss)} ₸</strong> при возврате товара, купленного со скидкой сантехника.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
