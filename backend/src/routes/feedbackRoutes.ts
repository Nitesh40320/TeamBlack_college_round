import { Router } from 'express';
import {
  getFeedbackStats,
  exportFeedback,
  triggerRecalibration,
} from '../controllers/feedbackController';

const router = Router();

router.get('/feedback/stats', getFeedbackStats);
router.get('/feedback/export', exportFeedback);
router.post('/feedback/recalibrate', triggerRecalibration);
router.post('/admin/recalibrate', triggerRecalibration);

export default router;
