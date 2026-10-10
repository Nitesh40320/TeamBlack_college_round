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
