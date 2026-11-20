import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  DEFAULT_STUDIO_INFO,
  formatSerialNumber,
  getMonthKey,
  getTodayIsoDate,
  normalizeBDPhone,
} from '../constants/studioDefaults';
import type {
  Customer,
  Expense,
  ExpenseCategory,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  PaymentMethod,
  StudioSettings,
} from '../types/studio';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned.slice(0, 128) || `id_${Date.now()}`;
}

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return sanitizeId(`${prefix}_${Date.now()}_${rand}`);
}

function clampStr(val: string | undefined, max: number): string {
  return (val ?? '').trim().slice(0, max);
}

function clampMoney(val: number): number {
  if (!Number.isFinite(val) || val < 0) return 0;
  return Math.round(val * 100) / 100;
}

export async function ensureStudioSettings(userId: string): Promise<void> {
  const path = `users/${userId}/settings/studio`;
  const ref = doc(db, 'users', userId, 'settings', 'studio');
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: userId,
        studioName: DEFAULT_STUDIO_INFO.studioName,
        proprietorName: DEFAULT_STUDIO_INFO.proprietorName,
        mobile: DEFAULT_STUDIO_INFO.mobile,
        whatsappNumber: DEFAULT_STUDIO_INFO.whatsappNumber,
        address: DEFAULT_STUDIO_INFO.address,
        nextSerial: 1,
        autoBackupDrive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeStudioSettings(
  userId: string,
  onData: (settings: StudioSettings) => void
): () => void {
  const path = `users/${userId}/settings`;
  const q = query(collection(db, 'users', userId, 'settings'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const firstDoc = snapshot.docs[0];
      if (firstDoc) {
        onData({ id: firstDoc.id, ...(firstDoc.data() as StudioSettings) });
      } else {
        onData({
          ownerId: userId,
          ...DEFAULT_STUDIO_INFO,
          nextSerial: 1,
          autoBackupDrive: true,
        });
      }
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeCustomers(
  userId: string,
  onData: (customers: Customer[]) => void
): () => void {
  const path = `users/${userId}/customers`;
  const q = query(collection(db, 'users', userId, 'customers'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<Customer, 'id'>),
        id: d.id,
      }));
      rows.sort((a, b) => (b.serialNo ?? 0) - (a.serialNo ?? 0));
      onData(rows);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeInvoices(
  userId: string,
  onData: (invoices: Invoice[]) => void
): () => void {
  const path = `users/${userId}/invoices`;
  const q = query(collection(db, 'users', userId, 'invoices'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<Invoice, 'id'>),
        id: d.id,
      }));
      rows.sort((a, b) => (b.serialIndex ?? 0) - (a.serialIndex ?? 0));
      onData(rows);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeExpenses(
  userId: string,
  onData: (expenses: Expense[]) => void
): () => void {
  const path = `users/${userId}/expenses`;
  const q = query(collection(db, 'users', userId, 'expenses'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<Expense, 'id'>),
        id: d.id,
      }));
      rows.sort((a, b) => (b.expenseDate ?? '').localeCompare(a.expenseDate ?? ''));
      onData(rows);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function updateStudioSettings(
  userId: string,
  updates: Partial<
    Pick<
      StudioSettings,
      | 'studioName'
      | 'proprietorName'
      | 'mobile'
      | 'whatsappNumber'
      | 'address'
      | 'autoBackupDrive'
      | 'driveFolderId'
      | 'lastDriveBackupAt'
      | 'whatsappWebhookUrl'
    >
  >
): Promise<void> {
  const path = `users/${userId}/settings/studio`;
  const ref = doc(db, 'users', userId, 'settings', 'studio');
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.studioName !== undefined) payload.studioName = clampStr(updates.studioName, 120) || DEFAULT_STUDIO_INFO.studioName;
  if (updates.proprietorName !== undefined) payload.proprietorName = clampStr(updates.proprietorName, 120) || DEFAULT_STUDIO_INFO.proprietorName;
  if (updates.mobile !== undefined) payload.mobile = clampStr(updates.mobile, 24) || DEFAULT_STUDIO_INFO.mobile;
  if (updates.whatsappNumber !== undefined) payload.whatsappNumber = clampStr(updates.whatsappNumber, 24) || DEFAULT_STUDIO_INFO.whatsappNumber;
  if (updates.address !== undefined) payload.address = clampStr(updates.address, 240) || DEFAULT_STUDIO_INFO.address;
  if (updates.autoBackupDrive !== undefined) payload.autoBackupDrive = Boolean(updates.autoBackupDrive);
  if (updates.driveFolderId !== undefined) payload.driveFolderId = clampStr(updates.driveFolderId, 128);
  if (updates.lastDriveBackupAt !== undefined) payload.lastDriveBackupAt = clampStr(updates.lastDriveBackupAt, 64);
  if (updates.whatsappWebhookUrl !== undefined) payload.whatsappWebhookUrl = clampStr(updates.whatsappWebhookUrl, 300);

  try {
    await updateDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface CreateInvoiceInput {
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  existingCustomer?: Customer | null;
  allCustomers: Customer[];
  serialIndex: number;
  invoiceDate: string;
  deliveryDate?: string;
  items: InvoiceItem[];
  discount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export async function createInvoiceWithCustomerSync(
  userId: string,
  input: CreateInvoiceInput
): Promise<Invoice> {
  const batch = writeBatch(db);
  const cleanItems = input.items
    .filter((item) => item.name.trim().length > 0 && item.qty > 0)
    .slice(0, 25)
    .map((item) => {
      const qty = Math.max(1, Math.round(item.qty));
      const rate = clampMoney(item.rate);
      return {
        name: clampStr(item.name, 120),
        qty,
        rate,
        total: clampMoney(qty * rate),
      };
    });

  if (cleanItems.length === 0) {
    throw new Error('কমপক্ষে একটি সেবা বা আইটেম যোগ করুন।');
  }

  const subtotal = clampMoney(cleanItems.reduce((sum, item) => sum + item.total, 0));
  const discount = clampMoney(Math.min(input.discount, subtotal));
  const netTotal = clampMoney(Math.max(0, subtotal - discount));
  const paidAmount = clampMoney(Math.min(input.paidAmount, netTotal));
  const dueAmount = clampMoney(Math.max(0, netTotal - paidAmount));
  const status: InvoiceStatus =
    dueAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'due';

  const normalizedPhone = normalizeBDPhone(input.customerPhone);
  const matchedCustomer =
    input.existingCustomer ||
    input.allCustomers.find(
      (c) => normalizeBDPhone(c.phone) === normalizedPhone && normalizedPhone.length >= 10
    ) ||
    null;

  const customerId = matchedCustomer ? matchedCustomer.id : generateId('cust');
  const customerRef = doc(db, 'users', userId, 'customers', customerId);
  const invoiceDate = clampStr(input.invoiceDate, 32) || getTodayIsoDate();
  const cleanName = clampStr(input.customerName, 120) || 'সম্মানিত গ্রাহক';
  const cleanPhone = clampStr(input.customerPhone, 24) || '01700000000';

  if (matchedCustomer) {
    batch.update(customerRef, {
      name: cleanName,
      phone: cleanPhone,
      totalBilled: clampMoney(matchedCustomer.totalBilled + netTotal),
      totalPaid: clampMoney(matchedCustomer.totalPaid + paidAmount),
      totalDue: clampMoney(matchedCustomer.totalDue + dueAmount),
      invoiceCount: (matchedCustomer.invoiceCount || 0) + 1,
      lastVisitDate: invoiceDate,
      updatedAt: serverTimestamp(),
    });
  } else {
    const nextCustomerSerial =
      input.allCustomers.reduce((max, c) => Math.max(max, c.serialNo || 0), 0) + 1;
    const customerPayload: Record<string, unknown> = {
      ownerId: userId,
      serialNo: nextCustomerSerial,
      name: cleanName,
      phone: cleanPhone,
      totalBilled: netTotal,
      totalPaid: paidAmount,
      totalDue: dueAmount,
      invoiceCount: 1,
      lastVisitDate: invoiceDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.customerAddress && input.customerAddress.trim()) {
      customerPayload.address = clampStr(input.customerAddress, 200);
    }
    batch.set(customerRef, customerPayload);
  }

  const invoiceId = generateId('inv');
  const invoiceRef = doc(db, 'users', userId, 'invoices', invoiceId);
  const serialIndex = Math.max(1, Math.round(input.serialIndex));
  const serialNumber = formatSerialNumber(serialIndex);
  const monthKey = getMonthKey(invoiceDate);

  const invoicePayload: Record<string, unknown> = {
    ownerId: userId,
    serialNumber,
    serialIndex,
    customerId,
    customerName: cleanName,
    customerPhone: cleanPhone,
    invoiceDate,
    monthKey,
    items: cleanItems,
    subtotal,
    discount,
    netTotal,
    paidAmount,
    dueAmount,
    paymentMethod: input.paymentMethod,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (input.deliveryDate && input.deliveryDate.trim()) {
    invoicePayload.deliveryDate = clampStr(input.deliveryDate, 32);
  }
  if (input.notes && input.notes.trim()) {
    invoicePayload.notes = clampStr(input.notes, 500);
  }

  batch.set(invoiceRef, invoicePayload);

  const settingsRef = doc(db, 'users', userId, 'settings', 'studio');
  batch.update(settingsRef, {
    nextSerial: increment(1),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return {
      id: invoiceId,
      ownerId: userId,
      serialNumber,
      serialIndex,
      customerId,
      customerName: cleanName,
      customerPhone: cleanPhone,
      invoiceDate,
      deliveryDate: input.deliveryDate?.trim() || undefined,
      monthKey,
      items: cleanItems,
      subtotal,
      discount,
      netTotal,
      paidAmount,
      dueAmount,
      paymentMethod: input.paymentMethod,
      status,
      notes: input.notes?.trim() || undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/invoices/${invoiceId}`);
  }
}

export async function recordInvoicePayment(
  userId: string,
  invoice: Invoice,
  customer: Customer | undefined,
  paymentAmount: number,
  paymentMethod: PaymentMethod,
  notes?: string
): Promise<void> {
  const safePay = clampMoney(Math.min(paymentAmount, invoice.dueAmount));
  if (safePay <= 0) return;

  const newPaid = clampMoney(invoice.paidAmount + safePay);
  const newDue = clampMoney(Math.max(0, invoice.netTotal - newPaid));
  const newStatus: InvoiceStatus = newDue <= 0 ? 'paid' : 'partial';

  const batch = writeBatch(db);
  const invRef = doc(db, 'users', userId, 'invoices', invoice.id);
  const invUpdates: Record<string, unknown> = {
    paidAmount: newPaid,
    dueAmount: newDue,
    status: newStatus,
    paymentMethod,
    updatedAt: serverTimestamp(),
  };
  if (notes !== undefined && notes.trim()) {
    invUpdates.notes = clampStr(notes, 500);
  }
  batch.update(invRef, invUpdates);

  if (customer) {
    const custRef = doc(db, 'users', userId, 'customers', customer.id);
    batch.update(custRef, {
      name: customer.name,
      phone: customer.phone,
      totalBilled: customer.totalBilled,
      totalPaid: clampMoney(customer.totalPaid + safePay),
      totalDue: clampMoney(Math.max(0, customer.totalDue - safePay)),
      invoiceCount: customer.invoiceCount,
      lastVisitDate: getTodayIsoDate(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/invoices/${invoice.id}`);
  }
}

export async function settleCustomerDueAmount(
  userId: string,
  customer: Customer,
  customerInvoices: Invoice[],
  amount: number,
  paymentMethod: PaymentMethod
): Promise<void> {
  let remaining = clampMoney(Math.min(amount, customer.totalDue));
  if (remaining <= 0) return;

  const batch = writeBatch(db);
  const unpaid = [...customerInvoices]
    .filter((inv) => inv.status !== 'paid' && inv.dueAmount > 0)
    .sort((a, b) => a.serialIndex - b.serialIndex);

  let appliedTotal = 0;
  for (const inv of unpaid) {
    if (remaining <= 0) break;
    const payThis = clampMoney(Math.min(remaining, inv.dueAmount));
    if (payThis <= 0) continue;

    const newPaid = clampMoney(inv.paidAmount + payThis);
    const newDue = clampMoney(Math.max(0, inv.netTotal - newPaid));
    const newStatus: InvoiceStatus = newDue <= 0 ? 'paid' : 'partial';

    batch.update(doc(db, 'users', userId, 'invoices', inv.id), {
      paidAmount: newPaid,
      dueAmount: newDue,
      status: newStatus,
      paymentMethod,
      updatedAt: serverTimestamp(),
    });

    remaining = clampMoney(remaining - payThis);
    appliedTotal = clampMoney(appliedTotal + payThis);
  }

  const finalCredit = appliedTotal > 0 ? appliedTotal : clampMoney(Math.min(amount, customer.totalDue));
  batch.update(doc(db, 'users', userId, 'customers', customer.id), {
    name: customer.name,
    phone: customer.phone,
    totalBilled: customer.totalBilled,
    totalPaid: clampMoney(customer.totalPaid + finalCredit),
    totalDue: clampMoney(Math.max(0, customer.totalDue - finalCredit)),
    invoiceCount: customer.invoiceCount,
    lastVisitDate: getTodayIsoDate(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/customers/${customer.id}`);
  }
}

export async function updateCustomerProfile(
  userId: string,
  customerId: string,
  data: { name: string; phone: string; address?: string }
): Promise<void> {
  const path = `users/${userId}/customers/${customerId}`;
  const ref = doc(db, 'users', userId, 'customers', customerId);
  const payload: Record<string, unknown> = {
    name: clampStr(data.name, 120) || 'সম্মানিত গ্রাহক',
    phone: clampStr(data.phone, 24) || '01700000000',
    updatedAt: serverTimestamp(),
  };
  if (data.address !== undefined) {
    payload.address = clampStr(data.address, 200);
  }
  try {
    await updateDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateInvoiceDispatchMeta(
  userId: string,
  invoiceId: string,
  meta: {
    driveFileId?: string;
    driveWebViewLink?: string;
    whatsappSentAt?: string;
  }
): Promise<void> {
  const path = `users/${userId}/invoices/${invoiceId}`;
  const ref = doc(db, 'users', userId, 'invoices', invoiceId);
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (meta.driveFileId) payload.driveFileId = clampStr(meta.driveFileId, 128);
  if (meta.driveWebViewLink) payload.driveWebViewLink = clampStr(meta.driveWebViewLink, 300);
  if (meta.whatsappSentAt) payload.whatsappSentAt = clampStr(meta.whatsappSentAt, 64);
  try {
    await updateDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteInvoiceWithCustomerSync(
  userId: string,
  invoice: Invoice,
  customer: Customer | undefined
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', userId, 'invoices', invoice.id));
  if (customer) {
    batch.update(doc(db, 'users', userId, 'customers', customer.id), {
      name: customer.name,
      phone: customer.phone,
      totalBilled: clampMoney(Math.max(0, customer.totalBilled - invoice.netTotal)),
      totalPaid: clampMoney(Math.max(0, customer.totalPaid - invoice.paidAmount)),
      totalDue: clampMoney(Math.max(0, customer.totalDue - invoice.dueAmount)),
      invoiceCount: Math.max(0, (customer.invoiceCount || 1) - 1),
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/invoices/${invoice.id}`);
  }
}

export async function createExpense(
  userId: string,
  input: {
    title: string;
    category: ExpenseCategory;
    amount: number;
    expenseDate: string;
    notes?: string;
  }
): Promise<void> {
  const id = generateId('exp');
  const path = `users/${userId}/expenses/${id}`;
  const expenseDate = clampStr(input.expenseDate, 32) || getTodayIsoDate();
  const payload: Record<string, unknown> = {
    ownerId: userId,
    title: clampStr(input.title, 140) || 'স্টুডিও খরচ',
    category: input.category,
    amount: clampMoney(input.amount),
    expenseDate,
    monthKey: getMonthKey(expenseDate),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.notes && input.notes.trim()) {
    payload.notes = clampStr(input.notes, 300);
  }
  try {
    await setDoc(doc(db, 'users', userId, 'expenses', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteExpense(userId: string, expenseId: string): Promise<void> {
  const path = `users/${userId}/expenses/${expenseId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'expenses', expenseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function restoreStudioBackupPayload(
  userId: string,
  payload: {
    customers?: Customer[];
    invoices?: Invoice[];
    expenses?: Expense[];
  }
): Promise<void> {
  const custList = Array.isArray(payload.customers) ? payload.customers : [];
  const invList = Array.isArray(payload.invoices) ? payload.invoices : [];
  const expList = Array.isArray(payload.expenses) ? payload.expenses : [];

  // Write customers first so invoice existsAfter checks always succeed
  const custBatch = writeBatch(db);
  const validCustomerIds = new Set<string>();

  for (const c of custList) {
    const cid = sanitizeId(c.id || generateId('cust'));
    validCustomerIds.add(cid);
    const data: Record<string, unknown> = {
      ownerId: userId,
      serialNo: Math.max(1, Math.round(c.serialNo || 1)),
      name: clampStr(c.name, 120) || 'গ্রাহক',
      phone: clampStr(c.phone, 24) || '01700000000',
      totalBilled: clampMoney(c.totalBilled || 0),
      totalPaid: clampMoney(c.totalPaid || 0),
      totalDue: clampMoney(c.totalDue || 0),
      invoiceCount: Math.max(0, Math.round(c.invoiceCount || 0)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (c.address) data.address = clampStr(c.address, 200);
    if (c.lastVisitDate) data.lastVisitDate = clampStr(c.lastVisitDate, 32);
    custBatch.set(doc(db, 'users', userId, 'customers', cid), data);
  }
  if (custList.length > 0) {
    await custBatch.commit();
  }

  const invBatch = writeBatch(db);
  for (const inv of invList) {
    const iid = sanitizeId(inv.id || generateId('inv'));
    const cid = sanitizeId(inv.customerId || '');
    if (!validCustomerIds.has(cid)) continue;
    const cleanItems = (Array.isArray(inv.items) ? inv.items : [])
      .slice(0, 25)
      .map((item) => ({
        name: clampStr(item.name, 120) || 'সেবা',
        qty: Math.max(1, Math.round(item.qty || 1)),
        rate: clampMoney(item.rate || 0),
        total: clampMoney(item.total || 0),
      }));
    if (cleanItems.length === 0) continue;

    const invData: Record<string, unknown> = {
      ownerId: userId,
      serialNumber: clampStr(inv.serialNumber, 32) || formatSerialNumber(inv.serialIndex || 1),
      serialIndex: Math.max(1, Math.round(inv.serialIndex || 1)),
      customerId: cid,
      customerName: clampStr(inv.customerName, 120) || 'গ্রাহক',
      customerPhone: clampStr(inv.customerPhone, 24) || '01700000000',
      invoiceDate: clampStr(inv.invoiceDate, 32) || getTodayIsoDate(),
      monthKey: getMonthKey(inv.invoiceDate || getTodayIsoDate()),
      items: cleanItems,
      subtotal: clampMoney(inv.subtotal || 0),
      discount: clampMoney(inv.discount || 0),
      netTotal: clampMoney(inv.netTotal || 0),
      paidAmount: clampMoney(inv.paidAmount || 0),
      dueAmount: clampMoney(inv.dueAmount || 0),
      paymentMethod: inv.paymentMethod || 'cash',
      status: inv.status || 'due',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (inv.deliveryDate) invData.deliveryDate = clampStr(inv.deliveryDate, 32);
    if (inv.notes) invData.notes = clampStr(inv.notes, 500);
    invBatch.set(doc(db, 'users', userId, 'invoices', iid), invData);
  }
  for (const exp of expList) {
    const eid = sanitizeId(exp.id || generateId('exp'));
    const expDate = clampStr(exp.expenseDate, 32) || getTodayIsoDate();
    const expData: Record<string, unknown> = {
      ownerId: userId,
      title: clampStr(exp.title, 140) || 'খরচ',
      category: exp.category || 'other',
      amount: clampMoney(exp.amount || 0),
      expenseDate: expDate,
      monthKey: getMonthKey(expDate),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (exp.notes) expData.notes = clampStr(exp.notes, 300);
    invBatch.set(doc(db, 'users', userId, 'expenses', eid), expData);
  }
  if (invList.length > 0 || expList.length > 0) {
    await invBatch.commit();
  }
}
