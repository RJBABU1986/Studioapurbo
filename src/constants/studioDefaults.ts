import type { ExpenseCategory, PaymentMethod } from '../types/studio';

export const DEFAULT_STUDIO_INFO = {
  studioName: 'অপূর্ব ডিজিটাল ষ্টুডিও',
  proprietorName: 'মোহাম্মদ সুমন আহাম্মেদ',
  mobile: '01715-938402',
  whatsappNumber: '01674-977245',
  address: 'ভাদাইল বাজার, চৌরাস্তা, আশুলিয়া, সাভার, ঢাকা - ১৩৪৯',
};

export interface ServicePreset {
  name: string;
  rate: number;
  defaultQty: number;
}

export const STUDIO_SERVICE_PRESETS: ServicePreset[] = [
  { name: 'পাসপোর্ট সাইজ ছবি (৪ কপি)', rate: 60, defaultQty: 1 },
  { name: 'পাসপোর্ট + স্ট্যাম্প ছবি সেট', rate: 100, defaultQty: 1 },
  { name: '4R ফটো প্রিন্ট', rate: 30, defaultQty: 1 },
  { name: '5R ফটো প্রিন্ট', rate: 60, defaultQty: 1 },
  { name: '8R / A4 লার্জ প্রিন্ট', rate: 150, defaultQty: 1 },
  { name: 'ফটো ফ্রেমিং (8R/12R)', rate: 350, defaultQty: 1 },
  { name: 'লেমিনেশন (A4 / আইডি কার্ড)', rate: 30, defaultQty: 1 },
  { name: 'জরুরি ছবি এডিটিং ও রিটাচ', rate: 80, defaultQty: 1 },
  { name: 'অনলাইন আবেদন / ফর্ম পূরণ', rate: 100, defaultQty: 1 },
  { name: 'ইভেন্ট ফটোগ্রাফি প্যাকেজ', rate: 3000, defaultQty: 1 },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'নগদ (Cash)',
  bkash: 'বিকাশ (bKash)',
  nagad: 'নগদ অ্যাপ (Nagad)',
  rocket: 'রকেট (Rocket)',
  bank: 'ব্যাংক ট্রান্সফার',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  supplies: 'ফটো পেপার ও কালি',
  rent: 'দোকান ভাড়া',
  utilities: 'বিদ্যুৎ ও ইন্টারনেট বিল',
  equipment: 'ক্যামেরা ও প্রিন্টার মেরামত',
  salary: 'কর্মচারী বেতন',
  other: 'অন্যান্য খরচ',
};

const BANGLA_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)] ?? d);
}

export function formatBDT(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `৳ ${safe.toLocaleString('en-IN')}`;
}

export function formatSerialNumber(index: number): string {
  return `ODS-${String(index).padStart(4, '0')}`;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMonthKey(dateStr: string): string {
  if (/^\d{4}-\d{2}/.test(dateStr)) {
    return dateStr.slice(0, 7);
  }
  return getTodayIsoDate().slice(0, 7);
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthIdx = Number(month) - 1;
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${BANGLA_MONTHS[monthIdx]} ${toBanglaDigits(year)}`;
  }
  return monthKey;
}

export function normalizeBDPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('880') && digits.length >= 13) {
    return `0${digits.slice(3, 13)}`;
  }
  if (digits.startsWith('01') && digits.length >= 11) {
    return digits.slice(0, 11);
  }
  return digits;
}

export function toE164BDPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('880')) {
    return `+${digits}`;
  }
  if (digits.startsWith('01')) {
    return `+88${digits}`;
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `+880${digits}`;
  }
  return `+${digits}`;
}

export function formatWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `88${digits}`;
  if (digits.startsWith('1') && digits.length === 10) return `880${digits}`;
  return digits;
}
