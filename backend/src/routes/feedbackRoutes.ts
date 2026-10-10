import { Router } from 'express';
import { getFeedbackStats } from '../controllers/feedbackController';

const router = Router();

router.get('/feedback/stats', getFeedbackStats);

export default router;
