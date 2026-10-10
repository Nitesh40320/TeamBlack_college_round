import { Request, Response, NextFunction } from 'express';
import { AuditRequestSchema } from '../types/contract';
import { auditService } from '../services/auditService';
import { AuditModel } from '../models/Audit';
import { auditEvents } from '../services/auditOrchestrator';
import { generateMarkdownReport, generatePdfReport } from '../services/exportService';

export const createAudit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedInput = AuditRequestSchema.parse(req.body);
    const result = await auditService.createAudit(validatedInput);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAuditById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await auditService.getAuditById(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const streamAuditProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.findOne({ id });
    if (!audit) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Audit with ID '${id}' not found`,
        },
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    // Send initial snapshot event
    const initialPayload = {
      auditId: id,
      status: audit.status,
      progress: audit.progress,
      error: audit.error,
    };
    res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

    if (audit.status === 'completed' || audit.status === 'failed') {
      res.end();
      return;
    }

    const onProgress = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (data.status === 'completed' || data.status === 'failed') {
        auditEvents.removeListener(`audit:${id}`, onProgress);
        res.end();
      }
    };

    auditEvents.on(`audit:${id}`, onProgress);

    req.on('close', () => {
      auditEvents.removeListener(`audit:${id}`, onProgress);
    });
  } catch (error) {
    next(error);
  }
};

export const rerunAudit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const fromStage =
      (req.query.fromStage as string) || (req.body && req.body.fromStage);
    const result = await auditService.rerunAudit(id, fromStage);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
};

export const getReasoningIssues = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await auditService.getReasoningIssues(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getSafetyFlags = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await auditService.getSafetyFlags(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const listAudits = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const status = req.query.status as string | undefined;
    const q = (req.query.q || req.query.search) as string | undefined;
    const grade = req.query.grade as string | undefined;
    const verdict = req.query.verdict as string | undefined;
    const safetyFlagged = req.query.safetyFlagged as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

    const result = await auditService.listAudits({
      page,
      limit,
      status,
      q,
      grade,
      verdict,
      safetyFlagged,
      sortBy,
      sortOrder,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getFindings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const verdict = req.query.verdict as string | undefined;
    const category = req.query.category as string | undefined;
    const claimType = req.query.claimType as string | undefined;

    const result = await auditService.getFindings(id, {
      verdict,
      category,
      claimType,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAnnotations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await auditService.getAnnotations(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAuditSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await auditService.getAuditSummary(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getAuditJudges = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await auditService.getAuditJudges(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const generateCorrections = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await auditService.generateAndStoreCorrections(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const exportAuditReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const format = ((req.query.format as string) || 'json').toLowerCase();
    const audit = await auditService.getAuditById(id);

    if (format === 'md' || format === 'markdown') {
      const mdContent = generateMarkdownReport(audit);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-${id}.md"`
      );
      res.status(200).send(mdContent);
      return;
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-${id}.pdf"`
      );
      generatePdfReport(audit, res);
      return;
    }

    // Default: JSON
    res.status(200).json(audit);
  } catch (error) {
    next(error);
  }
};

