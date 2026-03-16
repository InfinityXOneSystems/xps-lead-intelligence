/**
 * HTML sanitization utilities.
 * Use stripHtml to safely convert HTML to plain text.
 * Use sanitizeEmailHtml to allow only safe HTML tags.
 */
import sanitizeHtml from 'sanitize-html';

/** Strip all HTML tags and return safe plain text */
export function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
}

/** Allow a safe subset of HTML tags (bold, italic, links, lists) */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'span', 'div'],
    allowedAttributes: { a: ['href', 'target', 'rel'], span: ['style'], div: ['style'], p: ['style'] },
    allowedSchemes: ['https', 'http', 'mailto'],
  });
}
