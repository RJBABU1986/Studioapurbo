import React, { useMemo, useState } from 'react';
import {
  Edit3,
  MessageCircle,
  Search,
  Wallet,
} from 'lucide-react';
import {
  formatBDT,
  PAYMENT_METHOD_LABELS,
  toBanglaDigits,
} from '../constants/studioDefaults';
import {
  settleCustomerDueAmount,
  updateCustomerProfile,
} from '../services/studioDb';
import {
  buildWhatsAppDueReminderMessage,
  openWhatsAppTextChat,
} from '../services/pdfAndWhatsapp';
import type { Customer, Invoice, PaymentMethod, StudioSettings } from '../types/studio';

interface CustomersDueViewProps {
  userId: string;
  settings: StudioSettings;
  customers: Customer[];
  invoices: Invoice[];
}

export const CustomersDueView: React.FC<CustomersDueViewProps> = ({
  userId,
  settings,
  customers,
  invoices,
}) => {
  const [search, setSearch] = useState('');
  const [onlyDue, setOnlyDue] = useState(false);

  const [settleTarget, setSettleTarget] = useState<Customer | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('cash');

  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');

  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (onlyDue && c.totalDue <= 0) return false;
      if (!q) return true;
      return (
        String(c.serialNo).includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
      );
    });
  }, [customers, onlyDue, search]);

  const totalDueSum = useMemo(
    () => customers.reduce((sum, c) => sum + (c.totalDue || 0), 0),
    [customers]
  );

  const openSettle = (cust: Customer) => {
    setSettleTarget(cust);
    setSettleAmount(String(cust.totalDue));
    setSettleMethod('cash');
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;
    const amt = Number(settleAmount) || 0;
    if (amt <= 0) return;
    setBusy(true);
    try {
      const custInvoices = invoices.filter((inv) => inv.customerId === settleTarget.id);
      await settleCustomerDueAmount(userId, settleTarget, custInvoices, amt, settleMethod);
      setSettleTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (cust: Customer) => {
    setEditTarget(cust);
    setEditName(cust.name);
    setEditPhone(cust.phone);
    setEditAddress(cust.address || '');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setBusy(true);
    try {
      await updateCustomerProfile(userId, editTarget.id, {
        name: editName,
        phone: editPhone,
        address: editAddress,
      });
      setEditTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const handleSendDueReminder = (cust: Customer) => {
    const msg = buildWhatsAppDueReminderMessage(cust, settings);
    openWhatsAppTextChat(cust.phone, msg);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">কাস্টমার ও বকেয়া খাতা</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            মোট গ্রাহক: <span className="font-mono-num font-semibold">{toBanglaDigits(customers.length)}</span> জন
            {' · '}
            মোট বকেয়া: <span className="font-mono-num font-bold text-red-700">{formatBDT(totalDueSum)}</span>
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setOnlyDue(false)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              !onlyDue ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            সকল গ্রাহক
          </button>
          <button
            type="button"
            onClick={() => setOnlyDue(true)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              onlyDue ? 'bg-white text-red-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            শুধু বকেয়া
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ক্রমিক নং, গ্রাহকের নাম বা মোবাইল নাম্বার দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            এই তালিকায় কোনো গ্রাহক পাওয়া যায়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-left font-semibold">ক্রমিক নং</th>
                  <th className="py-3 px-4 text-left font-semibold">গ্রাহকের নাম</th>
                  <th className="py-3 px-4 text-left font-semibold">গ্রাহকের মোবাইল নাম্বার</th>
                  <th className="py-3 px-4 text-right font-semibold">মোট বিল</th>
                  <th className="py-3 px-4 text-right font-semibold">জমা</th>
                  <th className="py-3 px-4 text-right font-semibold">বকেয়া</th>
                  <th className="py-3 px-4 text-right font-semibold">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono-num font-bold text-slate-900 whitespace-nowrap">
                      {toBanglaDigits(cust.serialNo)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{cust.name}</div>
                      {cust.address && (
                        <div className="text-xs text-slate-500">{cust.address}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-slate-700 whitespace-nowrap">
                      {cust.phone}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-slate-900 whitespace-nowrap">
                      {formatBDT(cust.totalBilled)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-emerald-700 whitespace-nowrap">
                      {formatBDT(cust.totalPaid)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono-num font-bold whitespace-nowrap ${
                        cust.totalDue > 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {cust.totalDue > 0 ? formatBDT(cust.totalDue) : '০ (পরিশোধিত)'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {cust.totalDue > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => openSettle(cust)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              বকেয়া জমা
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendDueReminder(cust)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              WhatsApp তাগাদা
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(cust)}
                          aria-label="তথ্য সম্পাদনা"
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
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

      {/* Settle Due Modal */}
      {settleTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSettleSubmit}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <h3 className="text-lg font-bold text-slate-900">
              বকেয়া আদায় — {settleTarget.name}
            </h3>
            <p className="text-xs text-slate-600">
              মোট বকেয়া:{' '}
              <strong className="font-mono-num text-red-700">
                {formatBDT(settleTarget.totalDue)}
              </strong>
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                আদায়কৃত টাকা (৳)
              </label>
              <input
                type="number"
                min={1}
                max={settleTarget.totalDue}
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                পেমেন্ট মাধ্যম
              </label>
              <select
                value={settleMethod}
                onChange={(e) => setSettleMethod(e.target.value as PaymentMethod)}
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
                onClick={() => setSettleTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer disabled:opacity-60"
              >
                {busy ? 'সংরক্ষণ হচ্ছে...' : 'জমা নিশ্চিত করুন'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleEditSubmit}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <h3 className="text-lg font-bold text-slate-900">গ্রাহকের তথ্য পরিবর্তন</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                গ্রাহকের নাম
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                মোবাইল নাম্বার
              </label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ঠিকানা
              </label>
              <input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer disabled:opacity-60"
              >
                {busy ? 'আপডেট হচ্ছে...' : 'সংরক্ষণ করুন'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
