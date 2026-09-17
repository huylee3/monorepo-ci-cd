import type { RequestHandler } from 'express';
import { authService } from '../services/auth.service.js';
export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    res.locals.auth = await authService.authenticate(req.cookies.access ?? '');
    next();
  } catch (e) {
    next(e);
  }
};
