import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../services/errors.js';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Invalid input',
      issues: error.issues.map(({ path, message }) => ({ path, message })),
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? error.status
      : undefined;
  if (status === 400 || status === 413) {
    res.status(status).json({
      error: status === 413 ? 'Request too large' : 'Invalid request body',
    });
    return;
  }
  console.error(
    'Request failed',
    error instanceof Error ? error.message : 'Unknown error',
  );
  res.status(500).json({ error: 'Internal server error' });
};
