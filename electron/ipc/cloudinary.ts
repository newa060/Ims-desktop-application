import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import logger from '../../src/utils/logger';

/**
 * Uploads a file to Cloudinary.
 * Two channels:
 *   staff:uploadToCloudinary      — receives a local file path (main-process use)
 *   staff:uploadToCloudinaryBase64 — receives base64 content (renderer use)
 */
export const setupCloudinaryHandlers = () => {

  /** Shared upload logic */
  const uploadBuffer = async (
    buffer: Buffer,
    fileName: string,
    folder: string,
    publicId?: string
  ): Promise<{ success: boolean; url?: string; publicId?: string; error?: string }> => {
    const cloudName  = process.env.CLOUDINARY_CLOUD_NAME!;
    const apiKey     = process.env.CLOUDINARY_API_KEY!;
    const apiSecret  = process.env.CLOUDINARY_API_SECRET!;

    if (!cloudName || !apiKey || !apiSecret) {
      return { success: false, error: 'Cloudinary credentials not configured' };
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sigParams: Record<string, string> = { folder, timestamp };
    if (publicId) sigParams.public_id = publicId;

    const sigString =
      Object.keys(sigParams).sort().map((k) => `${k}=${sigParams[k]}`).join('&') + apiSecret;
    const signature = crypto.createHash('sha1').update(sigString).digest('hex');

    const boundary = `----CloudinaryBoundary${Date.now()}`;
    const ext      = path.extname(fileName).toLowerCase();
    const mimeType =
      ext === '.pdf' ? 'application/pdf' :
      ext === '.png' ? 'image/png'       :
      ext === '.gif' ? 'image/gif'       : 'image/jpeg';

    const parts: Buffer[] = [];
    const addField = (name: string, value: string) => {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    };

    addField('api_key',   apiKey);
    addField('timestamp', timestamp);
    addField('folder',    folder);
    addField('signature', signature);
    if (publicId) addField('public_id', publicId);

    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
    parts.push(buffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body      = Buffer.concat(parts);
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    const res = await fetch(uploadUrl, {
      method:  'POST',
      headers: {
        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
      body,
    });

    const json: any = await res.json();
    if (!res.ok || json.error) {
      const msg = json.error?.message ?? `Upload failed (HTTP ${res.status})`;
      logger.error('Cloudinary upload error:', msg);
      return { success: false, error: msg };
    }

    logger.info(`Cloudinary upload OK: ${json.secure_url}`);
    return { success: true, url: json.secure_url, publicId: json.public_id };
  };

  // ── Channel 1: base64 content from renderer ────────────────────────────────
  ipcMain.handle(
    'staff:uploadToCloudinaryBase64',
    async (
      _event,
      params: { base64: string; fileName: string; folder: string; publicId?: string }
    ) => {
      try {
        const buffer = Buffer.from(params.base64, 'base64');
        return await uploadBuffer(buffer, params.fileName, params.folder, params.publicId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Cloudinary base64 upload exception:', msg);
        return { success: false, error: msg };
      }
    }
  );

  // ── Channel 2: local file path from main process ───────────────────────────
  ipcMain.handle(
    'staff:uploadToCloudinary',
    async (
      _event,
      params: { filePath: string; folder: string; publicId?: string }
    ) => {
      try {
        if (!fs.existsSync(params.filePath)) {
          return { success: false, error: `File not found: ${params.filePath}` };
        }
        const buffer   = fs.readFileSync(params.filePath);
        const fileName = path.basename(params.filePath);
        return await uploadBuffer(buffer, fileName, params.folder, params.publicId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Cloudinary file upload exception:', msg);
        return { success: false, error: msg };
      }
    }
  );
};
