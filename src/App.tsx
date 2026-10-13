/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  CatalogItem,
  CipherAlgorithm,
  DiscountMode,
  DiscountPercent,
  InvoiceLineItem,
  SavedInvoice,
  BotMessage,
} from './types';
import { INITIAL_CATALOG, VOICE_PRESETS } from './data/initialCatalog';
import {
  generateEncryptedInvoiceNumber,
  parseDictationToInvoiceItems,
  formatCurrency,
  TABLE_SUBSTITUTION_ENCODE,
} from './utils/cipherAndParser';
import { CatalogExcelManager } from './components/CatalogExcelManager';
import { ReturnCipherDecoder } from './components/ReturnCipherDecoder';
import { InvoiceJournalView } from './components/InvoiceJournalView';
import { ArchitectureAndMarketView } from './components/ArchitectureAndMarketView';
import { DebtorsManagerView } from './components/DebtorsManagerView';
import { AcceptPaymentModal } from './components/AcceptPaymentModal';
import {
  Mic,
  MicOff,
  Send,
  Printer,
  Plus,
  Trash2,
  Check,
  KeyRound,
  FileSpreadsheet,
  Volume2,
  Lock,
  Eye,
  HelpCircle,
  Upload,
  Loader2,
  Sparkles,
  Users,
  CreditCard,
  Wallet,
  ExternalLink,
} from 'lucide-react';

type ActiveTab = 'workspace' | 'debtors' | 'return_decoder' | 'catalog' | 'journal' | 'architecture';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workspace');
  const [catalog, setCatalog] = useState<CatalogItem[]>(INITIAL_CATALOG);

  const [seqCounter, setSeqCounter] = useState<number>(421);
  const [discountPercent, setDiscountPercent] = useState<DiscountPercent>(0);
  const [discountMode, setDiscountMode] = useState<DiscountMode>('hidden_contractor');
  const [cipherAlgorithm, setCipherAlgorithm] = useState<CipherAlgorithm>('table_substitution');
  const [contractorNote, setContractorNote] = useState<string>('Сантехник Сергей (бригада ЖК Южный)');
  const [managerName] = useState<string>('Алексеев И. В.');

  const [invoiceItems, setInvoiceItems] = useState<InvoiceLineItem[]>(() =>
    parseDictationToInvoiceItems(
      `Труба диаметр 50, 4 м.\nРазвод угловой, диаметр 50, 8 штук.\nТройник косой 50, 3 штуки.\nМуфта соединительная 50, 6 штук.`,
      INITIAL_CATALOG
    )
  );

  const [dictationInput, setDictationInput] = useState<string>(
    `Труба диаметр 50, 4 м.\nРазвод угловой, диаметр 50, 8 штук.`
  );
  const [appendMode, setAppendMode] = useState<'replace' | 'append'>('replace');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [quickAddCatalogId, setQuickAddCatalogId] = useState<string>(INITIAL_CATALOG[0].id);
  const [quickAddQty, setQuickAddQty] = useState<string>('2');
  const [printToast, setPrintToast] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentSuccessToast, setPaymentSuccessToast] = useState<string | null>(null);

  // Подключение реального Telegram-бота
  const [telegramStatus, setTelegramStatus] = useState<{
    connected: boolean;
    botUsername: string | null;
  }>({ connected: false, botUsername: null });
  const [tokenInput, setTokenInput] = useState('');
  const [tokenConnecting, setTokenConnecting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/telegram/status')
      .then((r) => r.json())
      .then((data) => {
        if (data) setTelegramStatus(data);
      })
      .catch(() => {});
  }, []);

  const handleConnectTelegramBot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tokenInput.trim()) return;
    setTokenConnecting(true);
    setTokenError(null);
    try {
      const res = await fetch('/api/telegram/set-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTelegramStatus({
          connected: true,
          botUsername: data.botName?.replace('@', '') || null,
        });
        setTokenInput('');
      } else {
        setTokenError(data.error || 'Ошибка подключения бота');
      }
    } catch (err: any) {
      setTokenError(err?.message || 'Ошибка соединения с сервером');
    } finally {
      setTokenConnecting(false);
    }
  };

  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>(() => {
    const sample1Items = parseDictationToInvoiceItems(
      `Труба диаметр 50, 4 м.\nРазвод угловой, диаметр 50, 8 штук.\nТройник косой 50, 3 штуки.\nМуфта соединительная 50, 6 штук.`,
      INITIAL_CATALOG
    );
    const retail1 = sample1Items.reduce((s, i) => s + i.quantity * i.retailPrice, 0);
    const paid1 = Math.round(retail1 * 0.8);

    const sample2Items = parseDictationToInvoiceItems(
      `Труба сшитый полиэтилен 16, 120 м.\nКоллекторная группа на 6 контуров, 1 компл.\nЕвроконус 16 на 3/4, 12 штук.`,
      INITIAL_CATALOG
    );
    const retail2 = sample2Items.reduce((s, i) => s + i.quantity * i.retailPrice, 0);
    const paid2 = Math.round(retail2 * 0.85);

    const sample3Items = parseDictationToInvoiceItems(
      `Кабель ВВГнг-LS 3х2.5, 50 м.\nАвтомат однополюсный 16А, 6 штук.\nПодрозетник глубокий по бетону, 20 штук.`,
      INITIAL_CATALOG
    );
    const retail3 = sample3Items.reduce((s, i) => s + i.quantity * i.retailPrice, 0);
    const paid3 = Math.round(retail3 * 0.9);

    return [
      {
        id: 'inv-418',
        seqNumber: 418,
        invoiceNumber: generateEncryptedInvoiceNumber(418, 20, 'hidden_contractor', 'table_substitution').invoiceNumber,
        createdAt: 'Сегодня, 10:15',
        managerName: 'Алексеев И. В.',
        contractorNote: 'Сантехник Сергей (скидка 20%)',
        discountPercent: 20,
        discountMode: 'hidden_contractor',
        cipherAlgorithm: 'table_substitution',
        items: sample1Items,
        retailTotal: retail1,
        actualPaidTotal: paid1,
        contractorMargin: retail1 - paid1,
        status: 'printed',
      },
      {
        id: 'inv-419',
        seqNumber: 419,
        invoiceNumber: generateEncryptedInvoiceNumber(419, 15, 'hidden_contractor', 'table_substitution').invoiceNumber,
        createdAt: 'Сегодня, 11:40',
        managerName: 'Алексеев И. В.',
        contractorNote: 'Монтажник отопления Виктор (скидка 15%)',
        discountPercent: 15,
        discountMode: 'hidden_contractor',
        cipherAlgorithm: 'table_substitution',
        items: sample2Items,
        retailTotal: retail2,
        actualPaidTotal: paid2,
        contractorMargin: retail2 - paid2,
        status: 'printed',
      },
      {
        id: 'inv-420',
        seqNumber: 420,
        invoiceNumber: generateEncryptedInvoiceNumber(420, 10, 'hidden_contractor', 'table_substitution').invoiceNumber,
        createdAt: 'Сегодня, 12:05',
        managerName: 'Алексеев И. В.',
        contractorNote: 'Электрик Андрей (скидка 10%)',
        discountPercent: 10,
        discountMode: 'hidden_contractor',
        cipherAlgorithm: 'table_substitution',
        items: sample3Items,
        retailTotal: retail3,
        actualPaidTotal: paid3,
        contractorMargin: retail3 - paid3,
        status: 'printed',
      },
    ];
  });

  const [botMessages, setBotMessages] = useState<BotMessage[]>([
    {
      id: 'msg-1',
      sender: 'manager',
      type: 'voice',
      text: 'Труба диаметр 50, 4 м. Развод угловой, диаметр 50, 8 штук. Тройник косой 50, 3 штуки. Муфта соединительная 50, 6 штук.',
      timestamp: '12:20',
      voiceDurationSec: 9,
    },
    {
      id: 'msg-2',
      sender: 'bot',
      type: 'invoice_preview',
      text: 'Распознано 4 позиции по прайс-листу. Выберите процент скидки перед отправкой накладной на печать:',
      timestamp: '12:20',
      parsedLines: [
        {
          phrase: 'Труба диаметр 50, 4 м',
          matchedName: 'Труба канализационная ПП диаметр 50 мм (серая)',
          quantity: 4,
          unit: 'м',
          price: 185,
          sum: 740,
        },
        {
          phrase: 'Развод угловой, диаметр 50, 8 штук',
          matchedName: 'Развод угловой (Отвод) канализационный ПП диаметр 50 мм, 87°',
          quantity: 8,
          unit: 'шт',
          price: 65,
          sum: 520,
        },
        {
          phrase: 'Тройник косой 50, 3 штуки',
          matchedName: 'Тройник канализационный косой ПП диаметр 50×50 мм, 45°',
          quantity: 3,
          unit: 'шт',
          price: 115,
          sum: 345,
        },
        {
          phrase: 'Муфта соединительная 50, 6 штук',
          matchedName: 'Муфта соединительная канализационная ПП диаметр 50 мм',
          quantity: 6,
          unit: 'шт',
          price: 55,
          sum: 330,
        },
      ],
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioInputFileRef = useRef<HTMLInputElement | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcribeNotice, setTranscribeNotice] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  const currentCipher = useMemo(
    () =>
      generateEncryptedInvoiceNumber(
        seqCounter,
        discountPercent,
        discountMode,
        cipherAlgorithm
      ),
    [seqCounter, discountPercent, discountMode, cipherAlgorithm]
  );

  const effectiveInvoiceTotal = useMemo(() => {
    const factor = (100 - (discountPercent || 0)) / 100;
    return invoiceItems.reduce(
      (sum, item) => sum + item.quantity * (item.isNotFound ? 0 : Math.round(item.retailPrice * factor)),
      0
    );
  }, [invoiceItems, discountPercent]);

  const retailTotal = useMemo(
    () =>
      invoiceItems.reduce(
        (sum, item) => sum + item.quantity * item.retailPrice,
        0
      ),
    [invoiceItems]
  );

  const actualPaidTotal = effectiveInvoiceTotal;

  const contractorMargin = retailTotal - actualPaidTotal;

  const handleSendDictation = (rawText?: string, isSimulatedVoice = true) => {
    const textToParse = (rawText ?? dictationInput).trim();
    if (!textToParse) return;

    const parsed = parseDictationToInvoiceItems(textToParse, catalog);
    const nowTime = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const nextItems =
      appendMode === 'append' ? [...invoiceItems, ...parsed] : parsed;

    if (parsed.length > 0) {
      setInvoiceItems(nextItems);
    }

    const userMsg: BotMessage = {
      id: `msg-u-${Date.now()}`,
      sender: 'manager',
      type: isSimulatedVoice ? 'voice' : 'text',
      text: textToParse,
      timestamp: nowTime,
      voiceDurationSec: Math.max(4, Math.min(18, Math.round(textToParse.length / 11))),
    };

    const botReply: BotMessage = {
      id: `msg-b-${Date.now() + 1}`,
      sender: 'bot',
      type: 'invoice_preview',
      text:
        parsed.length > 0
          ? `Найдено в прайсе позиций: ${parsed.length} (${appendMode === 'append' ? 'добавлено к текущей накладной' : 'сформирована новая накладная'}). Выберите кнопку скидки перед печатью:`
          : 'Не удалось точно сопоставить товар по прайс-листу. Уточните название или диаметр (например: «Труба диаметр 50, 4 м»).',
      timestamp: nowTime,
      parsedLines: parsed.map((p) => ({
        phrase: p.rawVoicePhrase || p.name,
        matchedName: p.name,
        quantity: p.quantity,
        unit: p.unit,
        price: p.retailPrice,
        sum: p.quantity * p.retailPrice,
      })),
    };

    setBotMessages((prev) => [...prev, userMsg, botReply]);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [botMessages.length]);

  const [printModalData, setPrintModalData] = useState<SavedInvoice | null>(null);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [copiedInvoiceText, setCopiedInvoiceText] = useState<boolean>(false);

  const sendAudioToGemini = async (audioBlob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setTranscribeNotice({
      type: 'info',
      text: '⚡ Отправка аудио в Gemini AI для высокоточного распознавания речи...',
    });

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1] || '';
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const audioBase64 = await base64Promise;

      const resp = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType }),
      });

      const data = await resp.json();
      if (data.success && data.text) {
        setDictationInput(data.text);
        setTranscribeNotice({
          type: 'success',
          text: `✓ Распознано нейросетью Gemini: «${data.text}»`,
        });
        handleSendDictation(data.text, true);
      } else {
        setTranscribeNotice({
          type: 'error',
          text: `Не удалось распознать: ${data.error || 'попробуйте ещё раз или напечатайте текст'}`,
        });
      }
    } catch (err: any) {
      setTranscribeNotice({
        type: 'error',
        text: `Ошибка связи: ${err.message || 'попробуйте снова'}`,
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAudioFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await sendAudioToGemini(file, file.type || 'audio/ogg');
    if (audioInputFileRef.current) {
      audioInputFileRef.current.value = '';
    }
  };

  const handleToggleMicrophone = async () => {
    setMicNotice(null);
    setTranscribeNotice(null);

    // Если сейчас идет запись
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
        setIsListening(false);
        return;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        setIsListening(false);
        return;
      }
      setIsListening(false);
      return;
    }

    // 1. Пробуем запись реального аудиопотока через MediaRecorder для отправки в Gemini
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const mimeType = MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
          ? 'audio/webm; codecs=opus'
          : MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
          ? 'audio/ogg; codecs=opus'
          : 'audio/webm';

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          if (audioChunksRef.current.length === 0) return;

          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          await sendAudioToGemini(audioBlob, mimeType);
        };

        recorder.start(250);
        setIsListening(true);
        setTranscribeNotice({
          type: 'info',
          text: '🎙 Идёт запись речи... Говорите список стройматериалов. Нажмите «Остановить запись» для расшифровки через Gemini.',
        });
        return;
      } catch (mediaErr: any) {
        console.warn('getUserMedia failed, falling back to Web Speech or sample:', mediaErr);
      }
    }

    // 2. Резервный вариант: браузерный Web Speech API
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript;
          if (transcript) {
            setDictationInput(transcript);
            handleSendDictation(transcript, true);
            setTranscribeNotice({
              type: 'success',
              text: `Распознано: «${transcript}»`,
            });
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
          setMicNotice(
            'Микрофон заблокирован настройками iframe/браузера. Загрузите аудиофайл кнопкой «Аудиофайл» или выберите готовый пример в 1 клик.'
          );
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch {
        // ignore
      }
    }

    setMicNotice(
      'Микрофон недоступен в песочнице iframe. Вы можете загрузить аудиофайл кнопкой «Аудиофайл» или нажать готовый пример голосовой диктовки.'
    );
  };

  const handleApplyDiscount = (pct: DiscountPercent) => {
    setDiscountPercent(pct);
    const factor = (100 - pct) / 100;
    setBotMessages((prev) =>
      prev.map((m) => {
        if (m.type === 'invoice_preview') {
          return {
            ...m,
            parsedLines: m.parsedLines?.map((pl) => {
              const catalogItem = catalog.find((c) => c.name === pl.matchedName);
              const basePrice = catalogItem?.price || pl.price;
              const newPrice = pct === 0 ? basePrice : Math.round(basePrice * factor);
              return {
                ...pl,
                price: newPrice,
                sum: pl.quantity * newPrice,
              };
            }),
          };
        }
        return m;
      })
    );
  };

  const handlePrintAndSaveInvoice = (triggerBrowserPrint = true) => {
    if (invoiceItems.length === 0) return;

    const nowTime = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const factor = (100 - (discountPercent || 0)) / 100;
    const recalculatedItems = invoiceItems.map((it) => ({
      ...it,
      retailPrice: it.isNotFound ? 0 : Math.round(it.retailPrice * factor),
    }));

    const newSaved: SavedInvoice = {
      id: `inv-${Date.now()}`,
      seqNumber: seqCounter,
      invoiceNumber: currentCipher.invoiceNumber,
      createdAt: `Сегодня, ${nowTime}`,
      managerName,
      contractorNote,
      discountPercent,
      discountMode,
      cipherAlgorithm,
      items: recalculatedItems,
      retailTotal: effectiveInvoiceTotal,
      actualPaidTotal: effectiveInvoiceTotal,
      contractorMargin,
      status: 'printed',
    };

    setSavedInvoices((prev) => [newSaved, ...prev]);
    setPrintModalData(newSaved);

    const confirmMsg: BotMessage = {
      id: `msg-p-${Date.now()}`,
      sender: 'bot',
      type: 'print_sent',
      text: `Накладная № ${currentCipher.invoiceNumber} отправлена в очередь печати на кассу. Сумма по накладной: ${formatCurrency(effectiveInvoiceTotal)} ₸.`,
      timestamp: nowTime,
      invoiceNumber: currentCipher.invoiceNumber,
      discountPercent,
      retailTotal: effectiveInvoiceTotal,
      actualPaidTotal: effectiveInvoiceTotal,
    };

    setBotMessages((prev) => [...prev, confirmMsg]);
    setSeqCounter((n) => n + 1);

    setPrintToast(
      `Накладная ${currentCipher.invoiceNumber} сохранена в журнале и передана на печать.`
    );
    setTimeout(() => setPrintToast(null), 5000);

    if (triggerBrowserPrint) {
      setTimeout(() => {
        try {
          window.print();
        } catch (e) {
          console.warn('Direct window.print prevented by iframe sandbox:', e);
        }
      }, 150);
    }
  };

  const handleUpdateLineQty = (id: string, nextQty: number) => {
    if (nextQty <= 0) {
      setInvoiceItems((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    setInvoiceItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: nextQty } : item))
    );
  };

  const handleSelectCandidate = (lineId: string, catalogItemId: string) => {
    const catItem = catalog.find((c) => c.id === catalogItemId);
    if (!catItem) return;
    setInvoiceItems((prev) =>
      prev.map((it) => {
        if (it.id === lineId) {
          return {
            ...it,
            catalogItemId: catItem.id,
            sku: catItem.sku,
            name: catItem.name,
            unit: catItem.unit,
            retailPrice: catItem.price,
            isNotFound: false,
            isAmbiguous: false,
            matchConfidence: 100,
          };
        }
        return it;
      })
    );
  };

  const handleManualUpdateName = (lineId: string, newName: string) => {
    if (!newName.trim()) return;
    setInvoiceItems((prev) =>
      prev.map((it) => (it.id === lineId ? { ...it, name: newName.trim() } : it))
    );
  };

  const handleManualUpdatePrice = (lineId: string, newPrice: number) => {
    setInvoiceItems((prev) =>
      prev.map((it) =>
        it.id === lineId
          ? { ...it, retailPrice: Math.max(0, newPrice), isNotFound: false }
          : it
      )
    );
  };

  const handleQuickAddFromCatalog = () => {
    const found = catalog.find((c) => c.id === quickAddCatalogId);
    const qty = parseFloat(quickAddQty) || 1;
    if (!found) return;

    const newLine: InvoiceLineItem = {
      id: `line-manual-${Date.now()}`,
      catalogItemId: found.id,
      sku: found.sku,
      name: found.name,
      unit: found.unit,
      quantity: qty,
      retailPrice: found.price,
      rawVoicePhrase: 'Добавлено вручную из прайса',
      matchConfidence: 100,
    };

    setInvoiceItems((prev) => [...prev, newLine]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8">
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('workspace');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          СтройОтпуск
        </a>

        <nav className="flex items-center gap-5 text-sm font-medium text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('workspace')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'workspace'
                ? 'text-slate-900 font-semibold underline decoration-slate-900 decoration-2 underline-offset-8'
                : 'hover:text-slate-900'
            }`}
          >
            Сборка и Бот
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('debtors')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'debtors'
                ? 'text-slate-900 font-semibold underline decoration-slate-900 decoration-2 underline-offset-8'
                : 'hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-amber-700" />
            Должники (Лист 2)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('return_decoder')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'return_decoder'
                ? 'text-slate-900 font-semibold underline decoration-slate-900 decoration-2 underline-offset-8'
                : 'hover:text-slate-900'
            }`}
          >
            Возврат и Шифр
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'catalog'
                ? 'text-slate-900 font-semibold underline decoration-slate-900 decoration-2 underline-offset-8'
                : 'hover:text-slate-900'
            }`}
          >
            База товаров (Excel)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('journal')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'journal'
                ? 'text-slate-900 font-semibold underline decoration-slate-900 decoration-2 underline-offset-8'
                : 'hover:text-slate-900'
            }`}
          >
            Журнал накладных
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'architecture'
                ? 'text-slate-900 font-semibold underline decoration-slate-900 decoration-2 underline-offset-8'
                : 'hover:text-slate-900'
            }`}
          >
            Архитектура и Рынок
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPaymentModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Wallet className="w-4 h-4" />
            Принять оплату
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeTab !== 'workspace') {
                setActiveTab('workspace');
              }
              handlePrintAndSaveInvoice(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Печать накладной
          </button>
        </div>
      </header>

      {paymentSuccessToast && (
        <div className="no-print max-w-[1440px] w-full mx-auto px-6 pt-4">
          <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-900 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{paymentSuccessToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('debtors')}
              className="text-xs font-semibold text-emerald-800 underline underline-offset-2 whitespace-nowrap shrink-0"
            >
              Открыть Лист «Должники» →
            </button>
          </div>
        </div>
      )}

      {printToast && (
        <div className="no-print max-w-[1440px] w-full mx-auto px-6 pt-4">
          <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-900 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{printToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('return_decoder')}
              className="text-xs font-semibold text-emerald-800 underline underline-offset-2 whitespace-nowrap shrink-0"
            >
              Проверить расшифровку при возврате →
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 pt-6">
        {activeTab === 'workspace' && (
          <div className="space-y-6 pb-12">
            <div className="no-print bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500">
                  Интерактивный MVP для демонстрации заказчику · Голосовой ввод в Telegram · Скрытая скидка в номере документа
                </div>
                <h1 className="text-lg lg:text-xl font-bold text-slate-900 mt-0.5">
                  Рабочее место менеджера отгрузки и формирование накладной
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('architecture')}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Схема работы и сравнение с 1С / МойСклад
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Прайс-лист ({catalog.length} поз.)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('return_decoder')}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Калькулятор возврата по номеру
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="no-print lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold tracking-tight">
                      Telegram-бот · @StroyOtpusk_Bot
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Терминал менеджера в торговом зале / на складе
                    </div>
                  </div>
                  <div className="text-xs font-mono text-slate-300">
                    Прайс: {catalog.length} поз.
                  </div>
                </div>

                {/* Подключение реального Telegram-бота */}
                <div className="p-3.5 bg-slate-100 border-b border-slate-200">
                  {telegramStatus.connected && telegramStatus.botUsername ? (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span className="font-semibold text-slate-900">
                          Реальный Telegram-бот подключён: @{telegramStatus.botUsername}
                        </span>
                      </div>
                      <a
                        href={`https://t.me/${telegramStatus.botUsername}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors shrink-0"
                      >
                        Открыть в Telegram ↗
                      </a>
                    </div>
                  ) : (
                    <form onSubmit={handleConnectTelegramBot} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-800">
                          Подключить своего Telegram-бота:
                        </span>
                        <span>Токен из @BotFather</span>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={tokenInput}
                          onChange={(e) => setTokenInput(e.target.value)}
                          placeholder="Вставьте токен: 123456789:ABCdef..."
                          className="flex-1 px-2.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-slate-900"
                        />
                        <button
                          type="submit"
                          disabled={tokenConnecting || !tokenInput.trim()}
                          className="px-3 py-1 text-xs font-semibold text-white bg-slate-900 rounded hover:bg-slate-800 disabled:opacity-50 transition-colors shrink-0"
                        >
                          {tokenConnecting ? 'Подключение...' : 'Подключить'}
                        </button>
                      </div>
                      {tokenError && (
                        <div className="text-[11px] text-red-600">{tokenError}</div>
                      )}
                    </form>
                  )}
                </div>

                <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Готовые примеры голосовой диктовки (в 1 клик):
                    </span>
                    <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded text-[11px]">
                      <button
                        type="button"
                        onClick={() => setAppendMode('replace')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          appendMode === 'replace'
                            ? 'bg-white text-slate-900 font-medium shadow-2xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Новая накладная
                      </button>
                      <button
                        type="button"
                        onClick={() => setAppendMode('append')}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          appendMode === 'append'
                            ? 'bg-white text-slate-900 font-medium shadow-2xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Дополнить текущую
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {VOICE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setDictationInput(preset.text);
                          handleSendDictation(preset.text, true);
                        }}
                        className="text-left p-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-400 transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900 group-hover:text-slate-950">
                            {preset.label}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500 group-hover:text-slate-900 whitespace-nowrap">
                            Надиктовать →
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {preset.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 space-y-3 max-h-[380px] overflow-y-auto bg-slate-100/60">
                  {botMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.sender === 'manager' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[92%] rounded-xl p-3.5 text-xs leading-relaxed ${
                          msg.sender === 'manager'
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-800'
                        }`}
                      >
                        {msg.type === 'voice' && (
                          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-700/80 text-[11px] text-slate-300">
                            <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Голосовое сообщение · 0:{String(msg.voiceDurationSec || 7).padStart(2, '0')}</span>
                          </div>
                        )}

                        <div className="whitespace-pre-line">{msg.text}</div>

                        {msg.parsedLines && msg.parsedLines.length > 0 && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1.5">
                            {msg.parsedLines.map((line, i) => (
                              <div
                                key={i}
                                className="flex items-baseline justify-between gap-2 text-[11px] bg-slate-50 px-2.5 py-1.5 rounded"
                              >
                                <span className="font-medium text-slate-800">
                                  {i + 1}. {line.matchedName}
                                </span>
                                <span className="font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                                  {line.quantity} {line.unit} × {line.price} ={' '}
                                  {formatCurrency(line.sum)} ₸
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div
                          className={`mt-1.5 text-[10px] text-right ${
                            msg.sender === 'manager' ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">
                      Кнопки в боте перед печатью (выбор скидки):
                    </span>
                    <span className="text-xs font-mono font-semibold text-amber-800">
                      Шифр «{TABLE_SUBSTITUTION_ENCODE[discountPercent]}» = {discountPercent}%
                    </span>
                  </div>

                  {/* По ТЗ: 4 кнопки 5%, 10%, 15%, 20% в один ряд; при нажатии они исчезают и появляется кнопка Отмена */}
                  {discountPercent > 0 ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => handleApplyDiscount(0)}
                        className="w-full py-2.5 px-3 rounded-lg font-mono text-xs font-bold border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center justify-center gap-2 transition-colors shadow-xs"
                      >
                        <span>↩️ Отмена</span>
                        <span className="font-normal text-[11px] text-rose-600">(вернуть старую накладную с исходными ценами)</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {([5, 10, 15, 20] as DiscountPercent[]).map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => handleApplyDiscount(pct)}
                          className="py-2 px-2 rounded-lg font-mono text-xs font-bold border border-slate-200 bg-white text-slate-800 hover:bg-slate-900 hover:text-white transition-colors whitespace-nowrap text-center shadow-xs"
                        >
                          {`${pct}%`}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Кнопки действий по ТЗ: Продолжить накладную, Редактировать текст, Напечатать, Принять оплату */}
                  <div className="space-y-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setAppendMode(appendMode === 'append' ? 'replace' : 'append')}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                        appendMode === 'append'
                          ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-600" />
                      {appendMode === 'append' ? '✓ Режим: Продолжение накладной (вкл)' : '➕ Продолжить накладную'}
                    </button>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const asText = invoiceItems.map((it) => `${it.name}, ${it.quantity} ${it.unit}`).join('\n');
                          setDictationInput(asText);
                        }}
                        className="py-2 px-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                      >
                        ✏️ Изменить текст
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePrintAndSaveInvoice(true)}
                        className="py-2 px-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        Напечатать
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      💳 Принять оплату
                    </button>
                  </div>

                  <div className="pt-2 space-y-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Продиктуйте голосом или введите список товаров:
                    </label>
                    <textarea
                      value={dictationInput}
                      onChange={(e) => setDictationInput(e.target.value)}
                      rows={3}
                      placeholder={`Труба диаметр 50, 4 м.\nРазвод угловой, диаметр 50, 8 штук.`}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />

                    {transcribeNotice && (
                      <div
                        className={`p-2.5 rounded-md text-[11px] flex items-start justify-between gap-2 border ${
                          transcribeNotice.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : transcribeNotice.type === 'error'
                            ? 'bg-red-50 border-red-200 text-red-900'
                            : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-medium">
                          {isTranscribing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          )}
                          <span>{transcribeNotice.text}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTranscribeNotice(null)}
                          className="text-slate-400 hover:text-slate-700 font-bold shrink-0 ml-1"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {micNotice && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md text-[11px] text-amber-900 flex items-start justify-between gap-2">
                        <span>{micNotice}</span>
                        <button
                          type="button"
                          onClick={() => setMicNotice(null)}
                          className="text-amber-700 hover:text-amber-950 font-bold shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {/* Скрытый инпут для загрузки готового аудиофайла */}
                    <input
                      type="file"
                      ref={audioInputFileRef}
                      accept="audio/*,.ogg,.oga,.mp3,.wav,.m4a"
                      onChange={handleAudioFileInput}
                      className="hidden"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleMicrophone}
                        disabled={isTranscribing}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                          isListening
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200'
                        } disabled:opacity-50`}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="w-3.5 h-3.5" />
                            Остановить запись
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5 text-indigo-600" />
                            Диктовать (Gemini AI)
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => audioInputFileRef.current?.click()}
                        disabled={isTranscribing || isListening}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                        title="Загрузить аудиозапись для распознавания через Gemini"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        Аудиофайл
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendDictation(dictationInput, false)}
                        disabled={isTranscribing}
                        className="flex-1 py-2 px-4 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Распознать в накладную
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div className="no-print bg-slate-900 text-white rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div>
                      <div className="text-[11px] font-mono text-slate-400">
                        ТАБЛО КАССИРА И МЕНЕДЖЕРА (НЕ ПЕЧАТАЕТСЯ НА БЛАНКЕ КЛИЕНТА)
                      </div>
                      <h2 className="text-base font-bold text-white mt-0.5">
                        Расчёт с сантехником и расшифровка номера {currentCipher.invoiceNumber}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg self-start">
                      <button
                        type="button"
                        onClick={() => setDiscountMode('hidden_contractor')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                          discountMode === 'hidden_contractor'
                            ? 'bg-amber-400 text-slate-950 font-semibold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Lock className="w-3 h-3" />
                        Скрытая (Для сантехника)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountMode('direct_client')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                          discountMode === 'direct_client'
                            ? 'bg-white text-slate-950 font-semibold'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        Прямая в чеке
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-800/90 border border-slate-700 rounded-lg">
                      <div className="text-[11px] text-slate-400">
                        1. Напечатано в накладной (100%):
                      </div>
                      <div className="text-xl font-mono font-bold text-white mt-1 tabular-nums">
                        {formatCurrency(retailTotal)} ₸
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Цена для заказчика ремонта
                      </div>
                    </div>

                    <div className="p-3.5 bg-emerald-950/60 border border-emerald-700/60 rounded-lg">
                      <div className="text-[11px] text-emerald-300">
                        2. Взять в кассу со скидкой {discountPercent}%:
                      </div>
                      <div className="text-xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
                        {formatCurrency(actualPaidTotal)} ₸
                      </div>
                      <div className="text-[11px] text-emerald-300/80 mt-0.5">
                        Реальная оплата от мастера
                      </div>
                    </div>

                    <div className="p-3.5 bg-amber-950/50 border border-amber-700/60 rounded-lg">
                      <div className="text-[11px] text-amber-300">
                        3. Выгода мастера (скидка {discountPercent}%):
                      </div>
                      <div className="text-xl font-mono font-bold text-amber-400 mt-1 tabular-nums">
                        {formatCurrency(contractorMargin)} ₸
                      </div>
                      <div className="text-[11px] text-amber-300/80 mt-0.5">
                        Зашито цифрой «{currentCipher.secretDigit}» в № накладной
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Алгоритм шифрования скидки в номере:
                      </label>
                      <select
                        value={cipherAlgorithm}
                        onChange={(e) =>
                          setCipherAlgorithm(e.target.value as CipherAlgorithm)
                        }
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-white text-xs focus:outline-none"
                      >
                        <option value="table_substitution">
                          Нелинейный ключ в среднем блоке (0%→7, 5%→3, 10%→9, 15%→5, 20%→8)
                        </option>
                        <option value="complement_9">
                          Правило девятки: 9 минус шаг скидки (0%→9, 5%→8, 10%→7, 15%→6, 20%→5)
                        </option>
                        <option value="day_offset">
                          Сдвиг от числа месяца (день + шаг скидки)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Внутренняя пометка для журнала (не печатается в бланке):
                      </label>
                      <input
                        type="text"
                        value={contractorNote}
                        onChange={(e) => setContractorNote(e.target.value)}
                        placeholder="Например: Сантехник Сергей"
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-white text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-300 bg-slate-800/60 px-3 py-2 rounded border border-slate-700/80">
                    <strong>Расшифровка номера {currentCipher.invoiceNumber}:</strong>{' '}
                    {currentCipher.explanation}
                  </div>
                </div>

                <div className="no-print bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-700">
                    Ручное добавление из прайса:
                  </div>
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <select
                      value={quickAddCatalogId}
                      onChange={(e) => setQuickAddCatalogId(e.target.value)}
                      className="flex-1 min-w-[200px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                    >
                      {catalog.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — {formatCurrency(item.price)} ₸/{item.unit}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={quickAddQty}
                      onChange={(e) => setQuickAddQty(e.target.value)}
                      className="w-16 px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md text-center"
                    />
                    <button
                      type="button"
                      onClick={handleQuickAddFromCatalog}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      В накладную
                    </button>
                  </div>
                </div>

                <div className="print-only-container bg-white border border-slate-300 rounded-xl p-6 sm:p-8 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900">
                    <div>
                      <div className="text-xs font-semibold text-slate-600">
                        База строительных и сантехнических материалов «СтройКомплект»
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Склад отгрузки №1 · Отдел инженерной сантехники, водоснабжения и электрики
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-3 tracking-tight">
                        ТОВАРНАЯ НАКЛАДНАЯ №{' '}
                        <span className="font-mono">{currentCipher.invoiceNumber}</span>
                      </h2>
                      <div className="text-xs text-slate-600 mt-1">
                        Дата составления: {new Date().toLocaleDateString('ru-RU')} г. · Валюта: тенге (₸)
                      </div>
                    </div>

                    <div className="no-print flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsPaymentModalOpen(true)}
                          className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
                        >
                          <Wallet className="w-4 h-4" />
                          Принять оплату
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintAndSaveInvoice(true)}
                          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
                        >
                          <Printer className="w-4 h-4" />
                          Распечатать
                        </button>
                        <a
                          href={`/print/${currentCipher.invoiceNumber}?autoPrint=1`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                          title="Открыть казахстанский бланк накладной в отдельной вкладке"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                          Бланк РК
                        </a>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Печатная форма А4 для подписи клиента (Казахстан)
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-300">
                          <th className="py-2.5 px-2.5 border-r border-slate-300 w-10 text-center">
                            №
                          </th>
                          <th className="py-2.5 px-2.5 border-r border-slate-300 w-24">
                            Код
                          </th>
                          <th className="py-2.5 px-3 border-r border-slate-300">
                            Наименование товара
                          </th>
                          <th className="py-2.5 px-2 border-r border-slate-300 w-14 text-center">
                            Ед.
                          </th>
                          <th className="py-2.5 px-2.5 border-r border-slate-300 w-24 text-right">
                            Кол-во
                          </th>
                          <th className="py-2.5 px-3 border-r border-slate-300 w-28 text-right">
                            Цена, ₸
                          </th>
                          <th className="py-2.5 px-3 w-32 text-right">
                            Сумма, ₸
                          </th>
                          <th className="no-print py-2.5 px-2 w-10 text-center border-l border-slate-300">
                            ×
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300">
                        {invoiceItems.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="py-8 text-center text-slate-500"
                            >
                              Накладная пуста. Продиктуйте товары в Telegram-боте слева или выберите готовый пример диктовки.
                            </td>
                          </tr>
                        ) : (
                          invoiceItems.map((item, idx) => {
                            const factor = (100 - (discountPercent || 0)) / 100;
                            const printedUnitPrice = item.isNotFound ? 0 : Math.round(item.retailPrice * factor);
                            const printedLineSum = item.quantity * printedUnitPrice;

                            return (
                              <tr
                                key={item.id}
                                className={`hover:bg-slate-50/70 ${
                                  item.isNotFound
                                    ? 'bg-rose-50/40'
                                    : item.isAmbiguous
                                    ? 'bg-amber-50/30'
                                    : ''
                                }`}
                              >
                                <td className="py-2.5 px-2.5 text-center font-mono text-slate-600 border-r border-slate-300 tabular-nums">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-2.5 font-mono text-slate-600 border-r border-slate-300 whitespace-nowrap">
                                  {item.sku}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-900 border-r border-slate-300">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span>{item.name}</span>
                                    {item.isAmbiguous && (
                                      <span className="no-print inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                        ❓ Несколько вариантов
                                      </span>
                                    )}
                                    {item.isNotFound && (
                                      <span className="no-print inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                        ⚠️ Не найден в таблице
                                      </span>
                                    )}
                                  </div>

                                  {item.rawVoicePhrase && (
                                    <div className="no-print text-[10px] text-slate-400 font-normal mt-0.5">
                                      Диктовка: «{item.rawVoicePhrase}»
                                    </div>
                                  )}

                                  {/* Выпадающий список вариантов, если фраза неоднозначна (например, продиктована просто «муфта») */}
                                  {item.candidates && item.candidates.length > 1 && (
                                    <div className="no-print mt-1.5 p-1.5 bg-amber-50/90 border border-amber-300 rounded-md">
                                      <div className="text-[11px] font-semibold text-amber-900 mb-1 flex items-center justify-between">
                                        <span>👇 Выберите точный товар из выпадающего списка:</span>
                                        <span className="text-[10px] text-amber-700">({item.candidates.length} в каталоге)</span>
                                      </div>
                                      <select
                                        value={item.catalogItemId || ''}
                                        onChange={(e) => handleSelectCandidate(item.id, e.target.value)}
                                        className="w-full text-xs bg-white border border-amber-300 rounded px-2 py-1 text-slate-800 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                      >
                                        <option value="" disabled>-- Выберите вариант --</option>
                                        {item.candidates.map((cand) => (
                                          <option key={cand.id} value={cand.id}>
                                            {cand.name} — {formatCurrency(cand.price)} ₸/{cand.unit} (№{cand.sku})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  {/* Блок если товар не найден в таблице: не выдумываем цены, даем выбрать вручную */}
                                  {item.isNotFound && (
                                    <div className="no-print mt-1.5 p-2 bg-rose-50 border border-rose-300 rounded-md">
                                      <div className="text-[11px] font-semibold text-rose-900 mb-1">
                                        ⚠️ Товар не найден в прайс-листе. Выберите из таблицы или введите вручную:
                                      </div>
                                      <select
                                        value=""
                                        onChange={(e) => handleSelectCandidate(item.id, e.target.value)}
                                        className="w-full text-xs bg-white border border-rose-300 rounded px-2 py-1 text-slate-800 font-medium focus:ring-1 focus:ring-rose-500 focus:outline-none mb-1.5"
                                      >
                                        <option value="">-- Выбрать из прайс-листа ({catalog.length} товаров) --</option>
                                        {catalog.map((cat) => (
                                          <option key={cat.id} value={cat.id}>
                                            {cat.name} — {formatCurrency(cat.price)} ₸/{cat.unit}
                                          </option>
                                        ))}
                                      </select>
                                      <div className="flex gap-1.5">
                                        <input
                                          type="text"
                                          placeholder="Название товара вручную..."
                                          defaultValue={item.rawVoicePhrase || ''}
                                          onBlur={(e) => handleManualUpdateName(item.id, e.target.value)}
                                          className="flex-1 text-xs px-2 py-1 bg-white border border-slate-300 rounded"
                                        />
                                        <input
                                          type="number"
                                          placeholder="Цена ₸"
                                          defaultValue={item.retailPrice > 0 ? item.retailPrice : ''}
                                          onBlur={(e) => handleManualUpdatePrice(item.id, Number(e.target.value) || 0)}
                                          className="w-20 text-xs px-2 py-1 bg-white border border-slate-300 rounded text-right font-mono"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-2 text-center text-slate-700 border-r border-slate-300">
                                  {item.unit}
                                </td>
                                <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-slate-900 border-r border-slate-300 tabular-nums whitespace-nowrap">
                                  <div className="inline-flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateLineQty(item.id, item.quantity - 1)
                                      }
                                      className="no-print w-5 h-5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs"
                                    >
                                      -
                                    </button>
                                    <span className="min-w-[24px] text-center">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateLineQty(item.id, item.quantity + 1)
                                      }
                                      className="no-print w-5 h-5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-800 border-r border-slate-300 tabular-nums whitespace-nowrap">
                                  {formatCurrency(printedUnitPrice)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                  {formatCurrency(printedLineSum)}
                                </td>
                                <td className="no-print py-2.5 px-2 text-center border-l border-slate-300">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateLineQty(item.id, 0)}
                                    className="text-slate-400 hover:text-red-600"
                                    title="Удалить строку"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-900 font-bold text-slate-900">
                          <td
                            colSpan={6}
                            className="py-3 px-3 text-right border-r border-slate-300 text-xs uppercase tracking-wide"
                          >
                            Итого к оплате по накладной:
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-base tabular-nums whitespace-nowrap">
                            {formatCurrency(effectiveInvoiceTotal)}{' '}
                            ₸
                          </td>
                          <td className="no-print border-l border-slate-300" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="mt-5 text-xs text-slate-700 space-y-5">
                    <div>
                      Всего наименований:{' '}
                      <strong className="font-mono">{invoiceItems.length}</strong>, на сумму{' '}
                      <strong className="font-mono">
                        {formatCurrency(effectiveInvoiceTotal)}{' '}
                        тенге 00 тиын
                      </strong>
                    </div>

                    <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-8 border-t border-slate-200">
                      <div>
                        <div className="text-xs font-semibold text-slate-800 mb-4">
                          Товар отпустил (Менеджер склада):
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1 border-b border-slate-400 h-5" />
                          <span className="text-xs text-slate-600 whitespace-nowrap">
                            / {managerName} /
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          подпись ответственного лица
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-slate-800 mb-4">
                          Товар получил, претензий по количеству и виду не имею:
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1 border-b border-slate-400 h-5" />
                          <span className="text-xs text-slate-600 whitespace-nowrap">
                            / Покупатель /
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          подпись и расшифровка покупателя (при возврате предъявить бланк)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'debtors' && (
          <DebtorsManagerView
            onOpenInvoicePrint={(invNumber) => {
              window.open(`/print/${invNumber}`, '_blank');
            }}
          />
        )}

        {activeTab === 'return_decoder' && (
          <ReturnCipherDecoder savedInvoices={savedInvoices} />
        )}

        {activeTab === 'catalog' && (
          <CatalogExcelManager
            catalog={catalog}
            onUpdateCatalog={setCatalog}
            onResetCatalog={() => setCatalog(INITIAL_CATALOG)}
          />
        )}

        {activeTab === 'journal' && (
          <InvoiceJournalView
            savedInvoices={savedInvoices}
            onLoadInvoiceToPrint={(inv) => {
              setInvoiceItems(inv.items);
              setDiscountPercent(inv.discountPercent);
              setDiscountMode(inv.discountMode);
              setCipherAlgorithm(inv.cipherAlgorithm);
              setContractorNote(inv.contractorNote);
              setActiveTab('workspace');
            }}
            onInspectReturn={() => {
              setActiveTab('return_decoder');
            }}
          />
        )}

        {activeTab === 'architecture' && (
          <ArchitectureAndMarketView
            onSwitchToWorkspace={() => setActiveTab('workspace')}
            onSwitchToReturn={() => setActiveTab('return_decoder')}
          />
        )}

        {/* Интерактивное модальное окно подтверждения отправки на печать и экспорта */}
        {printModalData && (
          <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="text-xs font-mono text-slate-500">
                      ДОКУМЕНТ ОТПРАВЛЕН В ОЧЕРЕДЬ ПЕЧАТИ
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Накладная № {printModalData.invoiceNumber}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPrintModalData(null)}
                  className="text-slate-400 hover:text-slate-700 text-lg leading-none p-1"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <div className="text-slate-500 text-[11px]">В бланке (розница):</div>
                  <div className="font-mono font-bold text-slate-900 text-sm mt-0.5 tabular-nums">
                    {formatCurrency(printModalData.retailTotal)} ₸
                  </div>
                </div>
                <div>
                  <div className="text-emerald-700 font-medium text-[11px]">
                    В кассу (-{printModalData.discountPercent}%):
                  </div>
                  <div className="font-mono font-bold text-emerald-700 text-sm mt-0.5 tabular-nums">
                    {formatCurrency(printModalData.actualPaidTotal)} ₸
                  </div>
                </div>
                <div>
                  <div className="text-amber-800 font-medium text-[11px]">
                    Выгода мастера:
                  </div>
                  <div className="font-mono font-bold text-amber-800 text-sm mt-0.5 tabular-nums">
                    {formatCurrency(printModalData.contractorMargin)} ₸
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 bg-slate-100/80 p-3 rounded-lg leading-relaxed">
                Скидка <strong>{printModalData.discountPercent}%</strong> зашита во 2-ю цифру среднего блока номера накладной. Если клиент принесёт возврат, кассир введёт номер документа и система автоматически рассчитает точную сумму возврата.
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPaymentModalOpen(true);
                    }}
                    className="flex-1 min-w-[130px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs"
                  >
                    <Wallet className="w-4 h-4" />
                    Принять оплату
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        window.print();
                      } catch (e) {
                        console.warn(e);
                      }
                    }}
                    className="py-2.5 px-3 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Printer className="w-4 h-4" />
                    Печать
                  </button>
                  <a
                    href={`/print/${printModalData.invoiceNumber}?autoPrint=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
                    title="Открыть официальный бланк Казахстана в новой вкладке"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    Бланк РК
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const textLines = [
                        `ТОВАРНАЯ НАКЛАДНАЯ № ${printModalData.invoiceNumber}`,
                        `Дата: ${printModalData.createdAt}`,
                        `Сумма по накладной: ${formatCurrency(printModalData.retailTotal)} ₸`,
                        ...printModalData.items.map(
                          (it, idx) =>
                            `${idx + 1}. ${it.name} — ${it.quantity} ${it.unit} × ${it.retailPrice} = ${formatCurrency(it.quantity * it.retailPrice)} ₸`
                        ),
                      ].join('\n');
                      navigator.clipboard?.writeText(textLines);
                      setCopiedInvoiceText(true);
                      setTimeout(() => setCopiedInvoiceText(false), 2500);
                    }}
                    className="py-2.5 px-3 bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors whitespace-nowrap"
                  >
                    {copiedInvoiceText ? '✓ Скопировано' : 'Копировать'}
                  </button>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintModalData(null);
                      setActiveTab('return_decoder');
                    }}
                    className="text-slate-700 hover:text-slate-950 font-semibold underline underline-offset-4"
                  >
                    Проверить возврат по этому номеру →
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintModalData(null)}
                    className="px-4 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <AcceptPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          invoiceNumber={currentCipher.invoiceNumber}
          totalSum={effectiveInvoiceTotal}
          onPaymentSuccess={(msg) => {
            setPaymentSuccessToast(msg);
            setTimeout(() => setPaymentSuccessToast(null), 6000);
          }}
        />
      </main>
    </div>
  );
}
