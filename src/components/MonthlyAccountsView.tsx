import React, { useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Download,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  EXPENSE_CATEGORY_LABELS,
  formatBDT,
  formatMonthLabel,
  getTodayIsoDate,
  toBanglaDigits,
} from '../constants/studioDefaults';
import { createExpense, deleteExpense } from '../services/studioDb';
import { downloadBlobFile, generatePdfBlobFromElement } from '../services/pdfAndWhatsapp';
import { ConfirmDialog } from './ConfirmDialog';
import type { Expense, ExpenseCategory, Invoice, StudioSettings } from '../types/studio';

interface MonthlyAccountsViewProps {
  userId: string;
  settings: StudioSettings;
  invoices: Invoice[];
  expenses: Expense[];
}

export const MonthlyAccountsView: React.FC<MonthlyAccountsViewProps> = ({
  userId,
  settings,
  invoices,
  expenses,
}) => {
  const currentMonth = getTodayIsoDate().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('supplies');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(getTodayIsoDate());
  const [expNotes, setExpNotes] = useState('');
  const [savingExp, setSavingExp] = useState(false);

  const [deleteExpTarget, setDeleteExpTarget] = useState<Expense | null>(null);
  const [deletingExp, setDeletingExp] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const availableMonths = useMemo(() => {
    const set = new Set<string>([currentMonth]);
    invoices.forEach((i) => set.add(i.monthKey));
    expenses.forEach((e) => set.add(e.monthKey));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [currentMonth, expenses, invoices]);

  const monthInvoices = useMemo(
    () => invoices.filter((i) => i.monthKey === selectedMonth),
    [invoices, selectedMonth]
  );

  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.monthKey === selectedMonth),
    [expenses, selectedMonth]
  );

  const summary = useMemo(() => {
    const totalBilled = monthInvoices.reduce((s, i) => s + i.netTotal, 0);
    const totalCollected = monthInvoices.reduce((s, i) => s + i.paidAmount, 0);
    const totalDue = monthInvoices.reduce((s, i) => s + i.dueAmount, 0);
    const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalCollected - totalExpenses;
    return { totalBilled, totalCollected, totalDue, totalExpenses, netProfit };
  }, [monthExpenses, monthInvoices]);

  const dailyBars = useMemo(() => {
    const dayMap = new Map<string, { day: string; income: number; expense: number }>();
    monthInvoices.forEach((inv) => {
      const day = inv.invoiceDate.slice(8, 10) || '01';
      const entry = dayMap.get(day) || { day, income: 0, expense: 0 };
      entry.income += inv.paidAmount;
      dayMap.set(day, entry);
    });
    monthExpenses.forEach((exp) => {
      const day = exp.expenseDate.slice(8, 10) || '01';
      const entry = dayMap.get(day) || { day, income: 0, expense: 0 };
      entry.expense += exp.amount;
      dayMap.set(day, entry);
    });
    return Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [monthExpenses, monthInvoices]);

  const maxDailyVal = useMemo(
    () => Math.max(100, ...dailyBars.map((d) => Math.max(d.income, d.expense))),
    [dailyBars]
  );

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expAmount) || 0;
    if (!expTitle.trim() || amt <= 0) return;
    setSavingExp(true);
    try {
      await createExpense(userId, {
        title: expTitle,
        category: expCategory,
        amount: amt,
        expenseDate: expDate,
        notes: expNotes,
      });
      setExpTitle('');
      setExpAmount('');
      setExpNotes('');
    } finally {
      setSavingExp(false);
    }
  };

  const handleConfirmDeleteExp = async () => {
    if (!deleteExpTarget) return;
    setDeletingExp(true);
    try {
      await deleteExpense(userId, deleteExpTarget.id);
      setDeleteExpTarget(null);
    } finally {
      setDeletingExp(false);
    }
  };

  const handleExportMonthlyPdf = async () => {
    if (!reportRef.current) return;
    setExportingPdf(true);
    try {
      const blob = await generatePdfBlobFromElement(reportRef.current);
      downloadBlobFile(blob, `Opoorbo-Monthly-Report-${selectedMonth}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Month Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">প্রতি মাসের হিসাব ও ব্যয়ের খাতা</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {settings.studioName} · নির্বাচিত মাস: {formatMonthLabel(selectedMonth)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportMonthlyPdf}
            disabled={exportingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {exportingPdf ? 'তৈরি হচ্ছে...' : 'মাসিক রিপোর্ট PDF'}
          </button>
        </div>
      </div>

      {/* Printable Report Area */}
      <div ref={reportRef} className="space-y-6 bg-slate-50">
        {/* 5-card Monthly KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">মোট বিল (বিক্রি)</div>
            <div className="text-xl font-bold font-mono-num text-slate-900 mt-1.5">
              {formatBDT(summary.totalBilled)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              রিসিট: {toBanglaDigits(monthInvoices.length)} টি
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">মোট আদায়</div>
            <div className="text-xl font-bold font-mono-num text-emerald-700 mt-1.5">
              {formatBDT(summary.totalCollected)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">নগদ ও ডিজিটাল</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">মাসের বকেয়া</div>
            <div className="text-xl font-bold font-mono-num text-red-700 mt-1.5">
              {formatBDT(summary.totalDue)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">আদায়যোগ্য</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">মোট খরচ</div>
            <div className="text-xl font-bold font-mono-num text-amber-700 mt-1.5">
              {formatBDT(summary.totalExpenses)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              ভাউচার: {toBanglaDigits(monthExpenses.length)} টি
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">নিট লাভ (আদায় - খরচ)</div>
            <div
              className={`text-xl font-bold font-mono-num mt-1.5 ${
                summary.netProfit >= 0 ? 'text-slate-900' : 'text-red-700'
              }`}
            >
              {formatBDT(summary.netProfit)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {formatMonthLabel(selectedMonth)}
            </div>
          </div>
        </div>

        {/* Daily Income vs Expense Bar Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-700" />
                দৈনিক আদায় বনাম খরচ ({formatMonthLabel(selectedMonth)})
              </h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-600 rounded-xs inline-block" />
                আদায়
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs inline-block" />
                খরচ
              </span>
            </div>
          </div>

          {dailyBars.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              এই মাসে এখনো কোনো লেনদেন যুক্ত হয়নি।
            </div>
          ) : (
            <div className="flex items-end gap-3 overflow-x-auto pb-2 pt-4 h-48">
              {dailyBars.map((d) => {
                const incPct = Math.max(4, Math.round((d.income / maxDailyVal) * 100));
                const expPct = Math.max(0, Math.round((d.expense / maxDailyVal) * 100));
                return (
                  <div
                    key={d.day}
                    className="flex flex-col items-center gap-1.5 min-w-[44px]"
                  >
                    <div className="flex items-end gap-1 h-32">
                      <div
                        title={`আদায়: ${formatBDT(d.income)}`}
                        style={{ height: `${incPct}%` }}
                        className="w-4 bg-emerald-600 rounded-t-sm"
                      />
                      {d.expense > 0 && (
                        <div
                          title={`খরচ: ${formatBDT(d.expense)}`}
                          style={{ height: `${Math.max(4, expPct)}%` }}
                          className="w-4 bg-amber-500 rounded-t-sm"
                        />
                      )}
                    </div>
                    <div className="text-[11px] font-mono-num text-slate-600">
                      {toBanglaDigits(d.day)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Expense & Expense Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleAddExpense}
          className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 self-start"
        >
          <h2 className="text-base font-bold text-slate-900">নতুন স্টুডিও খরচ যোগ করুন</h2>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              খরচের বিবরণ *
            </label>
            <input
              type="text"
              value={expTitle}
              onChange={(e) => setExpTitle(e.target.value)}
              placeholder="যেমন: ফটো পেপার ও প্রিন্টার কালি"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              খরচের ধরন
            </label>
            <select
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                টাকা (৳) *
              </label>
              <input
                type="number"
                min={1}
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="500"
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                তারিখ
              </label>
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              মন্তব্য (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={expNotes}
              onChange={(e) => setExpNotes(e.target.value)}
              placeholder="ভাউচার বা দোকানের নাম"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={savingExp}
            className="w-full py-2.5 px-4 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {savingExp ? 'সংরক্ষণ হচ্ছে...' : 'খরচ যোগ করুন'}
          </button>
        </form>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              মাসের খরচের তালিকা ({formatMonthLabel(selectedMonth)})
            </h2>
          </div>

          {monthExpenses.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              এই মাসে কোনো খরচ যুক্ত করা হয়নি।
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th className="py-2.5 px-4 text-left font-semibold">তারিখ</th>
                    <th className="py-2.5 px-4 text-left font-semibold">বিবরণ</th>
                    <th className="py-2.5 px-4 text-left font-semibold">ধরন</th>
                    <th className="py-2.5 px-4 text-right font-semibold">টাকা</th>
                    <th className="py-2.5 px-4 text-right font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                        {exp.expenseDate}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{exp.title}</div>
                        {exp.notes && (
                          <div className="text-xs text-slate-500">{exp.notes}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {EXPENSE_CATEGORY_LABELS[exp.category]}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-amber-700 whitespace-nowrap">
                        {formatBDT(exp.amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteExpTarget(exp)}
                          aria-label="খরচ মুছুন"
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteExpTarget)}
        title="খরচের এন্ট্রি মুছে ফেলবেন?"
        description={
          deleteExpTarget
            ? `"${deleteExpTarget.title}" (${formatBDT(deleteExpTarget.amount)}) স্থায়ীভাবে মুছে ফেলা হবে।`
            : ''
        }
        confirmLabel="হ্যাঁ, মুছে ফেলুন"
        destructive
        loading={deletingExp}
        onConfirm={handleConfirmDeleteExp}
        onCancel={() => setDeleteExpTarget(null)}
      />
    </div>
  );
};
