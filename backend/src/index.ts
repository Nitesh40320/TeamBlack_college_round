import app from './app';
import { env } from './config/env';
import { connectDB } from './config/db';
import mongoose from 'mongoose';

const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(env.PORT, () => {
      console.log(
        `[Server] Backend running on port ${env.PORT} in ${env.NODE_ENV} mode`
      );
    });

    const gracefulShutdown = (signal: string) => {
      console.log(`[Server] ${signal} signal received. Starting graceful shutdown...`);
      server.close(async () => {
        console.log('[Server] HTTP server closed.');
        try {
          await mongoose.connection.close();
          console.log('[Server] Database connection closed.');
          process.exit(0);
        } catch (err) {
          console.error('[Server] Error closing database connection:', err);
          process.exit(1);
        }
      });

      setTimeout(() => {
        console.error('[Server] Forced shutdown after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    console.error('[Server] Failed to start backend server:', error);
    process.exit(1);
  }
};

startServer();
