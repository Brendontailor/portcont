import { env } from '../../config/env.js';

export interface UploadResult {
  key: string;
  url: string;
}

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN not configured');
  }

  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const key = `uploads/${timestamp}-${sanitizedName}`;

  const response = await fetch(`https://blob.vercel-storage.com/${key}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': mimeType,
      'x-add-random-suffix': 'false',
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload to Vercel Blob: ${error}`);
  }

  const data = await response.json() as { url: string };
  return { key, url: data.url };
}

export async function deleteFile(key: string): Promise<void> {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;

  await fetch(`https://blob.vercel-storage.com/${key}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}