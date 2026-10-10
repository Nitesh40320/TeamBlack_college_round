import { describe, it, expect } from 'vitest';
import { parseUploadedFile } from '../utils/fileParser';

describe('fileParser utility', () => {
  it('parses .txt files correctly', async () => {
    const file = new File(['Hello world source text'], 'research_notes.txt', {
      type: 'text/plain',
    });
    const parsed = await parseUploadedFile(file);
    expect(parsed.title).toBe('research_notes');
    expect(parsed.text).toBe('Hello world source text');
    expect(parsed.id).toMatch(/^src-/);
  });

  it('parses .md files correctly', async () => {
    const file = new File(['# Title\n\nSome markdown text content'], 'doc.md', {
      type: 'text/markdown',
    });
    const parsed = await parseUploadedFile(file);
    expect(parsed.title).toBe('doc');
    expect(parsed.text).toContain('Some markdown text content');
  });

  it('handles empty titles gracefully by removing extension', async () => {
    const file = new File(['Sample content'], 'source_document.txt', {
      type: 'text/plain',
    });
    const parsed = await parseUploadedFile(file);
    expect(parsed.title).toBe('source_document');
  });
});
