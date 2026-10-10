/**
 * Multer configuration for multipart/form-data uploads.
 *
 * Limits enforced here (hard limits):
 *   - Per-file size: 10 MB
 *   - Max files:     20
 *   - Total fields:  25 (answer + question + up to 20 source text fields + spare)
 *
 * Business-logic limits (source count, total chars) are enforced in auditService.
 * Files are stored in memory (never written to disk) for security and portability.
 */

import multer from 'multer';

const ALLOWED_MIMES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Browser may send these for .txt / .md
  'application/octet-stream',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 20,
    fields: 25,
  },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    const allowedExts = ['.txt', '.md', '.pdf', '.docx'];
    if (!allowedExts.includes(ext) && !ALLOWED_MIMES.includes(file.mimetype)) {
      cb(new Error(`Unsupported file type: "${file.originalname}". Allowed: .txt, .md, .pdf, .docx`));
      return;
    }
    cb(null, true);
  },
});

/**
 * Accept any mix of:
 *   - `sourceFiles` (uploaded files, any count up to 20)
 */
export const uploadMiddleware = upload.array('sourceFiles', 20);
