import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Requirement NF-15: Enterprise Observability, Correlation Tracing & Latency Telemetry.
 * Assigns a deterministic `X-Request-Id` to every API and file request, logs structured
 * latency metrics, and alerts on 5xx server faults.
 */
export function observabilityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId =
    (req.headers['x-request-id'] as string | undefined) || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startNs = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    const status = res.statusCode;

    if (status >= 500) {
      console.error(
        JSON.stringify({
          level: 'ERROR_ALERT',
          service: 'icx-studios-api',
          requestId,
          method: req.method,
          path: req.originalUrl,
          status,
          durationMs: Number(durationMs.toFixed(2)),
          actorId: req.user?.sub ?? null,
          timestamp: new Date().toISOString(),
        })
      );
    }
  });

  next();
}

