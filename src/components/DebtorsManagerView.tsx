import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertTriangle,
  Search,
  Plus,
  Calendar,
  Phone,
  CreditCard,
  MapPin,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  DollarSign,
  FileText,
  AlertOctagon,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { formatCurrency } from '../utils/cipherAndParser';

export interface DebtHistoryEntry {
  id: string;
  date: string;
  invoiceNumber: string;
  invoiceTotal: number;
  paidCash: number;
  debtAdded: number;
  totalDebtAfter: number;
  note?: string;
}

export interface Debtor {
  id: string;
  fullName: string;
  phone: string;
  idCardNumber: string;
  address: string;
  totalDebt: number;
  history: DebtHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

interface DebtorsManagerViewProps {
  onOpenInvoicePrint?: (invoiceNumber: string) => void;
}

const DEBT_LIMIT_KZT = 200000;

export const DebtorsManagerView: React.FC<DebtorsManagerViewProps> = ({ onOpenInvoicePrint }) => {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'exceeded' | 'normal'>('all');
  const [expandedDebtorId, setExpandedDebtorId] = useState<string | null>(null);

  // Модалка нового должника
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newIdCard, setNewIdCard] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newInitialDebt, setNewInitialDebt] = useState('0');
  const [modalError, setModalError] = useState<string | null>(null);

  // Модалка погашения долга
  const [repayModalDebtor, setRepayModalDebtor] = useState<Debtor | null>(null);
  const [repayAmount, setRepayAmount] = useState<string>('');
  const [repayNote, setRepayNote] = useState<string>('Оплата наличными в кассу');

  const fetchDebtors = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/debtors');
      const data = await res.json();
      if (data.success && Array.isArray(data.debtors)) {
        setDebtors(data.debtors);
      }
    } catch (e) {
      console.warn('Failed to fetch debtors:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebtors();
  }, []);

  const totalDebtSum = debtors.reduce((s, d) => s + d.totalDebt, 0);
  const exceededCount = debtors.filter((d) => d.totalDebt > DEBT_LIMIT_KZT).length;

  const filteredDebtors = debtors.filter((d) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      d.fullName.toLowerCase().includes(q) ||
      d.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
      d.idCardNumber.toLowerCase().includes(q) ||
      d.address.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (filterMode === 'exceeded') return d.totalDebt > DEBT_LIMIT_KZT;
    if (filterMode === 'normal') return d.totalDebt <= DEBT_LIMIT_KZT;
    return true;
  });

  const handleCreateDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setModalError('Введите ФИО клиента');
      return;
    }

    try {
      const debtAmount = Number(newInitialDebt) || 0;
      const res = await fetch('/api/debtors/add-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newName.trim(),
          phone: newPhone.trim() || 'Не указан',
          idCardNumber: newIdCard.trim() || 'Не указан',
          address: newAddress.trim() || 'г. Алматы',
          invoiceNumber: 'Начальное сальдо',
          invoiceTotal: debtAmount,
          paidCash: 0,
          debtAdded: debtAmount,
          note: 'Начальная задолженность',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewName('');
        setNewPhone('');
        setNewIdCard('');
        setNewAddress('');
        setNewInitialDebt('0');
        fetchDebtors();
      } else {
        setModalError(data.error || 'Ошибка создания должника');
      }
    } catch (err: any) {
      setModalError(err.message || 'Ошибка соединения');
    }
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayModalDebtor) return;
    const amount = Number(repayAmount);
    if (!amount || amount <= 0) return;

    try {
      const res = await fetch('/api/debtors/repay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debtorId: repayModalDebtor.id,
          amount,
          note: repayNote.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRepayModalDebtor(null);
        setRepayAmount('');
        fetchDebtors();
      }
    } catch (err) {
      console.warn(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Шапка раздела */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Лист 2 Google Таблицы / Excel
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
              <Users className="w-6 h-6 text-slate-700" />
              База должников строительного магазина
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Учёт частичных оплат, суммирование долгов по накладным и контроль лимита 200 000 ₸.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchDebtors}
              className="p-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              title="Обновить данные"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Добавить должника
            </button>
          </div>
        </div>

        {/* Информационные плашки KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="text-[11px] font-medium text-slate-500">Всего клиентов в долге:</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {debtors.length} <span className="text-xs font-normal text-slate-500">чел.</span>
            </div>
          </div>

          <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/80">
            <div className="text-[11px] font-medium text-amber-800">Общая сумма задолженности:</div>
            <div className="text-xl font-bold font-mono text-amber-900 mt-1 tabular-nums">
              {formatCurrency(totalDebtSum)} ₸
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border ${exceededCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className={`text-[11px] font-medium ${exceededCount > 0 ? 'text-rose-800' : 'text-emerald-800'}`}>
              Превысили лимит (&gt; 200 000 ₸):
            </div>
            <div className={`text-xl font-bold font-mono mt-1 ${exceededCount > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>
              {exceededCount} <span className="text-xs font-normal">клиент(ов)</span>
            </div>
          </div>

          <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80">
            <div className="text-[11px] font-medium text-blue-800">Кредитный лимит магазина:</div>
            <div className="text-xl font-bold font-mono text-blue-900 mt-1 tabular-nums">
              200 000 ₸
            </div>
          </div>
        </div>

        {/* Предупреждение о лимите для кассира */}
        {exceededCount > 0 && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-3 text-rose-900 text-xs">
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">
                Внимание менеджеру и кассиру! У {exceededCount} клиента(ов) долг превышает 200 000 тенге!
              </div>
              <div className="text-rose-700 mt-0.5">
                По регламенту магазина: <strong>требуйте полного расчёта</strong> и не отпускайте товар в долг. Отпуск только за наличный расчёт!
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Поиск и фильтры */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по ФИО, телефону, номеру удостоверения..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterMode === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Все ({debtors.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('exceeded')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterMode === 'exceeded' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            Превышен лимит ({exceededCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('normal')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterMode === 'normal' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            В норме ({debtors.length - exceededCount})
          </button>
        </div>
      </div>

      {/* Список должников */}
      <div className="space-y-4">
        {filteredDebtors.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 text-xs">
            {searchQuery ? 'Клиенты не найдены по запросу' : 'Список должников пуст'}
          </div>
        ) : (
          filteredDebtors.map((debtor) => {
            const isExceeded = debtor.totalDebt > DEBT_LIMIT_KZT;
            const isExpanded = expandedDebtorId === debtor.id;

            return (
              <div
                key={debtor.id}
                className={`bg-white rounded-2xl border transition-all shadow-xs ${
                  isExceeded ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900">{debtor.fullName}</h3>
                        {isExceeded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            ЛИМИТ ПРЕВЫШЕН (&gt;200 000 ₸)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            В норме (до лимита: {formatCurrency(DEBT_LIMIT_KZT - debtor.totalDebt)} ₸)
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs text-slate-600 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{debtor.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span>Уд. личности: <strong className="font-mono text-slate-800">{debtor.idCardNumber}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate max-w-[220px]" title={debtor.address}>{debtor.address}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 border-t md:border-t-0 pt-3 md:pt-0">
                      <div className="text-right">
                        <div className="text-[11px] text-slate-500">Сумма долга:</div>
                        <div
                          className={`text-2xl font-bold font-mono tabular-nums ${
                            isExceeded ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          {formatCurrency(debtor.totalDebt)} ₸
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRepayModalDebtor(debtor);
                            setRepayAmount(String(Math.min(debtor.totalDebt, 50000)));
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          Погасить
                        </button>

                        <button
                          type="button"
                          onClick={() => setExpandedDebtorId(isExpanded ? null : debtor.id)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          История ({debtor.history.length})
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Баннер запрета отпуска в долг, если лимит превышен */}
                  {isExceeded && (
                    <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        Менеджер, внимание! Клиенту <strong>запрещено отпускать товары в долг</strong>. Требуйте полного погашения ({formatCurrency(debtor.totalDebt)} ₸), покупки только за наличные!
                      </span>
                    </div>
                  )}
                </div>

                {/* Раскрывающийся блок истории долгов: суммирование по датам и накладным */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-5 bg-slate-50/70 rounded-b-2xl animate-in fade-in duration-150">
                    <div className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      Детализация задолженности по датам и накладным (как суммировался долг):
                    </div>

                    {debtor.history.length === 0 ? (
                      <div className="text-xs text-slate-400 italic">История операций пуста.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs bg-white rounded-xl overflow-hidden border border-slate-200">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                              <th className="py-2.5 px-3">Дата / Время</th>
                              <th className="py-2.5 px-3">Накладная</th>
                              <th className="py-2.5 px-3 text-right">Сумма накладной</th>
                              <th className="py-2.5 px-3 text-right">Оплачено в кассу</th>
                              <th className="py-2.5 px-3 text-right">Приплюсовано в долг</th>
                              <th className="py-2.5 px-3 text-right">Итоговый остаток долга</th>
                              <th className="py-2.5 px-3">Примечание</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {debtor.history.map((entry) => (
                              <tr key={entry.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{entry.date}</td>
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {entry.invoiceNumber.startsWith('РН-') ? (
                                    <button
                                      type="button"
                                      onClick={() => onOpenInvoicePrint?.(entry.invoiceNumber)}
                                      className="text-blue-600 hover:underline flex items-center gap-1"
                                      title="Открыть бланк накладной"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                                      {entry.invoiceNumber}
                                    </button>
                                  ) : (
                                    entry.invoiceNumber
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-slate-800">
                                  {entry.invoiceTotal > 0 ? `${formatCurrency(entry.invoiceTotal)} ₸` : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">
                                  {entry.paidCash > 0 ? `${formatCurrency(entry.paidCash)} ₸` : '0 ₸'}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums font-bold">
                                  {entry.debtAdded > 0 ? (
                                    <span className="text-amber-700">+{formatCurrency(entry.debtAdded)} ₸</span>
                                  ) : (
                                    <span className="text-emerald-700">{formatCurrency(entry.debtAdded)} ₸</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900">
                                  {formatCurrency(entry.totalDebtAfter)} ₸
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 font-sans text-[11px]">
                                  {entry.note || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Модальное окно добавления нового должника */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-700" />
                Новый клиент в Лист «Должники»
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="my-3 p-2.5 bg-rose-50 text-rose-800 text-xs rounded-lg border border-rose-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateDebtor} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ФИО клиента <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Например: Садвакасов Канат Ерболович"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Телефон:</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+7 701 000-00-00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Номер удостоверения личности / ИИН:
                </label>
                <input
                  type="text"
                  value={newIdCard}
                  onChange={(e) => setNewIdCard(e.target.value)}
                  placeholder="045892104"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Адрес объекта / проживания:</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="г. Алматы, мкр. Самал-2, д. 15"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Начальная сумма долга, ₸ (если есть):
                </label>
                <input
                  type="number"
                  min="0"
                  value={newInitialDebt}
                  onChange={(e) => setNewInitialDebt(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно погашения задолженности */}
      {repayModalDebtor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                Погашение долга
              </h3>
              <button
                type="button"
                onClick={() => setRepayModalDebtor(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-600">
              Клиент: <strong>{repayModalDebtor.fullName}</strong>
              <br />
              Текущий долг: <strong className="text-slate-900 font-mono">{formatCurrency(repayModalDebtor.totalDebt)} ₸</strong>
            </div>

            <form onSubmit={handleRepay} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Сумма внесения в кассу, ₸:</label>
                <input
                  type="number"
                  min="1"
                  max={repayModalDebtor.totalDebt}
                  required
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-base font-bold focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Примечание:</label>
                <input
                  type="text"
                  value={repayNote}
                  onChange={(e) => setRepayNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRepayModalDebtor(null)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
                >
                  Принять оплату
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
