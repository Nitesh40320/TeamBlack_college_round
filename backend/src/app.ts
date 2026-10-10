import express from 'express';
import cors from 'cors';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import healthRoutes from './routes/healthRoutes';
import auditRoutes from './routes/auditRoutes';
import evalRoutes from './routes/evalRoutes';
import feedbackRoutes from './routes/feedbackRoutes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestIdMiddleware);
app.use(requestLogger);

// Mount routes
app.use('/', healthRoutes);
app.use('/api', auditRoutes);
app.use('/api', evalRoutes);
app.use('/api', feedbackRoutes);


// Catch 404
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
    },
  });
});

// Centralized error handler
app.use(errorHandler);

export default app;
