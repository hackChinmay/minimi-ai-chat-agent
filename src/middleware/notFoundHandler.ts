import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../utils/errors';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const method = req.method;
  const path = req.originalUrl || req.url;
  next(new NotFoundError(`Cannot ${method} ${path}`));
}
