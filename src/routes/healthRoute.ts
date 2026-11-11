import { Router } from 'express';
import { healthController } from '../controllers/healthController';

const router = Router();

router.get('/', (req, res) => healthController.getHealth(req, res));

export const healthRouter = router;
