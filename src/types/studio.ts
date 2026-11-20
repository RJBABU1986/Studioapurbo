import type { Timestamp } from 'firebase/firestore';

export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'bank';
export type InvoiceStatus = 'paid' | 'partial' | 'due';
export type ExpenseCategory = 'supplies' | 'rent' | 'utilities' | 'equipment' | 'salary' | 'other';

export interface StudioSettings {
  id?: string;
  ownerId: string;
  studioName: string;
  proprietorName: string;
  mobile: string;
  whatsappNumber: string;
  address: string;
  nextSerial: number;
  autoBackupDrive: boolean;
  driveFolderId?: string;
  lastDriveBackupAt?: string;
  whatsappWebhookUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Customer {
  id: string;
  ownerId: string;
  serialNo: number;
  name: string;
  phone: string;
  address?: string;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  invoiceCount: number;
  lastVisitDate?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface InvoiceItem {
  name: string;
  qty: number;
  rate: number;
  total: number;
}

export interface Invoice {
  id: string;
  ownerId: string;
  serialNumber: string;
  serialIndex: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
  invoiceDate: string;
  deliveryDate?: string;
  monthKey: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  netTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  status: InvoiceStatus;
  notes?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  whatsappSentAt?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Expense {
  id: string;
  ownerId: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  monthKey: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface DriveBackupFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
}

export type AppSection =
  | 'dashboard'
  | 'new-invoice'
  | 'invoices'
  | 'customers'
  | 'monthly-accounts'
  | 'backup-settings';
