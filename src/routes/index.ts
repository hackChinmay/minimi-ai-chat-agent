import { Router } from 'express';
import { healthRouter } from './healthRoute';
import { searchRouter } from './searchRoute';
import { conversationRouter } from './conversationRoute';

const apiRouter = Router();

// Mount feature routers
apiRouter.use('/health', healthRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/conversations', conversationRouter);

export { apiRouter };
