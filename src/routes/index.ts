import { Router } from 'express';
import { healthRouter } from './healthRoute';
import { searchRouter } from './searchRoute';
import { conversationRouter } from './conversationRoute';
import { historicalRouter } from './historicalRoute';

const apiRouter = Router();

// Mount feature routers
apiRouter.use('/health', healthRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/conversations', conversationRouter);
apiRouter.use('/historical', historicalRouter);

export { apiRouter };
