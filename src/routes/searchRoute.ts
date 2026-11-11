import { Router } from 'express';
import { z } from 'zod';
import { searchController } from '../controllers/searchController';
import { validateRequest } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

export const searchRequestSchema = z.object({
  query: z
    .string({ required_error: 'Query is required' })
    .trim()
    .min(2, 'Query must be at least 2 characters long')
    .max(500, 'Query cannot exceed 500 characters'),
  maxResults: z.coerce
    .number()
    .int()
    .min(1, 'maxResults must be at least 1')
    .max(20, 'maxResults cannot exceed 20')
    .default(5)
    .optional(),
});

router.post(
  '/',
  validateRequest({ body: searchRequestSchema }),
  asyncHandler(searchController.search)
);

export const searchRouter = router;
