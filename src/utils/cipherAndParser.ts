import {
  CatalogItem,
  CipherAlgorithm,
  DiscountMode,
  DiscountPercent,
  InvoiceLineItem,
} from '../types';

// Нелинейная таблица шифрования скидки (чтобы клиент/заказчик не увидел закономерности 1, 2, 3, 4)
export const TABLE_SUBSTITUTION_ENCODE: Record<DiscountPercent, string> = {
  0: '7',
  5: '3',
  10: '9',
  15: '5',
  20: '8',
};

export const TABLE_SUBSTITUTION_DECODE: Record<string, DiscountPercent> = {
  '7': 0,
  '3': 5,
  '9': 10,
  '5': 15,
  '8': 20,
};

// Правило девятки: 9 - (скидка / 5)
export const COMPLEMENT_9_ENCODE: Record<DiscountPercent, string> = {
  0: '9',
  5: '8',
  10: '7',
  15: '6',
  20: '5',
};

export const COMPLEMENT_9_DECODE: Record<string, DiscountPercent> = {
  '9': 0,
  '8': 5,
  '7': 10,
  '6': 15,
  '5': 20,
};

export interface GeneratedCipherResult {
  invoiceNumber: string;
  prefix: string;
  seqPart: string;
  cipherBlock: string;
  secretDigit: string;
  controlBlock: string;
  explanation: string;
}

export function generateEncryptedInvoiceNumber(
  seqNumber: number,
  discount: DiscountPercent,
  mode: DiscountMode,
  algorithm: CipherAlgorithm = 'table_substitution',
  date: Date = new Date()
): GeneratedCipherResult {
  const seqPart = String(seqNumber).padStart(4, '0');
  const noiseDigit = String(((seqNumber * 7 + 3) % 8) + 1); // детерминированная маскирующая цифра 1..8
  const modeDigit = mode === 'hidden_contractor' ? '3' : '1';

  if (algorithm === 'table_substitution') {
    const secretDigit = TABLE_SUBSTITUTION_ENCODE[discount];
    const cipherBlock = `${noiseDigit}${secretDigit}`;
    const checkSum = (seqNumber + Number(secretDigit) + Number(modeDigit)) % 9 + 1;
    const controlBlock = `${modeDigit}${checkSum}`;
    const invoiceNumber = `РН-${seqPart}-${cipherBlock}-${controlBlock}`;

    return {
      invoiceNumber,
      prefix: 'РН',
      seqPart,
      cipherBlock,
      secretDigit,
      controlBlock,
      explanation: `В блоке «-${cipherBlock}-» первая цифра (${noiseDigit}) — шумовая маскировка, вторая цифра «${secretDigit}» по закрытой таблице магазина означает скидку ${discount}%. Блок «${controlBlock}» хранит режим (${mode === 'hidden_contractor' ? 'скрытая для прораба' : 'прямая'}) и контрольную цифру.`,
    };
  }

  if (algorithm === 'complement_9') {
    const secretDigit = COMPLEMENT_9_ENCODE[discount];
    const cipherBlock = `${secretDigit}`;
    const checkSum = (seqNumber + Number(secretDigit)) % 9 + 1;
    const controlBlock = `${modeDigit}${checkSum}`;
    const invoiceNumber = `РН-${seqPart}-${cipherBlock}-${controlBlock}`;

    return {
      invoiceNumber,
      prefix: 'РН',
      seqPart,
      cipherBlock,
      secretDigit,
      controlBlock,
      explanation: `Между тире цифра «-${cipherBlock}-» вычислена по формуле: 9 минус шаг скидки (${discount}% / 5 = ${discount / 5}, 9 - ${discount / 5} = ${secretDigit}).`,
    };
  }

  // day_offset
  const dayLastDigit = date.getDate() % 10;
  const step = discount / 5; // 0..4
  const secretDigit = String((dayLastDigit + step) % 10);
  const cipherBlock = `${dayLastDigit}${secretDigit}`;
  const checkSum = (seqNumber + step) % 9 + 1;
  const controlBlock = `${modeDigit}${checkSum}`;
  const invoiceNumber = `РН-${seqPart}-${cipherBlock}-${controlBlock}`;

  return {
    invoiceNumber,
    prefix: 'РН',
    seqPart,
    cipherBlock,
    secretDigit,
    controlBlock,
    explanation: `В блоке «-${cipherBlock}-» первая цифра (${dayLastDigit}) — последняя цифра дня выписки, вторая (${secretDigit}) = ${dayLastDigit} + ${step} (шаг скидки ${discount}%).`,
  };
}

export interface DecodedInvoiceInfo {
  isValid: boolean;
  rawInput: string;
  discountPercent: DiscountPercent;
  discountMode: DiscountMode;
  cipherBlock: string;
  secretDigit: string;
  algorithmName: string;
  explanation: string;
}

export function decodeInvoiceNumber(rawInput: string): DecodedInvoiceInfo {
  const cleaned = rawInput.trim().toUpperCase();
  const parts = cleaned.split('-').filter(Boolean);

  if (parts.length >= 3) {
    const hasLetterPrefix = /^[A-ZА-ЯЁ]+$/.test(parts[0]);
    const cipherBlock = hasLetterPrefix ? parts[2] : parts[1];
    const controlBlock = hasLetterPrefix ? parts[3] || '' : parts[2] || '';

    const modeDigit = controlBlock.charAt(0);
    const discountMode: DiscountMode =
      modeDigit === '1' ? 'direct_client' : 'hidden_contractor';

    if (cipherBlock && cipherBlock.length === 2) {
      const firstChar = cipherBlock.charAt(0);
      const secondChar = cipherBlock.charAt(1);

      if (secondChar in TABLE_SUBSTITUTION_DECODE) {
        const discountPercent = TABLE_SUBSTITUTION_DECODE[secondChar];
        return {
          isValid: true,
          rawInput: cleaned,
          discountPercent,
          discountMode,
          cipherBlock,
          secretDigit: secondChar,
          algorithmName: 'Нелинейный табличный ключ (2-я цифра блока)',
          explanation: `В среднем блоке «-${cipherBlock}-» первая цифра (${firstChar}) — шумовая, а вторая цифра «${secondChar}» расшифровывается по ключу магазина как скидка ${discountPercent}%.`,
        };
      }

      const d1 = Number(firstChar);
      const d2 = Number(secondChar);
      if (!Number.isNaN(d1) && !Number.isNaN(d2)) {
        const diff = (d2 - d1 + 10) % 10;
        if (diff >= 0 && diff <= 4) {
          const discountPercent = (diff * 5) as DiscountPercent;
          return {
            isValid: true,
            rawInput: cleaned,
            discountPercent,
            discountMode,
            cipherBlock,
            secretDigit: secondChar,
            algorithmName: 'Сдвиг от числа месяца',
            explanation: `Разница между цифрами в блоке «-${cipherBlock}-» составляет ${diff} (${diff} × 5% = ${discountPercent}%).`,
          };
        }
      }
    }

    if (cipherBlock && cipherBlock.length === 1) {
      const char = cipherBlock.charAt(0);
      if (char in COMPLEMENT_9_DECODE) {
        const discountPercent = COMPLEMENT_9_DECODE[char];
        return {
          isValid: true,
          rawInput: cleaned,
          discountPercent,
          discountMode,
          cipherBlock,
          secretDigit: char,
          algorithmName: 'Правило девятки (9 минус шаг скидки)',
          explanation: `Цифра «-${char}-» между тире: (9 - ${char}) × 5% = ${discountPercent}% скрытой скидки.`,
        };
      }
    }
  }

  return {
    isValid: false,
    rawInput: cleaned,
    discountPercent: 0,
    discountMode: 'hidden_contractor',
    cipherBlock: '—',
    secretDigit: '—',
    algorithmName: 'Неизвестный формат номера',
    explanation:
      'Введите номер накладной в формате РН-0418-78-34 или выберите накладную из журнала ниже.',
  };
}

const SPOKEN_NUMBERS: Record<string, number> = {
  один: 1,
  одна: 1,
  одну: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  пятнадцать: 15,
  двадцать: 20,
  двадцатьпять: 25,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  шестьдесят: 60,
  восемьдесят: 80,
  сто: 100,
  стодвадцать: 120,
};

function normalizeRussianText(str: string): string {
  return str
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[×*x]/g, 'х')
    .trim();
}

function extractQuantityAndCleanPhrase(rawClause: string): {
  quantity: number;
  productQuery: string;
} {
  let text = normalizeRussianText(rawClause);

  const unitPattern = '(?:м|метр(?:а|ов)?|пог\\.?\\s*м|шт|штук(?:и|а)?|компл(?:ект(?:а|ов)?)?|меш(?:ок|ка|ков)?|уп(?:ак)?)';
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const cleanWord = words[i].replace(/[.,;]/g, '');
    if (cleanWord in SPOKEN_NUMBERS) {
      const nextWord = (words[i + 1] || '').replace(/[.,;]/g, '');
      const isBeforeUnit = new RegExp(`^${unitPattern}$`).test(nextWord);
      const isLastWord = i === words.length - 1;
      if (isBeforeUnit || isLastWord) {
        words[i] = String(SPOKEN_NUMBERS[cleanWord]);
      }
    }
  }
  text = words.join(' ');

  const endQtyWithUnitRegex = new RegExp(
    `(?:,\\s*|\\s+-\\s+|\\s+)(\\d+(?:[.,]\\d+)?)\\s*${unitPattern}\\.?\\s*$`,
    'i'
  );
  const matchEndUnit = text.match(endQtyWithUnitRegex);
  if (matchEndUnit) {
    const qty = parseFloat(matchEndUnit[1].replace(',', '.'));
    const productQuery = text.slice(0, matchEndUnit.index).trim();
    return {
      quantity: qty > 0 ? qty : 1,
      productQuery: productQuery || text,
    };
  }

  const afterCommaNumberRegex = /,\s*(\d+(?:[.,]\\d+)?)\s*$/;
  const matchComma = text.match(afterCommaNumberRegex);
  if (matchComma) {
    const qty = parseFloat(matchComma[1].replace(',', '.'));
    const productQuery = text.slice(0, matchComma.index).trim();
    return {
      quantity: qty > 0 ? qty : 1,
      productQuery: productQuery || text,
    };
  }

  const midQtyRegex = new RegExp(
    `(\\d+(?:[.,]\\d+)?)\\s*${unitPattern}\\b`,
    'i'
  );
  const matchMid = text.match(midQtyRegex);
  if (matchMid && matchMid.index !== undefined) {
    const qty = parseFloat(matchMid[1].replace(',', '.'));
    const productQuery = (
      text.slice(0, matchMid.index) +
      ' ' +
      text.slice(matchMid.index + matchMid[0].length)
    ).trim();
    return {
      quantity: qty > 0 ? qty : 1,
      productQuery: productQuery || text,
    };
  }

  return {
    quantity: 1,
    productQuery: text,
  };
}

export interface MatchResult {
  item: CatalogItem | null;
  confidence: number;
  isNotFound: boolean;
  isAmbiguous: boolean;
  candidates: { id: string; sku: string; name: string; price: number; unit: string }[];
}

export function matchCatalogItem(
  productQuery: string,
  catalog: CatalogItem[]
): MatchResult {
  if (!catalog.length) {
    return {
      item: null,
      confidence: 0,
      isNotFound: true,
      isAmbiguous: false,
      candidates: [],
    };
  }

  const q = normalizeRussianText(productQuery).replace(/[.,;:()]/g, ' ');
  const queryTokens = q.split(/\s+/).filter((t) => t.length > 0);
  if (queryTokens.length === 0) {
    return {
      item: null,
      confidence: 0,
      isNotFound: true,
      isAmbiguous: false,
      candidates: [],
    };
  }

  const queryNumbers = queryTokens.filter((t) => /\d/.test(t));
  const scoredItems: Array<{ item: CatalogItem; score: number }> = [];

  for (const item of catalog) {
    let score = 0;
    const itemNameNorm = normalizeRussianText(item.name);
    const allKeywordsNorm = item.keywords.map(normalizeRussianText);
    const combinedTarget = `${itemNameNorm} ${allKeywordsNorm.join(' ')}`;

    for (const kw of allKeywordsNorm) {
      if (q === kw) {
        score += 80;
      } else if (q.includes(kw)) {
        score += 45 + kw.length;
      } else {
        const kwWords = kw.split(/\s+/);
        const matchedKwWords = kwWords.filter((w) =>
          queryTokens.some((qt) => qt.startsWith(w.slice(0, 4)) || w.startsWith(qt.slice(0, 4)))
        );
        if (matchedKwWords.length === kwWords.length && kwWords.length >= 2) {
          score += 38;
        }
      }
    }

    for (const numTok of queryNumbers) {
      const exactNumRegex = new RegExp(`(^|[^\\d])${numTok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\d]|$)`);
      if (exactNumRegex.test(combinedTarget)) {
        score += 40;
      } else {
        score -= 30; // Штраф за несоответствие диаметра
      }
    }

    for (const token of queryTokens) {
      if (token.length < 3 || /^\d+$/.test(token)) continue;
      if (token === 'диаметр' || token === 'размер') continue;
      const stem = token.slice(0, Math.min(token.length, 5));
      if (itemNameNorm.includes(stem)) {
        score += 25; // Прямое совпадение в названии товара
      } else if (combinedTarget.includes(stem)) {
        score += 15;
      }
    }

    if (itemNameNorm.includes(q)) {
      score += 20;
    }

    const hasFittingWord = /(развод|отвод|угол|колено|тройник|муфт|хомут|кран|евроконус|переход|полуотвод)/.test(q);
    if (!hasFittingWord && q.includes('труб') && itemNameNorm.startsWith('труба')) {
      score += 25;
    }

    if (score >= 12) {
      scoredItems.push({ item, score });
    }
  }

  scoredItems.sort((a, b) => b.score - a.score);

  if (scoredItems.length === 0) {
    return {
      item: null,
      confidence: 0,
      isNotFound: true,
      isAmbiguous: false,
      candidates: [],
    };
  }

  const best = scoredItems[0];
  const second = scoredItems[1];
  const topCandidates = scoredItems.slice(0, 5).map((s) => ({
    id: s.item.id,
    sku: s.item.sku,
    name: s.item.name,
    price: s.item.price,
    unit: s.item.unit,
  }));

  // Если найдено несколько товаров и у них близкий балл или не назван диаметр/специфика
  const isAmbiguous =
    scoredItems.length > 1 &&
    queryNumbers.length === 0 &&
    (!!second && best.score - second.score < 25);

  const confidence = Math.min(99, Math.max(50, Math.round(45 + best.score / 2.2)));

  return {
    item: best.item,
    confidence,
    isNotFound: false,
    isAmbiguous,
    candidates: topCandidates,
  };
}

export function parseDictationToInvoiceItems(
  rawDictation: string,
  catalog: CatalogItem[]
): InvoiceLineItem[] {
  const clauses = rawDictation
    .replace(/(\d)\.(\d)/g, '$1_DOT_$2')
    .split(/[\n;]+|\.\s+|\.$/)
    .map((s) => s.replace(/_DOT_/g, '.').replace(/^[-•*—]\s*/, '').trim())
    .filter((s) => s.length >= 2);

  const results: InvoiceLineItem[] = [];

  clauses.forEach((clause, idx) => {
    const { quantity, productQuery } = extractQuantityAndCleanPhrase(clause);
    const matched = matchCatalogItem(productQuery, catalog);

    if (matched.isNotFound || !matched.item) {
      // Строго по требованию: ничего не придумываем, фиксируем что товар не найден в прайсе
      results.push({
        id: `line-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        catalogItemId: '',
        sku: 'НЕ-НАЙДЕН',
        name: `Товар «${productQuery}» не найден в прайс-листе`,
        unit: 'шт',
        quantity,
        retailPrice: 0,
        rawVoicePhrase: clause,
        matchConfidence: 0,
        isNotFound: true,
        isAmbiguous: false,
        candidates: catalog.slice(0, 5).map((c) => ({
          id: c.id,
          sku: c.sku,
          name: c.name,
          price: c.price,
          unit: c.unit,
        })),
      });
    } else {
      results.push({
        id: `line-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        catalogItemId: matched.item.id,
        sku: matched.item.sku,
        name: matched.item.name,
        unit: matched.item.unit,
        quantity,
        retailPrice: matched.item.price,
        rawVoicePhrase: clause,
        matchConfidence: matched.confidence,
        isNotFound: false,
        isAmbiguous: matched.isAmbiguous,
        candidates: matched.candidates,
      });
    }
  });

  return results;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
