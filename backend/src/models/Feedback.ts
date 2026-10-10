import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedbackDocument extends Document {
  id: string;
  auditId: string;
  findingType: 'claim' | 'reasoning' | 'safety';
  findingId: string;
  verdict: 'correct' | 'incorrect';
  comment?: string;
  clientId: string;
  createdAt: string;
}

const FeedbackSchema = new Schema<IFeedbackDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    auditId: { type: String, required: true, index: true },
    findingType: {
      type: String,
      enum: ['claim', 'reasoning', 'safety'],
      required: true,
    },
    findingId: { type: String, required: true, index: true },
    verdict: { type: String, enum: ['correct', 'incorrect'], required: true },
    comment: { type: String },
    clientId: { type: String, required: true, index: true },
    createdAt: { type: String, required: true },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Prevent duplicate votes per finding per session/client id
FeedbackSchema.index({ auditId: 1, findingId: 1, clientId: 1 }, { unique: true });

export const FeedbackModel = mongoose.model<IFeedbackDocument>(
  'Feedback',
  FeedbackSchema
);
