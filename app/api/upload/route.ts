import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireAuth } from '@/lib/auth';
import { uploadFile, validateFile, parseUpload } from '@/lib/storage';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

// POST /api/upload — upload a file and attach to an employee document record
export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const parsed = await parseUpload(req);

    if (!parsed) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const { file, originalName, mimeType, size, fields } = parsed;

    // Validate
    const validationError = validateFile(size, mimeType);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Upload to storage
    const result = await uploadFile({
      buffer: file,
      originalName,
      mimeType,
      folder: fields.folder ?? 'documents',
    });

    // If employee_id and doc_type provided, save document record
    if (fields.employee_id && fields.doc_type && fields.title) {
      const docRes = await query(
        `INSERT INTO employee_documents
           (employee_id, doc_type, title, file_name, file_size, file_url, mime_type, expiry_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          fields.employee_id,
          fields.doc_type,
          fields.title,
          originalName,
          size,
          result.url,
          mimeType,
          fields.expiry_date || null,
          fields.notes || null,
        ]
      );

      return NextResponse.json({
        upload: result,
        document: docRes.rows[0],
      }, { status: 201 });
    }

    return NextResponse.json({ upload: result }, { status: 201 });
  } catch (err) {
    console.error('[Upload POST]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// GET /api/upload?key=xxx — get a fresh signed URL for a stored file
export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 });

  try {
    const { getFileUrl } = await import('@/lib/storage');
    const url = await getFileUrl(key);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[Upload GET]', err);
    return NextResponse.json({ error: 'Failed to get URL' }, { status: 500 });
  }
}
