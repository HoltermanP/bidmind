import { readFile } from 'fs/promises'
import path from 'path'
import { extractTextFromBuffer } from '@/lib/documents/extract-text'

export function guessMimeFromFileName(fileName: string | null): string {
  const ext = path.extname(fileName || '').toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.docx')
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === '.doc') return 'application/msword'
  if (ext === '.xlsx')
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return 'application/octet-stream'
}

const MAX_CHARS = 120_000

/** Tekst uit een handmatig geüpload document (lokaal bestand of publieke URL). */
export async function extractTextFromUploadedDoc(doc: {
  fileName: string | null
  fileUrl: string | null
  tenderId: string | null
}): Promise<string | null> {
  const { fileUrl, fileName, tenderId } = doc
  if (!fileUrl || !tenderId) return null

  if (fileUrl.startsWith('/uploads/')) {
    const prefix = `/uploads/tenders/${tenderId}/`
    if (!fileUrl.startsWith(prefix)) return null
    const rel = fileUrl.replace(/^\//, '')
    const abs = path.join(process.cwd(), 'public', rel)
    try {
      const buf = await readFile(abs)
      const mime = guessMimeFromFileName(fileName)
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      const extracted = await extractTextFromBuffer(ab, mime)
      if (extracted && extracted.trim().length > 0) {
        return extracted.length > MAX_CHARS
          ? extracted.slice(0, MAX_CHARS) + '\n\n[... document ingekort voor analyse ...]'
          : extracted
      }
    } catch (e) {
      console.warn('Geüpload bestand lezen mislukt:', e)
    }
    return null
  }

  if (fileUrl.startsWith('http') && !fileUrl.includes('placeholder.uploadthing.com')) {
    try {
      const res = await fetch(fileUrl, { signal: AbortSignal.timeout(120_000) })
      if (!res.ok) return null
      const ct = res.headers.get('content-type') || guessMimeFromFileName(fileName)
      const buf = await res.arrayBuffer()
      const extracted = await extractTextFromBuffer(buf, ct)
      if (extracted && extracted.trim().length > 0) {
        return extracted.length > MAX_CHARS
          ? extracted.slice(0, MAX_CHARS) + '\n\n[... document ingekort voor analyse ...]'
          : extracted
      }
    } catch (e) {
      console.warn('Document-URL ophalen mislukt:', e)
    }
  }

  return null
}
