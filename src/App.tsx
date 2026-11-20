import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Cloud,
  FilePlus2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { DEFAULT_STUDIO_INFO } from './constants/studioDefaults';
import {
  logoutStudio,
  refreshGoogleDriveToken,
  subscribeAuthState,
} from './services/firebase';
import {
  ensureStudioSettings,
  restoreStudioBackupPayload,
  subscribeCustomers,
  subscribeExpenses,
  subscribeInvoices,
  subscribeStudioSettings,
  updateInvoiceDispatchMeta,
  updateStudioSettings,
} from './services/studioDb';
import {
  ensureStudioDriveFolder,
  uploadFullStudioBackupToDrive,
  uploadPdfReceiptToDrive,
} from './services/googleDrive';
import {
  dispatchPdfToWhatsApp,
  generatePdfBlobFromElement,
} from './services/pdfAndWhatsapp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingAuthView } from './components/LandingAuthView';
import { DashboardOverview } from './components/DashboardOverview';
import { NewInvoiceView } from './components/NewInvoiceView';
import { InvoicesListView } from './components/InvoicesListView';
import { CustomersDueView } from './components/CustomersDueView';
import { MonthlyAccountsView } from './components/MonthlyAccountsView';
import { BackupAndSettingsView } from './components/BackupAndSettingsView';
import { ReceiptPreviewModal } from './components/ReceiptPreviewModal';
import { InvoiceReceiptTemplate } from './components/InvoiceReceiptTemplate';
import type {
  AppSection,
  Customer,
  Expense,
  Invoice,
  StudioSettings,
} from './types/studio';

const NAV_ITEMS: Array<{ id: AppSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
  { id: 'new-invoice', label: 'নতুন বিল / রিসিট', icon: FilePlus2 },
  { id: 'invoices', label: 'সকল রিসিট', icon: FileText },
  { id: 'customers', label: 'কাস্টমার ও বকেয়া খাতা', icon: Users },
  { id: 'monthly-accounts', label: 'প্রতি মাসের হিসাব', icon: BarChart3 },
  { id: 'backup-settings', label: 'Drive ব্যাকআপ ও সেটিংস', icon: Cloud },
];

function StudioAppShell() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);

  const [section, setSection] = useState<AppSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [settings, setSettings] = useState<StudioSettings>({
    ownerId: '',
    ...DEFAULT_STUDIO_INFO,
    nextSerial: 1,
    autoBackupDrive: true,
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [offscreenInvoice, setOffscreenInvoice] = useState<Invoice | null>(null);
  const offscreenReceiptRef = useRef<HTMLDivElement | null>(null);

  const [backingUp, setBackingUp] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 5000);
  };

  useEffect(() => {
    const unsub = subscribeAuthState((authUser, token) => {
      setUser(authUser);
      setDriveToken(token);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;

    void ensureStudioSettings(user.uid);
    const unsubSettings = subscribeStudioSettings(user.uid, (s) => {
      if (active) setSettings(s);
    });
    const unsubCustomers = subscribeCustomers(user.uid, (list) => {
      if (active) setCustomers(list);
    });
    const unsubInvoices = subscribeInvoices(user.uid, (list) => {
      if (active) setInvoices(list);
    });
    const unsubExpenses = subscribeExpenses(user.uid, (list) => {
      if (active) setExpenses(list);
    });

    return () => {
      active = false;
      unsubSettings();
      unsubCustomers();
      unsubInvoices();
      unsubExpenses();
    };
  }, [user]);

  const handleConnectDrive = async (): Promise<string | null> => {
    try {
      const token = await refreshGoogleDriveToken();
      setDriveToken(token);
      if (token) {
        showToast('Google Drive সফলভাবে সংযুক্ত হয়েছে।');
      }
      return token;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google Drive সংযুক্ত করা যায়নি।');
      return null;
    }
  };

  const runFullDriveBackup = async (tokenOverride?: string | null) => {
    if (!user) return;
    let token = tokenOverride ?? driveToken;
    if (!token) {
      token = await handleConnectDrive();
    }
    if (!token) return;

    setBackingUp(true);
    try {
      const folderId = await ensureStudioDriveFolder(token, settings.driveFolderId);
      await uploadFullStudioBackupToDrive(token, folderId, {
        version: 1,
        exportedAt: new Date().toISOString(),
        studio: {
          studioName: settings.studioName,
          proprietorName: settings.proprietorName,
          mobile: settings.mobile,
          whatsappNumber: settings.whatsappNumber,
          address: settings.address,
        },
        customers,
        invoices,
        expenses,
      });
      await updateStudioSettings(user.uid, {
        driveFolderId: folderId,
        lastDriveBackupAt: new Date().toISOString(),
      });
      showToast('সম্পূর্ণ ডেটা Google Drive-এ সফলভাবে ব্যাকআপ হয়েছে।');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'DRIVE_AUTH_EXPIRED') {
        setDriveToken(null);
        showToast('Google Drive সেশন শেষ হয়েছে — অনুগ্রহ করে পুনরায় সংযুক্ত করুন।');
      } else {
        showToast(`Drive ব্যাকআপ ব্যর্থ: ${msg}`);
      }
    } finally {
      setBackingUp(false);
    }
  };

  const handleUploadPdfToDrive = async (
    invoice: Invoice,
    pdfBlob: Blob
  ): Promise<string | undefined> => {
    if (!user) return undefined;
    let token = driveToken;
    if (!token) {
      token = await handleConnectDrive();
    }
    if (!token) return undefined;

    const folderId = await ensureStudioDriveFolder(token, settings.driveFolderId);
    const filename = `Opoorbo-Receipt-${invoice.serialNumber}.pdf`;
    const uploaded = await uploadPdfReceiptToDrive(token, folderId, filename, pdfBlob);

    await updateInvoiceDispatchMeta(user.uid, invoice.id, {
      driveFileId: uploaded.fileId,
      driveWebViewLink: uploaded.webViewLink || '',
    });

    if (folderId !== settings.driveFolderId) {
      await updateStudioSettings(user.uid, { driveFolderId: folderId });
    }
    return uploaded.webViewLink;
  };

  const handleMarkWhatsappSent = async (invoiceId: string) => {
    if (!user) return;
    await updateInvoiceDispatchMeta(user.uid, invoiceId, {
      whatsappSentAt: new Date().toISOString(),
    });
  };

  const handleInvoiceCreated = async (
    created: Invoice,
    options: { openWhatsapp: boolean; backupDrive: boolean }
  ) => {
    setPreviewInvoice(created);
    setOffscreenInvoice(created);

    // Wait a tick for off-screen receipt DOM to paint, then generate PDF & dispatch
    setTimeout(async () => {
      try {
        let pdfBlob: Blob | null = null;
        if (offscreenReceiptRef.current && (options.backupDrive || options.openWhatsapp)) {
          pdfBlob = await generatePdfBlobFromElement(offscreenReceiptRef.current);
        }

        let driveLink: string | undefined;
        if (options.backupDrive && driveToken) {
          try {
            if (pdfBlob) {
              driveLink = await handleUploadPdfToDrive(created, pdfBlob);
            }
            if (settings.autoBackupDrive) {
              await runFullDriveBackup(driveToken);
            }
          } catch {
            // Non-blocking
          }
        }

        if (options.openWhatsapp) {
          const dispatchRes = await dispatchPdfToWhatsApp({
            invoice: created,
            settings,
            pdfBlob,
            driveLink,
          });
          await handleMarkWhatsappSent(created.id);
          showToast(dispatchRes.message);
        } else {
          showToast(`রিসিট ${created.serialNumber} সংরক্ষিত হয়েছে।`);
        }
      } finally {
        setOffscreenInvoice(null);
      }
    }, 250);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-3 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-2/3" />
          <div className="h-4 bg-slate-100 rounded w-full" />
          <div className="h-10 bg-slate-200 rounded w-full mt-4" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingAuthView
        onSignedIn={(token) => {
          if (token) setDriveToken(token);
        }}
      />
    );
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === section);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-slate-200 shrink-0 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/studio_emblem_1795170985416.jpg"
              alt={settings.studioName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">
                {settings.studioName}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {settings.proprietorName}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3 text-xs">
          <div className="text-slate-600">
            <div className="font-semibold text-slate-900 truncate">
              {user.displayName || user.email || user.phoneNumber}
            </div>
            <div className="text-[11px] text-slate-500 font-mono-num">
              WhatsApp: {settings.whatsappNumber}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logoutStudio()}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            লগআউট করুন
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 bg-white h-full flex flex-col border-r border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">{settings.studioName}</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="মেনু বন্ধ করুন"
                className="p-1 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap cursor-pointer ${
                      active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => void logoutStudio()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                লগআউট
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="নেভিগেশন খুলুন"
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm font-semibold text-slate-700 truncate">
              <span className="text-slate-400">{settings.studioName}</span>
              <span className="mx-2 text-slate-300">/</span>
              <span className="text-slate-900">{currentNav?.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setSection('new-invoice')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" />
              নতুন বিল / রিসিট
            </button>
          </div>
        </header>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-lg bg-slate-900 text-white text-xs font-medium flex items-center justify-between gap-4">
            <span>{toastMsg}</span>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Section Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {section === 'dashboard' && (
            <DashboardOverview
              settings={settings}
              invoices={invoices}
              customers={customers}
              expenses={expenses}
              driveConnected={Boolean(driveToken)}
              backingUp={backingUp}
              onNavigate={setSection}
              onPreviewInvoice={setPreviewInvoice}
              onTriggerDriveBackup={() => void runFullDriveBackup()}
            />
          )}

          {section === 'new-invoice' && (
            <NewInvoiceView
              userId={user.uid}
              settings={settings}
              customers={customers}
              onInvoiceCreated={handleInvoiceCreated}
            />
          )}

          {section === 'invoices' && (
            <InvoicesListView
              userId={user.uid}
              invoices={invoices}
              customers={customers}
              onPreviewInvoice={setPreviewInvoice}
              onCreateNew={() => setSection('new-invoice')}
            />
          )}

          {section === 'customers' && (
            <CustomersDueView
              userId={user.uid}
              settings={settings}
              customers={customers}
              invoices={invoices}
            />
          )}

          {section === 'monthly-accounts' && (
            <MonthlyAccountsView
              userId={user.uid}
              settings={settings}
              invoices={invoices}
              expenses={expenses}
            />
          )}

          {section === 'backup-settings' && (
            <BackupAndSettingsView
              user={user}
              settings={settings}
              driveToken={driveToken}
              backingUp={backingUp}
              onConnectDrive={handleConnectDrive}
              onBackupNow={() => runFullDriveBackup()}
              onRestoreBackupData={async (payload) => {
                await restoreStudioBackupPayload(user.uid, payload);
              }}
            />
          )}
        </main>
      </div>

      {/* Off-screen Receipt Renderer for Auto PDF Generation */}
      {offscreenInvoice && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '720px',
            pointerEvents: 'none',
          }}
        >
          <div ref={offscreenReceiptRef}>
            <InvoiceReceiptTemplate invoice={offscreenInvoice} settings={settings} />
          </div>
        </div>
      )}

      {/* Interactive Receipt Modal */}
      <ReceiptPreviewModal
        invoice={previewInvoice}
        settings={settings}
        driveConnected={Boolean(driveToken)}
        onClose={() => setPreviewInvoice(null)}
        onUploadPdfToDrive={handleUploadPdfToDrive}
        onMarkWhatsappSent={handleMarkWhatsappSent}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StudioAppShell />
    </ErrorBoundary>
  );
}
