import fs from 'fs';
import path from 'path';
import { INITIAL_CATALOG } from '../data/initialCatalog';
import {
  parseDictationToInvoiceItems,
  generateEncryptedInvoiceNumber,
  decodeInvoiceNumber,
  formatCurrency,
  TABLE_SUBSTITUTION_ENCODE,
} from '../utils/cipherAndParser';
import { DiscountPercent, CatalogItem } from '../types';
import { fetchGoogleSheetCatalog, extractSheetId } from './googleSheets';
import { geminiVoiceTranscriber } from './geminiVoiceTranscriber';
import { debtorsService } from './debtorsService';
import { PrintableInvoiceData } from './invoicePrintTemplate';

export interface DraftOrder {
  items: ReturnType<typeof parseDictationToInvoiceItems>;
  seqNumber: number;
  discountPercent: DiscountPercent;
  createdAt: string;
  isAppending?: boolean;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DRAFTS_FILE = path.join(DATA_DIR, 'telegramDrafts.json');
const INVOICES_FILE = path.join(DATA_DIR, 'invoicesStore.json');

export class TelegramBotService {
  private token: string | null = null;
  private botInfo: { username: string; firstName: string } | null = null;
  private isPolling = false;
  private pollOffset = 0;
  private draftOrders = new Map<number, DraftOrder>();
  private userChatStates = new Map<number, { mode: 'normal' | 'editing_text' | 'awaiting_debt_details'; debtorId?: string }>();
  private seqCounter = 425;
  private catalog: CatalogItem[] = [...INITIAL_CATALOG];
  private currentSheetUrlOrId: string | null = null;
  private invoicesStore = new Map<string, PrintableInvoiceData>();
  private serverHostUrl = 'http://localhost:3000';

  constructor() {
    this.loadPersistedData();
  }

  private loadPersistedData() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DRAFTS_FILE)) {
        const raw = fs.readFileSync(DRAFTS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.chatId && item.draft) {
              this.draftOrders.set(Number(item.chatId), item.draft);
              if (item.draft.seqNumber >= this.seqCounter) {
                this.seqCounter = item.draft.seqNumber + 1;
              }
            }
          }
        }
      }

      if (fs.existsSync(INVOICES_FILE)) {
        const raw = fs.readFileSync(INVOICES_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [key, val] of Object.entries(parsed)) {
            this.invoicesStore.set(key, val as PrintableInvoiceData);
          }
        }
      }
    } catch (e) {
      console.warn('Error loading persisted drafts/invoices:', e);
    }
  }

  private savePersistedDrafts() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const arr = Array.from(this.draftOrders.entries()).map(([chatId, draft]) => ({
        chatId,
        draft,
      }));
      fs.writeFileSync(DRAFTS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Error saving drafts to disk:', e);
    }
  }

  private savePersistedInvoices() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const obj: Record<string, PrintableInvoiceData> = {};
      for (const [key, val] of this.invoicesStore.entries()) {
        obj[key] = val;
      }
      fs.writeFileSync(INVOICES_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Error saving invoicesStore to disk:', e);
    }
  }

  public getDraft(chatId: number): DraftOrder | undefined {
    return this.draftOrders.get(Number(chatId));
  }

  public saveDraft(chatId: number, draft: DraftOrder): void {
    this.draftOrders.set(Number(chatId), draft);
    this.savePersistedDrafts();
  }

  public deleteDraft(chatId: number): void {
    this.draftOrders.delete(Number(chatId));
    this.savePersistedDrafts();
  }

  public setHostUrl(hostUrl: string) {
    this.serverHostUrl = hostUrl.replace(/\/$/, '');
  }

  public getStatus() {
    return {
      connected: !!this.token && !!this.botInfo,
      isPolling: this.isPolling,
      botUsername: this.botInfo?.username || null,
      botFirstName: this.botInfo?.firstName || null,
      catalogItemsCount: this.catalog.length,
      currentSheetId: this.currentSheetUrlOrId ? extractSheetId(this.currentSheetUrlOrId) : null,
    };
  }

  public getCatalog(): CatalogItem[] {
    return this.catalog;
  }

  public getPrintableInvoice(invoiceNumberOrSeq: string): PrintableInvoiceData | null {
    // 1. Direct match in saved invoices
    if (this.invoicesStore.has(invoiceNumberOrSeq)) {
      return this.invoicesStore.get(invoiceNumberOrSeq)!;
    }

    // 2. Search in draft orders
    for (const draft of this.draftOrders.values()) {
      const cipher = generateEncryptedInvoiceNumber(
        draft.seqNumber,
        draft.discountPercent,
        'hidden_contractor',
        'table_substitution'
      );
      if (cipher.invoiceNumber === invoiceNumberOrSeq || String(draft.seqNumber) === invoiceNumberOrSeq) {
        const factor = (100 - (draft.discountPercent || 0)) / 100;
        const items = draft.items.map((it) => ({
          name: it.name,
          unit: it.unit,
          quantity: it.quantity,
          price: Math.round(it.retailPrice * factor),
        }));
        const total = items.reduce((s, it) => s + it.quantity * it.price, 0);
        return {
          invoiceNumber: cipher.invoiceNumber,
          date: new Date().toLocaleDateString('ru-RU'),
          managerName: 'Алексеев И. В.',
          items,
          totalSum: total,
        };
      }
    }

    return null;
  }

  public async syncGoogleSheets(sheetUrlOrId: string) {
    const result = await fetchGoogleSheetCatalog(sheetUrlOrId);
    if (result.success && result.items) {
      this.catalog = result.items;
      this.currentSheetUrlOrId = sheetUrlOrId;
      return { success: true, count: result.items.length };
    }
    return { success: false, error: result.error };
  }

  public async setToken(token: string): Promise<{ success: boolean; botName?: string; error?: string }> {
    const cleanToken = token.trim();
    if (!cleanToken) {
      return { success: false, error: 'Токен не может быть пустым' };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      const data = await res.json();
      if (!data.ok) {
        return { success: false, error: data.description || 'Неверный токен Telegram-бота' };
      }

      this.token = cleanToken;
      this.botInfo = {
        username: data.result.username,
        firstName: data.result.first_name,
      };

      // Очищаем webhook перед polling, чтобы исключить ошибку 409 Conflict
      await this.telegramCall('deleteWebhook', { drop_pending_updates: false });

      // Устанавливаем ровно те 4 команды, которые запросил пользователь
      await this.setupBotMenuCommands();

      this.startPolling();
      return { success: true, botName: `@${this.botInfo.username}` };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Ошибка соединения с Telegram API' };
    }
  }

  private async setupBotMenuCommands() {
    // В меню Telegram-бота ровно 4 команды по ТЗ:
    // 1. Старт (перезапустить бота)
    // 2. Новая накладная
    // 3. Возврат
    // 4. Должники
    await this.telegramCall('setMyCommands', {
      commands: [
        { command: 'start', description: 'Старт (перезапустить бота)' },
        { command: 'new', description: 'Новая накладная' },
        { command: 'vozvrat', description: 'Возврат' },
        { command: 'debtors', description: 'Должники' },
      ],
    });
  }

  private async telegramCall(method: string, payload: any) {
    if (!this.token) return null;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        console.error(`Telegram API error on ${method}:`, data);
      }
      return data;
    } catch (e) {
      console.error(`Telegram API network error on ${method}:`, e);
      return null;
    }
  }

  private startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollLoop();
  }

  public stopPolling() {
    this.isPolling = false;
  }

  private async pollLoop() {
    console.log(`Telegram Bot pollLoop started for @${this.botInfo?.username}`);
    while (this.isPolling && this.token) {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.pollOffset}&timeout=20`
        );
        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.pollOffset = update.update_id + 1;
            try {
              await this.handleUpdate(update);
            } catch (err) {
              console.error('Error handling Telegram update:', err);
            }
          }
        } else {
          if (!data.ok) {
            console.warn('getUpdates returned non-ok:', data);
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (e) {
        console.error('Network error during pollLoop getUpdates:', e);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    console.log(`Telegram Bot pollLoop stopped.`);
  }

  private async handleUpdate(update: any) {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  private async handleMessage(msg: any) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const userState = this.userChatStates.get(chatId) || { mode: 'normal' };

    // 1. Команда /start (Старт — перезапустить бота)
    if (text.startsWith('/start')) {
      this.deleteDraft(chatId);
      this.userChatStates.delete(chatId);

      const welcomeText =
        `🏗 <b>Строительный магазин «СтройКомплект» (Казахстан)</b>\n\n` +
        `Бот готов к работе. Все товары берутся <b>только из таблицы Excel</b>, цены в <b>тенге (₸)</b>.\n\n` +
        `📋 <b>Доступные команды в меню:</b>\n` +
        `• <b>/new</b> — Начать новую накладную\n` +
        `• <b>/vozvrat</b> — Расшифровка скидки при возврате товара\n` +
        `• <b>/debtors</b> — База должников и контроль лимита 200 000 ₸\n` +
        `• <b>/start</b> — Перезапустить бота\n\n` +
        `🎙 <b>Как составить накладную:</b>\n` +
        `Просто <b>надиктуйте голосовым сообщением</b> или напишите товары текстом, например:\n` +
        `<i>«Муфта диаметр 50, 4 штуки. Труба 50, 6 м. Тройник 50, 2 шт»</i>`;

      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text: welcomeText,
        parse_mode: 'HTML',
      });
      return;
    }

    // 2. Команда /new (Новая накладная)
    if (text.startsWith('/new')) {
      this.deleteDraft(chatId);
      this.userChatStates.delete(chatId);

      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text:
          `📄 <b>Новая накладная открыта!</b>\n\n` +
          `Надиктуйте голосовое сообщение со списком товаров или отправьте текст:\n` +
          `<i>«Муфта 50 4 шт, Труба 50 6м»</i>`,
        parse_mode: 'HTML',
      });
      return;
    }

    // 3. Команда /vozvrat (Возврат)
    if (text.startsWith('/vozvrat') || text.startsWith('/return')) {
      const parts = text.split(/\s+/);
      const numberToDecode = parts[1] || '';
      if (!numberToDecode) {
        await this.telegramCall('sendMessage', {
          chat_id: chatId,
          text: `⚠️ Укажите номер накладной для расшифровки возврата:\nПример: <code>/vozvrat РН-0421-78-34</code>`,
          parse_mode: 'HTML',
        });
        return;
      }

      const decoded = decodeInvoiceNumber(numberToDecode);
      const returnText =
        `🔍 <b>Расшифровка накладной ${escapeHtml(decoded.rawInput)}</b>\n\n` +
        `• Скрытая скидка сантехника: <b>${decoded.discountPercent}%</b>\n` +
        `• Коэффициент возврата: <b>${(1 - decoded.discountPercent / 100).toFixed(2)}</b>\n\n` +
        `💡 <i>Правило кассира: если по бумаге возврат товара на 10 000 ₸, фактически вернуть клиенту: <b>${formatCurrency(
          Math.round(10000 * (1 - decoded.discountPercent / 100))
        )} ₸</b>!</i>`;

      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text: returnText,
        parse_mode: 'HTML',
      });
      return;
    }

    // 4. Команда /debtors (Должники)
    if (text.startsWith('/debtors') || text.startsWith('/dolgi') || text.startsWith('/dolg')) {
      const parts = text.split(/\s+/);
      const query = parts.slice(1).join(' ').trim();
      const debtors = debtorsService.findByQuery(query);

      if (debtors.length === 0) {
        await this.telegramCall('sendMessage', {
          chat_id: chatId,
          text: `👥 Должников не найдено.`,
          parse_mode: 'HTML',
        });
        return;
      }

      let debtorsMsg = `👥 <b>Список должников (Лист «Должники»):</b>\n\n`;
      debtors.forEach((d, idx) => {
        const statusBadge = d.totalDebt > 200000 ? '⛔️ ПРЕВЫШЕН ЛИМИТ' : '🟢 В норме';
        debtorsMsg +=
          `<b>${idx + 1}. ${escapeHtml(d.fullName)}</b>\n` +
          `   📞 ${escapeHtml(d.phone)} | 🆔 Уд.личности: ${escapeHtml(d.idCardNumber)}\n` +
          `   📍 ${escapeHtml(d.address)}\n` +
          `   💰 Сумма долга: <b>${formatCurrency(d.totalDebt)} ₸</b> (${statusBadge})\n\n`;
      });

      debtorsMsg += `<i>Лимит кредита: 200 000 ₸. Если сумма превышает 200 000 ₸, отпуск товаров только за наличку!</i>`;

      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text: debtorsMsg,
        parse_mode: 'HTML',
      });
      return;
    }

    // 5. Обработка голосового сообщения / аудиофайла
    let textToParse = text;
    const isAudioMsg = !!(msg.voice || msg.audio || msg.video_note);

    if (isAudioMsg) {
      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text: `🎧 <i>Слушаю голосовое сообщение менеджера...</i>`,
        parse_mode: 'HTML',
      });

      const fileId = msg.voice?.file_id || msg.audio?.file_id || msg.video_note?.file_id;
      const mimeType = msg.voice?.mime_type || msg.audio?.mime_type || (msg.video_note ? 'video/mp4' : 'audio/ogg');

      const transcribed = await this.transcribeVoice(fileId, mimeType);
      if (transcribed && transcribed.text) {
        textToParse = transcribed.text;
        await this.telegramCall('sendMessage', {
          chat_id: chatId,
          text: `🎙 <b>Распознано:</b> <i>«${escapeHtml(transcribed.text)}»</i>`,
          parse_mode: 'HTML',
        });
      } else {
        await this.telegramCall('sendMessage', {
          chat_id: chatId,
          text: `⚠️ Не удалось распознать речь. Попробуйте наговорить ещё раз или отправьте текстом.`,
          parse_mode: 'HTML',
        });
        return;
      }
    }

    if (!textToParse) return;

    // Режим ожидания деталей долга
    if (userState.mode === 'awaiting_debt_details') {
      const activeDraft = this.getDraft(chatId);
      const { totalSum } = activeDraft ? this.getRecalculatedDraftTotals(activeDraft) : { totalSum: 0 };
      const cipher = activeDraft
        ? generateEncryptedInvoiceNumber(activeDraft.seqNumber, activeDraft.discountPercent, 'hidden_contractor', 'table_substitution')
        : { invoiceNumber: `РН-${this.seqCounter}` };

      const res = debtorsService.addOrUpdateDebt({
        debtorId: userState.debtorId,
        fullName: textToParse,
        invoiceNumber: cipher.invoiceNumber,
        invoiceTotal: totalSum,
        paidCash: 0,
        debtAdded: totalSum,
      });

      this.userChatStates.set(chatId, { mode: 'normal' });
      this.deleteDraft(chatId);

      let replyMsg =
        `✅ <b>Долг зафиксирован в Листе 2 «Должники»!</b>\n\n` +
        `Клиент: <b>${escapeHtml(res.debtor.fullName)}</b>\n` +
        `Накладная: <b>${cipher.invoiceNumber}</b> на сумму: <b>${formatCurrency(totalSum)} ₸</b>\n` +
        `Итоговый долг клиента: <b>${formatCurrency(res.debtor.totalDebt)} ₸</b>\n\n`;

      if (res.limitExceeded) {
        replyMsg +=
          `⛔️ <b>ВНИМАНИЕ МЕНЕДЖЕРУ: У КЛИЕНТА ПРЕВЫШЕН ЛИМИТ!</b>\n` +
          `Сумма долга превысила 200 000 ₸! <b>Требуйте полного расчёта, больше в долг не давать! Только за наличку!</b>`;
      } else {
        replyMsg += `🟢 Лимит в норме (до 200 000 ₸ осталось: ${formatCurrency(200000 - res.debtor.totalDebt)} ₸).`;
      }

      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text: replyMsg,
        parse_mode: 'HTML',
      });
      return;
    }

    // Режим редактирования текста накладной
    if (userState.mode === 'editing_text') {
      this.userChatStates.set(chatId, { mode: 'normal' });
      const currentDraft = this.getDraft(chatId);

      const newlyParsed = await this.parseItemsFromText(textToParse);
      if (newlyParsed.length > 0 && currentDraft) {
        currentDraft.items = newlyParsed;
        this.saveDraft(chatId, currentDraft);
        await this.telegramCall('sendMessage', {
          chat_id: chatId,
          text: `✏️ <b>Текст накладной успешно обновлён!</b>`,
          parse_mode: 'HTML',
        });
        await this.sendInvoicePreviewMessage(chatId, currentDraft);
        return;
      }
    }

    // Обычный режим / режим добавления товаров ("Продолжить накладную")
    const incomingItems = await this.parseItemsFromText(textToParse);

    if (incomingItems.length === 0) {
      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text:
          `⚠️ Товар не найден в таблице Excel по фразе: <i>«${escapeHtml(textToParse)}»</i>.\n\n` +
          `Мы берём товары <b>только из вашей таблицы</b> и не выдумываем цены.\n` +
          `Вы можете ввести товар вручную или надиктовать другой.`,
        parse_mode: 'HTML',
      });
      return;
    }

    let draft = this.getDraft(chatId);

    // Если накладная уже начата и пользователь нажал "Продолжить накладную"
    if (draft && draft.isAppending) {
      draft.items = [...draft.items, ...incomingItems];
      draft.isAppending = false;
      this.saveDraft(chatId, draft);
      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text: `➕ <b>Добавлено позиций: ${incomingItems.length} шт. в текущую накладную!</b>`,
        parse_mode: 'HTML',
      });
    } else {
      // Новая накладная с исходными базовыми ценами (0% скидки)
      draft = {
        items: incomingItems,
        seqNumber: this.seqCounter++,
        discountPercent: 0,
        createdAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      };
      this.saveDraft(chatId, draft);
    }

    await this.sendInvoicePreviewMessage(chatId, draft);
  }

  private async parseItemsFromText(text: string) {
    let parsedItems = parseDictationToInvoiceItems(text, this.catalog);

    if (parsedItems.length === 0) {
      const smartMatches = await geminiVoiceTranscriber.smartParseItemsWithGemini(text, this.catalog);
      if (smartMatches.length > 0) {
        parsedItems = smartMatches.map((sm, index) => {
          const catItem = sm.catalogItemId ? this.catalog.find((c) => c.id === sm.catalogItemId) : undefined;
          return {
            id: `smart_${Date.now()}_${index}`,
            catalogItemId: catItem?.id || sm.catalogItemId || '',
            sku: catItem?.sku || '',
            name: sm.name || catItem?.name || text,
            quantity: sm.quantity || 1,
            unit: sm.unit || catItem?.unit || 'шт',
            retailPrice: sm.price || catItem?.price || 0,
            rawVoicePhrase: text,
            matchConfidence: sm.isNotFound ? 0 : 95,
            isNotFound: sm.isNotFound,
          };
        });
      }
    }

    return parsedItems;
  }

  private getRecalculatedDraftTotals(draft: DraftOrder) {
    const factor = (100 - (draft.discountPercent || 0)) / 100;
    const items = draft.items.map((it) => {
      const unitPrice = it.isNotFound ? 0 : Math.round(it.retailPrice * factor);
      return {
        ...it,
        recalculatedPrice: unitPrice,
        recalculatedSum: it.quantity * unitPrice,
      };
    });
    const totalSum = items.reduce((s, it) => s + it.recalculatedSum, 0);
    return { items, totalSum };
  }

  private async sendInvoicePreviewMessage(chatId: number, draft: DraftOrder, messageIdToEdit?: number) {
    const { items: recalculatedItems, totalSum } = this.getRecalculatedDraftTotals(draft);

    const cipher = generateEncryptedInvoiceNumber(
      draft.seqNumber,
      draft.discountPercent,
      'hidden_contractor',
      'table_substitution'
    );

    // Сохраняем для печати в браузере с уже пересчитанными ценами
    this.invoicesStore.set(cipher.invoiceNumber, {
      invoiceNumber: cipher.invoiceNumber,
      date: new Date().toLocaleDateString('ru-RU'),
      managerName: 'Алексеев И. В.',
      items: recalculatedItems.map((it) => ({
        name: it.name,
        unit: it.unit,
        quantity: it.quantity,
        price: it.recalculatedPrice,
      })),
      totalSum,
    });
    this.savePersistedInvoices();

    let linesText = '';
    const hasNotFound = draft.items.some((it) => it.isNotFound || it.retailPrice === 0);

    recalculatedItems.forEach((it, idx) => {
      const safeName = escapeHtml(it.name);
      const safeUnit = escapeHtml(it.unit);
      if (it.isNotFound) {
        linesText += `${idx + 1}. ⚠️ <b>${safeName}</b>\n   └ <i>(Не найден в таблице Excel. Цена: 0 ₸ — введите вручную)</i>\n`;
      } else if (it.isAmbiguous) {
        linesText += `${idx + 1}. <b>${safeName}</b>\n   └ ${it.quantity} ${safeUnit} × ${formatCurrency(it.recalculatedPrice)} ₸ = <b>${formatCurrency(it.recalculatedSum)} ₸</b>\n   └ <i>(Уточните тип: см. кнопки)</i>\n`;
      } else {
        linesText += `${idx + 1}. <b>${safeName}</b>\n   └ ${it.quantity} ${safeUnit} × ${formatCurrency(it.recalculatedPrice)} ₸ = <b>${formatCurrency(it.recalculatedSum)} ₸</b>\n`;
      }
    });

    // Строго по ТЗ: только номер, список товаров, разделитель и итого. Без лишних строк и надписей о скидках.
    let messageText =
      `📋 <b>НАКЛАДНАЯ № ${cipher.invoiceNumber}</b>\n\n` +
      `${linesText}\n` +
      `───────────────\n` +
      `<b>Итого:</b> <b>${formatCurrency(totalSum)} ₸</b>\n`;

    if (hasNotFound) {
      messageText += `\n⚠️ <i>Некоторые товары не найдены в таблице. Отредактируйте их перед печатью.</i>\n`;
    }

    // Кнопки по ТЗ:
    // Если скидка выбрана (> 0): кнопки 5%, 10%, 15%, 20% исчезают, вместо них «↩️ Отмена»
    // Если скидка не выбрана (0%): 4 кнопки в один ряд: 5%, 10%, 15%, 20%
    const inlineKeyboard: any[] = [];
    if (draft.discountPercent && draft.discountPercent > 0) {
      inlineKeyboard.push([
        { text: '↩️ Отмена', callback_data: 'disc_cancel' },
      ]);
    } else {
      inlineKeyboard.push([
        { text: '5%', callback_data: 'disc_5' },
        { text: '10%', callback_data: 'disc_10' },
        { text: '15%', callback_data: 'disc_15' },
        { text: '20%', callback_data: 'disc_20' },
      ]);
    }

    // Выбор неоднозначного товара (если есть)
    const ambiguousItem = draft.items.find((it) => it.isAmbiguous && it.candidates && it.candidates.length > 1);
    if (ambiguousItem && ambiguousItem.candidates) {
      inlineKeyboard.push([
        { text: `👇 Выберите вариант для «${ambiguousItem.rawVoicePhrase || 'позиции'}»:`, callback_data: 'noop' },
      ]);
      ambiguousItem.candidates.slice(0, 4).forEach((cand) => {
        inlineKeyboard.push([
          {
            text: `${cand.name.slice(0, 26)} (${cand.price} ₸)`,
            callback_data: `pick_${ambiguousItem.id.slice(-6)}_${cand.id}`,
          },
        ]);
      });
    }

    // Кнопка «Продолжить накладную»
    inlineKeyboard.push([
      { text: '➕ Продолжить накладную', callback_data: 'append_items' },
    ]);

    // Кнопки действий: Посмотреть/редактировать текст, Напечатать накладную
    inlineKeyboard.push([
      { text: '✏️ Посмотреть / Изменить текст', callback_data: 'edit_text' },
      { text: '🖨 Напечатать накладную', callback_data: 'do_print' },
    ]);

    // Кнопка «Принять оплату»
    inlineKeyboard.push([
      { text: '💳 Принять оплату', callback_data: 'accept_payment' },
    ]);

    if (messageIdToEdit) {
      const editRes = await this.telegramCall('editMessageText', {
        chat_id: chatId,
        message_id: messageIdToEdit,
        text: messageText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
      return editRes;
    } else {
      const sendRes = await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
      return sendRes;
    }
  }

  // Восстановление черновика из текста сообщения, если процесс был перезапущен
  private reconstructDraftFromMessageText(chatId: number, msgText: string): DraftOrder | null {
    if (!msgText || !msgText.includes('НАКЛАДНАЯ')) return null;

    try {
      const seqMatch = msgText.match(/РН-(\d{4})/);
      const seqNumber = seqMatch ? parseInt(seqMatch[1], 10) : this.seqCounter++;

      const items: ReturnType<typeof parseDictationToInvoiceItems> = [];
      const lines = msgText.split('\n');

      let currentName = '';
      for (const line of lines) {
        const itemHeaderMatch = line.match(/^\d+\.\s*(?:⚠️\s*)?([^\n\r]+)/);
        if (itemHeaderMatch) {
          currentName = itemHeaderMatch[1].trim();
          continue;
        }

        const cleanLine = line.replace(/[\u00A0\u202F]/g, ' ');
        const detailsMatch = cleanLine.match(/└\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Zа-яА-ЯёЁ.]+)\s*×\s*([\d\s]+)\s*₸/);
        if (detailsMatch && currentName) {
          const qty = parseFloat(detailsMatch[1].replace(',', '.'));
          const unit = detailsMatch[2].trim();
          const price = parseInt(detailsMatch[3].replace(/\s/g, ''), 10);

          const catalogItem = this.catalog.find(
            (c) => c.name.toLowerCase() === currentName.toLowerCase() || c.name.toLowerCase().includes(currentName.toLowerCase())
          );

          items.push({
            id: `rec_${Date.now()}_${items.length}`,
            catalogItemId: catalogItem?.id || '',
            sku: catalogItem?.sku || '',
            name: catalogItem?.name || currentName,
            quantity: qty,
            unit: catalogItem?.unit || unit,
            retailPrice: catalogItem?.price || price,
            rawVoicePhrase: currentName,
            matchConfidence: 90,
            isNotFound: false,
          });
          currentName = '';
        }
      }

      if (items.length > 0) {
        const draft: DraftOrder = {
          items,
          seqNumber,
          discountPercent: 0,
          createdAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        };
        this.saveDraft(chatId, draft);
        return draft;
      }
    } catch (e) {
      console.warn('Error reconstructing draft from message text:', e);
    }

    return null;
  }

  private async handleCallbackQuery(cb: any) {
    const chatId = Number(cb.message?.chat?.id ?? cb.from?.id);
    const messageId = cb.message?.message_id;
    const data = cb.data;

    if (!chatId) {
      await this.telegramCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: 'Ошибка чата',
      });
      return;
    }

    if (data === 'noop') {
      await this.telegramCall('answerCallbackQuery', { callback_query_id: cb.id });
      return;
    }

    // Ищем черновик в памяти/на диске или восстанавливаем прямо из текста накладной
    let draft: DraftOrder | undefined = this.getDraft(chatId);
    if (!draft && cb.message?.text) {
      draft = this.reconstructDraftFromMessageText(chatId, cb.message.text) || undefined;
    }

    if (!draft) {
      await this.telegramCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: '⚠️ Накладная не найдена. Надиктуйте товары заново или начните новую через /new',
        show_alert: true,
      });
      return;
    }

    // 1. Выбор варианта неоднозначного товара (pick_)
    if (data.startsWith('pick_')) {
      const parts = data.split('_');
      const candId = parts.slice(2).join('_');
      const candItem = this.catalog.find((c) => c.id === candId);
      if (candItem) {
        const itemToUpdate = draft.items.find((it) => it.isAmbiguous);
        if (itemToUpdate) {
          itemToUpdate.catalogItemId = candItem.id;
          itemToUpdate.sku = candItem.sku;
          itemToUpdate.name = candItem.name;
          itemToUpdate.retailPrice = candItem.price;
          itemToUpdate.unit = candItem.unit;
          itemToUpdate.isAmbiguous = false;
        }
        this.saveDraft(chatId, draft);
        await this.telegramCall('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: `Выбрано: ${candItem.name.slice(0, 24)}`,
        });
        await this.sendInvoicePreviewMessage(chatId, draft, messageId);
        return;
      }
    }

    // 2. Кнопки скидок: 5%, 10%, 15%, 20% или Отмена (disc_)
    if (data.startsWith('disc_')) {
      const val = data.replace('disc_', '');
      let notifyText = '';
      if (val === 'cancel') {
        draft.discountPercent = 0;
        notifyText = '↩️ Скидка отменена. Исходные цены возвращены.';
      } else {
        const pct = Number(val) as DiscountPercent;
        draft.discountPercent = pct;
        notifyText = `✅ Применена скидка ${pct}%`;
      }
      this.saveDraft(chatId, draft);

      // Мгновенный отклик с уведомлением Telegram
      await this.telegramCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: notifyText,
      });

      // Пересчитываем цены и обновляем накладную на её месте!
      if (messageId) {
        const editRes = await this.sendInvoicePreviewMessage(chatId, draft, messageId);
        if (!editRes || !editRes.ok) {
          // Если editMessageText не прошёл, отправляем свежее сообщение
          await this.sendInvoicePreviewMessage(chatId, draft);
        }
      } else {
        await this.sendInvoicePreviewMessage(chatId, draft);
      }
      return;
    }

    // 3. Кнопка «Продолжить накладную» (append_items)
    if (data === 'append_items') {
      draft.isAppending = true;
      this.saveDraft(chatId, draft);

      await this.telegramCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: '➕ Режим продолжения накладной включён',
      });

      const cipher = generateEncryptedInvoiceNumber(
        draft.seqNumber,
        draft.discountPercent,
        'hidden_contractor',
        'table_substitution'
      );
      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text:
          `🎙 <b>Накладная № ${cipher.invoiceNumber} продолжается!</b>\n\n` +
          `Надиктуйте новые товары голосовым сообщением или отправьте текстом — они будут добавлены в эту же накладную:`,
        parse_mode: 'HTML',
      });
      return;
    }

    // 4. Кнопка «Посмотреть / Изменить текст» (edit_text)
    if (data === 'edit_text') {
      this.userChatStates.set(chatId, { mode: 'editing_text' });

      await this.telegramCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: '✏️ Режим редактирования текста',
      });

      const cipher = generateEncryptedInvoiceNumber(
        draft.seqNumber,
        draft.discountPercent,
        'hidden_contractor',
        'table_substitution'
      );

      let editableText = '';
      draft.items.forEach((it) => {
        editableText += `${it.name}, ${it.quantity} ${it.unit}\n`;
      });

      const editInstruction =
        `✏️ <b>Редактирование накладной № ${cipher.invoiceNumber}:</b>\n\n` +
        `Скопируйте текст ниже, внесите нужные исправления и <b>отправьте ответным сообщением</b> сюда в чат:\n\n` +
        `<code>${escapeHtml(editableText.trim())}</code>\n\n` +
        `<i>Бот сразу применит обновлённый список к накладной! Либо можете надиктовать голосом.</i>`;

      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text: editInstruction,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '↩️ Отмена и назад к накладной', callback_data: 'cancel_edit' }],
          ],
        },
      });
      return;
    }

    // 5. Кнопка «Отмена редактирования» (cancel_edit)
    if (data === 'cancel_edit') {
      this.userChatStates.set(chatId, { mode: 'normal' });
      await this.telegramCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: 'Редактирование отменено',
      });
      await this.sendInvoicePreviewMessage(chatId, draft);
      return;
    }

    // 6. Кнопка «Напечатать накладную» (do_print)
    if (data === 'do_print') {
      await this.telegramCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: '🖨 Бланк подготовлен',
      });

      const cipher = generateEncryptedInvoiceNumber(
        draft.seqNumber,
        draft.discountPercent,
        'hidden_contractor',
        'table_substitution'
      );
      const { totalSum } = this.getRecalculatedDraftTotals(draft);

      const printUrl = `${this.serverHostUrl}/print/${cipher.invoiceNumber}?autoPrint=1`;

      const printConfirm =
        `🖨 <b>Бланк накладной № ${cipher.invoiceNumber} готов!</b>\n\n` +
        `• Сумма по накладной: <b>${formatCurrency(totalSum)} ₸</b>\n` +
        `• Позиций: <b>${draft.items.length} шт.</b>\n\n` +
        `Откройте бланк для распечатки на принтере или нажмите «Принять оплату»:`;

      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text: printConfirm,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📄 Открыть бланк в браузере', url: printUrl }],
            [{ text: '💳 Принять оплату', callback_data: 'accept_payment' }],
          ],
        },
      });
      return;
    }

    // 7. Кнопка «Принять оплату» (accept_payment)
    if (data === 'accept_payment') {
      await this.telegramCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: '💳 Приём оплаты',
      });

      const cipher = generateEncryptedInvoiceNumber(
        draft.seqNumber,
        draft.discountPercent,
        'hidden_contractor',
        'table_substitution'
      );
      const { totalSum } = this.getRecalculatedDraftTotals(draft);

      const payMenu =
        `💳 <b>Приём оплаты по накладной № ${cipher.invoiceNumber}</b>\n\n` +
        `Сумма к оплате: <b>${formatCurrency(totalSum)} ₸</b>\n\n` +
        `Выберите способ оплаты:`;

      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text: payMenu,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💵 Оплачено 100% (В кассу)', callback_data: 'pay_full_cash' }],
            [{ text: '📝 Записать в долг (Лист «Должники»)', callback_data: 'pay_debt_menu' }],
          ],
        },
      });
      return;
    }

    // 8. Кнопка «Оплачено 100% (В кассу)» (pay_full_cash)
    if (data === 'pay_full_cash') {
      await this.telegramCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: '💵 Оплата 100% зафиксирована',
      });

      const cipher = generateEncryptedInvoiceNumber(
        draft.seqNumber,
        draft.discountPercent,
        'hidden_contractor',
        'table_substitution'
      );
      const { totalSum } = this.getRecalculatedDraftTotals(draft);

      this.deleteDraft(chatId);

      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text:
          `✅ <b>Оплата принята полностью!</b>\n\n` +
          `Накладная № <b>${cipher.invoiceNumber}</b>\n` +
          `Внесено в кассу: <b>${formatCurrency(totalSum)} ₸</b> наличными/картой.\n` +
          `Сделка закрыта.`,
        parse_mode: 'HTML',
      });
      return;
    }

    // 9. Меню записи в долг (pay_debt_menu)
    if (data === 'pay_debt_menu') {
      await this.telegramCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: 'Выбор клиента из базы',
      });

      const debtors = debtorsService.getAll().slice(0, 4);

      const debtKb: any[] = debtors.map((d) => [
        {
          text: `👤 ${d.fullName.slice(0, 22)} (долг: ${formatCurrency(d.totalDebt)} ₸)`,
          callback_data: `pick_debtor_${d.id}`,
        },
      ]);

      debtKb.push([{ text: '➕ Ввести нового клиента', callback_data: 'new_debtor_prompt' }]);

      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text:
          `📝 <b>Запись в долг (Лист 2 «Должники»):</b>\n\n` +
          `Выберите постоянного клиента из базы или добавьте нового:`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: debtKb },
      });
      return;
    }

    // 10. Выбор конкретного должника из базы (pick_debtor_)
    if (data.startsWith('pick_debtor_')) {
      const debtorId = data.replace('pick_debtor_', '');
      const debtor = debtorsService.getById(debtorId);
      if (!debtor) {
        await this.telegramCall('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: 'Клиент не найден в базе',
        });
        return;
      }

      await this.telegramCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: `Выбран клиент: ${debtor.fullName.slice(0, 20)}`,
      });

      const cipher = generateEncryptedInvoiceNumber(
        draft.seqNumber,
        draft.discountPercent,
        'hidden_contractor',
        'table_substitution'
      );
      const { totalSum } = this.getRecalculatedDraftTotals(draft);

      const limitCheck = debtorsService.checkLimit(debtor.id, totalSum);

      if (limitCheck.limitExceeded) {
        const warning =
          `⛔️ <b>ВНИМАНИЕ МЕНЕДЖЕРУ: У КЛИЕНТА ПРЕВЫШЕН ЛИМИТ!</b>\n\n` +
          `Клиент: <b>${escapeHtml(debtor.fullName)}</b>\n` +
          `Текущий долг: <b>${formatCurrency(debtor.totalDebt)} ₸</b>\n` +
          `Накладная: <b>${formatCurrency(totalSum)} ₸</b>\n` +
          `Суммарный долг составил бы: <b>${formatCurrency(limitCheck.newTotalDebt)} ₸</b> (лимит: 200 000 ₸)!\n\n` +
          `🚨 <b>ТРЕБУЙТЕ ПОЛНОГО РАСЧЁТА! В долг не отпускать! Только за наличку!</b>`;

        await this.telegramCall('sendMessage', {
          chat_id: chatId,
          text: warning,
          parse_mode: 'HTML',
        });
        return;
      }

      // Лимит не превышен — приплюсовываем к долгу
      const res = debtorsService.addOrUpdateDebt({
        debtorId: debtor.id,
        fullName: debtor.fullName,
        invoiceNumber: cipher.invoiceNumber,
        invoiceTotal: totalSum,
        paidCash: 0,
        debtAdded: totalSum,
      });

      this.deleteDraft(chatId);

      const successMsg =
        `✅ <b>Сумма добавлена в долг клиента!</b>\n\n` +
        `Клиент: <b>${escapeHtml(res.debtor.fullName)}</b>\n` +
        `Накладная: <b>${cipher.invoiceNumber}</b> (+${formatCurrency(totalSum)} ₸)\n` +
        `Прежний долг: ${formatCurrency(debtor.totalDebt)} ₸\n` +
        `<b>Новая сумма долга: ${formatCurrency(res.debtor.totalDebt)} ₸</b>\n\n` +
        `Запись сохранена в Листе «Должники».`;

      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text: successMsg,
        parse_mode: 'HTML',
      });
      return;
    }

    // 11. Запрос на ввод нового клиента (new_debtor_prompt)
    if (data === 'new_debtor_prompt') {
      this.userChatStates.set(chatId, { mode: 'awaiting_debt_details' });

      await this.telegramCall('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: 'Введите данные клиента',
      });

      await this.telegramCall('sendMessage', {
        chat_id: chatId,
        text:
          `👤 <b>Добавление нового должника:</b>\n\n` +
          `Отправьте сообщение с ФИО, телефоном и удостоверением клиента, например:\n` +
          `<i>«Смагулов Кайрат, +7 705 123-45-67, Уд. 049182391, мкр. Самал 12»</i>`,
        parse_mode: 'HTML',
      });
      return;
    }
  }

  private async transcribeVoice(fileId: string, mimeType: string): Promise<{ text: string } | null> {
    if (!this.token || !fileId) return null;

    try {
      const getFileRes = await fetch(`https://api.telegram.org/bot${this.token}/getFile?file_id=${fileId}`);
      const fileData = await getFileRes.json();
      if (!fileData.ok || !fileData.result?.file_path) {
        console.error('Failed to get file from Telegram:', fileData);
        return null;
      }

      const filePath = fileData.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${this.token}/${filePath}`;

      const audioRes = await fetch(downloadUrl);
      const audioArrayBuffer = await audioRes.arrayBuffer();
      const audioBuffer = Buffer.from(audioArrayBuffer);

      const transcriberResult = await geminiVoiceTranscriber.transcribeAudioBuffer(
        audioBuffer,
        mimeType,
        this.catalog
      );

      if (transcriberResult.success && transcriberResult.text) {
        return { text: transcriberResult.text };
      }

      return null;
    } catch (e) {
      console.error('Error during voice transcription:', e);
      return null;
    }
  }
}

export const telegramBot = new TelegramBotService();
