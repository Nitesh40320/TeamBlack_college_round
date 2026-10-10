import { v4 as uuidv4 } from 'uuid';
import { auditService } from './auditService';
import { AuditRequestInput, AuditResult } from '../types/contract';
import { AppError } from '../middleware/errorHandler';

export interface BatchItemInput {
  question?: string;
  answer: string;
  sources?: Array<{ id?: string; title: string; text: string }>;
  sourceText?: string;
  sourceTitle?: string;
}

export interface BatchAuditSummary {
  id: string;
  status: string;
  createdAt: string;
  question?: string;
  answer?: string;
}

export interface BatchAuditResultResponse {
  batchId: string;
  total: number;
  audits: BatchAuditSummary[];
  createdAt: string;
}

/**
 * Parses raw CSV string into batch items.
 */
export function parseCsvBatch(csvContent: string): BatchItemInput[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'CSV content must contain a header row and at least one data row.'
    );
  }

  // Parse header
  const headers = parseCsvRow(lines[0]).map((h) => h.toLowerCase());
  const answerIdx = headers.findIndex((h) => h === 'answer' || h === 'answertext');
  const questionIdx = headers.findIndex((h) => h === 'question');
  const sourceTextIdx = headers.findIndex(
    (h) => h === 'sourcetext' || h === 'source' || h === 'sources'
  );
  const sourceTitleIdx = headers.findIndex((h) => h === 'sourcetitle' || h === 'title');

  if (answerIdx === -1) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'CSV header must include an "answer" column.'
    );
  }

  const items: BatchItemInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    const answer = row[answerIdx]?.trim();
    if (!answer) continue;

    const question = questionIdx !== -1 ? row[questionIdx]?.trim() : undefined;
    const sourceText = sourceTextIdx !== -1 ? row[sourceTextIdx]?.trim() : undefined;
    const sourceTitle =
      sourceTitleIdx !== -1 ? row[sourceTitleIdx]?.trim() : `Batch Source ${i}`;

    items.push({
      question,
      answer,
      sourceText: sourceText || answer,
      sourceTitle,
    });
  }

  return items;
}

/**
 * Minimal CSV row parser supporting quoted strings.
 */
function parseCsvRow(rowStr: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    if (char === '"' && (i === 0 || rowStr[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses JSONL batch string into batch items.
 */
export function parseJsonlBatch(jsonlContent: string): BatchItemInput[] {
  const lines = jsonlContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'JSONL content is empty.'
    );
  }

  const items: BatchItemInput[] = [];

  for (let i = 0; i < lines.length; i++) {
    try {
      const obj = JSON.parse(lines[i]);
      if (typeof obj !== 'object' || !obj.answer) continue;
      items.push(obj);
    } catch (_err) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Invalid JSON syntax on line ${i + 1} of JSONL upload.`
      );
    }
  }

  return items;
}

export class BatchAuditService {
  public async processBatch(
    items: BatchItemInput[]
  ): Promise<BatchAuditResultResponse> {
    if (!items || items.length === 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Batch items array cannot be empty.'
      );
    }

    if (items.length > 50) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Maximum 50 audit items per batch request.'
      );
    }

    const batchId = `batch-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();
    const audits: BatchAuditSummary[] = [];

    for (let i = 0; i < items.length; i++) {
      const raw = items[i];
      const sources =
        raw.sources && raw.sources.length > 0
          ? raw.sources.map((s, idx) => ({
              id: s.id || `src-${idx + 1}`,
              title: s.title || `Source ${idx + 1}`,
              text: s.text,
            }))
          : [
              {
                id: 'src-1',
                title: raw.sourceTitle || `Source Document 1`,
                text: raw.sourceText || raw.answer,
              },
            ];

      const requestPayload: AuditRequestInput = {
        question: raw.question,
        answer: raw.answer,
        sources,
      };

      try {
        const audit = await auditService.createAudit(requestPayload);
        audits.push({
          ...audit,
          question: raw.question,
          answer: raw.answer,
        });
      } catch (err: any) {
        console.error(`[BatchAuditService] Error processing batch item ${i + 1}:`, err);
      }
    }

    return {
      batchId,
      total: audits.length,
      audits,
      createdAt: now,
    };
  }
}

export const batchAuditService = new BatchAuditService();
