import { Request, Response, NextFunction } from 'express';
import { ingestUrl } from '../services/urlIngestionService';
import { AppError } from '../middleware/errorHandler';

export const handleIngestUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Field "url" is required in request body.'
      );
    }

    const result = await ingestUrl(url);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
