import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  ExternalLink,
  FolderSync,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  deleteDriveBackupFile,
  downloadDriveJsonBackup,
  ensureStudioDriveFolder,
  listDriveBackupFiles,
} from '../services/googleDrive';
import { updateStudioSettings } from '../services/studioDb';
import { ConfirmDialog } from './ConfirmDialog';
import type { DriveBackupFile, StudioSettings } from '../types/studio';

interface BackupAndSettingsViewProps {
  user: User;
  settings: StudioSettings;
  driveToken: string | null;
  backingUp: boolean;
  onConnectDrive: () => Promise<string | null>;
  onBackupNow: () => Promise<void>;
  onRestoreBackupData: (payload: Awaited<ReturnType<typeof downloadDriveJsonBackup>>) => Promise<void>;
}

export const BackupAndSettingsView: React.FC<BackupAndSettingsViewProps> = ({
  user,
  settings,
  driveToken,
  backingUp,
  onConnectDrive,
  onBackupNow,
  onRestoreBackupData,
}) => {
  const [studioName, setStudioName] = useState(settings.studioName);
  const [proprietorName, setProprietorName] = useState(settings.proprietorName);
  const [mobile, setMobile] = useState(settings.mobile);
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsappNumber);
  const [address, setAddress] = useState(settings.address);
  const [autoBackupDrive, setAutoBackupDrive] = useState(settings.autoBackupDrive);
  const [whatsappWebhookUrl, setWhatsappWebhookUrl] = useState(settings.whatsappWebhookUrl || '');

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  const [driveFiles, setDriveFiles] = useState<DriveBackupFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccess, setDriveSuccess] = useState<string | null>(null);

  const [restoreTarget, setRestoreTarget] = useState<DriveBackupFile | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<DriveBackupFile | null>(null);
  const [mutatingDrive, setMutatingDrive] = useState(false);

  useEffect(() => {
    setStudioName(settings.studioName);
    setProprietorName(settings.proprietorName);
    setMobile(settings.mobile);
    setWhatsappNumber(settings.whatsappNumber);
    setAddress(settings.address);
    setAutoBackupDrive(settings.autoBackupDrive);
    setWhatsappWebhookUrl(settings.whatsappWebhookUrl || '');
  }, [settings]);

  const loadDriveFiles = async (tokenToUse?: string | null) => {
    const token = tokenToUse ?? driveToken;
    if (!token) return;
    setLoadingFiles(true);
    setDriveError(null);
    try {
      const folderId = await ensureStudioDriveFolder(token, settings.driveFolderId);
      if (folderId !== settings.driveFolderId) {
        await updateStudioSettings(user.uid, { driveFolderId: folderId });
      }
      const files = await listDriveBackupFiles(token, folderId);
      setDriveFiles(files);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'DRIVE_AUTH_EXPIRED') {
        setDriveError('Google Drive সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে পুনরায় সংযুক্ত করুন।');
      } else {
        setDriveError(msg);
      }
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (driveToken) {
      void loadDriveFiles(driveToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveToken]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      await updateStudioSettings(user.uid, {
        studioName,
        proprietorName,
        mobile,
        whatsappNumber,
        address,
        autoBackupDrive,
        whatsappWebhookUrl,
      });
      setSettingsMsg('প্রতিষ্ঠানের তথ্য ও সেটিংস সফলভাবে সংরক্ষিত হয়েছে।');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleReconnectAndLoad = async () => {
    setDriveError(null);
    const token = await onConnectDrive();
    if (token) {
      await loadDriveFiles(token);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget || !driveToken) return;
    setMutatingDrive(true);
    setDriveError(null);
    setDriveSuccess(null);
    try {
      const payload = await downloadDriveJsonBackup(driveToken, restoreTarget.id);
      await onRestoreBackupData(payload);
      setDriveSuccess(`"${restoreTarget.name}" থেকে ডেটা সফলভাবে রিস্টোর করা হয়েছে।`);
      setRestoreTarget(null);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'রিস্টোর ব্যর্থ হয়েছে।');
    } finally {
      setMutatingDrive(false);
    }
  };

  const handleConfirmDeleteDriveFile = async () => {
    if (!deleteFileTarget || !driveToken) return;
    setMutatingDrive(true);
    setDriveError(null);
    setDriveSuccess(null);
    try {
      await deleteDriveBackupFile(driveToken, deleteFileTarget.id);
      setDriveFiles((prev) => prev.filter((f) => f.id !== deleteFileTarget.id));
      setDriveSuccess(`"${deleteFileTarget.name}" Google Drive থেকে মুছে ফেলা হয়েছে।`);
      setDeleteFileTarget(null);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'ফাইল মুছা যায়নি।');
    } finally {
      setMutatingDrive(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Google Drive Backup Center */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-700" />
              Google Drive স্বয়ংক্রিয় ব্যাকআপ কেন্দ্র
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              ফোল্ডার: <strong className="text-slate-700">Opoorbo Digital Studio Backups</strong>
              {settings.lastDriveBackupAt && (
                <>
                  {' · '}
                  সর্বশেষ ব্যাকআপ: {new Date(settings.lastDriveBackupAt).toLocaleString('bn-BD')}
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!driveToken ? (
              <button
                type="button"
                onClick={handleReconnectAndLoad}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 cursor-pointer"
              >
                <FolderSync className="w-4 h-4" />
                Google Drive সংযুক্ত করুন
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void loadDriveFiles()}
                  disabled={loadingFiles}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
                  রিফ্রেশ
                </button>
                <button
                  type="button"
                  onClick={onBackupNow}
                  disabled={backingUp}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-60"
                >
                  <Cloud className="w-4 h-4" />
                  {backingUp ? 'ব্যাকআপ চলছে...' : 'এখনই সম্পূর্ণ ব্যাকআপ নিন'}
                </button>
              </>
            )}
          </div>
        </div>

        {driveError && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {driveError}
          </div>
        )}
        {driveSuccess && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{driveSuccess}</span>
          </div>
        )}

        {driveToken ? (
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Google Drive-এ সংরক্ষিত ব্যাকআপ ও PDF ফাইলসমূহ
            </h3>
            {loadingFiles ? (
              <div className="py-6 text-xs text-slate-500">ফাইল তালিকা লোড হচ্ছে...</div>
            ) : driveFiles.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                এখনো কোনো ফাইল ব্যাকআপ করা হয়নি। উপরে "এখনই সম্পূর্ণ ব্যাকআপ নিন" বাটনে ক্লিক করুন।
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                    <tr>
                      <th className="py-2.5 px-4 text-left font-semibold">ফাইলের নাম</th>
                      <th className="py-2.5 px-4 text-left font-semibold">সময়</th>
                      <th className="py-2.5 px-4 text-right font-semibold">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {driveFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-medium text-slate-900">{file.name}</td>
                        <td className="py-2.5 px-4 text-xs text-slate-500 font-mono-num">
                          {new Date(file.modifiedTime).toLocaleString('bn-BD')}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
                              >
                                দেখুন
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {file.mimeType === 'application/json' && (
                              <button
                                type="button"
                                onClick={() => setRestoreTarget(file)}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 cursor-pointer"
                              >
                                রিস্টোর
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteFileTarget(file)}
                              aria-label="Drive ফাইল মুছুন"
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        ) : (
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
            Google Drive-এ সর্বক্ষণ ব্যাকআপ রাখতে এবং রিসিট PDF আপলোড করতে উপরে{' '}
            <strong className="text-slate-900">"Google Drive সংযুক্ত করুন"</strong> বাটনে ক্লিক করে অনুমতি দিন।
          </div>
        )}
      </div>

      {/* Studio Settings & Account Security */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveSettings}
          className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-slate-900">প্রতিষ্ঠানের তথ্য ও WhatsApp সেটিংস</h2>

          {settingsMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{settingsMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রতিষ্ঠানের নাম
              </label>
              <input
                type="text"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রোঃ (মালিকের নাম)
              </label>
              <input
                type="text"
                value={proprietorName}
                onChange={(e) => setProprietorName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                অফিসিয়াল মোবাইল নাম্বার
              </label>
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রতিষ্ঠানের WhatsApp নাম্বার (PDF প্রেরক)
              </label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ঠিকানা
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              অটোমেটিক WhatsApp Cloud API ওয়েবহুক URL (ঐচ্ছিক)
            </label>
            <input
              type="url"
              value={whatsappWebhookUrl}
              onChange={(e) => setWhatsappWebhookUrl(e.target.value)}
              placeholder="https://your-whatsapp-gateway.example/send-pdf"
              className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              ফাঁকা রাখলে ব্রাউজার সরাসরি PDF ডাউনলোড করে আপনার ডিভাইসের WhatsApp-এ ({whatsappNumber}) গ্রাহকের চ্যাট খুলে দেবে।
            </p>
          </div>

          <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={autoBackupDrive}
              onChange={(e) => setAutoBackupDrive(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>প্রতিটি নতুন বিলের পর স্বয়ংক্রিয়ভাবে Google Drive ব্যাকআপ আপডেট রাখুন</span>
          </label>

          <button
            type="submit"
            disabled={savingSettings}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {savingSettings ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}
          </button>
        </form>

        {/* Account Security Info */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4 self-start">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            নিরাপদ অ্যাকাউন্ট তথ্য
          </div>
          <div className="space-y-2.5 text-xs text-slate-600">
            <div>
              <span className="text-slate-400 block">ব্যবহারকারীর নাম</span>
              <span className="font-semibold text-slate-900">
                {user.displayName || settings.proprietorName}
              </span>
            </div>
            {user.email && (
              <div>
                <span className="text-slate-400 block">ভেরিফায়েড ইমেইল</span>
                <span className="font-mono-num font-semibold text-slate-900">{user.email}</span>
              </div>
            )}
            {user.phoneNumber && (
              <div>
                <span className="text-slate-400 block">ভেরিফায়েড মোবাইল</span>
                <span className="font-mono-num font-semibold text-slate-900">
                  {user.phoneNumber}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-400 block">Google Drive ব্যাকআপ স্ট্যাটাস</span>
              <span
                className={`font-semibold ${
                  driveToken ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {driveToken ? 'সংযুক্ত ও সক্রিয়' : 'পুনরায় সংযুক্ত প্রয়োজন'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modals for Drive Restore & Delete */}
      <ConfirmDialog
        open={Boolean(restoreTarget)}
        title="Google Drive ব্যাকআপ রিস্টোর করবেন?"
        description={
          restoreTarget
            ? `"${restoreTarget.name}" ফাইল থেকে গ্রাহক, ইনভয়েস ও খরচের তথ্য আপনার ক্লাউড অ্যাকাউন্টে যুক্ত করা হবে।`
            : ''
        }
        confirmLabel="হ্যাঁ, রিস্টোর করুন"
        loading={mutatingDrive}
        onConfirm={handleConfirmRestore}
        onCancel={() => setRestoreTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteFileTarget)}
        title="Google Drive থেকে ফাইল মুছে ফেলবেন?"
        description={
          deleteFileTarget
            ? `"${deleteFileTarget.name}" ফাইলটি আপনার Google Drive থেকে স্থায়ীভাবে মুছে ফেলা হবে। এই কাজটি আর ফিরিয়ে নেওয়া যাবে না।`
            : ''
        }
        confirmLabel="হ্যাঁ, মুছে ফেলুন"
        destructive
        loading={mutatingDrive}
        onConfirm={handleConfirmDeleteDriveFile}
        onCancel={() => setDeleteFileTarget(null)}
      />
    </div>
  );
};
