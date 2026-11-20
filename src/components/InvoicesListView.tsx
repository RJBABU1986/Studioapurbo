import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  FilePlus2,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  formatBDT,
  PAYMENT_METHOD_LABELS,
  toBanglaDigits,
} from '../constants/studioDefaults';
import { ConfirmDialog } from './ConfirmDialog';
import {
  deleteInvoiceWithCustomerSync,
  recordInvoicePayment,
} from '../services/studioDb';
import type { Customer, Invoice, PaymentMethod } from '../types/studio';

interface InvoicesListViewProps {
  userId: string;
  invoices: Invoice[];
  customers: Customer[];
  onPreviewInvoice: (invoice: Invoice) => void;
  onCreateNew: () => void;
}

export const InvoicesListView: React.FC<InvoicesListViewProps> = ({
  userId,
  invoices,
  customers,
  onPreviewInvoice,
  onCreateNew,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'due'>('all');
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (!q) return true;
      return (
        inv.serialNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerPhone.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, statusFilter]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const cust = customers.find((c) => c.id === deleteTarget.customerId);
      await deleteInvoiceWithCustomerSync(userId, deleteTarget, cust);
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const openPayModal = (inv: Invoice) => {
    setPayTarget(inv);
    setPayAmount(String(inv.dueAmount));
    setPayMethod(inv.paymentMethod);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    const amt = Number(payAmount) || 0;
    if (amt <= 0) return;

    setBusy(true);
    try {
      const cust = customers.find((c) => c.id === payTarget.customerId);
      await recordInvoicePayment(userId, payTarget, cust, amt, payMethod);
      setPayTarget(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">সকল বিলিং রিসিট / ইনভয়েস</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            মোট <span className="font-mono-num font-semibold">{toBanglaDigits(invoices.length)}</span> টি রিসিট সংরক্ষিত আছে
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FilePlus2 className="w-4 h-4" />
          নতুন বিল তৈরি করুন
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ক্রমিক নং, গ্রাহকের নাম বা মোবাইল নাম্বার দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          {(
            [
              { id: 'all', label: 'সকল' },
              { id: 'paid', label: 'পরিশোধিত' },
              { id: 'partial', label: 'আংশিক' },
              { id: 'due', label: 'বকেয়া' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            কোনো বিলিং রিসিট পাওয়া যায়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold">ক্রমিক নং</th>
                  <th className="py-3 px-4 text-left font-semibold">তারিখ</th>
                  <th className="py-3 px-4 text-left font-semibold">গ্রাহকের নাম</th>
                  <th className="py-3 px-4 text-left font-semibold">মোবাইল নাম্বার</th>
                  <th className="py-3 px-4 text-right font-semibold">নিট বিল</th>
                  <th className="py-3 px-4 text-right font-semibold">জমা</th>
                  <th className="py-3 px-4 text-right font-semibold">বকেয়া</th>
                  <th className="py-3 px-4 text-left font-semibold">অবস্থা</th>
                  <th className="py-3 px-4 text-right font-semibold">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono-num font-bold text-slate-900 whitespace-nowrap">
                      {inv.serialNumber}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                      {inv.invoiceDate}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{inv.customerName}</td>
                    <td className="py-3 px-4 font-mono-num text-slate-700 whitespace-nowrap">
                      {inv.customerPhone}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                      {formatBDT(inv.netTotal)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-emerald-700 whitespace-nowrap">
                      {formatBDT(inv.paidAmount)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono-num font-bold whitespace-nowrap ${
                        inv.dueAmount > 0 ? 'text-red-700' : 'text-slate-400'
                      }`}
                    >
                      {formatBDT(inv.dueAmount)}
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      {inv.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          পরিশোধিত
                        </span>
                      ) : inv.status === 'partial' ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          আংশিক
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          বকেয়া
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onPreviewInvoice(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          রিসিট
                        </button>
                        {inv.dueAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => openPayModal(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md cursor-pointer"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            জমা নিন
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(inv)}
                          aria-label="রিসিট মুছুন"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {payTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleRecordPayment}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <h3 className="text-lg font-bold text-slate-900">
              বকেয়া পেমেন্ট গ্রহণ — {payTarget.serialNumber}
            </h3>
            <p className="text-xs text-slate-600">
              গ্রাহক: {payTarget.customerName} · অবশিষ্ট বকেয়া:{' '}
              <strong className="font-mono-num text-red-700">
                {formatBDT(payTarget.dueAmount)}
              </strong>
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                জমা টাকার পরিমাণ (৳)
              </label>
              <input
                type="number"
                min={1}
                max={payTarget.dueAmount}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                পেমেন্ট মাধ্যম
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer disabled:opacity-60"
              >
                {busy ? 'আপডেট হচ্ছে...' : 'জমা সংরক্ষণ করুন'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="বিলিং রিসিট মুছে ফেলবেন?"
        description={
          deleteTarget
            ? `রিসিট ${deleteTarget.serialNumber} (${deleteTarget.customerName}) স্থায়ীভাবে মুছে ফেলা হবে এবং গ্রাহকের বকেয়া হিসাব থেকে সমন্বয় করা হবে।`
            : ''
        }
        confirmLabel="হ্যাঁ, মুছে ফেলুন"
        destructive
        loading={busy}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
