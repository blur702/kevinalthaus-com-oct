// HTML escape character map - defined once at module level to avoid reallocation
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

const HTML_ESCAPE_REGEX = /[&<>"'`]/g;

export function escapeHtml(str: string | null | undefined): string {
  if (str === null || str === undefined) {
    return '';
  }
  return String(str).replace(HTML_ESCAPE_REGEX, (ch) => HTML_ESCAPE_MAP[ch]);
}
