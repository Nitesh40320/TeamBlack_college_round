import { Request, Response, NextFunction } from 'express';
import {
  batchAuditService,
  parseCsvBatch,
  parseJsonlBatch,
  BatchItemInput,
} from '../services/batchAuditService';
import { AppError } from '../middleware/errorHandler';

export const handleBatchAudit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let items: BatchItemInput[] = [];

    if (Array.isArray(req.body.items)) {
      items = req.body.items;
    } else if (typeof req.body.content === 'string') {
      const format = (req.body.format || 'csv').toLowerCase();
      if (format === 'jsonl') {
        items = parseJsonlBatch(req.body.content);
      } else {
        items = parseCsvBatch(req.body.content);
      }
    } else if (typeof req.body === 'string') {
      // Raw payload string
      const str = req.body.trim();
      if (str.startsWith('{') || str.startsWith('[')) {
        try {
          const parsed = JSON.parse(str);
          items = Array.isArray(parsed) ? parsed : parsed.items || [];
        } catch (_err) {
          items = parseJsonlBatch(str);
        }
      } else {
        items = parseCsvBatch(str);
      }
    } else {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Request body must provide an "items" array or a CSV/JSONL "content" string.'
      );
    }

    const result = await batchAuditService.processBatch(items);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
};
