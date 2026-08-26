export const MEDIA_MAX_BYTES = 16 * 1024 * 1024;

export const MEDIA_MAX_BYTES_BY_KIND = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
} as const;

export function buildMediaPath(
  accountId: string,
  fileName: string,
  now: number = Date.now()
): string {
  // The extension comes from a user-controlled filename; restrict it to a
  // short alphanumeric token so path separators can never reach the
  // storage object key (e.g. "x.pdf/../../evil").
  const hasExt = /\.[^.]+$/.test(fileName);
  const rawExt = hasExt ? fileName.split('.').pop()!.toLowerCase() : 'bin';
  const ext = /^[a-z0-9]{1,10}$/.test(rawExt) ? rawExt : 'bin';
  const safeBase =
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 40) || 'file';
  return `account-${accountId}/${now}-${safeBase}.${ext}`;
}

export interface UploadAccountMediaResult {
  publicUrl: string;
  path: string;
}

export async function uploadAccountMedia(
  bucket: string,
  file: File
): Promise<UploadAccountMediaResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (bucket) {
    formData.append('bucket', bucket);
  }

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Upload failed with status ${res.status}`);
  }

  const payload = await res.json();
  return {
    publicUrl: payload.data.publicUrl,
    path: payload.data.path,
  };
}

export async function deleteAccountMedia(
  bucket: string,
  path: string
): Promise<void> {
  try {
    const url = `/api/upload?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;
    await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch {
    // best-effort cleanup
  }
}
