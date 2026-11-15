import { Router } from 'express';
import { z } from 'zod';
import { historicalController } from '../controllers/historicalController';
import { validateRequest } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Validation Schemas
const historicalSearchBodySchema = z.object({
  query: z
    .string({ required_error: 'Query is required' })
    .trim()
    .min(1, 'Query cannot be empty')
    .max(500, 'Query cannot exceed 500 characters'),
  conversationId: z.string().uuid('conversationId must be a valid UUID v4').optional(),
  date: z.string().trim().max(100).optional(),
  maxResults: z.coerce.number().int().min(1).max(20).optional(),
});

const getSnapshotsQuerySchema = z.object({
  conversationId: z.string().uuid('conversationId must be a valid UUID v4').optional(),
  entity: z.string().trim().max(100).optional(),
  query: z.string().trim().max(200).optional(),
  since: z.string().trim().optional(),
  until: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const historicalCompareBodySchema = z.object({
  conversationId: z.string().uuid('conversationId must be a valid UUID v4').optional(),
  subject: z
    .string({ required_error: 'Subject is required' })
    .trim()
    .min(1, 'Subject cannot be empty')
    .max(200, 'Subject cannot exceed 200 characters'),
  attribute: z.string().trim().max(100).optional(),
  baselineDate: z.string().trim().optional(),
  targetDate: z.string().trim().optional(),
});

// Route Bindings
router.post(
  '/search',
  validateRequest({ body: historicalSearchBodySchema }),
  asyncHandler(historicalController.search)
);

router.get(
  '/snapshots',
  validateRequest({ query: getSnapshotsQuerySchema }),
  asyncHandler(historicalController.getSnapshots)
);

router.post(
  '/compare',
  validateRequest({ body: historicalCompareBodySchema }),
  asyncHandler(historicalController.compare)
);

export const historicalRouter = router;
