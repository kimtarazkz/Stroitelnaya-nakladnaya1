import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CatalogItem } from '../types';

const execAsync = promisify(exec);

// Модели Gemini в порядке приоритета для максимальной надёжности и качества транскрипции
const GEMINI_AUDIO_MODELS = [
  'gemini-flash-latest',
  'gemini-3.5-transcribe',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  modelUsed?: string;
  error?: string;
}

export class GeminiVoiceTranscriber {
  private client: GoogleGenAI | null = null;

  constructor() {
    this.getClient();
  }

  private getClient(): GoogleGenAI | null {
    if (this.client) return this.client;
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (apiKey) {
      try {
        this.client = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.warn('Failed to initialize Gemini client:', err);
      }
    }
    return this.client;
  }

  /**
   * Конвертирует любой входящий аудиофайл (ogg, oga, webm, mp3, mp4, wav) в чистый WAV 16kHz Mono
   * с помощью ffmpeg для наивысшей точности распознавания речи.
   */
  private async convertToWav(inputPath: string, outputPath: string): Promise<boolean> {
    try {
      await execAsync(
        `ffmpeg -y -i "${inputPath}" -vn -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}"`,
        { timeout: 15000 }
      );
      return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100;
    } catch (err) {
      console.warn('ffmpeg conversion error, will try using raw file directly:', err);
      return false;
    }
  }

  /**
   * Транскрибирует аудио-буфер в текст с контекстом каталога стройматериалов.
   */
  public async transcribeAudioBuffer(
    buffer: Buffer,
    originalMime: string = 'audio/ogg',
    catalog?: CatalogItem[]
  ): Promise<TranscriptionResult> {
    const ai = this.getClient();
    if (!ai) {
      return {
        success: false,
        error: 'GEMINI_API_KEY не настроен на сервере',
      };
    }

    const tempDir = os.tmpdir();
    const uniqueId = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const inputExt = originalMime.includes('webm') ? 'webm' : originalMime.includes('wav') ? 'wav' : 'ogg';
    const tempInputPath = path.join(tempDir, `${uniqueId}.${inputExt}`);
    const tempWavPath = path.join(tempDir, `${uniqueId}_clean.wav`);

    let uploadedFile: any = null;

    try {
      // 1. Записываем входной буфер во временный файл
      await fs.promises.writeFile(tempInputPath, buffer);

      // 2. Конвертируем в 16kHz WAV через ffmpeg
      const converted = await this.convertToWav(tempInputPath, tempWavPath);
      const filePathToUpload = converted ? tempWavPath : tempInputPath;
      const mimeToUpload = converted ? 'audio/wav' : originalMime;

      // 3. Загружаем в File API Gemini для стабильной обработки
      try {
        uploadedFile = await ai.files.upload({
          file: filePathToUpload,
          config: { mimeType: mimeToUpload },
        });
      } catch (uploadErr) {
        console.warn('Gemini file upload failed, fallback to base64 inlineData:', uploadErr);
      }

      // 4. Подготавливаем словарь синонимов и товаров из текущего каталога
      let catalogHint = '';
      if (catalog && catalog.length > 0) {
        const topNames = catalog
          .slice(0, 40)
          .map((it) => it.name)
          .join(', ');
        catalogHint = `\nСловарь товаров строительного магазина для контекста: ${topNames}.`;
      }

      const promptText =
        `Ты — высокоточный транскрибатор речи для строительного магазина и склада материалов.` +
        `${catalogHint}\n` +
        `Транскрибируй аудиозапись голосового сообщения человека на русском (или казахском) языке.\n` +
        `ВАЖНЕЙШЕЕ ПРАВИЛО: Записывай РОВНО ТЕ СЛОВА, ЧИСЛА И МАТЕРИАЛЫ, которые продиктовал говорящий!\n` +
        `НЕ ВЫДУМЫВАЙ лишних товаров, если их не было в аудиозаписи.\n` +
        `ВЕРНИ ТОЛЬКО РАСПОЗНАННЫЙ ТЕКСТ ДИКТОВКИ без вступительных фраз, без кавычек и без пояснений.`;

      // 5. Выполняем запрос с каскадным перебором моделей для 100% надежности
      let recognizedText = '';
      let usedModel = '';

      for (const model of GEMINI_AUDIO_MODELS) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            let contents: any[] = [];
            if (uploadedFile?.uri) {
              contents = [
                {
                  role: 'user',
                  parts: [
                    {
                      fileData: {
                        fileUri: uploadedFile.uri,
                        mimeType: uploadedFile.mimeType || mimeToUpload,
                      },
                    },
                    { text: promptText },
                  ],
                },
              ];
            } else {
              // Fallback to inlineData base64
              const base64Audio = (await fs.promises.readFile(filePathToUpload)).toString('base64');
              contents = [
                {
                  role: 'user',
                  parts: [
                    {
                      inlineData: {
                        mimeType: mimeToUpload,
                        data: base64Audio,
                      },
                    },
                    { text: promptText },
                  ],
                },
              ];
            }

            const response = await ai.models.generateContent({
              model,
              contents,
            });

            const candidateText = response.text?.trim() || '';
            if (candidateText) {
              recognizedText = candidateText;
              usedModel = model;
              break;
            }
          } catch (err: any) {
            const is503 = err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('high demand');
            if (is503 && attempt === 0) {
              // Небольшая пауза при пиковой нагрузке
              await new Promise((resolve) => setTimeout(resolve, 800));
              continue;
            }
            console.warn(`Model ${model} attempt ${attempt} error:`, err?.message || err);
            break; // Переходим к следующей модели
          }
        }

        if (recognizedText) {
          break;
        }
      }

      if (!recognizedText) {
        return {
          success: false,
          error: 'Не удалось распознать речь. Попробуйте продиктовать чуть громче или четче.',
        };
      }

      // Убираем случайные кавычки вокруг результата
      recognizedText = recognizedText.replace(/^["'«]+|["'»]+$/g, '').trim();

      return {
        success: true,
        text: recognizedText,
        modelUsed: usedModel,
      };
    } catch (e: any) {
      console.error('GeminiVoiceTranscriber fatal error:', e);
      return {
        success: false,
        error: e.message || 'Ошибка транскрипции аудио',
      };
    } finally {
      // Очистка временных файлов
      try {
        if (fs.existsSync(tempInputPath)) await fs.promises.unlink(tempInputPath);
        if (fs.existsSync(tempWavPath)) await fs.promises.unlink(tempWavPath);
        if (uploadedFile?.name) {
          await ai.files.delete({ name: uploadedFile.name }).catch(() => {});
        }
      } catch {
        // ignore cleanup error
      }
    }
  }

  /**
   * Умное распознавание диктовки через Gemini в структурированные позиции каталога,
   * если стандартный парсер регулярных выражений ничего не нашел из-за сложного разговорного оборота.
   */
  public async smartParseItemsWithGemini(
    dictationText: string,
    catalog: CatalogItem[]
  ): Promise<Array<{ catalogItemId: string; name: string; quantity: number; unit: string; price: number; isNotFound?: boolean; rawPhrase?: string }>> {
    const ai = this.getClient();
    if (!ai || !dictationText.trim() || catalog.length === 0) return [];

    try {
      const catalogMini = catalog.slice(0, 70).map((c) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        unit: c.unit,
        keywords: c.keywords.slice(0, 4),
      }));

      const prompt =
        `Пользователь продиктовал список товаров сантехники/стройматериалов: "${dictationText}".\n` +
        `Вот СТРОГИЙ прайс-лист магазина из таблицы Excel в JSON формате:\n${JSON.stringify(catalogMini)}\n\n` +
        `СТРОГИЕ ПРАВИЛА:\n` +
        `1. Ищи товары ТОЛЬКО в переданном прайс-листе! Категорически ЗАПРЕЩЕНО выдумывать товары, артикулы или цены.\n` +
        `2. Цену (price) бери ТОЛЬКО из соответствующего товара в каталоге (все цены в тенге ₸). Запрещено выдумывать свои цены!\n` +
        `3. Если какой-то товар из диктовки отсутствует в прайс-листе, верни его с catalogItemId: null, price: 0, isNotFound: true, name: "Товар не найден в прайс-листе"!\n` +
        `4. Верни ТОЛЬКО валидный JSON массив в формате:\n` +
        `[{"catalogItemId": "id_из_каталога_или_null", "name": "название_из_каталога_или_не_найден", "quantity": 1, "unit": "шт", "price": 0, "isNotFound": false, "rawPhrase": "фраза"}]\n`;

      const res = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
      });

      const raw = res.text?.trim() || '[]';
      const cleanJson = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((it) => it.quantity > 0)
          .map((it) => {
            const realCat = catalog.find((c) => c.id === it.catalogItemId);
            if (realCat) {
              return {
                catalogItemId: realCat.id,
                name: realCat.name,
                quantity: it.quantity,
                unit: realCat.unit,
                price: realCat.price, // ТОЛЬКО реальная цена из таблицы!
                isNotFound: false,
                rawPhrase: it.rawPhrase,
              };
            }
            return {
              catalogItemId: '',
              name: `Товар «${it.rawPhrase || it.name || 'неизвестно'}» не найден в прайс-листе`,
              quantity: it.quantity,
              unit: 'шт',
              price: 0, // Не выдумываем цену!
              isNotFound: true,
              rawPhrase: it.rawPhrase,
            };
          });
      }
    } catch (e) {
      console.warn('smartParseItemsWithGemini error:', e);
    }
    return [];
  }
}

export const geminiVoiceTranscriber = new GeminiVoiceTranscriber();
