import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

// ── Storage backend selection ─────────────────────────────────────────────────
// Set STORAGE_BACKEND=s3 in .env for production (AWS S3 or Cloudflare R2)
// Default: local disk at ./public/uploads (dev only)

const BACKEND = process.env.STORAGE_BACKEND ?? 'local';

// S3 / Cloudflare R2 config
const s3 = BACKEND === 's3' ? new S3Client({
  region: process.env.S3_REGION ?? 'auto',
  endpoint: process.env.S3_ENDPOINT,           // set for Cloudflare R2
  credentials: {
    accessKeyId:     process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
}) : null;

const S3_BUCKET = process.env.S3_BUCKET ?? 'peoplecore-documents';
const LOCAL_DIR = path.join(process.cwd(), 'public', 'uploads');

// ── Types ─────────────────────────────────────────────────────────────────────
export interface UploadResult {
  key: string;        // storage key / relative path
  url: string;        // public or signed URL
  size: number;
  mime_type: string;
  original_name: string;
}

// ── Allowed MIME types ────────────────────────────────────────────────────────
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const MAX_SIZE_MB = 10;

export function validateFile(size: number, mimeType: string): string | null {
  if (size > MAX_SIZE_MB * 1024 * 1024) return `File too large (max ${MAX_SIZE_MB}MB)`;
  if (!ALLOWED_TYPES.includes(mimeType)) return 'File type not allowed (PDF, JPEG, PNG, DOCX only)';
  return null;
}

// ── Upload ────────────────────────────────────────────────────────────────────
export async function uploadFile(opts: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder?: string;      // e.g. 'documents', 'avatars'
}): Promise<UploadResult> {
  const { buffer, originalName, mimeType, folder = 'documents' } = opts;

  // Sanitize filename
  const ext  = path.extname(originalName).toLowerCase() || '.bin';
  const safe = originalName.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
  const key  = `${folder}/${Date.now()}-${safe}`;

  if (BACKEND === 's3' && s3) {
    // Upload to S3 / R2
    await s3.send(new PutObjectCommand({
      Bucket:      S3_BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
    }));

    // Generate signed URL (1 hour)
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn: 3600 });

    return { key, url, size: buffer.length, mime_type: mimeType, original_name: originalName };
  } else {
    // Local disk
    const dir = path.join(LOCAL_DIR, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `${Date.now()}-${safe}`;
    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, buffer);

    const url = `/uploads/${folder}/${filename}`;
    return { key: `${folder}/${filename}`, url, size: buffer.length, mime_type: mimeType, original_name: originalName };
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
export async function deleteFile(key: string): Promise<void> {
  if (BACKEND === 's3' && s3) {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } else {
    const fullPath = path.join(LOCAL_DIR, '..', key);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
}

// ── Get signed URL ────────────────────────────────────────────────────────────
export async function getFileUrl(key: string): Promise<string> {
  if (BACKEND === 's3' && s3) {
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn: 3600 });
  }
  return `/uploads/${key}`;
}

// ── Parse multipart form data (Next.js App Router) ────────────────────────────
export async function parseUpload(req: Request): Promise<{
  file: Buffer; originalName: string; mimeType: string; size: number;
  fields: Record<string, string>;
} | null> {
  try {
    const formData = await req.formData();
    const file     = formData.get('file') as File | null;
    if (!file) return null;

    const buffer   = Buffer.from(await file.arrayBuffer());
    const fields: Record<string, string> = {};

    formData.forEach((value, key) => {
      if (key !== 'file' && typeof value === 'string') fields[key] = value;
    });

    return {
      file: buffer,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      fields,
    };
  } catch {
    return null;
  }
}
