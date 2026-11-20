import React from 'react';
import {
  ArrowRight,
  Cloud,
  FilePlus2,
  MessageCircle,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react';
import {
  formatBDT,
  formatMonthLabel,
  getTodayIsoDate,
  toBanglaDigits,
} from '../constants/studioDefaults';
import type {
  AppSection,
  Customer,
  Expense,
  Invoice,
  StudioSettings,
} from '../types/studio';

interface DashboardOverviewProps {
  settings: StudioSettings;
  invoices: Invoice[];
  customers: Customer[];
  expenses: Expense[];
  driveConnected: boolean;
  backingUp: boolean;
  onNavigate: (section: AppSection) => void;
  onPreviewInvoice: (invoice: Invoice) => void;
  onTriggerDriveBackup: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  settings,
  invoices,
  customers,
  expenses,
  driveConnected,
  backingUp,
  onNavigate,
  onPreviewInvoice,
  onTriggerDriveBackup,
}) => {
  const currentMonth = getTodayIsoDate().slice(0, 7);
  const monthInvoices = invoices.filter((inv) => inv.monthKey === currentMonth);
  const monthExpenses = expenses.filter((exp) => exp.monthKey === currentMonth);

  const monthBilled = monthInvoices.reduce((s, i) => s + i.netTotal, 0);
  const monthCollected = monthInvoices.reduce((s, i) => s + i.paidAmount, 0);
  const monthExpenseTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const monthNetProfit = monthCollected - monthExpenseTotal;

  const totalOutstandingDue = customers.reduce((s, c) => s + (c.totalDue || 0), 0);
  const dueCustomers = customers
    .filter((c) => c.totalDue > 0)
    .sort((a, b) => b.totalDue - a.totalDue)
    .slice(0, 5);
  const recentInvoices = invoices.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Studio Welcome & Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
            <span>{settings.studioName}</span>
            <span aria-hidden="true">·</span>
            <span>প্রোঃ {settings.proprietorName}</span>
            <span aria-hidden="true">·</span>
            <span>চলতি মাস: {formatMonthLabel(currentMonth)}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            ডিজিটাল স্টুডিও হিসাব ও বিলিং ড্যাশবোর্ড
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            অফিসিয়াল মোবাইল: <span className="font-mono-num font-semibold">{settings.mobile}</span>
            {' · '}
            WhatsApp প্রেরক: <span className="font-mono-num font-semibold text-emerald-700">{settings.whatsappNumber}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onTriggerDriveBackup}
            disabled={backingUp}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <Cloud className="w-4 h-4 text-blue-700" />
            {backingUp
              ? 'Drive ব্যাকআপ চলছে...'
              : driveConnected
              ? 'Google Drive ব্যাকআপ'
              : 'Drive সংযুক্ত করে ব্যাকআপ'}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('new-invoice')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4" />
            নতুন বিল / রিসিট তৈরি করুন
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>চলতি মাসের মোট বিল</span>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-slate-900 mt-2">
            {formatBDT(monthBilled)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            মোট রিসিট: <span className="font-mono-num font-semibold">{toBanglaDigits(monthInvoices.length)}</span> টি
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>চলতি মাসে আদায়</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-emerald-700 mt-2">
            {formatBDT(monthCollected)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            নিট লাভ (খরচ বাদে):{' '}
            <span className="font-mono-num font-semibold text-slate-900">
              {formatBDT(monthNetProfit)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>সর্বমোট বকেয়া পাওনা</span>
            <Users className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-red-700 mt-2">
            {formatBDT(totalOutstandingDue)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            বকেয়া গ্রাহক:{' '}
            <span className="font-mono-num font-semibold">
              {toBanglaDigits(customers.filter((c) => c.totalDue > 0).length)}
            </span>{' '}
            জন
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>চলতি মাসের খরচ</span>
            <MessageCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono-num text-slate-900 mt-2">
            {formatBDT(monthExpenseTotal)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            শেষ Drive ব্যাকআপ:{' '}
            <span className="font-medium text-slate-700">
              {settings.lastDriveBackupAt
                ? new Date(settings.lastDriveBackupAt).toLocaleDateString('bn-BD')
                : 'এখনো হয়নি'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Split: Recent Invoices + Due Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Invoices */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">সাম্প্রতিক বিলিং রিসিট</h2>
              <p className="text-xs text-slate-500">সর্বশেষ তৈরি করা ইনভয়েসসমূহ</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('invoices')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              সব দেখুন
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-600 mb-4">
                এখনো কোনো বিলিং রিসিট তৈরি করা হয়নি।
              </p>
              <button
                type="button"
                onClick={() => onNavigate('new-invoice')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <FilePlus2 className="w-4 h-4" />
                প্রথম রিসিট তৈরি করুন
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 text-left font-semibold">ক্রমিক নং</th>
                    <th className="py-2.5 px-4 text-left font-semibold">গ্রাহক</th>
                    <th className="py-2.5 px-4 text-right font-semibold">নিট বিল</th>
                    <th className="py-2.5 px-4 text-right font-semibold">বকেয়া</th>
                    <th className="py-2.5 px-4 text-right font-semibold">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                        {inv.serialNumber}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{inv.customerName}</div>
                        <div className="text-xs text-slate-500 font-mono-num">
                          {inv.customerPhone} · {inv.invoiceDate}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                        {formatBDT(inv.netTotal)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono-num font-semibold whitespace-nowrap ${
                          inv.dueAmount > 0 ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {inv.dueAmount > 0 ? formatBDT(inv.dueAmount) : 'পরিশোধিত'}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onPreviewInvoice(inv)}
                          className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                        >
                          রিসিট / PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Due Customers */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">বকেয়া গ্রাহক তালিকা</h2>
              <p className="text-xs text-slate-500">সর্বোচ্চ বকেয়া থাকা গ্রাহকগণ</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              বকেয়া খাতা
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {dueCustomers.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              বর্তমানে কোনো গ্রাহকের বকেয়া নেই।
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dueCustomers.map((cust) => (
                <div
                  key={cust.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      #{toBanglaDigits(cust.serialNo)} · {cust.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono-num">
                      {cust.phone}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono-num text-red-700">
                      {formatBDT(cust.totalDue)}
                    </div>
                    <div className="text-[11px] text-slate-500">বকেয়া</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
