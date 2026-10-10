import { Request, Response, NextFunction } from 'express';
import { AuditRequestSchema } from '../types/contract';
import { auditService } from '../services/auditService';

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

    const result = await auditService.listAudits(page, limit, status);
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
