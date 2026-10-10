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
  getAuditJudges,
  generateCorrections,
} from '../controllers/auditController';
import { submitFeedback } from '../controllers/feedbackController';
import { handleIngestUrl } from '../controllers/ingestController';
import { handleBatchAudit } from '../controllers/batchController';

const router = Router();

router.post('/audits', createAudit);
router.post('/audits/batch', handleBatchAudit);
router.post('/batch-audits', handleBatchAudit);
router.post('/ingest/url', handleIngestUrl);
router.post('/audits/ingest-url', handleIngestUrl);

router.get('/audits', listAudits);
router.get('/audits/:id', getAuditById);
router.get('/audits/:id/stream', streamAuditProgress);
router.get('/audits/:id/export', exportAuditReport);
router.get('/audits/:id/summary', getAuditSummary);
router.get('/audits/:id/judges', getAuditJudges);
router.get('/audits/:id/findings', getFindings);
router.get('/audits/:id/annotations', getAnnotations);
router.get('/audits/:id/reasoning', getReasoningIssues);
router.get('/audits/:id/safety', getSafetyFlags);
router.post('/audits/:id/corrections', generateCorrections);
router.post('/audits/:id/rerun', rerunAudit);
router.post('/audits/:id/feedback', submitFeedback);

export default router;

