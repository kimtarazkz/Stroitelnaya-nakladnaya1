import express from 'express';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { telegramBot } from './src/server/telegramBot';
import { geminiVoiceTranscriber } from './src/server/geminiVoiceTranscriber';
import { debtorsService } from './src/server/debtorsService';
import { renderKazakhstanInvoiceHtml } from './src/server/invoicePrintTemplate';

dotenv.config();

async function startServer() {
  const app = express();
  const port = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '25mb' }));

  app.use((req, _res, next) => {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    if (host) {
      telegramBot.setHostUrl(`${proto}://${host}`);
    }
    next();
  });

  // API для управления подключением реального Telegram-бота
  app.get('/api/telegram/status', (_req, res) => {
    res.json(telegramBot.getStatus());
  });

  app.post('/api/telegram/set-token', async (req, res) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Токен не указан' });
    }
    const result = await telegramBot.setToken(token);
    return res.json(result);
  });

  // API для синхронизации с Google Таблицей
  app.post('/api/sheets/sync', async (req, res) => {
    const { sheetUrlOrId } = req.body;
    if (!sheetUrlOrId) {
      return res.status(400).json({ success: false, error: 'Ссылка или ID таблицы не указаны' });
    }
    const result = await telegramBot.syncGoogleSheets(sheetUrlOrId);
    if (result.success) {
      return res.json({
        success: true,
        count: result.count,
        items: telegramBot.getCatalog(),
      });
    }
    return res.status(400).json(result);
  });

  app.get('/api/sheets/catalog', (_req, res) => {
    res.json({
      items: telegramBot.getCatalog(),
      status: telegramBot.getStatus(),
    });
  });

  // API для транскрибирования аудио через Gemini с каскадным перебором моделей
  app.post('/api/voice/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ success: false, error: 'Аудиоданные не переданы' });
      }

      const buffer = Buffer.from(audioBase64, 'base64');
      const catalog = telegramBot.getCatalog();
      const result = await geminiVoiceTranscriber.transcribeAudioBuffer(
        buffer,
        mimeType || 'audio/webm',
        catalog
      );

      if (result.success && result.text) {
        return res.json({
          success: true,
          text: result.text,
          modelUsed: result.modelUsed,
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || 'Не удалось распознать речь',
        });
      }
    } catch (err: any) {
      console.error('/api/voice/transcribe error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Ошибка распознавания речи' });
    }
  });

  // API для работы с должниками (Лист 2 таблицы)
  app.get('/api/debtors', (_req, res) => {
    res.json({
      success: true,
      debtors: debtorsService.getAll(),
      limit: 200000,
    });
  });

  app.post('/api/debtors/check-limit', (req, res) => {
    const { debtorId, additionalDebt } = req.body;
    const check = debtorsService.checkLimit(debtorId, Number(additionalDebt) || 0);
    res.json(check);
  });

  app.post('/api/debtors/add-debt', (req, res) => {
    const { debtorId, fullName, phone, idCardNumber, address, invoiceNumber, invoiceTotal, paidCash, debtAdded, note } = req.body;
    if (!fullName && !debtorId) {
      return res.status(400).json({ success: false, error: 'Укажите ФИО клиента или выберите должника' });
    }
    const result = debtorsService.addOrUpdateDebt({
      debtorId,
      fullName: fullName || '',
      phone,
      idCardNumber,
      address,
      invoiceNumber: invoiceNumber || 'Б/Н',
      invoiceTotal: Number(invoiceTotal) || 0,
      paidCash: Number(paidCash) || 0,
      debtAdded: Number(debtAdded) || 0,
      note,
    });
    res.json(result);
  });

  app.post('/api/debtors/repay', (req, res) => {
    const { debtorId, amount, note } = req.body;
    if (!debtorId || !amount) {
      return res.status(400).json({ success: false, error: 'Укажите ID должника и сумму погашения' });
    }
    const result = debtorsService.recordRepayment(debtorId, Number(amount), note);
    res.json(result);
  });

  // Эндпоинт для открытия и печати бланка накладной в браузере (Казахстанский стандарт)
  app.get(['/print/:id', '/invoice-print/:id'], (req, res) => {
    const invoiceId = req.params.id;
    const host = `${req.protocol}://${req.get('host')}`;
    telegramBot.setHostUrl(host);

    const invoiceData = telegramBot.getPrintableInvoice(invoiceId);
    if (invoiceData) {
      const html = renderKazakhstanInvoiceHtml(invoiceData);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    // Если накладная не найдена в текущей памяти бота, генерируем стандартный бланк
    const fallbackHtml = renderKazakhstanInvoiceHtml({
      invoiceNumber: invoiceId,
      date: new Date().toLocaleDateString('ru-RU'),
      managerName: 'Алексеев И. В.',
      items: [
        { name: 'Муфта 50 полипропилен', unit: 'шт', quantity: 4, price: 450 },
        { name: 'Труба канализационная 50 2м', unit: 'шт', quantity: 3, price: 1200 },
      ],
      totalSum: 5400,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(fallbackHtml);
  });

  // Автоматическая загрузка товаров из Google Таблицы пользователя при старте
  const defaultSheetUrl =
    process.env.GOOGLE_SHEET_URL ||
    'https://docs.google.com/spreadsheets/d/10bVlCpuwBTUCySFwAJDxJXDOcJWwDkbVBPtWZVEKW50/edit?usp=drivesdk';
  telegramBot
    .syncGoogleSheets(defaultSheetUrl)
    .then((sync) => {
      if (sync.success) {
        console.log(`Auto-synced user Google Sheet: ${sync.count} items loaded.`);
      }
    })
    .catch((err) => console.warn('Initial Google Sheet sync warning:', err));

  // Автозапуск бота, если токен уже задан в переменных окружения
  const initialToken = process.env.TELEGRAM_BOT_TOKEN;
  if (initialToken) {
    console.log('Found TELEGRAM_BOT_TOKEN in env, connecting to Telegram...');
    telegramBot.setToken(initialToken).then((res) => {
      if (res.success) {
        console.log(`Telegram Bot started successfully as ${res.botName}`);
      } else {
        console.warn(`Failed to connect Telegram bot from env:`, res.error);
      }
    });
  }

  // Интеграция с Vite для работы веб-приложения на том же порту 3000
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
