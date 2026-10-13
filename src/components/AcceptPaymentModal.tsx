import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Wallet,
  AlertOctagon,
  CheckCircle2,
  Users,
  Plus,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency } from '../utils/cipherAndParser';
import { Debtor } from './DebtorsManagerView';

interface AcceptPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  totalSum: number;
  onPaymentSuccess?: (msg: string) => void;
}

const DEBT_LIMIT_KZT = 200000;

export const AcceptPaymentModal: React.FC<AcceptPaymentModalProps> = ({
  isOpen,
  onClose,
  invoiceNumber,
  totalSum,
  onPaymentSuccess,
}) => {
  const [paymentMode, setPaymentMode] = useState<'full_cash' | 'partial_debt'>('partial_debt');
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>('');
  const [isNewDebtor, setIsNewDebtor] = useState<boolean>(false);

  // Поля нового должника
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newIdCard, setNewIdCard] = useState('');
  const [newAddress, setNewAddress] = useState('');

  // Расчёт оплат
  const [paidCashInput, setPaidCashInput] = useState<string>('0');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/debtors')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.debtors)) {
            setDebtors(d.debtors);
            if (d.debtors.length > 0 && !selectedDebtorId) {
              setSelectedDebtorId(d.debtors[0].id);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const paidCash = Math.max(0, Math.min(totalSum, Number(paidCashInput) || 0));
  const debtToAdd = Math.max(0, totalSum - paidCash);

  const selectedDebtor = debtors.find((d) => d.id === selectedDebtorId);
  const currentDebtorDebt = selectedDebtor ? selectedDebtor.totalDebt : 0;
  const newProjectedDebt = currentDebtorDebt + debtToAdd;
  const isLimitExceeded = newProjectedDebt > DEBT_LIMIT_KZT;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (paymentMode === 'full_cash') {
        onPaymentSuccess?.(
          `Накладная № ${invoiceNumber} полностью оплачена (${formatCurrency(totalSum)} ₸) наличными в кассу.`
        );
        onClose();
        return;
      }

      // Режим частичной оплаты / записи в долг
      if (isNewDebtor && !newFullName.trim()) {
        setErrorMsg('Укажите ФИО нового клиента');
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/debtors/add-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debtorId: isNewDebtor ? undefined : selectedDebtorId,
          fullName: isNewDebtor ? newFullName.trim() : selectedDebtor?.fullName || '',
          phone: isNewDebtor ? newPhone.trim() : selectedDebtor?.phone,
          idCardNumber: isNewDebtor ? newIdCard.trim() : selectedDebtor?.idCardNumber,
          address: isNewDebtor ? newAddress.trim() : selectedDebtor?.address,
          invoiceNumber,
          invoiceTotal: totalSum,
          paidCash,
          debtAdded: debtToAdd,
          note: note.trim() || `Накладная ${invoiceNumber} (Оплачено: ${paidCash} ₸, в долг: ${debtToAdd} ₸)`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        let msg = `Оплата по накладной № ${invoiceNumber} зафиксирована! `;
        if (debtToAdd > 0) {
          msg += `В долг записано +${formatCurrency(debtToAdd)} ₸ (Лист 2 «Должники»).`;
        }
        if (data.limitExceeded) {
          msg += ` ⚠️ ВНИМАНИЕ: У клиента превышен лимит 200 000 ₸!`;
        }
        onPaymentSuccess?.(msg);
        onClose();
      } else {
        setErrorMsg(data.error || 'Ошибка проведения оплаты');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка соединения');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Принять оплату по накладной № {invoiceNumber}
              </h3>
              <div className="text-xs text-slate-500">
                Сумма к оплате: <strong className="font-mono text-slate-800">{formatCurrency(totalSum)} ₸</strong>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="my-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          {/* Переключатель способа оплаты */}
          <div>
            <label className="block font-semibold text-slate-700 mb-2">Форма расчёта:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('full_cash')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  paymentMode === 'full_cash'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  100% В кассу (наличные/карта)
                </div>
                <div className={`text-[11px] mt-1 ${paymentMode === 'full_cash' ? 'text-slate-300' : 'text-slate-500'}`}>
                  Полная оплата {formatCurrency(totalSum)} ₸ без записи в долг
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('partial_debt')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  paymentMode === 'partial_debt'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  Частично / В долг
                </div>
                <div className={`text-[11px] mt-1 ${paymentMode === 'partial_debt' ? 'text-slate-300' : 'text-slate-500'}`}>
                  Запись остатка в Лист 2 «Должники»
                </div>
              </button>
            </div>
          </div>

          {paymentMode === 'partial_debt' && (
            <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              {/* Суммы: сколько налом, сколько в долг */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Оплачено сразу в кассу (₸):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalSum}
                    value={paidCashInput}
                    onChange={(e) => setPaidCashInput(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  <div className="flex gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setPaidCashInput('0')}
                      className="text-[10px] px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded"
                    >
                      0 ₸
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaidCashInput(String(Math.round(totalSum / 2)))}
                      className="text-[10px] px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded"
                    >
                      50% ({formatCurrency(Math.round(totalSum / 2))} ₸)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-amber-900 mb-1">
                    Записать в долг (₸):
                  </label>
                  <div className="w-full px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg font-mono font-bold text-amber-900 text-sm">
                    {formatCurrency(debtToAdd)} ₸
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Автоматически суммируется в карточке
                  </div>
                </div>
              </div>

              {/* Выбор должника или создание нового */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700">Клиент-должник:</label>
                  <button
                    type="button"
                    onClick={() => setIsNewDebtor(!isNewDebtor)}
                    className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    {isNewDebtor ? '← Выбрать из базы' : '+ Новый клиент'}
                  </button>
                </div>

                {!isNewDebtor ? (
                  <select
                    value={selectedDebtorId}
                    onChange={(e) => setSelectedDebtorId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    {debtors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} — долг: {formatCurrency(d.totalDebt)} ₸ ({d.phone})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2.5 p-3 bg-white border border-slate-200 rounded-lg">
                    <div>
                      <input
                        type="text"
                        placeholder="ФИО клиента *"
                        value={newFullName}
                        onChange={(e) => setNewFullName(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Телефон"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Номер уд. личности"
                        value={newIdCard}
                        onChange={(e) => setNewIdCard(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Адрес объекта / проживания"
                        value={newAddress}
                        onChange={(e) => setNewAddress(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Расчёт баланса и ПРОВЕРКА ЛИМИТА 200 000 ₸ */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Текущий долг клиента:</span>
                  <span className="font-mono font-semibold">{formatCurrency(currentDebtorDebt)} ₸</span>
                </div>
                <div className="flex justify-between text-amber-800">
                  <span>Добавляется по накладной:</span>
                  <span className="font-mono font-bold">+{formatCurrency(debtToAdd)} ₸</span>
                </div>
                <div className="flex justify-between text-slate-900 pt-1 border-t border-slate-100 font-bold">
                  <span>Итоговый долг станет:</span>
                  <span className={`font-mono text-sm ${isLimitExceeded ? 'text-rose-600 font-bold' : ''}`}>
                    {formatCurrency(newProjectedDebt)} ₸
                  </span>
                </div>
              </div>

              {/* КРАСНЫЙ АЛЕРТ ПРЕВЫШЕНИЯ ЛИМИТА 200 000 ₸ */}
              {isLimitExceeded && (
                <div className="p-3.5 bg-rose-50 border-2 border-rose-400 rounded-xl flex items-start gap-3 text-rose-900">
                  <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wide text-rose-700">
                      Внимание менеджеру! Превышен лимит 200 000 ₸!
                    </div>
                    <div className="text-xs mt-1 leading-relaxed">
                      Сумма долга клиента составит <strong>{formatCurrency(newProjectedDebt)} ₸</strong> (лимит: 200 000 ₸).
                      <br />
                      <strong className="text-rose-800 underline">
                        Требуйте полного расчёта! В долг не отпускать! Только за наличку!
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Примечание к платежу:</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Например: Оплата 50% переводом, остаток до субботы"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-2.5 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                isLimitExceeded && paymentMode === 'partial_debt'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-slate-900 hover:bg-slate-800'
              } disabled:opacity-50`}
            >
              {submitting ? 'Проведение...' : 'Зафиксировать расчёт'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
