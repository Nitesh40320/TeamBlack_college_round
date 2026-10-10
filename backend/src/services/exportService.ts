import PDFDocument from 'pdfkit';
import { AuditResult } from '../types/contract';

export function generateMarkdownReport(audit: AuditResult): string {
  const {
    id,
    question,
    answer,
    overall,
    claims = [],
    reasoningIssues = [],
    safetyFlags = [],
    createdAt,
  } = audit;

  let md = `# Second Opinion Audit Report\n\n`;
  md += `**Audit ID:** \`${id}\`  \n`;
  md += `**Created At:** ${createdAt}  \n`;
  if (question) md += `**Question:** ${question}  \n`;
  md += `\n---\n\n`;

  md += `## 1. Overall Assessment\n\n`;
  md += `- **Grade:** ${overall?.grade || 'N/A'}\n`;
  md += `- **Score:** ${overall?.score ?? 0}/100\n`;
  md += `- **Summary:** ${overall?.summary || 'No summary available.'}\n\n`;

  if (overall?.counts) {
    md += `### Verdict Counts\n`;
    md += `- **SUPPORTED:** ${overall.counts.SUPPORTED}\n`;
    md += `- **CONTRADICTED:** ${overall.counts.CONTRADICTED}\n`;
    md += `- **UNSUPPORTED:** ${overall.counts.UNSUPPORTED}\n`;
    md += `- **UNVERIFIABLE:** ${overall.counts.UNVERIFIABLE}\n`;
    md += `- **AMBIGUOUS:** ${overall.counts.AMBIGUOUS}\n\n`;
  }

  md += `## 2. Verified Claims & Findings\n\n`;
  if (claims.length === 0) {
    md += `*No claims extracted.*\n\n`;
  } else {
    claims.forEach((c, idx) => {
      md += `### ${idx + 1}. [${c.verdict}] ${c.text}\n`;
      const span = c.errorSpan || c.answerSpan;
      if (span && answer) {
        const quoted = answer.substring(span.start, span.end);
        md += `> **Quoted Answer Span [${span.start}-${span.end}]:** "${quoted}"\n\n`;
      }
      md += `**Explanation:** ${c.explanation}\n`;
      if (c.errorCategory) md += `**Error Category:** ${c.errorCategory}\n`;
      if (c.confidence)
        md += `**Confidence Score:** ${(c.confidence.score * 100).toFixed(1)}% (${c.confidence.level})\n`;

      if (c.evidence && c.evidence.length > 0) {
        md += `\n**Evidence:**\n`;
        c.evidence.forEach((ev) => {
          md += `- *[${ev.relation.toUpperCase()}]* "${ev.text}" (Source: ${ev.sourceId}, Score: ${(ev.score * 100).toFixed(1)}%)\n`;
        });
      }
      md += `\n---\n\n`;
    });
  }

  md += `## 3. Reasoning Issues\n\n`;
  if (reasoningIssues.length === 0) {
    md += `*No reasoning issues identified.*\n\n`;
  } else {
    reasoningIssues.forEach((r, idx) => {
      md += `### ${idx + 1}. Flawed Inference (${r.type})\n`;
      if (r.answerSpan && answer) {
        const quoted = answer.substring(r.answerSpan.start, r.answerSpan.end);
        md += `> **Span [${r.answerSpan.start}-${r.answerSpan.end}]:** "${quoted}"\n\n`;
      }
      md += `**Explanation:** ${r.explanation}\n\n`;
    });
  }

  md += `## 4. Safety Flags\n\n`;
  if (safetyFlags.length === 0) {
    md += `*No safety concerns flagged.*\n\n`;
  } else {
    safetyFlags.forEach((s, idx) => {
      md += `### ${idx + 1}. [${s.severity.toUpperCase()}] Safety Warning (${s.domain})\n`;
      if (s.answerSpan && answer) {
        const quoted = answer.substring(s.answerSpan.start, s.answerSpan.end);
        md += `> **Span [${s.answerSpan.start}-${s.answerSpan.end}]:** "${quoted}"\n\n`;
      }
      md += `**Explanation:** ${s.explanation}\n`;
      if (s.recommendation)
        md += `**Safer Alternative / Recommendation:** ${s.recommendation}\n`;
      md += `\n`;
    });
  }

  return md;
}

export function generatePdfReport(audit: AuditResult, res: any): void {
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  // Header
  doc.fontSize(20).text('Second Opinion Audit Report', { align: 'center' });
  doc.moveDown();

  doc.fontSize(10).text(`Audit ID: ${audit.id}`);
  doc.text(`Created At: ${audit.createdAt}`);
  if (audit.question) doc.text(`Question: ${audit.question}`);
  doc.moveDown();

  // Summary Card
  doc.fontSize(14).text('Overall Assessment');
  doc.fontSize(11).text(
    `Grade: ${audit.overall?.grade || 'N/A'}  |  Score: ${audit.overall?.score ?? 0}/100`
  );
  doc.text(`Summary: ${audit.overall?.summary || ''}`);
  doc.moveDown();

  // Claims
  doc.fontSize(14).text('Verified Claims & Findings');
  doc.moveDown(0.5);

  const claims = audit.claims || [];
  if (claims.length === 0) {
    doc.fontSize(10).text('No claims extracted.');
  } else {
    claims.forEach((c, idx) => {
      doc.fontSize(11).text(`${idx + 1}. [${c.verdict}] ${c.text}`);
      const span = c.errorSpan || c.answerSpan;
      if (span && audit.answer) {
        const quoted = audit.answer.substring(span.start, span.end);
        doc
          .fontSize(9)
          .text(`Quoted Span [${span.start}-${span.end}]: "${quoted}"`);
      }
      doc.fontSize(10).text(`Explanation: ${c.explanation}`);
      doc.moveDown(0.5);
    });
  }
  doc.moveDown();

  // Reasoning Issues
  doc.fontSize(14).text('Reasoning Issues');
  doc.moveDown(0.5);
  const reasoning = audit.reasoningIssues || [];
  if (reasoning.length === 0) {
    doc.fontSize(10).text('No reasoning issues identified.');
  } else {
    reasoning.forEach((r, idx) => {
      doc.fontSize(11).text(`${idx + 1}. [${r.type}] ${r.explanation}`);
      doc.moveDown(0.5);
    });
  }
  doc.moveDown();

  // Safety Flags
  doc.fontSize(14).text('Safety Flags');
  doc.moveDown(0.5);
  const safety = audit.safetyFlags || [];
  if (safety.length === 0) {
    doc.fontSize(10).text('No safety flags identified.');
  } else {
    safety.forEach((s, idx) => {
      doc
        .fontSize(11)
        .text(
          `${idx + 1}. [${s.severity.toUpperCase()}] ${s.domain}: ${s.explanation}`
        );
      if (s.recommendation) {
        doc.fontSize(9).text(`Recommendation: ${s.recommendation}`);
      }
      doc.moveDown(0.5);
    });
  }

  doc.end();
}
