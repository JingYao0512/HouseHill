/**
 * sanitize.ts — XSS-safe Markdown HTML rendering.
 *
 * The backend renders markdown to HTML server-side (python-markdown), which
 * does NOT strip raw HTML embedded in articles. If a user with article-write
 * permission sneaks in <script> or <iframe>, that markup would execute in
 * every reader's browser. DOMPurify scrubs it before we hand it to React.
 *
 * Use `safeHTML(html)` and pass the result to dangerouslySetInnerHTML.
 */

import DOMPurify from 'dompurify';

// Tags/attributes useful for technical articles + release notes.
// Anything not on the allowlist (script, iframe, embed, object, on*=...) is dropped.
const PROFILE = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr', 'div', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 'b', 'i', 'u', 's', 'mark', 'sub', 'sup',
    'ul', 'ol', 'li',
    'blockquote', 'q',
    'code', 'pre', 'kbd', 'samp', 'var',
    'a',
    'img',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'details', 'summary',
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'alt', 'src', 'width', 'height',
    'class', 'id', 'colspan', 'rowspan',
    'data-language', 'data-line',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  // Block any unknown protocols (javascript:, data:text/html, etc.)
  ALLOW_DATA_ATTR: false,
};

// Force `target="_blank" rel="noopener noreferrer"` on every external <a>.
// Hooks must be added once; the module scope here is fine.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && (node as HTMLAnchorElement).href) {
    const a = node as HTMLAnchorElement;
    const sameOrigin = a.host === window.location.host;
    if (!sameOrigin) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  }
});

export function safeHTML(html: string): string {
  return DOMPurify.sanitize(html, PROFILE);
}
