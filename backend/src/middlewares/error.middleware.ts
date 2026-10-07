import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function redactSecrets(message: string): string {
  let safeMessage = message;
  for (const key of ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'ADMIN_PASSWORD']) {
    const secret = process.env[key];
    if (secret) safeMessage = safeMessage.split(secret).join('[REDACTED]');
  }
  return safeMessage.replace(/postgres(?:ql)?:\/\/\S+/gi, '[DATABASE_URL]');
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const isProduction = env.NODE_ENV === 'production';
  if (isProduction) {
    const metadata = err as Error & { code?: unknown; errorCode?: unknown };
    const code = typeof metadata.code === 'string'
      ? metadata.code
      : typeof metadata.errorCode === 'string' ? metadata.errorCode : undefined;
    if (!(err instanceof AppError) || err.statusCode >= 500) {
      console.error('[ERROR]', { name: err.name, code, message: redactSecrets(err.message) });
    }
  } else {
    console.error(`[ERROR] ${err.name}: ${err.message}`, err.stack);
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.flatten().fieldErrors,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
  }

  if (err.name === 'MulterError') {
    if (err.message.includes('File too large')) {
      return res.status(413).json({ error: `Arquivo excede o tamanho máximo de ${env.MAX_UPLOAD_MB}MB` });
    }
    return res.status(400).json({ error: 'Erro no upload do arquivo' });
  }

  return res.status(500).json({
    error: isProduction ? 'Erro interno do servidor' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Rota não encontrada' });
}
