import { Router } from 'express';
import { healthRouter } from './healthRoute';

const apiRouter = Router();

// Mount feature routers
apiRouter.use('/health', healthRouter);

export { apiRouter };
