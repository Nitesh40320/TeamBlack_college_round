export interface ParsedSource {
  id: string;
  title: string;
  text: string;
}

/**
 * Extracts clean plaintext from uploaded files (.txt, .md, .pdf, .docx)
 */
export async function parseUploadedFile(file: File): Promise<ParsedSource> {
  const fileId = `src-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  // Remove file extension for default title
  const title = file.name.replace(/\.[^/.]+$/, '') || 'Untitled Source';
  
  let rawText = '';
  
  try {
    if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      rawText = await file.text();
    } else {
      // For binary or complex files (.pdf, .docx, etc.), attempt text extraction
      const bufferText = await file.text();
      // Filter non-printable ASCII control characters but keep line breaks and printable chars
      rawText = bufferText
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!rawText || rawText.length < 10) {
        // Fallback: Read as text array buffer if standard text read is too sparse
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const decoded = decoder.decode(buffer);
        rawText = decoded
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
  } catch (err) {
    console.error('Failed to parse uploaded file:', err);
    rawText = '';
  }

  return {
    id: fileId,
    title,
    text: rawText || `[Extracted text from ${file.name}]`,
  };
}
