import fs from 'fs';
import path from 'path';

export interface DebtHistoryEntry {
  id: string;
  date: string; // e.g. "12.10.2026, 14:30"
  invoiceNumber: string;
  invoiceTotal: number;
  paidCash: number;
  debtAdded: number; // + amount added to debt, or negative if repayment
  totalDebtAfter: number;
  note?: string;
}

export interface Debtor {
  id: string;
  fullName: string; // ФИО
  phone: string; // Телефон
  idCardNumber: string; // Номер удостоверения личности / ИИН
  address: string; // Адрес
  totalDebt: number; // Сумма долга в тенге ₸
  history: DebtHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

const DEBT_LIMIT_KZT = 200000; // Лимит 200 000 тенге

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DEBTORS_FILE = path.join(DATA_DIR, 'debtors.json');

// Начальные реалистичные данные клиентов-должников (Казахстан)
const INITIAL_DEBTORS: Debtor[] = [
  {
    id: 'deb-1',
    fullName: 'Мамыров Серик Касымович',
    phone: '+7 701 555-41-23',
    idCardNumber: '048291045',
    address: 'г. Алматы, мкр. Аксай-4, д. 18, кв. 45',
    totalDebt: 50000,
    history: [
      {
        id: 'dh-1',
        date: '10.10.2026, 11:20',
        invoiceNumber: 'РН-0415-78-12',
        invoiceTotal: 85000,
        paidCash: 35000,
        debtAdded: 50000,
        totalDebtAfter: 50000,
        note: 'Трубы и фитинги на объект ЖК Алатау',
      },
    ],
    createdAt: '10.10.2026',
    updatedAt: '10.10.2026',
  },
  {
    id: 'deb-2',
    fullName: 'Асанов Бахытжан Нурланович',
    phone: '+7 777 234-89-90',
    idCardNumber: '051284920',
    address: 'г. Алматы, ул. Жандосова, д. 94, офис 12',
    totalDebt: 190000,
    history: [
      {
        id: 'dh-2',
        date: '08.10.2026, 15:40',
        invoiceNumber: 'РН-0410-65-88',
        invoiceTotal: 140000,
        paidCash: 40000,
        debtAdded: 100000,
        totalDebtAfter: 100000,
        note: 'Комплект отопления',
      },
      {
        id: 'dh-3',
        date: '11.10.2026, 09:15',
        invoiceNumber: 'РН-0418-72-40',
        invoiceTotal: 120000,
        paidCash: 30000,
        debtAdded: 90000,
        totalDebtAfter: 190000,
        note: 'Радиаторы и арматура',
      },
    ],
    createdAt: '08.10.2026',
    updatedAt: '11.10.2026',
  },
  {
    id: 'deb-3',
    fullName: 'Кенесов Даурен Мухтарович',
    phone: '+7 705 981-12-67',
    idCardNumber: '039485712',
    address: 'г. Алматы, пос. Боралдай, ул. Абая, 34',
    totalDebt: 215000,
    history: [
      {
        id: 'dh-4',
        date: '05.10.2026, 14:00',
        invoiceNumber: 'РН-0402-55-11',
        invoiceTotal: 150000,
        paidCash: 0,
        debtAdded: 150000,
        totalDebtAfter: 150000,
        note: 'Закупка труб ПВХ и фитингов',
      },
      {
        id: 'dh-5',
        date: '09.10.2026, 17:30',
        invoiceNumber: 'РН-0412-88-23',
        invoiceTotal: 65000,
        paidCash: 0,
        debtAdded: 65000,
        totalDebtAfter: 215000,
        note: 'Доборные элементы',
      },
    ],
    createdAt: '05.10.2026',
    updatedAt: '09.10.2026',
  },
];

export class DebtorsService {
  private debtors: Debtor[] = [];

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DEBTORS_FILE)) {
        const raw = fs.readFileSync(DEBTORS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.debtors = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load debtors from disk, using initial list:', e);
    }
    this.debtors = [...INITIAL_DEBTORS];
    this.saveToDisk();
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DEBTORS_FILE, JSON.stringify(this.debtors, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving debtors to disk:', e);
    }
  }

  public getAll(): Debtor[] {
    return this.debtors;
  }

  public getById(id: string): Debtor | undefined {
    return this.debtors.find((d) => d.id === id);
  }

  public findByQuery(query: string): Debtor[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.debtors;
    return this.debtors.filter(
      (d) =>
        d.fullName.toLowerCase().includes(q) ||
        d.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
        d.idCardNumber.toLowerCase().includes(q)
    );
  }

  public checkLimit(debtorId: string | null, additionalDebt: number): {
    limitExceeded: boolean;
    currentDebt: number;
    newTotalDebt: number;
    limit: number;
    message?: string;
  } {
    const current = debtorId ? this.getById(debtorId)?.totalDebt || 0 : 0;
    const newTotalDebt = current + additionalDebt;
    const limitExceeded = newTotalDebt > DEBT_LIMIT_KZT;

    return {
      limitExceeded,
      currentDebt: current,
      newTotalDebt,
      limit: DEBT_LIMIT_KZT,
      message: limitExceeded
        ? `⚠️ ВНИМАНИЕ: У клиента превышен лимит долга! Новый долг составит ${newTotalDebt.toLocaleString(
            'ru-RU'
          )} ₸ (максимум ${DEBT_LIMIT_KZT.toLocaleString(
            'ru-RU'
          )} ₸). Требуйте полного расчёта, отпуск только за наличные!`
        : undefined,
    };
  }

  public addOrUpdateDebt(params: {
    debtorId?: string;
    fullName: string;
    phone?: string;
    idCardNumber?: string;
    address?: string;
    invoiceNumber: string;
    invoiceTotal: number;
    paidCash: number;
    debtAdded: number;
    note?: string;
  }): { success: boolean; debtor: Debtor; limitExceeded: boolean; message?: string } {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU') + ', ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    let debtor: Debtor | undefined;

    if (params.debtorId) {
      debtor = this.getById(params.debtorId);
    }

    if (!debtor && params.fullName) {
      const cleanName = params.fullName.trim().toLowerCase();
      debtor = this.debtors.find((d) => d.fullName.trim().toLowerCase() === cleanName);
    }

    if (!debtor) {
      // Создаем нового должника
      debtor = {
        id: `deb-${Date.now()}`,
        fullName: params.fullName.trim(),
        phone: params.phone?.trim() || 'Не указан',
        idCardNumber: params.idCardNumber?.trim() || 'Не указан',
        address: params.address?.trim() || 'г. Алматы',
        totalDebt: 0,
        history: [],
        createdAt: now.toLocaleDateString('ru-RU'),
        updatedAt: dateStr,
      };
      this.debtors.unshift(debtor);
    } else {
      // Обновляем реквизиты, если были переданы
      if (params.phone && params.phone.trim()) debtor.phone = params.phone.trim();
      if (params.idCardNumber && params.idCardNumber.trim()) debtor.idCardNumber = params.idCardNumber.trim();
      if (params.address && params.address.trim()) debtor.address = params.address.trim();
    }

    const previousDebt = debtor.totalDebt;
    const newDebt = previousDebt + params.debtAdded;
    debtor.totalDebt = Math.max(0, newDebt);
    debtor.updatedAt = dateStr;

    const historyEntry: DebtHistoryEntry = {
      id: `dh-${Date.now()}`,
      date: dateStr,
      invoiceNumber: params.invoiceNumber,
      invoiceTotal: params.invoiceTotal,
      paidCash: params.paidCash,
      debtAdded: params.debtAdded,
      totalDebtAfter: debtor.totalDebt,
      note: params.note || `Накладная ${params.invoiceNumber} (Оплачено: ${params.paidCash} ₸, в долг: +${params.debtAdded} ₸)`,
    };

    debtor.history.unshift(historyEntry);
    this.saveToDisk();

    const limitExceeded = debtor.totalDebt > DEBT_LIMIT_KZT;

    return {
      success: true,
      debtor,
      limitExceeded,
      message: limitExceeded
        ? `⚠️ ВНИМАНИЕ МЕНЕДЖЕРУ: У клиента ${debtor.fullName} ПРЕВЫШЕН ЛИМИТ (${debtor.totalDebt.toLocaleString(
            'ru-RU'
          )} ₸ > 200 000 ₸)! Требуйте полного расчёта, больше в долг не давать!`
        : undefined,
    };
  }

  public recordRepayment(debtorId: string, amount: number, note?: string): { success: boolean; debtor?: Debtor; error?: string } {
    const debtor = this.getById(debtorId);
    if (!debtor) return { success: false, error: 'Должник не найден' };

    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU') + ', ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    debtor.totalDebt = Math.max(0, debtor.totalDebt - amount);
    debtor.updatedAt = dateStr;

    debtor.history.unshift({
      id: `dh-${Date.now()}`,
      date: dateStr,
      invoiceNumber: 'Погашение долга',
      invoiceTotal: 0,
      paidCash: amount,
      debtAdded: -amount,
      totalDebtAfter: debtor.totalDebt,
      note: note || `Погашение долга из кассы: -${amount.toLocaleString('ru-RU')} ₸`,
    });

    this.saveToDisk();
    return { success: true, debtor };
  }
}

export const debtorsService = new DebtorsService();
