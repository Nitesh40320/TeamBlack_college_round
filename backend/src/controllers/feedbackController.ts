import { Request, Response, NextFunction } from 'express';
import { FeedbackInputSchema } from '../types/contract';
import { feedbackService } from '../services/feedbackService';

export const submitFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: auditId } = req.params;
    const validatedInput = FeedbackInputSchema.parse(req.body);

    const clientId =
      (req.headers['x-client-id'] as string) ||
      (req.headers['x-session-id'] as string) ||
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      'default-client';

    const result = await feedbackService.submitFeedback(
      auditId,
      validatedInput,
      clientId
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getFeedbackStats = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await feedbackService.getFeedbackStats();
    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
};

export const exportFeedback = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const jsonlContent = await feedbackService.exportFeedbackJsonl();
    res.setHeader('Content-Type', 'application/x-jsonlines; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="feedback_export.jsonl"');
    res.status(200).send(jsonlContent);
  } catch (error) {
    next(error);
  }
};

export const triggerRecalibration = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const adminKey = req.headers['x-admin-key'] as string | undefined;
    const authHeader = req.headers['authorization'] as string | undefined;
    const isDev = process.env.NODE_ENV !== 'production';

    if (!isDev && adminKey !== 'admin' && !authHeader?.includes('admin')) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Admin credentials required to trigger calibrator refitting.',
        },
      });
      return;
    }

    const result = await feedbackService.recalibrateCalibrator();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
