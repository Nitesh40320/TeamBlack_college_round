import { Request, Response, NextFunction } from 'express';
import { modelClient } from '../services/modelClient';

export const getLatestEval = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await modelClient.getLatestEval();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
