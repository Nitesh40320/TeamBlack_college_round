import mongoose, { Schema, Document } from 'mongoose';

export interface ISourceDocument extends Document {
  id: string;
  auditId: string;       // references Audit.id (not _id)
  title: string;         // human-readable label
  originalName: string;  // original filename or "pasted-text"
  mimeType: string;      // "text/plain" | "text/markdown" | "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  text: string;          // exact text sent to the model (offset-stable)
  charCount: number;
  createdAt: string;
}

const SourceSchema = new Schema<ISourceDocument>(
  {
    id: { type: String, required: true, index: true },
    auditId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    text: { type: String, required: true },
    charCount: { type: Number, required: true },
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
  }
);

export const SourceModel = mongoose.model<ISourceDocument>('Source', SourceSchema);
