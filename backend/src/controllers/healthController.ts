import { Request, Response } from 'express';
import mongoose from 'mongoose';

export const getHealth = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

export const getReadiness = async (_req: Request, res: Response): Promise<void> => {
  const dbConnected = mongoose.connection.readyState === 1;

  if (!dbConnected) {
    res.status(503).json({
      status: 'not_ready',
      reason: 'Database connection not established',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(200).json({
    status: 'ready',
    checks: {
      database: 'connected',
    },
    timestamp: new Date().toISOString(),
  });
};
