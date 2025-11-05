/**
 * EditorService
 * Provides WYSIWYG editor functionality including content transformation,
 * validation, sanitization, and image handling.
 */

import type {
  IEditorService,
  EditorContent,
  EditorNode,
  EditorMark,
  ValidationResult,
  ImageMetadata,
  ImageResult,
} from '@monorepo/shared';
import { stripAllHTML } from '@monorepo/shared';

export class EditorService implements IEditorService {
  public readonly name = 'editor';
  private initialized = false;

  constructor() {
    // No dependencies needed for basic implementation
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('EditorService is already initialized');
    }

    this.initialized = true;
    console.log('[EditorService] ✓ Initialized');
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    this.initialized = false;
    console.log('[EditorService] ✓ Shut down');
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.initialized) {
      return { healthy: false, message: 'Service not initialized' };
    }

    try {
      // Test basic functionality
      const testContent = this.createEmpty();
      this.toHTML(testContent);
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert EditorContent to HTML string
   */
  toHTML(content: EditorContent): string {
    if (!content || !content.content) {
      return '';
    }

    return this.nodesToHTML(content.content);
  }

  /**
   * Convert HTML string to EditorContent structure
   */
  fromHTML(html: string): EditorContent {
    if (!html || html.trim() === '') {
      return this.createEmpty();
    }

    // Parse HTML into nodes
    const nodes = this.parseHTMLToNodes(html);

    return {
      type: 'doc',
      content: nodes,
      version: 1,
    };
  }

  /**
   * Validate editor content structure
   */
  validate(content: EditorContent): ValidationResult {
    const errors: string[] = [];

    if (!content) {
      errors.push('Content is null or undefined');
      return { valid: false, errors };
    }

    if (content.type !== 'doc') {
      errors.push(`Invalid root type: ${content.type}, expected 'doc'`);
    }

    if (!Array.isArray(content.content)) {
      errors.push('Content.content must be an array');
      return { valid: false, errors };
    }

    // Validate each node
    for (let i = 0; i < content.content.length; i++) {
      const nodeErrors = this.validateNode(content.content[i], `content[${i}]`);
      errors.push(...nodeErrors);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Sanitize HTML content to remove malicious tags/attributes
   */
  sanitize(html: string): string {
    if (!html) {
      return '';
    }

    // Basic sanitization - allow safe tags only
    const allowedTags = [
      'p',
      'br',
      'strong',
      'em',
      'u',
      's',
      'a',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'code',
      'pre',
      'img',
      'div',
      'span',
    ];

    const allowedAttrs: Record<string, string[]> = {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['class', 'id'],
    };

    // Simple regex-based sanitization
    // Remove script tags and event handlers
    let sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '');

    // Remove tags not in allowlist
    const tagPattern = /<(\/?)([\w-]+)([^>]*)>/g;
    sanitized = sanitized.replace(tagPattern, (match, closing, tagName, attrs) => {
      const tag = tagName.toLowerCase();

      if (!allowedTags.includes(tag)) {
        return '';
      }

      // Sanitize attributes
      const allowedForTag = allowedAttrs[tag] || allowedAttrs['*'] || [];
      const attrPattern = /([\w-]+)\s*=\s*["']([^"']*)["']/g;
      let sanitizedAttrs = '';
      let attrMatch;

      while ((attrMatch = attrPattern.exec(attrs)) !== null) {
        const [, attrName, attrValue] = attrMatch;
        if (allowedForTag.includes(attrName.toLowerCase())) {
          sanitizedAttrs += ` ${attrName}="${this.escapeAttr(attrValue)}"`;
        }
      }

      return `<${closing}${tag}${sanitizedAttrs}>`;
    });

    return sanitized;
  }

  /**
   * Extract plain text from editor content
   */
  toPlainText(content: EditorContent): string {
    if (!content || !content.content) {
      return '';
    }

    return this.nodesToPlainText(content.content);
  }

  /**
   * Get word count from editor content
   */
  getWordCount(content: EditorContent): number {
    const text = this.toPlainText(content);
    if (!text.trim()) {
      return 0;
    }

    // Split by whitespace and filter empty strings
    const words = text.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }

  /**
   * Get character count from editor content (excluding whitespace)
   */
  getCharacterCount(content: EditorContent): number {
    const text = this.toPlainText(content);
    // Remove all whitespace for character count
    return text.replace(/\s/g, '').length;
  }

  /**
   * Handle image upload and return image details
   * Note: This is a placeholder implementation
   */
  async uploadImage(
    file: File | Buffer,
    metadata?: ImageMetadata
  ): Promise<ImageResult> {
    // Placeholder implementation
    // In a real implementation, this would:
    // 1. Validate the image
    // 2. Upload to storage (S3, local filesystem, etc.)
    // 3. Generate thumbnail
    // 4. Return the URL and metadata

    throw new Error('Image upload not yet implemented - will be added with storage integration');
  }

  /**
   * Create empty editor content
   */
  createEmpty(): EditorContent {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [],
        },
      ],
      version: 1,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Convert array of nodes to HTML
   */
  private nodesToHTML(nodes: EditorNode[]): string {
    return nodes.map((node) => this.nodeToHTML(node)).join('');
  }

  /**
   * Convert single node to HTML
   */
  private nodeToHTML(node: EditorNode): string {
    switch (node.type) {
      case 'paragraph':
        return `<p>${node.content ? this.nodesToHTML(node.content) : ''}</p>`;

      case 'heading': {
        const level = (node.attrs?.level as number) || 1;
        return `<h${level}>${node.content ? this.nodesToHTML(node.content) : ''}</h${level}>`;
      }

      case 'blockquote':
        return `<blockquote>${node.content ? this.nodesToHTML(node.content) : ''}</blockquote>`;

      case 'bulletList':
        return `<ul>${node.content ? this.nodesToHTML(node.content) : ''}</ul>`;

      case 'orderedList':
        return `<ol>${node.content ? this.nodesToHTML(node.content) : ''}</ol>`;

      case 'listItem':
        return `<li>${node.content ? this.nodesToHTML(node.content) : ''}</li>`;

      case 'codeBlock':
        return `<pre><code>${node.content ? this.nodesToPlainText(node.content) : ''}</code></pre>`;

      case 'hardBreak':
        return '<br>';

      case 'image': {
        const src = node.attrs?.src as string;
        const alt = (node.attrs?.alt as string) || '';
        const title = (node.attrs?.title as string) || '';
        return `<img src="${this.escapeAttr(src)}" alt="${this.escapeAttr(alt)}" title="${this.escapeAttr(title)}">`;
      }

      case 'text': {
        let html = this.escapeHTML(node.text || '');
        // Apply marks
        if (node.marks) {
          node.marks.forEach((mark) => {
            html = this.applyMark(html, mark);
          });
        }
        return html;
      }

      default:
        // Unknown node type - return content if available
        return node.content ? this.nodesToHTML(node.content) : '';
    }
  }

  /**
   * Convert nodes to plain text
   */
  private nodesToPlainText(nodes: EditorNode[]): string {
    return nodes.map((node) => this.nodeToPlainText(node)).join('');
  }

  /**
   * Convert single node to plain text
   */
  private nodeToPlainText(node: EditorNode): string {
    if (node.type === 'text') {
      return node.text || '';
    }

    if (node.type === 'hardBreak') {
      return '\n';
    }

    if (node.content) {
      return this.nodesToPlainText(node.content);
    }

    return '';
  }

  /**
   * Apply mark (formatting) to HTML
   */
  private applyMark(html: string, mark: EditorMark): string {
    switch (mark.type) {
      case 'bold':
      case 'strong':
        return `<strong>${html}</strong>`;

      case 'italic':
      case 'em':
        return `<em>${html}</em>`;

      case 'underline':
        return `<u>${html}</u>`;

      case 'strike':
        return `<s>${html}</s>`;

      case 'code':
        return `<code>${html}</code>`;

      case 'link': {
        const href = (mark.attrs?.href as string) || '';
        const title = (mark.attrs?.title as string) || '';
        return `<a href="${this.escapeAttr(href)}" title="${this.escapeAttr(title)}">${html}</a>`;
      }

      default:
        return html;
    }
  }

  /**
   * Parse HTML to EditorNode array
   */
  private parseHTMLToNodes(html: string): EditorNode[] {
    // Simple HTML parsing - create paragraph nodes for each block
    // This is a basic implementation; a real one would use a proper HTML parser

    const sanitized = this.sanitize(html);
    const lines = sanitized.split(/\n+/).filter(Boolean);

    if (lines.length === 0) {
      return [{ type: 'paragraph', content: [] }];
    }

    return lines.map((line) => ({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: stripAllHTML(line),
        },
      ],
    }));
  }

  /**
   * Validate a single node
   */
  private validateNode(node: EditorNode, path: string): string[] {
    const errors: string[] = [];

    if (!node.type) {
      errors.push(`${path}: Missing node type`);
    }

    if (node.content && !Array.isArray(node.content)) {
      errors.push(`${path}: content must be an array`);
    }

    if (node.marks && !Array.isArray(node.marks)) {
      errors.push(`${path}: marks must be an array`);
    }

    // Validate child nodes recursively
    if (node.content) {
      node.content.forEach((child, index) => {
        const childErrors = this.validateNode(child, `${path}.content[${index}]`);
        errors.push(...childErrors);
      });
    }

    return errors;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(text: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return text.replace(/[&<>"']/g, (char) => escapeMap[char] || char);
  }

  /**
   * Escape HTML attribute values
   */
  private escapeAttr(value: string): string {
    if (!value) {
      return '';
    }
    return this.escapeHTML(value);
  }
}
