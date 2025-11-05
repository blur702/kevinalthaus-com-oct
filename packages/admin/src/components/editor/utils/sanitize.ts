/**
 * HTML sanitization utilities
 *
 * Functions for cleaning and sanitizing HTML content
 */

/**
 * Default allowed HTML tags
 */
export const DEFAULT_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'code',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'div',
  'span',
  'hr',
];

/**
 * Default allowed attributes per tag
 */
export const DEFAULT_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  '*': ['class', 'id', 'style'], // Allowed on all tags
};

/**
 * Sanitize HTML content
 */
export function sanitizeHTML(
  html: string,
  allowedTags: string[] = DEFAULT_ALLOWED_TAGS,
  allowedAttributes: Record<string, string[]> = DEFAULT_ALLOWED_ATTRIBUTES
): string {
  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Recursively clean the DOM tree
  cleanNode(temp, allowedTags, allowedAttributes);

  return temp.innerHTML;
}

/**
 * Recursively clean a DOM node and its children
 */
function cleanNode(
  node: Node,
  allowedTags: string[],
  allowedAttributes: Record<string, string[]>
): void {
  // Process all child nodes
  const children = Array.from(node.childNodes);

  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      // Remove disallowed tags (but keep their text content)
      if (!allowedTags.includes(tagName)) {
        const textContent = element.textContent || '';
        const textNode = document.createTextNode(textContent);
        element.replaceWith(textNode);
        continue;
      }

      // Clean attributes
      cleanAttributes(element, allowedAttributes);

      // Recursively clean children
      cleanNode(element, allowedTags, allowedAttributes);
    } else if (child.nodeType === Node.TEXT_NODE) {
      // Keep text nodes as-is
      continue;
    } else {
      // Remove other node types (comments, processing instructions, etc.)
      child.remove();
    }
  }
}

/**
 * Remove disallowed attributes from an element
 */
function cleanAttributes(element: HTMLElement, allowedAttributes: Record<string, string[]>): void {
  const tagName = element.tagName.toLowerCase();
  const allowedForTag = allowedAttributes[tagName] || [];
  const allowedForAll = allowedAttributes['*'] || [];
  const allowed = new Set([...allowedForTag, ...allowedForAll]);

  // Get all attribute names
  const attributes = Array.from(element.attributes);

  for (const attr of attributes) {
    if (!allowed.has(attr.name)) {
      element.removeAttribute(attr.name);
    }
  }

  // Additional safety: remove javascript: URLs
  if (element.hasAttribute('href')) {
    const href = element.getAttribute('href') || '';
    if (href.toLowerCase().startsWith('javascript:')) {
      element.removeAttribute('href');
    }
  }

  if (element.hasAttribute('src')) {
    const src = element.getAttribute('src') || '';
    if (src.toLowerCase().startsWith('javascript:')) {
      element.removeAttribute('src');
    }
  }
}

/**
 * Strip all HTML tags, leaving only text content
 */
export function stripHTML(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || '';
}

/**
 * Remove empty tags (tags with no text content and no meaningful children)
 */
export function removeEmptyTags(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  function removeEmpty(node: Node): void {
    const children = Array.from(node.childNodes);

    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;

        // Recursively clean children first
        removeEmpty(element);

        // Check if element is empty (no text content and no meaningful children)
        const hasText = (element.textContent || '').trim().length > 0;
        const hasMeaningfulChildren = element.querySelector('img, br, hr, video, audio, iframe');

        if (!hasText && !hasMeaningfulChildren) {
          element.remove();
        }
      }
    }
  }

  removeEmpty(temp);
  return temp.innerHTML;
}

/**
 * Normalize whitespace in HTML
 */
export function normalizeWhitespace(html: string): string {
  return html
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/>\s+</g, '><') // Remove spaces between tags
    .trim();
}

/**
 * Clean up pasted content (common cleanup tasks)
 */
export function cleanPastedHTML(html: string): string {
  let cleaned = html;

  // Remove Microsoft Word formatting
  cleaned = cleaned.replace(/<o:p>.*?<\/o:p>/gi, '');
  cleaned = cleaned.replace(/<\?xml[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/?w:[^>]*>/gi, '');

  // Remove style attributes (often contain bloat)
  cleaned = cleaned.replace(/\s*style="[^"]*"/gi, '');

  // Remove class attributes (often contain bloat)
  cleaned = cleaned.replace(/\s*class="[^"]*"/gi, '');

  // Remove data attributes
  cleaned = cleaned.replace(/\s*data-[^=]*="[^"]*"/gi, '');

  // Remove empty spans
  cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/gi, '');

  // Remove empty divs
  cleaned = cleaned.replace(/<div[^>]*>\s*<\/div>/gi, '');

  // Normalize whitespace
  cleaned = normalizeWhitespace(cleaned);

  return cleaned;
}

/**
 * Convert plain text to HTML paragraphs
 */
export function textToHTML(text: string): string {
  return text
    .split('\n\n')
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * Escape HTML entities
 */
export function escapeHTML(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Unescape HTML entities
 */
export function unescapeHTML(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

/**
 * Check if HTML content is empty (no meaningful content)
 */
export function isHTMLEmpty(html: string): boolean {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Check if there's any text content
  const text = (temp.textContent || '').trim();
  if (text.length > 0) {
    return false;
  }

  // Check for meaningful elements (images, etc.)
  const hasMeaningful = temp.querySelector('img, video, audio, iframe, hr');
  return !hasMeaningful;
}
