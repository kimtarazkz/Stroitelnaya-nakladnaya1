export type DiscountPercent = 0 | 5 | 10 | 15 | 20;

export type DiscountMode = 'hidden_contractor' | 'direct_client';

export type CipherAlgorithm = 'table_substitution' | 'complement_9' | 'day_offset';

export interface CatalogItem {
  id: string;
  sku: string;
  name: string;
  category: 'Канализация' | 'Водоснабжение и Отопление' | 'Электрика' | 'Смеси и Крепёж';
  unit: 'м' | 'шт' | 'компл' | 'меш' | 'уп';
  price: number;
  keywords: string[]; // Синонимы для голосового ввода (напр. "развод угловой", "уголок", "колено")
  stock: number;
}

export interface InvoiceLineItemCandidate {
  id: string;
  sku: string;
  name: string;
  price: number;
  unit: string;
}

export interface InvoiceLineItem {
  id: string;
  catalogItemId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  retailPrice: number;
  rawVoicePhrase?: string;
  matchConfidence: number; // 0..100
  isNotFound?: boolean;
  isAmbiguous?: boolean;
  candidates?: InvoiceLineItemCandidate[];
}

export interface SavedInvoice {
  id: string;
  seqNumber: number;
  invoiceNumber: string;
  createdAt: string;
  managerName: string;
  contractorNote: string; // Для внутренней пометки (не печатается в накладной для клиента прораба)
  discountPercent: DiscountPercent;
  discountMode: DiscountMode;
  cipherAlgorithm: CipherAlgorithm;
  items: InvoiceLineItem[];
  retailTotal: number;      // Сумма по розничным ценам (печатается в накладной при скрытой скидке)
  actualPaidTotal: number;  // Реальная сумма, которую платит сантехник/прораб в кассу
  contractorMargin: number; // Разница (заработок сантехника / сумма скидки)
  status: 'printed' | 'draft' | 'returned_partial';
}

export interface BotMessage {
  id: string;
  sender: 'manager' | 'bot';
  type: 'voice' | 'text' | 'invoice_preview' | 'print_sent';
  text: string;
  timestamp: string;
  voiceDurationSec?: number;
  parsedLines?: {
    phrase: string;
    matchedName: string;
    quantity: number;
    unit: string;
    price: number;
    sum: number;
  }[];
  invoiceNumber?: string;
  discountPercent?: DiscountPercent;
  retailTotal?: number;
  actualPaidTotal?: number;
}
