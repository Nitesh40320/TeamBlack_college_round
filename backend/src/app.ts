import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { openApiSpec } from './docs/swagger';
import healthRoutes from './routes/healthRoutes';
import auditRoutes from './routes/auditRoutes';
import evalRoutes from './routes/evalRoutes';
import feedbackRoutes from './routes/feedbackRoutes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestIdMiddleware);
app.use(requestLogger);

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, please try again later.',
    },
  },
});

app.use('/api/', apiLimiter);

// Swagger Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

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
