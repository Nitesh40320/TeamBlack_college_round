import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const reqId = (req.headers['x-request-id'] as string) || uuidv4();
  req.id = reqId;
  res.setHeader('x-request-id', reqId);
  next();
};
