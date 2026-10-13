import { CatalogItem } from '../types';

export function extractSheetId(input: string): string {
  const trimmed = input.trim();
  // Если передана полная ссылка: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    return match[1];
  }
  return trimmed;
}

export async function fetchGoogleSheetCatalog(sheetUrlOrId: string): Promise<{
  success: boolean;
  items?: CatalogItem[];
  count?: number;
  error?: string;
}> {
  const sheetId = extractSheetId(sheetUrlOrId);
  if (!sheetId) {
    return { success: false, error: 'Не указан ID таблицы' };
  }

  // Публичный экспорт в CSV (работает без сложных API ключей, если доступ включён «Все, у кого есть ссылка»)
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  try {
    const res = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Google вернул статус ${res.status}. Убедитесь, что в таблице открыт доступ «Все, у кого есть ссылка — Читатель».`,
      };
    }

    const text = await res.text();
    const rows = parseCsvText(text);

    if (rows.length < 2) {
      return { success: false, error: 'Таблица пуста или содержит только строку заголовков' };
    }

    // Ищем строку заголовков по всей таблице
    let headerRowIdx = -1;
    let skuCol = -1;
    let nameCol = -1;
    let synCol = -1;
    let priceCol = -1;
    let catCol = -1;
    let unitCol = -1;

    for (let r = 0; r < rows.length; r++) {
      const rowHeaders = (rows[r] || []).map((h) => (h || '').trim().toLowerCase());
      const hasHeaderKeywords = rowHeaders.some(
        (h) =>
          h.includes('назван') ||
          h.includes('наименов') ||
          h.includes('синоним') ||
          h.includes('цен') ||
          h.includes('порядков') ||
          h.includes('артикул')
      );
      if (hasHeaderKeywords) {
        headerRowIdx = r;
        rowHeaders.forEach((header, idx) => {
          if (
            header.includes('порядков') ||
            header.includes('номер') ||
            header.includes('№') ||
            header.includes('п/п') ||
            header.includes('артикул') ||
            header.includes('sku') ||
            header.includes('id')
          ) {
            if (skuCol === -1) skuCol = idx;
          } else if (
            header.includes('назван') ||
            header.includes('наименов') ||
            header.includes('товар') ||
            header.includes('тауар')
          ) {
            if (nameCol === -1) nameCol = idx;
          } else if (
            header.includes('синоним') ||
            header.includes('слов') ||
            header.includes('прост') ||
            header.includes('голос') ||
            header.includes('алиас')
          ) {
            if (synCol === -1) synCol = idx;
          } else if (
            header.includes('цен') ||
            header.includes('стоим') ||
            header.includes('баға') ||
            header.includes('бага') ||
            header.includes('price') ||
            header.includes('розниц')
          ) {
            if (priceCol === -1) priceCol = idx;
          } else if (header.includes('категор') || header.includes('раздел')) {
            if (catCol === -1) catCol = idx;
          } else if (header.includes('ед') || header.includes('измер') || header.includes('өлшем')) {
            if (unitCol === -1) unitCol = idx;
          }
        });
        break;
      }
    }

    // Если строка заголовков не найдена или не все колонки распознались, определяем по стандартной 4-колоночной схеме:
    // 0: Порядковый номер, 1: Название, 2: Слова-синонимы, 3: Цена
    const colCount = Math.max(...rows.map((r) => r.length));
    if (nameCol === -1) {
      if (colCount <= 4) {
        skuCol = 0;
        nameCol = 1;
        synCol = 2;
        priceCol = 3;
      } else {
        skuCol = 0;
        nameCol = 1;
        catCol = 2;
        unitCol = 3;
        priceCol = 4;
        synCol = 5;
      }
    }
    if (priceCol === -1) {
      priceCol = colCount <= 4 ? 3 : 4;
    }
    if (synCol === -1) {
      synCol = colCount <= 4 ? 2 : 5;
    }
    if (skuCol === -1) {
      skuCol = 0;
    }

    const catalogItems: CatalogItem[] = [];

    // Читаем все строки, пропуская явную строку заголовка
    for (let i = 0; i < rows.length; i++) {
      if (i === headerRowIdx) continue;
      const cols = rows[i];
      if (!cols || cols.length < 2) continue;

      let sku = (cols[skuCol] || `ТОВ-${i + 1}`).trim();
      let name = (cols[nameCol] || '').trim();
      let synonymsRaw = (synCol >= 0 ? cols[synCol] || '' : '').trim();
      let priceRaw = (priceCol >= 0 ? cols[priceCol] || '0' : '0').trim();
      let category = (catCol >= 0 ? cols[catCol] || '' : '').trim();
      let unit = (unitCol >= 0 ? cols[unitCol] || 'шт' : 'шт').trim();

      // Пропускаем служебные заголовки, если они попались в данных
      if (
        name.toLowerCase() === 'название' ||
        name.toLowerCase() === 'наименование' ||
        priceRaw.toLowerCase() === 'цена'
      ) {
        continue;
      }

      // Если в первой колонке на самом деле название:
      if (!name && sku && isNaN(parseFloat(sku.replace(',', '.')))) {
        name = sku;
        sku = `ТОВ-${i + 1}`;
      }

      // Очистка цены от валют, пробелов, разделителей
      const cleanedPrice = priceRaw
        .replace(/\s+/g, '')
        .replace(/тг|руб|тенге|\$|₽/gi, '')
        .replace(',', '.');
      const price = parseFloat(cleanedPrice);

      if (!name || isNaN(price) || price <= 0) continue;

      // Определение категории по контексту названия, если не указана
      let finalCategory: CatalogItem['category'] = 'Водоснабжение и Отопление';
      const nameLower = name.toLowerCase();
      if (category) {
        if (['Канализация', 'Водоснабжение и Отопление', 'Электрика', 'Смеси и Крепёж'].includes(category)) {
          finalCategory = category as CatalogItem['category'];
        }
      } else {
        if (nameLower.includes('канал') || nameLower.includes('кн')) {
          finalCategory = 'Канализация';
        } else if (nameLower.includes('пен') || nameLower.includes('клей') || nameLower.includes('скотч') || nameLower.includes('перчатк') || nameLower.includes('хомут') || nameLower.includes('клипс')) {
          finalCategory = 'Смеси и Крепёж';
        } else if (nameLower.includes('стабилиз') || nameLower.includes('эра') || nameLower.includes('электр')) {
          finalCategory = 'Электрика';
        }
      }

      const keywords = synonymsRaw
        ? synonymsRaw
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        : [nameLower];

      // Всегда включаем само название в синонимы, если его там ещё нет
      if (!keywords.includes(nameLower)) {
        keywords.unshift(nameLower);
      }

      catalogItems.push({
        id: `gsheet-${i}-${Date.now()}`,
        sku: sku || `ТОВ-${i}`,
        name,
        category: finalCategory,
        unit: (['м', 'шт', 'компл', 'меш', 'уп'].includes(unit) ? unit : 'шт') as CatalogItem['unit'],
        price,
        keywords,
        stock: 100,
      });
    }

    if (catalogItems.length === 0) {
      return { success: false, error: 'Не удалось распознать ни одной строки с ценой. Проверьте формат таблицы.' };
    }

    return {
      success: true,
      items: catalogItems,
      count: catalogItems.length,
    };
  } catch (e: any) {
    return {
      success: false,
      error: `Ошибка запроса к Google Sheets: ${e?.message || 'Неизвестная ошибка'}`,
    };
  }
}

function parseCsvText(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      lines.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    lines.push(currentRow);
  }

  return lines;
}
