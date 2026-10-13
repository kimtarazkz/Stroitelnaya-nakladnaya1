import React, { useState } from 'react';
import {
  Mic,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  ArrowRight,
  Check,
  Layers,
  Database,
  TrendingUp,
} from 'lucide-react';

export const ArchitectureAndMarketView: React.FC<{
  onSwitchToWorkspace: () => void;
  onSwitchToReturn: () => void;
}> = ({ onSwitchToWorkspace, onSwitchToReturn }) => {
  const [selectedStackOption, setSelectedStackOption] = useState<'gsheets' | 'excel_local' | 'miniapp'>('gsheets');

  return (
    <div className="space-y-10 pb-12">
      <section className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
        <div className="max-w-3xl">
          <div className="text-xs font-medium text-slate-500 mb-2">
            Архитектура системы · Проектирование MVP · Анализ рынка
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight text-balance">
            Как устроена система голосовой выписки накладных со скрытой скидкой для сантехников и прорабов
          </h1>
          <p className="mt-3 text-slate-600 text-base leading-relaxed">
            В строительных и сантехнических магазинах до 60% оборота делают постоянные мастера (сантехники, электрики, отделочники). Им критически важно получить для своего заказчика (хозяина квартиры) <strong>накладную с полными розничными ценами</strong>, но фактически заплатить в кассу со своей скидкой (5%, 10%, 15% или 20%). При этом магазин должен быть защищён при возврате излишков: зашитая в номер накладной цифра позволяет кассиру мгновенно узнать реальную скидку и не вернуть мастеру лишние деньги.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-3">
                <span>ШАГ 01</span>
                <Mic className="w-4 h-4 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">
                Голосовая диктовка в Telegram
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Менеджер идёт вдоль стеллажей с клиентом и наговаривает в бота: <em>«Труба диаметр 50, 4 м. Развод угловой 50, 8 штук»</em>. Речь переводится в текст и разбивается на товарные позиции и количество.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/80 text-xs text-slate-500">
              Стек: Telegram Bot API + Whisper / Vosk (бесплатно)
            </div>
          </div>

          <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-3">
                <span>ШАГ 02</span>
                <FileSpreadsheet className="w-4 h-4 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">
                Поиск цен в Excel / Google Таблице
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Бот сопоставляет живую речь с прайс-листом (учитывая синонимы: «развод угловой» = «отвод» = «уголок» = «колено»), подставляет розничную цену, перемножает количество и считает итог.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/80 text-xs text-slate-500">
              Стек: Google Sheets API или локальный файл .xlsx
            </div>
          </div>

          <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-3">
                <span>ШАГ 03</span>
                <ShieldCheck className="w-4 h-4 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">
                Кнопка скидки и шифр в номере
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Перед печатью менеджер нажимает в боте кнопку <code>[5%]</code>, <code>[10%]</code>, <code>[15%]</code> или <code>[20%]</code>. Цены в бланке остаются розничными (100%), а код скидки зашивается внутрь номера: <span className="font-mono font-semibold text-slate-900">РН-0418-78-34</span>.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/80 text-xs text-slate-500">
              Защита от переплаты при возврате остатков
            </div>
          </div>

          <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-3">
                <span>ШАГ 04</span>
                <Printer className="w-4 h-4 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">
                Авто-печать и подпись клиента
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                По нажатию «На печать» готовая PDF-накладная автоматически улетает на принтер на кассе/складе. Менеджер берёт распечатку, подписывает с клиентом и отпускает товар.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/80 text-xs text-slate-500">
              Стек: Локальный принт-скрипт / PrintNode / PDF в чат
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              Выбор бесплатного хранилища товаров и цен
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              3 варианта реализации базы товаров (чтобы клиент сам редактировал цены)
            </h2>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setSelectedStackOption('gsheets')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedStackOption === 'gsheets'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Google Таблицы (Рекомендуется)
            </button>
            <button
              type="button"
              onClick={() => setSelectedStackOption('excel_local')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedStackOption === 'excel_local'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. Excel-файл в Telegram / на ПК
            </button>
            <button
              type="button"
              onClick={() => setSelectedStackOption('miniapp')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedStackOption === 'miniapp'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3. Telegram WebApp + Веб-админка
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 space-y-4">
            {selectedStackOption === 'gsheets' && (
              <>
                <div className="text-xs font-mono text-emerald-700">
                  ВАРИАНТ 1 · ОПТИМАЛЬНЫЙ ДЛЯ БЕСПЛАТНОГО ЗАПУСКА (0 ₽ / МЕС)
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Google Таблицы (Google Sheets) + Telegram-бот + Скрипт автопечати на ПК кассы
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Владелец магазина или товаровед работает в обычной бесплатной Google Таблице. В ней всего 5 колонок: <strong>Артикул, Название для накладной, Ед. изм., Розничная цена, Голосовые синонимы</strong>. Когда в магазине меняются цены, владелец просто правит цифры в таблице (или вставляет прайс из Excel), а в Telegram-боте нажимает одну кнопку <code>🔄 Обновить прайс из таблицы</code>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-xs font-semibold text-slate-900 mb-2">Плюсы для магазина</div>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Полностью бесплатно (Google Sheets API не требует оплаты)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Редактировать цены можно одновременно с компьютера и телефона</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Все выписанные накладные бот автоматически записывает на 2-й лист («Журнал отгрузок и скидок»)</span>
                      </li>
                    </ul>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-xs font-semibold text-slate-900 mb-2">Как работает печать</div>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-700 shrink-0 mt-0.5" />
                        <span>На компьютере кассы (куда подключён принтер) запускается сам бот или лёгкий агент</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-700 shrink-0 mt-0.5" />
                        <span>При нажатии «Печать» в боте скрипт сразу посылает PDF на принтер по умолчанию (через SumatraPDF CLI в тихом режиме)</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </>
            )}

            {selectedStackOption === 'excel_local' && (
              <>
                <div className="text-xs font-mono text-slate-600">
                  ВАРИАНТ 2 · ПОЛНОСТЬЮ ЛОКАЛЬНЫЙ EXCEL (.XLSX) БЕЗ ОБЛАКОВ
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Файл price.xlsx на компьютере магазина или загрузка файла прямо в Telegram-бота
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Если заказчик не хочет использовать Google-аккаунт и привык хранить прайс в файле <code>Прайс_Магазин.xlsx</code> на рабочем столе компьютера:
                </p>
                <ul className="space-y-2 text-sm text-slate-600 pt-1">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Способ А (Загрузка в бота):</strong> Владелец меняет цены в своём Excel на компьютере и просто перетаскивает файл <code>.xlsx</code> в чат с Telegram-ботом. Бот за 1 секунду обновляет базу товаров.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Способ Б (Папка на ПК кассы):</strong> Программа-бот работает прямо на ноутбуке/ПК в магазине и читает файл <code>C:\СтройМагазин\Прайс.xlsx</code> напрямую. Никаких серверов оплачивать вообще не нужно!
                    </span>
                  </li>
                </ul>
              </>
            )}

            {selectedStackOption === 'miniapp' && (
              <>
                <div className="text-xs font-mono text-slate-600">
                  ВАРИАНТ 3 · ГИБРИДНАЯ ПАНЕЛЬ (КАК В ЭТОМ ДЕМО-ПРИЛОЖЕНИИ)
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Веб-панель кассира + Telegram WebApp (Mini App) внутри бота
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Менеджер диктует голосом в Telegram, но если нужно быстро подправить одну цифру или выбрать другой диаметр перед печатью — прямо внутри Telegram открывается удобное окно накладной. А на компьютере кассы открыт этот веб-терминал с журналом всех накладных и калькулятором возвратов.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onSwitchToWorkspace}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Попробовать живой терминал сборки
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono text-slate-400 mb-2">
                СЕКРЕТНАЯ МЕХАНИКА ДЛЯ САНТЕХНИКОВ И ПРОРАБОВ
              </div>
              <h3 className="text-lg font-bold text-white">
                Как зашифровать скидку в номер накладной, чтобы клиент не догадался?
              </h3>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Если зашифровать скидку линейно (например, <code>-05-</code>, <code>-10-</code>, <code>-20-</code> или <code>1, 2, 3, 4</code>), любой внимательный заказчик или сам прораб быстро заметит закономерность. Поэтому мы используем <strong>нелинейный табличный ключ с шумовой цифрой</strong>:
              </p>

              <div className="mt-4 p-3.5 bg-slate-800/90 border border-slate-700 rounded-lg font-mono text-xs space-y-2">
                <div className="text-slate-400">Пример номера на печатном бланке:</div>
                <div className="text-base font-bold tracking-wider text-white">
                  РН - <span className="text-slate-300">0418</span> - <span className="text-amber-400 underline decoration-amber-400/60 underline-offset-4">78</span> - <span className="text-emerald-400">34</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700 text-[11px]">
                  <div>
                    <span className="text-slate-400">0418:</span> № по порядку
                  </div>
                  <div>
                    <span className="text-amber-400">7</span>8: 1-я цифра (7) — шум
                  </div>
                  <div>
                    7<span className="text-amber-400 font-bold">8</span>: 2-я цифра (<span className="text-amber-400">8</span>) = <strong>20% скидка</strong>
                  </div>
                  <div>
                    <span className="text-emerald-400">34</span>: режим + контрольная цифра
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-5 gap-1.5 text-center font-mono text-xs">
                <div className="p-2 bg-slate-800 rounded border border-slate-700">
                  <div className="text-slate-400 text-[10px]">0%</div>
                  <div className="font-bold text-white mt-0.5">Код «7»</div>
                </div>
                <div className="p-2 bg-slate-800 rounded border border-slate-700">
                  <div className="text-slate-400 text-[10px]">5%</div>
                  <div className="font-bold text-white mt-0.5">Код «3»</div>
                </div>
                <div className="p-2 bg-slate-800 rounded border border-slate-700">
                  <div className="text-slate-400 text-[10px]">10%</div>
                  <div className="font-bold text-white mt-0.5">Код «9»</div>
                </div>
                <div className="p-2 bg-slate-800 rounded border border-slate-700">
                  <div className="text-slate-400 text-[10px]">15%</div>
                  <div className="font-bold text-white mt-0.5">Код «5»</div>
                </div>
                <div className="p-2 bg-amber-500/20 rounded border border-amber-500/40">
                  <div className="text-amber-300 text-[10px]">20%</div>
                  <div className="font-bold text-amber-300 mt-0.5">Код «8»</div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-400">
                При возврате кассир вводит номер или смотрит на 2-ю цифру после второго тире
              </span>
              <button
                type="button"
                onClick={onSwitchToReturn}
                className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-900 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                Проверить возврат
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
        <div className="max-w-3xl mb-6">
          <div className="text-xs font-medium text-slate-500 mb-1">
            Обзор аналогов на рынке СНГ (Платные и бесплатные ERP / Учётные системы)
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Почему стандартные программы (МойСклад, 1С, CloudShop) не закрывают эту задачу «из коробки»?
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Мы проанализировали популярные товароучётные системы, которые используют строительные магазины. Во всех коробочных системах скидка либо <strong>печатается открытым текстом в накладной</strong> (и тогда заказчик ремонта видит, что сантехник забрал 20% себе — возникает скандал и прораб уходит в другой магазин), либо не фиксируется вообще (и тогда магазин теряет 20% при возврате товара).
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Система / Решение</th>
                <th className="py-3 px-4">Стоимость</th>
                <th className="py-3 px-4">Голосовая диктовка в Telegram</th>
                <th className="py-3 px-4">Скрытая скидка прораба в № документа</th>
                <th className="py-3 px-4">Прайс из простой Excel / Google Таблицы</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs lg:text-sm">
              <tr className="bg-emerald-50/40">
                <td className="py-3.5 px-4 font-semibold text-slate-900">
                  Наше решение (Telegram-бот + Excel/Sheets)
                </td>
                <td className="py-3.5 px-4 font-mono font-semibold text-emerald-700 tabular-nums">
                  0 ₽ / мес
                </td>
                <td className="py-3.5 px-4 text-emerald-700 font-medium">
                  Да (понимает «труба 50 4м, развод угловой 8 шт»)
                </td>
                <td className="py-3.5 px-4 text-emerald-700 font-medium">
                  Да (в бланке 100% розница, скидка зашита в номер)
                </td>
                <td className="py-3.5 px-4 text-emerald-700 font-medium">
                  Да (редактирование в 1 клик без обучения)
                </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-slate-900">
                  МойСклад (Облачная ERP)
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                  от 2 400 ₽ / мес
                </td>
                <td className="py-3.5 px-4 text-slate-500">
                  Нет (ручной поиск по каталогу с ПК или ТСД)
                </td>
                <td className="py-3.5 px-4 text-slate-500">
                  Нет (скидка меняет цену в печатной форме)
                </td>
                <td className="py-3.5 px-4 text-slate-600">
                  Сложный мастер импорта с маппингом полей
                </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-slate-900">
                  1С:УНФ / 1С:Розница
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                  от 1 900 ₽ / мес + доработки
                </td>
                <td className="py-3.5 px-4 text-slate-500">
                  Нет (требуется писать внешнюю интеграцию)
                </td>
                <td className="py-3.5 px-4 text-slate-600">
                  Только через платную разработку внешней печатной формы (.epf)
                </td>
                <td className="py-3.5 px-4 text-slate-500">
                  Тяжёлая обработка загрузки номенклатуры
                </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-slate-900">
                  CloudShop / Бизнес.Ру Касса
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                  от 1 200 ₽ / мес
                </td>
                <td className="py-3.5 px-4 text-slate-500">
                  Нет
                </td>
                <td className="py-3.5 px-4 text-slate-500">
                  Нет (только стандартные дисконтные карты)
                </td>
                <td className="py-3.5 px-4 text-slate-600">
                  Импорт CSV через личный кабинет
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
        <div className="mb-6">
          <div className="text-xs font-medium text-slate-500 mb-1">
            Потенциал развития проекта · Дополнительные модули для продажи клиенту
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Куда можно развивать эту систему после показа MVP?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-2">
              <span>ЭТАП 01 · БАЗОВЫЙ MVP</span>
              <Layers className="w-4 h-4 text-slate-700" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              Голосовой сборщик + Шифр скидки + Прайс в Таблице
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-600 leading-relaxed">
              <li>• Распознавание голосовых сообщений менеджера с синонимами («развод угловой», «полтинник», «американка»).</li>
              <li>• Кнопки скрытой скидки 5 / 10 / 15 / 20% перед отправкой на печать.</li>
              <li>• Два чека в одном: полная розничная накладная на бумаге для клиента + расчёт реальной оплаты в экране менеджера.</li>
              <li>• База товаров в бесплатной Google Таблице или Excel.</li>
            </ul>
          </div>

          <div className="p-5 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-2">
              <span>ЭТАП 02 · УЧЁТ ПРОРАБОВ И ВОЗВРАТОВ</span>
              <Database className="w-4 h-4 text-slate-700" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              База сантехников, копилка откатов и QR-код возврата
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-600 leading-relaxed">
              <li>• <strong>Сценарий «Покупатель пришёл сам от сантехника»:</strong> Хозяин квартиры сам платит в кассу 100% по накладной, а 20% автоматически записываются на бонусный баланс сантехника Петрова (выплата раз в неделю).</li>
              <li>• <strong>Мини QR-код в углу накладной:</strong> Для клиента выглядит как обычный технический код, а при наведении камеры телефона кассира сразу открывает состав накладной и считает возврат с учётом скидки.</li>
            </ul>
          </div>

          <div className="p-5 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-2">
              <span>ЭТАП 03 · СКЛАД И ФОТО-СМЕТЫ</span>
              <TrendingUp className="w-4 h-4 text-slate-700" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              Распознавание рукописных списков и остатки склада
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-600 leading-relaxed">
              <li>• <strong>Фото списка на картонке:</strong> Сантехник присылает в WhatsApp/Telegram фото мятого листка со списком труб и фитингов — бот сам распознаёт почерк и собирает черновик накладной.</li>
              <li>• <strong>Контроль минимальных остатков:</strong> Когда ходовой позиции (например, отвод Ø50) остаётся меньше 30 штук, бот утром присылает владельцу список закупа для поставщика.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};
