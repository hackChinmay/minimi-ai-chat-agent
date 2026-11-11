import { Router } from 'express';
import { healthRouter } from './healthRoute';
import { searchRouter } from './searchRoute';

const apiRouter = Router();

// Mount feature routers
apiRouter.use('/health', healthRouter);
apiRouter.use('/search', searchRouter);

export { apiRouter };
