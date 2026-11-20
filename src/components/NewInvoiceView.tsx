import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  Save,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  formatBDT,
  formatSerialNumber,
  getTodayIsoDate,
  normalizeBDPhone,
  PAYMENT_METHOD_LABELS,
  STUDIO_SERVICE_PRESETS,
  toBanglaDigits,
} from '../constants/studioDefaults';
import { createInvoiceWithCustomerSync } from '../services/studioDb';
import type {
  Customer,
  Invoice,
  InvoiceItem,
  PaymentMethod,
  StudioSettings,
} from '../types/studio';

interface NewInvoiceViewProps {
  userId: string;
  settings: StudioSettings;
  customers: Customer[];
  onInvoiceCreated: (invoice: Invoice, options: { openWhatsapp: boolean; backupDrive: boolean }) => void;
}

export const NewInvoiceView: React.FC<NewInvoiceViewProps> = ({
  userId,
  settings,
  customers,
  onInvoiceCreated,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState(getTodayIsoDate());
  const [deliveryDate, setDeliveryDate] = useState(getTodayIsoDate());
  const [items, setItems] = useState<InvoiceItem[]>([
    { name: 'পাসপোর্ট সাইজ ছবি (৪ কপি)', qty: 1, rate: 60, total: 60 },
  ]);
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmountInput, setPaidAmountInput] = useState<string>('60');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [autoWhatsapp, setAutoWhatsapp] = useState(true);
  const [autoDrivePdf, setAutoDrivePdf] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, item.qty) * Math.max(0, item.rate), 0),
    [items]
  );
  const safeDiscount = Math.min(Math.max(0, discount || 0), subtotal);
  const netTotal = Math.max(0, subtotal - safeDiscount);
  const paidNum = Math.min(Math.max(0, Number(paidAmountInput) || 0), netTotal);
  const dueAmount = Math.max(0, netTotal - paidNum);

  const matchedCustomer = useMemo(() => {
    if (selectedCustomerId) {
      return customers.find((c) => c.id === selectedCustomerId) || null;
    }
    const norm = normalizeBDPhone(customerPhone);
    if (norm.length >= 10) {
      return customers.find((c) => normalizeBDPhone(c.phone) === norm) || null;
    }
    return null;
  }, [customers, customerPhone, selectedCustomerId]);

  const handleSelectCustomer = (custId: string) => {
    setSelectedCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setCustomerName(found.name);
      setCustomerPhone(found.phone);
      setCustomerAddress(found.address || '');
    }
  };

  const handleAddPreset = (name: string, rate: number, qty: number) => {
    setItems((prev) => {
      if (prev.length >= 25) return prev;
      const existingIdx = prev.findIndex((p) => p.name === name && p.rate === rate);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const nextQty = updated[existingIdx].qty + qty;
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: nextQty,
          total: nextQty * rate,
        };
        return updated;
      }
      return [...prev, { name, qty, rate, total: qty * rate }];
    });
  };

  const handleAddEmptyRow = () => {
    if (items.length >= 25) return;
    setItems((prev) => [...prev, { name: '', qty: 1, rate: 0, total: 0 }]);
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [field]: value };
        updated.qty = Math.max(1, Number(updated.qty) || 1);
        updated.rate = Math.max(0, Number(updated.rate) || 0);
        updated.total = updated.qty * updated.rate;
        return updated;
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customerName.trim()) {
      setErrorMsg('গ্রাহকের নাম লিখুন।');
      return;
    }
    if (normalizeBDPhone(customerPhone).length < 6) {
      setErrorMsg('গ্রাহকের সঠিক মোবাইল / WhatsApp নাম্বার দিন।');
      return;
    }
    const validItems = items.filter((i) => i.name.trim().length > 0 && i.qty > 0);
    if (validItems.length === 0) {
      setErrorMsg('কমপক্ষে একটি সেবার বিবরণ দিন।');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createInvoiceWithCustomerSync(userId, {
        customerName,
        customerPhone,
        customerAddress,
        existingCustomer: matchedCustomer,
        allCustomers: customers,
        serialIndex: settings.nextSerial || 1,
        invoiceDate,
        deliveryDate,
        items: validItems,
        discount: safeDiscount,
        paidAmount: paidNum,
        paymentMethod,
        notes,
      });

      // Reset form cleanly for next customer
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setSelectedCustomerId('');
      setItems([{ name: 'পাসপোর্ট সাইজ ছবি (৪ কপি)', qty: 1, rate: 60, total: 60 }]);
      setDiscount(0);
      setPaidAmountInput('60');
      setNotes('');

      onInvoiceCreated(created, {
        openWhatsapp: autoWhatsapp,
        backupDrive: autoDrivePdf,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'রিসিট সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900">নতুন কাস্টমার বিলিং রিসিট / ইনভয়েস</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {settings.studioName} · অফিসিয়াল WhatsApp প্রেরক: {settings.whatsappNumber}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs text-slate-500">পরবর্তী ক্রমিক নং</div>
            <div className="text-lg font-bold font-mono-num text-slate-900">
              {formatSerialNumber(settings.nextSerial || 1)}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        {/* Customer Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              পুরাতন গ্রাহক নির্বাচন (ঐচ্ছিক)
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleSelectCustomer(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">-- নতুন গ্রাহক লিখুন --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.serialNo} {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              গ্রাহকের নাম *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                if (selectedCustomerId) setSelectedCustomerId('');
              }}
              placeholder="যেমন: মোঃ কামাল হোসেন"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              গ্রাহকের মোবাইল / WhatsApp নাম্বার *
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="017XXXXXXXX"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-slate-900"
              required
            />
          </div>
        </div>

        {matchedCustomer && (
          <div className="mb-6 p-3.5 rounded-lg bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-900">
            <div className="flex items-center gap-2 font-medium">
              <UserCheck className="w-4 h-4 text-blue-700 shrink-0" />
              <span>
                বিদ্যমান গ্রাহক শনাক্ত হয়েছে (#{toBanglaDigits(matchedCustomer.serialNo)} {matchedCustomer.name})
              </span>
            </div>
            <div className="font-mono-num font-semibold">
              পূর্বের বকেয়া: {formatBDT(matchedCustomer.totalDue)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              বিলের তারিখ
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ডেলিভারির তারিখ
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ঠিকানা (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="ভাদাইল / আশুলিয়া"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Quick Preset Service Buttons */}
        <div className="mb-5">
          <div className="text-xs font-semibold text-slate-700 mb-2">
            দ্রুত সেবা যোগ করুন (ক্লিক করলেই তালিকায় যুক্ত হবে):
          </div>
          <div className="flex flex-wrap gap-2">
            {STUDIO_SERVICE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleAddPreset(preset.name, preset.rate, preset.defaultQty)}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                + {preset.name} ({formatBDT(preset.rate)})
              </button>
            ))}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="py-2.5 px-3 text-left font-semibold">কাজের / সেবার বিবরণ</th>
                <th className="py-2.5 px-3 text-right font-semibold w-24">পরিমাণ</th>
                <th className="py-2.5 px-3 text-right font-semibold w-28">দর (৳)</th>
                <th className="py-2.5 px-3 text-right font-semibold w-28">মোট (৳)</th>
                <th className="py-2.5 px-3 text-center font-semibold w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      placeholder="সেবার নাম লিখুন"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm text-right font-mono-num border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      value={item.rate}
                      onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm text-right font-mono-num border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </td>
                  <td className="p-2 text-right font-mono-num font-semibold text-slate-900">
                    {formatBDT(item.qty * item.rate)}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      disabled={items.length <= 1}
                      aria-label="সারি মুছুন"
                      className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200">
            <button
              type="button"
              onClick={handleAddEmptyRow}
              disabled={items.length >= 25}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              আরও একটি আইটেম যোগ করুন
            </button>
          </div>
        </div>

        {/* Payment & Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  পেমেন্ট মাধ্যম
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  নোট / ডেলিভারি মন্তব্য
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="যেমন: জরুরি প্রিন্ট, বিকাল ৫টায় ডেলিভারি"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={autoDrivePdf}
                  onChange={(e) => setAutoDrivePdf(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>সেভ করার সাথে সাথে Google Drive-এ ব্যাকআপ রাখুন</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={autoWhatsapp}
                  onChange={(e) => setAutoWhatsapp(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                />
                <span>
                  সেভ হওয়ার পর PDF তৈরি করে গ্রাহকের WhatsApp-এ পাঠান (প্রেরক: {settings.whatsappNumber})
                </span>
              </label>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">মোট বিল</span>
              <span className="font-mono-num font-semibold text-slate-900">
                {formatBDT(subtotal)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 text-sm">
              <label htmlFor="discount-input" className="text-slate-600">
                ডিসকাউন্ট (৳)
              </label>
              <input
                id="discount-input"
                type="number"
                min={0}
                max={subtotal}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="w-32 px-2.5 py-1 text-right font-mono-num border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-base font-bold">
              <span className="text-slate-900">নিট বিল</span>
              <span className="font-mono-num text-slate-900">{formatBDT(netTotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <label htmlFor="paid-input" className="text-slate-700 font-semibold">
                  জমা (৳)
                </label>
                <button
                  type="button"
                  onClick={() => setPaidAmountInput(String(netTotal))}
                  className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                >
                  পুরো জমা
                </button>
              </div>
              <input
                id="paid-input"
                type="number"
                min={0}
                max={netTotal}
                value={paidAmountInput}
                onChange={(e) => setPaidAmountInput(e.target.value)}
                className="w-32 px-2.5 py-1 text-right font-mono-num font-semibold border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="pt-2 border-t border-dashed border-slate-300 flex items-center justify-between text-base font-bold">
              <span className={dueAmount > 0 ? 'text-red-700' : 'text-emerald-700'}>
                বকেয়া
              </span>
              <span
                className={`font-mono-num ${dueAmount > 0 ? 'text-red-700' : 'text-emerald-700'}`}
              >
                {formatBDT(dueAmount)}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 px-4 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                'সংরক্ষণ হচ্ছে...'
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  বিল সংরক্ষণ করুন ও রিসিট দেখুন
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Helpful info row */}
      <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
        <span>
          রিসিট সেভ হওয়ার সাথে সাথেই কাস্টমার বকেয়া খাতা এবং প্রতি মাসের হিসাব স্বয়ংক্রিয়ভাবে আপডেট হয়ে যাবে।
        </span>
      </div>
    </form>
  );
};
