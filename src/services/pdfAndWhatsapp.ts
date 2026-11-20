import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  formatBDT,
  formatWhatsAppNumber,
  PAYMENT_METHOD_LABELS,
  toBanglaDigits,
} from '../constants/studioDefaults';
import type { Customer, Invoice, StudioSettings } from '../types/studio';

export async function generatePdfBlobFromElement(element: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(element, {
    pixelRatio: 2.5,
    backgroundColor: '#ffffff',
    cacheBust: true,
  });

  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (err) => reject(err);
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const imgHeight = (img.height * usableWidth) / img.width;

  let yPos = margin;
  let remainingHeight = imgHeight;

  pdf.addImage(dataUrl, 'PNG', margin, yPos, usableWidth, imgHeight, undefined, 'FAST');
  remainingHeight -= pageHeight - margin * 2;

  while (remainingHeight > 0) {
    pdf.addPage();
    yPos = margin - (imgHeight - remainingHeight);
    pdf.addImage(dataUrl, 'PNG', margin, yPos, usableWidth, imgHeight, undefined, 'FAST');
    remainingHeight -= pageHeight - margin * 2;
  }

  return pdf.output('blob');
}

export function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function buildWhatsAppInvoiceMessage(
  invoice: Invoice,
  settings: StudioSettings,
  driveLink?: string
): string {
  const itemsText = invoice.items
    .map(
      (item, idx) =>
        `${toBanglaDigits(idx + 1)}. ${item.name} (${toBanglaDigits(item.qty)} × ${formatBDT(item.rate)}) = ${formatBDT(item.total)}`
    )
    .join('\n');

  const lines = [
    `*${settings.studioName}*`,
    `প্রোঃ ${settings.proprietorName}`,
    `ঠিকানা: ${settings.address}`,
    `মোবাইল: ${settings.mobile} | WhatsApp: ${settings.whatsappNumber}`,
    `────────────────────`,
    `*ডিজিটাল বিলিং রিসিট*`,
    `ক্রমিক নং: *${invoice.serialNumber}*`,
    `তারিখ: ${invoice.invoiceDate}`,
    `গ্রাহক: ${invoice.customerName}`,
    `মোবাইল: ${invoice.customerPhone}`,
    `────────────────────`,
    itemsText,
    `────────────────────`,
    `মোট বিল: ${formatBDT(invoice.subtotal)}`,
  ];

  if (invoice.discount > 0) {
    lines.push(`ডিসকাউন্ট: -${formatBDT(invoice.discount)}`);
  }

  lines.push(
    `*নিট বিল: ${formatBDT(invoice.netTotal)}*`,
    `জমা (${PAYMENT_METHOD_LABELS[invoice.paymentMethod]}): ${formatBDT(invoice.paidAmount)}`,
    invoice.dueAmount > 0
      ? `*বকেয়া: ${formatBDT(invoice.dueAmount)}*`
      : `অবস্থা: সম্পূর্ণ পরিশোধিত`,
  );

  if (driveLink) {
    lines.push(`PDF রিসিট লিংক (Google Drive): ${driveLink}`);
  }

  lines.push(
    ``,
    `ধন্যবাদ! — ${settings.studioName} (WhatsApp: ${settings.whatsappNumber})`
  );

  return lines.join('\n');
}

export function buildWhatsAppDueReminderMessage(
  customer: Customer,
  settings: StudioSettings
): string {
  return [
    `আসসালামু আলাইকুম ${customer.name},`,
    `*${settings.studioName}*-এর পক্ষ থেকে জানানো যাচ্ছে যে আপনার মোট বকেয়া রয়েছে *${formatBDT(customer.totalDue)}*।`,
    `মোট বিল: ${formatBDT(customer.totalBilled)} | জমা: ${formatBDT(customer.totalPaid)}`,
    `সুবিধামতো বকেয়া পরিশোধের জন্য অনুরোধ করা হলো।`,
    ``,
    `প্রোঃ ${settings.proprietorName}`,
    `অফিসিয়াল WhatsApp: ${settings.whatsappNumber} | মোবাইল: ${settings.mobile}`,
    `${settings.address}`,
  ].join('\n');
}

export async function dispatchPdfToWhatsApp(params: {
  invoice: Invoice;
  settings: StudioSettings;
  pdfBlob?: Blob | null;
  driveLink?: string;
}): Promise<{ method: 'webhook' | 'share-sheet' | 'wa-link'; message: string }> {
  const { invoice, settings, pdfBlob, driveLink } = params;
  const filename = `Opoorbo-Receipt-${invoice.serialNumber}.pdf`;
  const text = buildWhatsAppInvoiceMessage(invoice, settings, driveLink);
  const targetPhone = formatWhatsAppNumber(invoice.customerPhone);

  // 1. If studio configured an automated WhatsApp Business Gateway / Webhook URL
  if (settings.whatsappWebhookUrl && settings.whatsappWebhookUrl.startsWith('http') && pdfBlob) {
    try {
      const formData = new FormData();
      formData.append('fromWhatsapp', settings.whatsappNumber);
      formData.append('toWhatsapp', targetPhone);
      formData.append('serialNumber', invoice.serialNumber);
      formData.append('customerName', invoice.customerName);
      formData.append('message', text);
      formData.append('file', pdfBlob, filename);

      const res = await fetch(settings.whatsappWebhookUrl, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        return {
          method: 'webhook',
          message: `WhatsApp ওয়েবহুক (${settings.whatsappNumber}) এর মাধ্যমে PDF সফলভাবে পাঠানো হয়েছে।`,
        };
      }
    } catch {
      // Fall back to browser download + WhatsApp link below
    }
  }

  // 2. Download PDF locally so it's ready to attach on Desktop WhatsApp Web
  if (pdfBlob) {
    downloadBlobFile(pdfBlob, filename);
  }

  // 3. Try Web Share API with actual PDF file on supported mobile devices
  if (pdfBlob && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `${settings.studioName} — ${invoice.serialNumber}`,
          text,
          files: [file],
        });
        return {
          method: 'share-sheet',
          message: 'PDF ফাইলসহ শেয়ার শীট খোলা হয়েছে — WhatsApp সিলেক্ট করে পাঠিয়ে দিন।',
        };
      } catch {
        // User cancelled share sheet or browser blocked; fall through to wa.me link
      }
    }
  }

  // 4. Open WhatsApp deep link directly to customer chat
  const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
  const link = document.createElement('a');
  link.href = waUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return {
    method: 'wa-link',
    message: `PDF ডাউনলোড হয়েছে এবং গ্রাহকের WhatsApp চ্যাট খোলা হয়েছে (${settings.whatsappNumber} নোটসহ)।`,
  };
}

export function openWhatsAppTextChat(phone: string, text: string): void {
  const targetPhone = formatWhatsAppNumber(phone);
  const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
  const link = document.createElement('a');
  link.href = waUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
