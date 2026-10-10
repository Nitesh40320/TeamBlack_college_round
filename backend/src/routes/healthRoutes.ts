import { Router } from 'express';
import { getHealth, getReadiness } from '../controllers/healthController';

const router = Router();

router.get('/health', getHealth);
router.get('/readiness', getReadiness);

export default router;
