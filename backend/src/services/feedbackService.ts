import { v4 as uuidv4 } from 'uuid';
import { FeedbackModel } from '../models/Feedback';
import { AuditModel } from '../models/Audit';
import { FeedbackInput } from '../types/contract';
import { AppError } from '../middleware/errorHandler';

export class FeedbackService {
  public async submitFeedback(
    auditId: string,
    input: FeedbackInput,
    clientId: string
  ) {
    const audit = await AuditModel.findOne({ id: auditId });
    if (!audit) {
      throw new AppError(404, 'NOT_FOUND', `Audit with ID '${auditId}' not found`);
    }

    // Prevent duplicate votes per finding per session/client id
    const existing = await FeedbackModel.findOne({
      auditId,
      findingId: input.findingId,
      clientId,
    });

    if (existing) {
      throw new AppError(
        409,
        'DUPLICATE_FEEDBACK',
        'Feedback has already been submitted for this finding in this session'
      );
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const doc = new FeedbackModel({
      id,
      auditId,
      findingType: input.findingType,
      findingId: input.findingId,
      verdict: input.verdict,
      comment: input.comment,
      clientId,
      createdAt: now,
    });

    await doc.save();
    return doc.toJSON();
  }

  public async getFeedbackStats() {
    const all = await FeedbackModel.find().exec();
    const total = all.length;
    let correct = 0;
    let incorrect = 0;

    const byFindingType: Record<
      'claim' | 'reasoning' | 'safety',
      { total: number; correct: number; incorrect: number }
    > = {
      claim: { total: 0, correct: 0, incorrect: 0 },
      reasoning: { total: 0, correct: 0, incorrect: 0 },
      safety: { total: 0, correct: 0, incorrect: 0 },
    };

    for (const f of all) {
      if (f.verdict === 'correct') {
        correct++;
        if (byFindingType[f.findingType]) {
          byFindingType[f.findingType].correct++;
        }
      } else if (f.verdict === 'incorrect') {
        incorrect++;
        if (byFindingType[f.findingType]) {
          byFindingType[f.findingType].incorrect++;
        }
      }

      if (byFindingType[f.findingType]) {
        byFindingType[f.findingType].total++;
      }
    }

    const accuracy = total > 0 ? Number(((correct / total) * 100).toFixed(2)) : 100.0;

    return {
      total,
      correct,
      incorrect,
      accuracy,
      byFindingType,
    };
  }
}

export const feedbackService = new FeedbackService();
