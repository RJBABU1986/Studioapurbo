import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Download,
  ExternalLink,
  MessageCircle,
  Printer,
  X,
} from 'lucide-react';
import { InvoiceReceiptTemplate } from './InvoiceReceiptTemplate';
import {
  dispatchPdfToWhatsApp,
  downloadBlobFile,
  generatePdfBlobFromElement,
} from '../services/pdfAndWhatsapp';
import type { Invoice, StudioSettings } from '../types/studio';

interface ReceiptPreviewModalProps {
  invoice: Invoice | null;
  settings: StudioSettings;
  driveConnected: boolean;
  onClose: () => void;
  onUploadPdfToDrive: (invoice: Invoice, pdfBlob: Blob) => Promise<string | undefined>;
  onMarkWhatsappSent: (invoiceId: string) => Promise<void>;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  invoice,
  settings,
  driveConnected,
  onClose,
  onUploadPdfToDrive,
  onMarkWhatsappSent,
}) => {
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [busyAction, setBusyAction] = useState<'pdf' | 'drive' | 'whatsapp' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!invoice) return null;

  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return;
    setBusyAction('pdf');
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const blob = await generatePdfBlobFromElement(receiptRef.current);
      downloadBlobFile(blob, `Opoorbo-Receipt-${invoice.serialNumber}.pdf`);
      setStatusMessage('PDF রিসিট সফলভাবে ডাউনলোড হয়েছে।');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'PDF তৈরি করা যায়নি।');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDriveUpload = async () => {
    if (!receiptRef.current) return;
    setBusyAction('drive');
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const blob = await generatePdfBlobFromElement(receiptRef.current);
      const link = await onUploadPdfToDrive(invoice, blob);
      setStatusMessage(
        link
          ? 'PDF রিসিট সফলভাবে Google Drive-এ সংরক্ষিত হয়েছে।'
          : 'Google Drive সংযুক্ত করে রিসিট আপলোড সম্পন্ন হয়েছে।'
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Drive আপলোড ব্যর্থ হয়েছে।');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!receiptRef.current) return;
    setBusyAction('whatsapp');
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const blob = await generatePdfBlobFromElement(receiptRef.current);
      let driveLink = invoice.driveWebViewLink;
      if (!driveLink && driveConnected) {
        try {
          driveLink = await onUploadPdfToDrive(invoice, blob);
        } catch {
          // Proceed with WhatsApp dispatch even if Drive upload fails
        }
      }
      const res = await dispatchPdfToWhatsApp({
        invoice,
        settings,
        pdfBlob: blob,
        driveLink,
      });
      await onMarkWhatsappSent(invoice.id);
      setStatusMessage(res.message);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'WhatsApp পাঠানো যায়নি।');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[1px] overflow-y-auto p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="বিলিং রিসিট প্রিভিউ"
    >
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl">
        {/* Action Toolbar */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              রিসিট প্রিভিউ — <span className="font-mono-num">{invoice.serialNumber}</span>
            </h3>
            <p className="text-xs text-slate-500">
              গ্রাহক: {invoice.customerName} · {invoice.customerPhone}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              প্রিন্ট
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {busyAction === 'pdf' ? 'তৈরি হচ্ছে...' : 'PDF ডাউনলোড'}
            </button>

            <button
              type="button"
              onClick={handleDriveUpload}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <CloudUpload className="w-4 h-4" />
              {busyAction === 'drive' ? 'আপলোড হচ্ছে...' : 'Drive ব্যাকআপ'}
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <MessageCircle className="w-4 h-4" />
              {busyAction === 'whatsapp' ? 'প্রস্তুত হচ্ছে...' : 'WhatsApp-এ PDF পাঠান'}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Feedback */}
        {(statusMessage || errorMessage || invoice.driveWebViewLink) && (
          <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            {statusMessage && (
              <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
            {errorMessage && <div className="text-red-700 font-medium">{errorMessage}</div>}
            {invoice.driveWebViewLink && (
              <a
                href={invoice.driveWebViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline ml-auto"
              >
                Google Drive-এ PDF দেখুন
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Receipt Render Area */}
        <div className="p-5 sm:p-8 bg-slate-100 overflow-x-auto">
          <div ref={receiptRef}>
            <InvoiceReceiptTemplate
              id="printable-receipt-area"
              invoice={invoice}
              settings={settings}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
