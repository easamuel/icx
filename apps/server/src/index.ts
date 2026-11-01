import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pool } from '@icx/database';
import { env } from './config/env.js';
import { redis } from './lib/redis.js';
import { initializePrivateStorage } from './engines/storage.engine.js';
import { releaseExpiredHolds } from './engines/concurrency.engine.js';
import { runScheduledNotificationsSweep } from './engines/scheduler.engine.js';
import { observabilityMiddleware } from './middleware/observability.js';
import { authRouter } from './routes/auth.routes.js';
import { uploadsRouter } from './routes/uploads.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { editingRouter } from './routes/editing.routes.js';
import { bookingsRouter } from './routes/bookings.routes.js';
import { rentalsRouter } from './routes/rentals.routes.js';
import { editorRouter } from './routes/editor.routes.js';
import { adminRouter } from './routes/admin.routes.js';

export const app = express();

// 1. Enterprise Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 2. CORS Configuration for Web App & Expo Mobile Clients (Exposes TUS Resumable Headers)
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origin not allowed by ICX Studios CORS policy'));
      }
    },
    credentials: true,
    exposedHeaders: [
      'Location',
      'Upload-Offset',
      'Upload-Length',
      'Tus-Version',
      'Tus-Resumable',
      'Tus-Max-Size',
      'Tus-Extension',
      'X-ICX-Photo-Id',
    ],
  })
);

app.use(cookieParser());
app.use(observabilityMiddleware);

// 3. Preserve Raw Buffer for Paystack Webhook Signature Verification
// Skip JSON body parsing on TUS binary PATCH stream requests
app.use((req: Request & { rawBody?: Buffer }, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/v1/uploads/tus') && req.method === 'PATCH') {
    next();
    return;
  }

  express.json({
    limit: '60mb',
    verify: (innerReq: Request & { rawBody?: Buffer }, _innerRes, buf) => {
      if (innerReq.originalUrl.startsWith('/api/v1/payments/paystack/webhook')) {
        innerReq.rawBody = Buffer.from(buf);
      }
    },
  })(req, res, next);
});

// 4. Health & Infrastructure Readiness Endpoint
app.get('/api/v1/health', async (_req: Request, res: Response) => {
  try {
    const dbCheck = await pool.query('SELECT NOW() AS server_time');
    const redisPing = await redis.ping();

    res.status(200).json({
      status: 'healthy',
      service: 'icx-studios-backend',
      timestamp: dbCheck.rows[0]?.server_time,
      dependencies: {
        postgresql: 'connected',
        redis: redisPing === 'PONG' ? 'connected' : 'degraded',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Infrastructure check failed',
    });
  }
});

// 5. Production API Route Mounts
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/uploads', uploadsRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/editing', editingRouter);
app.use('/api/v1/bookings', bookingsRouter);
app.use('/api/v1/rentals', rentalsRouter);
app.use('/api/v1/editor', editorRouter);
app.use('/api/v1/admin', adminRouter);

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ICX-SERVER] Unhandled Exception:', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
  });
});

if (process.env.NODE_ENV !== 'test') {
  initializePrivateStorage()
    .then(() => {
      const server = app.listen(env.PORT, () => {
        console.log(
          `[ICX-SERVER] Self-Hosted API Engine listening on http://localhost:${env.PORT}`
        );
      });

      // Background Hold Expiration Reaper (30-min Rental Holds & 48-hr Booking Slot Holds)
      const holdReaperInterval = setInterval(() => {
        releaseExpiredHolds().catch((err) => {
          console.error('[ICX-REAPER] Failed to sweep expired holds:', err.message);
        });
      }, 30_000);

      // Background Notification Scheduler (PE-11 3/7/14-Day Balance Reminders & NT-08 Rental Return Reminders)
      const schedulerInterval = setInterval(() => {
        runScheduledNotificationsSweep().catch((err) => {
          console.error('[ICX-SCHEDULER] Notification sweep error:', err.message);
        });
      }, 15 * 60 * 1000);

      const shutdown = async () => {
        console.log('[ICX-SERVER] Shutting down gracefully...');
        clearInterval(holdReaperInterval);
        clearInterval(schedulerInterval);
        server.close();
        await pool.end();
        redis.disconnect();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    })
    .catch((err) => {
      console.error('[ICX-SERVER] Failed to initialize private storage:', err);
      process.exit(1);
    });
}
