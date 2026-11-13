import { Router } from 'express';
import { z } from 'zod';
import { conversationController } from '../controllers/conversationController';
import { validateRequest } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { env } from '../config/env';

const router = Router();

// Validation Schemas
const conversationIdParamSchema = z.object({
  conversationId: z.string().uuid({ message: 'Invalid conversation ID: must be a valid UUID v4' }),
});

const createConversationBodySchema = z.object({
  title: z.string().trim().max(200, 'Title cannot exceed 200 characters').optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

const appendMessageBodySchema = z.object({
  role: z.enum(['user', 'assistant', 'system'], {
    errorMap: () => ({ message: 'Role must be "user", "assistant", or "system"' }),
  }),
  content: z
    .string({ required_error: 'Content is required' })
    .trim()
    .min(1, 'Message content cannot be empty')
    .max(env.MAX_MESSAGE_LENGTH, `Message content cannot exceed ${env.MAX_MESSAGE_LENGTH} characters`),
  metadata: z.record(z.unknown()).optional(),
});

const getMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: z.string().datetime({ message: 'before parameter must be a valid ISO-8601 timestamp' }).optional(),
  contextWindow: z.enum(['true', 'false']).optional(),
  maxMessages: z.coerce.number().int().min(1).max(100).optional(),
  maxCharacters: z.coerce.number().int().min(1).optional(),
});

// Route Bindings
router.post(
  '/',
  validateRequest({ body: createConversationBodySchema }),
  asyncHandler(conversationController.createConversation)
);

router.get(
  '/',
  validateRequest({ query: listConversationsQuerySchema }),
  asyncHandler(conversationController.listConversations)
);

router.get(
  '/:conversationId',
  validateRequest({ params: conversationIdParamSchema }),
  asyncHandler(conversationController.getConversation)
);

router.delete(
  '/:conversationId',
  validateRequest({ params: conversationIdParamSchema }),
  asyncHandler(conversationController.deleteConversation)
);

router.post(
  '/:conversationId/messages',
  validateRequest({
    params: conversationIdParamSchema,
    body: appendMessageBodySchema,
  }),
  asyncHandler(conversationController.appendMessage)
);

router.get(
  '/:conversationId/messages',
  validateRequest({
    params: conversationIdParamSchema,
    query: getMessagesQuerySchema,
  }),
  asyncHandler(conversationController.getMessages)
);

export const conversationRouter = router;
