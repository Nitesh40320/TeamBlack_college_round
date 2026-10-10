import { Router } from 'express';
import {
  createAudit,
  getAuditById,
  streamAuditProgress,
  exportAuditReport,
  rerunAudit,
  listAudits,
  getFindings,
  getAnnotations,
  getReasoningIssues,
  getSafetyFlags,
  getAuditSummary,
} from '../controllers/auditController';
import { submitFeedback } from '../controllers/feedbackController';

const router = Router();

router.post('/audits', createAudit);
router.get('/audits', listAudits);
router.get('/audits/:id', getAuditById);
router.get('/audits/:id/stream', streamAuditProgress);
router.get('/audits/:id/export', exportAuditReport);
router.get('/audits/:id/summary', getAuditSummary);
router.get('/audits/:id/findings', getFindings);
router.get('/audits/:id/annotations', getAnnotations);
router.get('/audits/:id/reasoning', getReasoningIssues);
router.get('/audits/:id/safety', getSafetyFlags);
router.post('/audits/:id/rerun', rerunAudit);
router.post('/audits/:id/feedback', submitFeedback);

export default router;

