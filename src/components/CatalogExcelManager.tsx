import React, { useState } from 'react';
import { CatalogItem } from '../types';
import { formatCurrency } from '../utils/cipherAndParser';
import {
  generateSeedTsv,
  generateSeedCsv,
  INVOICE_SEEDED_ITEMS,
} from '../data/invoiceProducts';
import {
  Search,
  Plus,
  Download,
  Upload,
  Trash2,
  Check,
  RotateCcw,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  Copy,
  ExternalLink,
  AlertCircle,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react';

interface CatalogExcelManagerProps {
  catalog: CatalogItem[];
  onUpdateCatalog: (next: CatalogItem[]) => void;
  onResetCatalog: () => void;
}

export const CatalogExcelManager: React.FC<CatalogExcelManagerProps> = ({
  catalog,
  onUpdateCatalog,
  onResetCatalog,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<CatalogItem>>({});
  const [newRowOpen, setNewRowOpen] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Google Sheets integration state (предзаполнена ссылка пользователя)
  const [sheetUrlInput, setSheetUrlInput] = useState(
    'https://docs.google.com/spreadsheets/d/10bVlCpuwBTUCySFwAJDxJXDOcJWwDkbVBPtWZVEKW50/edit?usp=drivesdk'
  );
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [connectedSheetInfo, setConnectedSheetInfo] = useState<{
    id: string;
    itemCount: number;
    lastSynced: string;
  } | null>(null);
  const [templateCopied, setTemplateCopied] = useState(false);
  const [invoiceCopied, setInvoiceCopied] = useState(false);
  const [table4Copied, setTable4Copied] = useState(false);

  const [newItem, setNewItem] = useState<{
    sku: string;
    name: string;
    category: CatalogItem['category'];
    unit: CatalogItem['unit'];
    price: string;
    keywords: string;
    stock: string;
  }>({
    sku: '1',
    name: '',
    category: 'Водоснабжение и Отопление',
    unit: 'шт',
    price: '',
    keywords: '',
    stock: '100',
  });

  const categories = ['ALL', 'Канализация', 'Водоснабжение и Отопление', 'Электрика', 'Смеси и Крепёж'];

  const filteredCatalog = catalog.filter((item) => {
    const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
    const q = search.trim().toLowerCase();
    if (!q) return matchesCat;
    return (
      matchesCat &&
      (item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q)))
    );
  });

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const handleCopy4ColumnTable = () => {
    const lines = [
      'Порядковый номер\tНазвание\tСлова-синонимы, как может быть по-простому называться\tЦена',
      ...catalog.map((item, idx) => {
        const num = item.sku || String(idx + 1);
        const syns = item.keywords.join(', ');
        return `${num}\t${item.name}\t${syns}\t${item.price}`;
      }),
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
    setTable4Copied(true);
    setTimeout(() => setTable4Copied(false), 3500);
    showNotice(`✅ Скопировано ${catalog.length} товаров в 4 столбца (№, Название, Синонимы, Цена ₸). Вставьте в Google Таблицу через Ctrl+V!`);
  };

  const handleCopyTemplate = () => {
    const templateContent = [
      'Порядковый номер\tНазвание\tСлова-синонимы, как может быть по-простому называться\tЦена',
      '1\tМуфта 50 полипропилен\tмуфта 50, муфта на 50, соединитель 50, муфта пп 50\t247',
      '2\tМуфта 25 полипропилен\tмуфта 25, муфта на 25, соединитель 25, прямая муфта 25\t60',
      '3\tОтвод 50\tотвод 50, отвод на 50, уголок 50, угол 50, колено 50\t350',
      '4\tКран 25 шаровый\tкран 25, кран шаровый 25, кран на 25, шаровый кран 25\t1200',
      '5\tКлей для труб\tклей, клей для труб, тюбик клея, клей сантехнический\t600',
    ].join('\n');
    navigator.clipboard?.writeText(templateContent);
    setTemplateCopied(true);
    setTimeout(() => setTemplateCopied(false), 3000);
    showNotice('Шаблон скопирован в буфер! Откройте вашу Google Таблицу и нажмите Ctrl+V.');
  };

  const handleCopyInvoiceTable = () => {
    const tsvData = generateSeedTsv();
    navigator.clipboard?.writeText(tsvData);
    setInvoiceCopied(true);
    setTimeout(() => setInvoiceCopied(false), 3500);
    showNotice(`✅ ${INVOICE_SEEDED_ITEMS.length} позиций из накладных скопированы! Перейдите в Google Таблицу и нажмите Ctrl+V в ячейку A1.`);
  };

  const handleSyncGoogleSheet = async (targetUrl?: string) => {
    const urlToSync = targetUrl || sheetUrlInput.trim();
    if (!urlToSync) {
      setSyncError('Пожалуйста, вставьте ссылку на Google Таблицу или её ID.');
      return;
    }
    setSyncLoading(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrlOrId: urlToSync }),
      });
      const data = await res.json();
      if (data.success && data.items) {
        onUpdateCatalog(data.items);
        setConnectedSheetInfo({
          id: urlToSync,
          itemCount: data.count || data.items.length,
          lastSynced: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        });
        showNotice(`✅ Google Таблица синхронизирована! Загружено ${data.count || data.items.length} товаров. Бот уже использует эти цены.`);
      } else {
        setSyncError(data.error || 'Не удалось синхронизировать таблицу. Проверьте права доступа («Все, у кого есть ссылка — Читатель»).');
      }
    } catch (e: any) {
      setSyncError(e?.message || 'Ошибка связи с сервером.');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleStartEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditDraft({ ...item });
  };

  const handleSaveEdit = (id: string) => {
    onUpdateCatalog(
      catalog.map((item) =>
        item.id === id
          ? {
              ...item,
              name: editDraft.name ?? item.name,
              sku: editDraft.sku ?? item.sku,
              unit: (editDraft.unit as CatalogItem['unit']) ?? item.unit,
              price: Number(editDraft.price) || item.price,
              keywords: editDraft.keywords ?? item.keywords,
              stock: Number(editDraft.stock) ?? item.stock,
            }
          : item
      )
    );
    setEditingId(null);
    showNotice('Изменения сохранены в прайс-листе. Голосовой бот уже использует новую цену.');
  };

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim() || !Number(newItem.price)) return;

    const created: CatalogItem = {
      id: `cat-${Date.now()}`,
      sku: newItem.sku.trim() || `СТ-${catalog.length + 1}`,
      name: newItem.name.trim(),
      category: newItem.category,
      unit: newItem.unit,
      price: Number(newItem.price),
      keywords: newItem.keywords
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      stock: Number(newItem.stock) || 50,
    };

    onUpdateCatalog([created, ...catalog]);
    setNewItem({
      sku: `СТ-${catalog.length + 2}`,
      name: '',
      category: 'Канализация',
      unit: 'шт',
      price: '',
      keywords: '',
      stock: '100',
    });
    setNewRowOpen(false);
    showNotice(`Товар «${created.name}» добавлен в базу и доступен для голосовой диктовки.`);
  };

  const handleDeleteItem = (id: string, name: string) => {
    onUpdateCatalog(catalog.filter((c) => c.id !== id));
    showNotice(`Позиция «${name}» удалена из прайса.`);
  };

  const handleExportExcelCsv = () => {
    const headers = ['Артикул', 'Наименование товара', 'Категория', 'Ед. изм.', 'Цена розничная (₸)', 'Голосовые синонимы (через запятую)', 'Остаток'];
    const rows = catalog.map((item) => [
      item.sku,
      `"${item.name.replace(/"/g, '""')}"`,
      item.category,
      item.unit,
      String(item.price),
      `"${item.keywords.join(', ')}"`,
      String(item.stock),
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Прайс_СтройМагазин_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Прайс-лист выгружен в формате CSV (открывается в Excel и Google Таблицах).');
  };

  const handleImportFromPaste = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const added: CatalogItem[] = [];
    lines.forEach((line, idx) => {
      const cols = line.includes('\t') ? line.split('\t') : line.split(';');
      if (cols.length >= 2) {
        const nameCandidate = cols[0].replace(/^"|"$/g, '').trim();
        const priceCandidate = parseFloat((cols[1] || '0').replace(/[^\d.,]/g, '').replace(',', '.'));
        const unitCandidate = (cols[2] || 'шт').trim() as CatalogItem['unit'];
        const synonymsCandidate = (cols[3] || nameCandidate.toLowerCase())
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

        if (nameCandidate && priceCandidate > 0) {
          added.push({
            id: `cat-imp-${Date.now()}-${idx}`,
            sku: `ИМП-${catalog.length + idx + 1}`,
            name: nameCandidate,
            category: 'Канализация',
            unit: ['м', 'шт', 'компл', 'меш', 'уп'].includes(unitCandidate) ? unitCandidate : 'шт',
            price: priceCandidate,
            keywords: synonymsCandidate,
            stock: 100,
          });
        }
      }
    });

    if (added.length > 0) {
      onUpdateCatalog([...added, ...catalog]);
      setPasteText('');
      setPasteModalOpen(false);
      showNotice(`Успешно импортировано позиций из таблицы: ${added.length} шт.`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Карточка подключения Google Таблицы */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white rounded-2xl p-6 shadow-xl border border-emerald-800/40 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-semibold uppercase tracking-wider border border-emerald-500/30">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Онлайн-база для Telegram-бота
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Связка с Google Таблицей / Excel Online
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl">
              Менеджер или директор меняет цены прямо в Google Таблице на телефоне или компьютере — бот мгновенно берет свежие цены без перезагрузок!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy4ColumnTable}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md cursor-pointer"
              title="Копирует 52 позиции каталога в 4 колонки: Порядковый номер, Название, Слова-синонимы, Цена ₸"
            >
              <ClipboardCheck className="w-4 h-4 text-slate-950" />
              {table4Copied ? '✓ Скопировано 52 товара!' : 'Скопировать 52 товара (в 4 колонки)'}
            </button>
            <button
              type="button"
              onClick={handleCopyTemplate}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              {templateCopied ? '✓ Скопировано в буфер!' : 'Шаблон 4 колонок'}
            </button>
            <a
              href="https://docs.google.com/spreadsheets/d/10bVlCpuwBTUCySFwAJDxJXDOcJWwDkbVBPtWZVEKW50/edit?usp=drivesdk"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              Открыть вашу Google Таблицу
            </a>
          </div>
        </div>

        {/* 4 Шага настройки */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-xl space-y-1">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[11px] font-mono">1</span>
              Колонки в таблице
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              1. Порядковый номер · 2. Название · 3. Слова-синонимы · 4. Цена (₸)
            </p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-xl space-y-1">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[11px] font-mono">2</span>
              Настройки доступа
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              В Google Таблице вверху справа нажмите кнопку <strong>«Поделиться» (Share)</strong>.
            </p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-xl space-y-1">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[11px] font-mono">3</span>
              Доступ по ссылке
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Выберите: <strong>«Все, у кого есть ссылка»</strong> с правами <strong>«Читатель»</strong>.
            </p>
          </div>

          <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-xl space-y-1">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[11px] font-mono">4</span>
              Подключение
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Вставьте ссылку ниже или отправьте боту в Telegram: <code>/sheet ссылка</code>
            </p>
          </div>
        </div>

        {/* Форма подключения ссылки / ID */}
        <div className="pt-2 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSyncGoogleSheet();
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
          >
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sheetUrlInput}
                onChange={(e) => setSheetUrlInput(e.target.value)}
                placeholder="Вставьте ссылку на Google Таблицу (https://docs.google.com/spreadsheets/d/...)"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-xl text-xs font-mono focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={syncLoading || !sheetUrlInput.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
              {syncLoading ? 'Подключение...' : 'Подключить к боту'}
            </button>
          </form>

          {syncError && (
            <div className="mt-3 p-3 bg-red-950/60 border border-red-800 text-red-200 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong>Ошибка: </strong>
                {syncError}
                <div className="text-[11px] text-red-300 mt-1">
                  Подсказка: проверьте, что в таблице в меню «Поделиться» выбран пункт «Все, у кого есть ссылка — Читатель».
                </div>
              </div>
            </div>
          )}

          {connectedSheetInfo && (
            <div className="mt-3 p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-xl text-xs flex items-center justify-between gap-3 text-emerald-200">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Таблица подключена! Загружено <strong>{connectedSheetInfo.itemCount}</strong> позиций. Последняя синхронизация: <strong>{connectedSheetInfo.lastSynced}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSyncGoogleSheet()}
                disabled={syncLoading}
                className="text-[11px] text-emerald-300 hover:text-white underline underline-offset-2 flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${syncLoading ? 'animate-spin' : ''}`} />
                Обновить цены
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              Бесплатное хранилище цен · Синхронизация с Google Sheets и MS Excel
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
              База товаров и голосовых синонимов ({catalog.length} поз.)
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Редактируйте цены прямо в ячейках таблицы, добавляйте разговорные названия (например, <em>«развод угловой», «полтинник», «колено»</em>) или выгружайте в Excel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setNewRowOpen(!newRowOpen)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Добавить товар
            </button>
            <button
              type="button"
              onClick={() => setPasteModalOpen(!pasteModalOpen)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200/70 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Вставить из Excel / Google Таблицы
            </button>
            <button
              type="button"
              onClick={handleExportExcelCsv}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Скачать Excel (.csv)
            </button>
            <button
              type="button"
              onClick={() => {
                onResetCatalog();
                showNotice('Восстановлен стандартный демонстрационный прайс-лист.');
              }}
              className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
              title="Сбросить к исходному прайсу"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Сброс
            </button>
          </div>
        </div>

        {statusNotice && (
          <div className="mt-4 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}

        {pasteModalOpen && (
          <div className="mt-5 p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                Быстрая вставка строк из Excel или Google Таблицы (Ctrl+C → Ctrl+V)
              </div>
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Закрыть
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Скопируйте столбцы в Excel или Google Таблице в формате: <code>Наименование ; Цена ; Ед. изм. ; Голосовые синонимы</code>:
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={4}
              placeholder={`Сифон для раковины бутылочный 1 1/2; 450; шт; сифон для раковины, сифон под мойку\nКран Маевского 1/2 латунный; 85; шт; кран маевского, воздухоотводчик`}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setPasteText(
                    `Сифон для умывальника бутылочный с выпуском; 460; шт; сифон, сифон для раковины\nОбратный клапан латунный 1/2 ВВ; 380; шт; обратный клапан 1/2, клапан обратный`
                  )
                }
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Подставить пример строк
              </button>
              <button
                type="button"
                onClick={handleImportFromPaste}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800"
              >
                Импортировать в базу
              </button>
            </div>
          </div>
        )}

        {newRowOpen && (
          <form
            onSubmit={handleAddNewItem}
            className="mt-5 p-5 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Артикул</label>
              <input
                type="text"
                value={newItem.sku}
                onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                placeholder="КН-050"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Официальное название (для печати в накладной)
              </label>
              <input
                type="text"
                required
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                placeholder="Напр.: Ревизия канализационная ПП диаметр 50 мм"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Ед.</label>
              <select
                value={newItem.unit}
                onChange={(e) =>
                  setNewItem({ ...newItem, unit: e.target.value as CatalogItem['unit'] })
                }
                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
              >
                <option value="шт">шт</option>
                <option value="м">м</option>
                <option value="компл">компл</option>
                <option value="меш">меш</option>
                <option value="уп">уп</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Розничная цена (₸)
              </label>
              <input
                type="number"
                required
                min="1"
                value={newItem.price}
                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                placeholder="135"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Как называют голосом (синонимы)
              </label>
              <input
                type="text"
                value={newItem.keywords}
                onChange={(e) => setNewItem({ ...newItem, keywords: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                placeholder="ревизия 50, прочистка 50"
              />
            </div>
            <div className="md:col-span-12 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewRowOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800"
              >
                Сохранить в прайс-лист
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'ALL' ? 'Все категории' : cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, Ø50, синониму..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-900"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-mono text-slate-500">
                <th className="py-2.5 px-3 w-10 text-center border-r border-slate-200">#</th>
                <th className="py-2.5 px-3 w-28 border-r border-slate-200">A · Артикул</th>
                <th className="py-2.5 px-4 border-r border-slate-200">B · Наименование (в накладную)</th>
                <th className="py-2.5 px-3 w-20 text-center border-r border-slate-200">C · Ед.</th>
                <th className="py-2.5 px-4 w-32 text-right border-r border-slate-200">D · Цена розн.</th>
                <th className="py-2.5 px-4 border-r border-slate-200">
                  E · Синонимы для голосового бота
                </th>
                <th className="py-2.5 px-3 w-28 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredCatalog.map((item, index) => {
                const isEditing = editingId === item.id;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400 border-r border-slate-100 tabular-nums">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 border-r border-slate-100 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editDraft.sku || ''}
                          onChange={(e) => setEditDraft({ ...editDraft, sku: e.target.value })}
                          className="w-full px-1.5 py-1 border border-slate-300 rounded font-mono text-xs"
                        />
                      ) : (
                        item.sku
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 border-r border-slate-100">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editDraft.name || ''}
                          onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                        />
                      ) : (
                        <div>
                          <div>{item.name}</div>
                          <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                            {item.category} · Остаток: {item.stock} {item.unit}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 border-r border-slate-100">
                      {isEditing ? (
                        <select
                          value={editDraft.unit || 'шт'}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              unit: e.target.value as CatalogItem['unit'],
                            })
                          }
                          className="px-1 py-1 border border-slate-300 rounded text-xs"
                        >
                          <option value="шт">шт</option>
                          <option value="м">м</option>
                          <option value="компл">компл</option>
                          <option value="меш">меш</option>
                        </select>
                      ) : (
                        item.unit
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 border-r border-slate-100 tabular-nums whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editDraft.price ?? item.price}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, price: Number(e.target.value) })
                          }
                          className="w-24 px-2 py-1 text-right border border-slate-900 rounded font-mono text-xs"
                        />
                      ) : (
                        `${formatCurrency(item.price)} ₸`
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 border-r border-slate-100">
                      {isEditing ? (
                        <input
                          type="text"
                          value={(editDraft.keywords || []).join(', ')}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              keywords: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                        />
                      ) : (
                        <span className="text-slate-500">
                          {item.keywords.join(' · ')}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            className="px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800"
                          >
                            Сохранить
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 underline decoration-slate-300 underline-offset-2"
                          >
                            Изменить цену
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Удалить позицию"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
