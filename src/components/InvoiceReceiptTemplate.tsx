import React from 'react';
import {
  formatBDT,
  PAYMENT_METHOD_LABELS,
  toBanglaDigits,
} from '../constants/studioDefaults';
import type { Invoice, StudioSettings } from '../types/studio';

interface InvoiceReceiptTemplateProps {
  invoice: Invoice;
  settings: StudioSettings;
  id?: string;
}

export const InvoiceReceiptTemplate: React.FC<InvoiceReceiptTemplateProps> = ({
  invoice,
  settings,
  id,
}) => {
  return (
    <div
      id={id}
      style={{
        backgroundColor: '#ffffff',
        color: '#0f172a',
        border: '1px solid #cbd5e1',
        fontFamily: "'Hind Siliguri', 'Plus Jakarta Sans', sans-serif",
      }}
      className="w-full max-w-[720px] mx-auto p-6 sm:p-8 rounded-lg"
    >
      {/* Studio Letterhead */}
      <div
        style={{ borderBottom: '2px solid #0f172a' }}
        className="pb-5 mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <div className="flex items-start gap-3.5">
          <img
            src="/src/assets/images/studio_emblem_1795170985416.jpg"
            alt={settings.studioName}
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div>
            <h2
              style={{ color: '#0f172a' }}
              className="text-2xl font-bold tracking-tight leading-tight"
            >
              {settings.studioName}
            </h2>
            <p style={{ color: '#334155' }} className="text-sm font-medium mt-0.5">
              প্রোঃ {settings.proprietorName}
            </p>
            <p style={{ color: '#475569' }} className="text-xs mt-1 leading-relaxed">
              {settings.address}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right text-xs space-y-1 shrink-0">
          <div style={{ color: '#0f172a' }} className="font-semibold">
            মোবাইল: <span className="font-mono-num">{settings.mobile}</span>
          </div>
          <div style={{ color: '#0f766e' }} className="font-semibold">
            WhatsApp: <span className="font-mono-num">{settings.whatsappNumber}</span>
          </div>
          <div
            style={{
              backgroundColor: '#f1f5f9',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
            }}
            className="inline-block px-2.5 py-1 rounded text-xs font-bold mt-1"
          >
            ক্যাশ মেমো / বিলিং রিসিট
          </div>
        </div>
      </div>

      {/* Invoice & Customer Meta */}
      <div
        style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg mb-5 text-sm"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span style={{ color: '#64748b' }} className="text-xs">
              গ্রাহকের নাম:
            </span>
            <span style={{ color: '#0f172a' }} className="font-bold">
              {invoice.customerName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ color: '#64748b' }} className="text-xs">
              মোবাইল নাম্বার:
            </span>
            <span style={{ color: '#0f172a' }} className="font-mono-num font-semibold">
              {invoice.customerPhone}
            </span>
          </div>
        </div>

        <div className="space-y-1 sm:text-right">
          <div className="flex sm:justify-end items-center gap-2">
            <span style={{ color: '#64748b' }} className="text-xs">
              ক্রমিক নং:
            </span>
            <span style={{ color: '#0f172a' }} className="font-mono-num font-bold">
              {invoice.serialNumber}
            </span>
          </div>
          <div className="flex sm:justify-end items-center gap-2 text-xs">
            <span style={{ color: '#64748b' }}>তারিখ:</span>
            <span style={{ color: '#0f172a' }} className="font-mono-num font-medium">
              {invoice.invoiceDate}
            </span>
            {invoice.deliveryDate && (
              <>
                <span style={{ color: '#94a3b8' }}>·</span>
                <span style={{ color: '#64748b' }}>ডেলিভারি:</span>
                <span style={{ color: '#0f172a' }} className="font-mono-num font-medium">
                  {invoice.deliveryDate}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <table className="w-full text-sm border-collapse mb-5">
        <thead>
          <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
            <th className="py-2.5 px-3 text-left font-semibold text-xs w-12">নং</th>
            <th className="py-2.5 px-3 text-left font-semibold text-xs">কাজের / সেবার বিবরণ</th>
            <th className="py-2.5 px-3 text-right font-semibold text-xs w-20">পরিমাণ</th>
            <th className="py-2.5 px-3 text-right font-semibold text-xs w-24">দর</th>
            <th className="py-2.5 px-3 text-right font-semibold text-xs w-28">মোট টাকা</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr
              key={`${item.name}_${index}`}
              style={{ borderBottom: '1px solid #e2e8f0' }}
            >
              <td style={{ color: '#475569' }} className="py-2.5 px-3 font-mono-num">
                {toBanglaDigits(index + 1)}
              </td>
              <td style={{ color: '#0f172a' }} className="py-2.5 px-3 font-medium">
                {item.name}
              </td>
              <td style={{ color: '#334155' }} className="py-2.5 px-3 text-right font-mono-num">
                {toBanglaDigits(item.qty)}
              </td>
              <td style={{ color: '#334155' }} className="py-2.5 px-3 text-right font-mono-num">
                {formatBDT(item.rate)}
              </td>
              <td
                style={{ color: '#0f172a' }}
                className="py-2.5 px-3 text-right font-mono-num font-semibold"
              >
                {formatBDT(item.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals & Payment Summary */}
      <div className="flex flex-col sm:flex-row justify-between gap-6 items-start">
        <div className="text-xs space-y-1.5 flex-1">
          <div style={{ color: '#475569' }}>
            পেমেন্ট মাধ্যম:{' '}
            <span style={{ color: '#0f172a' }} className="font-semibold">
              {PAYMENT_METHOD_LABELS[invoice.paymentMethod]}
            </span>
          </div>
          <div style={{ color: '#475569' }}>
            অবস্থা:{' '}
            <span
              style={{
                color:
                  invoice.status === 'paid'
                    ? '#15803d'
                    : invoice.status === 'partial'
                    ? '#b45309'
                    : '#b91c1c',
              }}
              className="font-bold"
            >
              {invoice.status === 'paid'
                ? 'সম্পূর্ণ পরিশোধিত'
                : invoice.status === 'partial'
                ? 'আংশিক পরিশোধিত'
                : 'বকেয়া রয়েছে'}
            </span>
          </div>
          {invoice.notes && (
            <div style={{ color: '#475569' }} className="pt-1">
              মন্তব্য: <span style={{ color: '#0f172a' }}>{invoice.notes}</span>
            </div>
          )}
        </div>

        <div
          style={{ border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}
          className="w-full sm:w-64 rounded-lg p-3.5 text-sm space-y-2 shrink-0"
        >
          <div className="flex items-center justify-between">
            <span style={{ color: '#475569' }}>মোট বিল</span>
            <span style={{ color: '#0f172a' }} className="font-mono-num font-medium">
              {formatBDT(invoice.subtotal)}
            </span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex items-center justify-between">
              <span style={{ color: '#475569' }}>ডিসকাউন্ট</span>
              <span style={{ color: '#15803d' }} className="font-mono-num font-medium">
                -{formatBDT(invoice.discount)}
              </span>
            </div>
          )}
          <div
            style={{ borderTop: '1px solid #cbd5e1' }}
            className="pt-2 flex items-center justify-between font-bold"
          >
            <span style={{ color: '#0f172a' }}>নিট বিল</span>
            <span style={{ color: '#0f172a' }} className="font-mono-num">
              {formatBDT(invoice.netTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: '#475569' }}>জমা</span>
            <span style={{ color: '#15803d' }} className="font-mono-num font-semibold">
              {formatBDT(invoice.paidAmount)}
            </span>
          </div>
          <div
            style={{ borderTop: '1px dashed #cbd5e1' }}
            className="pt-2 flex items-center justify-between font-bold"
          >
            <span style={{ color: invoice.dueAmount > 0 ? '#b91c1c' : '#15803d' }}>
              বকেয়া
            </span>
            <span
              style={{ color: invoice.dueAmount > 0 ? '#b91c1c' : '#15803d' }}
              className="font-mono-num"
            >
              {formatBDT(invoice.dueAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Signature */}
      <div
        style={{ borderTop: '1px solid #e2e8f0', color: '#64748b' }}
        className="mt-7 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
      >
        <div>
          ধন্যবাদ! পুনরায় আসবেন — {settings.studioName} (WhatsApp: {settings.whatsappNumber})
        </div>
        <div className="text-right font-semibold" style={{ color: '#0f172a' }}>
          স্বাক্ষর: {settings.proprietorName}
        </div>
      </div>
    </div>
  );
};
