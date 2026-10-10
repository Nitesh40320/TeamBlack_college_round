/**
 * File parsing service.
 *
 * Converts uploaded binary buffers into normalized plain text for analysis.
 *
 * Normalization rules (offset-safety):
 *   - PDF / DOCX: strip metadata, normalize Unicode, collapse runs of 3+
 *     blank lines to 2. Never alter in-line whitespace (spaces within a
 *     line stay intact so character offsets into sentences remain stable).
 *   - Plain text / Markdown: used as-is (no normalization) to maximize
 *     offset predictability.
 *
 * The returned text is the EXACT string stored in the Source document and
 * forwarded to the model service. Nothing downstream may alter it.
 */

const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';
import { AppError } from '../middleware/errorHandler';

export type SupportedMime =
  | 'text/plain'
  | 'text/markdown'
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const SUPPORTED_MIMES: readonly string[] = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const EXTENSION_MIME_MAP: Record<string, SupportedMime> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Resolve MIME type from file extension if multer could not detect it.
 */
export function resolveMimeType(
  originalName: string,
  detectedMime?: string
): SupportedMime {
  if (detectedMime && SUPPORTED_MIMES.includes(detectedMime)) {
    return detectedMime as SupportedMime;
  }
  const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();
  const resolved = EXTENSION_MIME_MAP[ext];
  if (!resolved) {
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      `Unsupported file type: "${originalName}". Allowed: .txt, .md, .pdf, .docx`
    );
  }
  return resolved;
}

/**
 * Minimal normalization that does NOT alter character offsets within sentences.
 *
 * Rules applied:
 *   1. Normalize Unicode to NFC.
 *   2. Normalize CR+LF and bare CR to LF.
 *   3. Collapse runs of 3+ consecutive blank lines to exactly 2.
 *   4. Strip trailing whitespace from each line (safe: only trailing space).
 *   5. Trim leading/trailing whitespace of the whole document.
 *
 * Deliberately NOT applied (would shift offsets):
 *   - Any removal of inline whitespace between words.
 *   - Any word-level transformation.
 */
function normalizeExtracted(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/**
 * Extract plain text from a file buffer.
 *
 * @param buffer       Raw file bytes.
 * @param mimeType     Resolved MIME type.
 * @param originalName Used only for error messages.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: SupportedMime,
  originalName: string
): Promise<string> {
  switch (mimeType) {
    case 'text/plain':
    case 'text/markdown':
      // Return verbatim: text/plain is already offset-stable
      return buffer.toString('utf-8').normalize('NFC').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();

    case 'application/pdf': {
      try {
        const result = await pdfParse(buffer);
        return normalizeExtracted(result.text);
      } catch (err: any) {
        throw new AppError(
          422,
          'UNPROCESSABLE_ENTITY',
          `Failed to parse PDF "${originalName}": ${err.message}`
        );
      }
    }

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      try {
        const result = await mammoth.extractRawText({ buffer });
        return normalizeExtracted(result.value);
      } catch (err: any) {
        throw new AppError(
          422,
          'UNPROCESSABLE_ENTITY',
          `Failed to parse DOCX "${originalName}": ${err.message}`
        );
      }
    }

    default:
      throw new AppError(
        422,
        'UNPROCESSABLE_ENTITY',
        `Unsupported MIME type: "${mimeType}"`
      );
  }
}
