import { Router } from 'express';
import { getLatestEval } from '../controllers/evalController';

const router = Router();

router.get('/eval/latest', getLatestEval);

export default router;
