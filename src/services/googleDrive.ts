import type { Customer, DriveBackupFile, Expense, Invoice, StudioSettings } from '../types/studio';

const STUDIO_FOLDER_NAME = 'Opoorbo Digital Studio Backups';
const LEDGER_BACKUP_FILENAME = 'opoorbo_studio_backup.json';

export interface StudioBackupPayload {
  version: number;
  exportedAt: string;
  studio: Partial<StudioSettings>;
  customers: Customer[];
  invoices: Invoice[];
  expenses: Expense[];
}

async function driveFetch(url: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error('DRIVE_AUTH_EXPIRED');
    }
    throw new Error(`Google Drive Error (${res.status}): ${errText.slice(0, 200)}`);
  }
  return res;
}

export async function ensureStudioDriveFolder(
  accessToken: string,
  knownFolderId?: string
): Promise<string> {
  if (knownFolderId) {
    try {
      const checkRes = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(knownFolderId)}?fields=id,trashed`,
        accessToken
      );
      const existing = (await checkRes.json()) as { id?: string; trashed?: boolean };
      if (existing.id && !existing.trashed) {
        return existing.id;
      }
    } catch {
      // Folder may have been deleted or inaccessible; recreate below
    }
  }

  const q = encodeURIComponent(
    `name='${STUDIO_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const listRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`,
    accessToken
  );
  const listData = (await listRes.json()) as { files?: Array<{ id: string; name: string }> };
  if (listData.files && listData.files.length > 0) {
    return listData.files[0].id;
  }

  const createRes = await driveFetch(
    'https://www.googleapis.com/drive/v3/files?fields=id',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: STUDIO_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

async function multipartUpload(
  accessToken: string,
  metadata: Record<string, unknown>,
  blob: Blob,
  mimeType: string,
  existingFileId?: string
): Promise<{ id: string; webViewLink?: string }> {
  const boundary = `opoorbo_boundary_${Date.now()}`;
  const metadataPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const closingPart = `\r\n--${boundary}--`;

  const bodyBlob = new Blob([metadataPart, blob, closingPart], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=multipart&fields=id,webViewLink`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';

  const res = await driveFetch(url, accessToken, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: bodyBlob,
  });

  return (await res.json()) as { id: string; webViewLink?: string };
}

export async function uploadFullStudioBackupToDrive(
  accessToken: string,
  folderId: string,
  payload: StudioBackupPayload
): Promise<{ fileId: string; webViewLink?: string }> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and name='${LEDGER_BACKUP_FILENAME}' and trashed=false`
  );
  const searchRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
    accessToken
  );
  const searchJson = (await searchRes.json()) as { files?: Array<{ id: string }> };
  const existingId = searchJson.files?.[0]?.id;

  const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });

  const metadata: Record<string, unknown> = existingId
    ? { name: LEDGER_BACKUP_FILENAME, mimeType: 'application/json' }
    : { name: LEDGER_BACKUP_FILENAME, parents: [folderId], mimeType: 'application/json' };

  const uploaded = await multipartUpload(
    accessToken,
    metadata,
    jsonBlob,
    'application/json',
    existingId
  );

  return { fileId: uploaded.id, webViewLink: uploaded.webViewLink };
}

export async function uploadPdfReceiptToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  pdfBlob: Blob
): Promise<{ fileId: string; webViewLink?: string }> {
  const uploaded = await multipartUpload(
    accessToken,
    {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/pdf',
    },
    pdfBlob,
    'application/pdf'
  );
  return { fileId: uploaded.id, webViewLink: uploaded.webViewLink };
}

export async function listDriveBackupFiles(
  accessToken: string,
  folderId: string
): Promise<DriveBackupFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=30&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)`,
    accessToken
  );
  const data = (await res.json()) as { files?: DriveBackupFile[] };
  return data.files ?? [];
}

export async function downloadDriveJsonBackup(
  accessToken: string,
  fileId: string
): Promise<StudioBackupPayload> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    accessToken
  );
  return (await res.json()) as StudioBackupPayload;
}

export async function deleteDriveBackupFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    accessToken,
    { method: 'DELETE' }
  );
}
