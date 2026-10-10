import { Router } from 'express';
import {
  createAudit,
  getAuditById,
  rerunAudit,
  listAudits,
  getFindings,
  getAnnotations,
  getReasoningIssues,
  getSafetyFlags,
} from '../controllers/auditController';

const router = Router();

router.post('/audits', createAudit);
router.get('/audits', listAudits);
router.get('/audits/:id', getAuditById);
router.get('/audits/:id/findings', getFindings);
router.get('/audits/:id/annotations', getAnnotations);
router.get('/audits/:id/reasoning', getReasoningIssues);
router.get('/audits/:id/safety', getSafetyFlags);
router.post('/audits/:id/rerun', rerunAudit);

export default router;
