import dns from 'dns';
import axios from 'axios';
import { AppError } from '../middleware/errorHandler';

export interface IngestedUrlResult {
  url: string;
  title: string;
  text: string;
}

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const cleanIp = ip.replace(/^::ffff:/, ''); // IPv4-mapped IPv6

  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === '0.0.0.0' || cleanIp === 'localhost') {
    return true;
  }

  const parts = cleanIp.split('.').map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (IMDS)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 0) return true;
  }

  if (
    cleanIp.toLowerCase().startsWith('fe80:') ||
    cleanIp.toLowerCase().startsWith('fc00:') ||
    cleanIp.toLowerCase().startsWith('fd00:')
  ) {
    return true;
  }

  return false;
}

export async function validateUrlForSsrf(targetUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch (_err) {
    throw new AppError(400, 'VALIDATION_ERROR', `Invalid URL format: '${targetUrl}'`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(
      400,
      'SSRF_PREVENTED',
      `Forbidden protocol '${parsed.protocol}'. Only http: and https: URLs are permitted.`
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.cluster.local')
  ) {
    throw new AppError(
      400,
      'SSRF_PREVENTED',
      `Access to internal hostname '${hostname}' is prohibited.`
    );
  }

  // Resolve hostname via DNS to check IP address
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        throw new AppError(
          400,
          'SSRF_PREVENTED',
          `URL resolves to non-routable/private IP '${addr.address}'. Access prohibited.`
        );
      }
    }
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      400,
      'FAILED_TO_RESOLVE_HOST',
      `Failed to resolve domain name '${hostname}': ${err.message}`
    );
  }

  return parsed;
}

export function extractReadabilityContent(html: string, fallbackTitle: string): { title: string; text: string } {
  // 1. Extract title
  let title = fallbackTitle;
  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  if (ogTitleMatch && ogTitleMatch[1]) {
    title = ogTitleMatch[1].trim();
  } else if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }

  // Decode basic HTML entities in title
  title = title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 2. Strip noise tags: <script>, <style>, <nav>, <header>, <footer>, <aside>, <form>, <!-- comments -->
  let cleanedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // 3. Convert block elements (<p>, <div>, <br>, <h1>-<h6>, <li>) to line breaks
  cleanedHtml = cleanedHtml
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|article|section)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n');

  // 4. Strip remaining HTML tags
  let plainText = cleanedHtml.replace(/<[^>]+>/g, ' ');

  // 5. Decode HTML entities
  plainText = plainText
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // 6. Normalize whitespace safely (preserve sentence linebreaks, max 2 blank lines)
  plainText = plainText
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  return {
    title: title || 'Ingested Document',
    text: plainText,
  };
}

export async function ingestUrl(urlInput: string): Promise<IngestedUrlResult> {
  const parsedUrl = await validateUrlForSsrf(urlInput);

  try {
    const response = await axios.get(parsedUrl.href, {
      timeout: 10000,
      maxContentLength: 5 * 1024 * 1024, // 5MB limit
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SecondOpinion/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const htmlContent = typeof response.data === 'string' ? response.data : String(response.data);
    const { title, text } = extractReadabilityContent(htmlContent, parsedUrl.hostname);

    if (!text || text.length < 10) {
      throw new AppError(
        422,
        'UNPROCESSABLE_ENTITY',
        `No readable text content could be extracted from '${urlInput}'.`
      );
    }

    return {
      url: parsedUrl.href,
      title,
      text,
    };
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      502,
      'FAILED_TO_FETCH_URL',
      `Failed to fetch URL content from '${urlInput}': ${err.message}`
    );
  }
}
