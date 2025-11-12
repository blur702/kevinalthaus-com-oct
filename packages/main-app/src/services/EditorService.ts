/**
 * Editor Service Implementation
 *
 * Provides rich text editing functionality with HTML conversion, sanitization,
 * and validation. Built without external WYSIWYG libraries for maximum control
 * and customization.
 *
 * Features:
 * - HTML to Editor Content conversion
 * - Editor Content to HTML serialization
 * - Content sanitization (XSS prevention)
 * - Content validation
 * - Plain text extraction
 * - Word and character counting
 * - Image upload handling
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
import { JSDOM } from 'jsdom';
import { storageService } from '../server';

/**
 * Editor Service
 * Manages rich text editor content with security and validation
 */
export class EditorService implements IEditorService {
  public readonly name = 'editor';
  private initialized = false;

  // Allowed HTML tags and their allowed attributes
  private readonly ALLOWED_TAGS = new Set([
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'ul',
    'ol',
    'li',
    'strong',
    'em',
    'u',
    'strike',
    'code',
    'pre',
    'a',
    'img',
    'br',
    'hr',
  ]);

  private readonly ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
    a: new Set(['href', 'title', 'target', 'rel']),
    img: new Set(['src', 'alt', 'title', 'width', 'height']),
  };

  // Node types supported by the editor
  private readonly NODE_TYPES = new Set([
    'doc',
    'paragraph',
    'heading',
    'blockquote',
    'bulletList',
    'orderedList',
    'listItem',
    'codeBlock',
    'horizontalRule',
    'hardBreak',
    'text',
    'image',
  ]);

  // Mark types (inline formatting)
  private readonly MARK_TYPES = new Set(['bold', 'italic', 'underline', 'strike', 'code', 'link']);

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('EditorService is already initialized');
    }

    // No external dependencies to initialize
    // This service is purely functional and stateless

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
    return { healthy: true };
  }

  /**
   * Convert editor content to HTML
   */
  toHTML(content: EditorContent): string {
    if (!content || !content.content) {
      return '';
    }

    return this.nodesToHTML(content.content);
  }

  /**
   * Parse HTML into editor content structure
   */
  fromHTML(html: string): EditorContent {
    if (!html || html.trim() === '') {
      return this.createEmpty();
    }

    // Sanitize HTML first
    const sanitizedHTML = this.sanitize(html);

    // Parse HTML using jsdom (Node.js compatible)
    const dom = new JSDOM(sanitizedHTML);
    const doc = dom.window.document;

    // Convert DOM nodes to editor nodes
    const nodes = this.domNodesToEditorNodes(Array.from(doc.body.childNodes));

    return {
      type: 'doc',
      content: nodes,
      version: 1,
    };
  }

  /**
   * Validate editor content
   */
  validate(content: EditorContent): ValidationResult {
    const errors: string[] = [];

    // Validate root structure
    if (!content || typeof content !== 'object') {
      errors.push('Content must be an object');
      return { valid: false, errors };
    }

    if (content.type !== 'doc') {
      errors.push('Root node must be of type "doc"');
    }

    if (!Array.isArray(content.content)) {
      errors.push('Content must have a "content" array');
      return { valid: false, errors };
    }

    // Validate nodes recursively
    this.validateNodes(content.content, errors);

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  sanitize(html: string): string {
    if (!html) {
      return '';
    }

    // Parse HTML using jsdom - this already parses the HTML safely
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Use the parsed DOM's body directly instead of re-parsing with innerHTML
    // This avoids double-parsing and prevents XSS during innerHTML assignment
    const root = doc.body || doc.documentElement;

    // Walk through all nodes and sanitize
    this.sanitizeNode(root);

    // Return the sanitized HTML from the DOM
    return root.innerHTML;
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
    if (!text || text.trim() === '') {
      return 0;
    }

    // Split by whitespace and filter empty strings
    const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
    return words.length;
  }

  /**
   * Get character count from editor content
   */
  getCharacterCount(content: EditorContent): number {
    const text = this.toPlainText(content);
    return text.length;
  }

  /**
   * Handle image upload
   * Integrates with StorageService for file upload and processing
   */
  async uploadImage(file: File | Buffer, metadata?: ImageMetadata): Promise<ImageResult> {
    if (!this.initialized) {
      throw new Error('EditorService not initialized');
    }

    // Convert File to Buffer if needed
    let buffer: Buffer;
    let originalName: string;
    let mimeType: string;

    if (Buffer.isBuffer(file)) {
      buffer = file;
      originalName = metadata?.filename || 'image.jpg';
      mimeType = metadata?.mimeType || 'image/jpeg';
    } else {
      // Handle File object (browser environment)
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      originalName = file.name;
      mimeType = file.type;
    }

    // Upload to storage service
    const uploadResult = await storageService.uploadFile(
      'editor', // plugin ID for editor uploads
      {
        buffer,
        originalname: originalName,
        mimetype: mimeType,
        size: buffer.length,
      },
      metadata?.userId || 'system',
      {
        generateThumbnail: true,
        thumbnailWidth: 300,
        thumbnailHeight: 300,
        quality: 80,
      }
    );

    return {
      id: uploadResult.id,
      url: uploadResult.url,
      thumbnailUrl: uploadResult.thumbnailUrl,
      width: uploadResult.width,
      height: uploadResult.height,
      alt: metadata?.alt,
      title: metadata?.title,
    };
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
   * Convert editor nodes to HTML string
   */
  private nodesToHTML(nodes: EditorNode[]): string {
    return nodes.map((node) => this.nodeToHTML(node)).join('');
  }

  /**
   * Convert single editor node to HTML
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
        return `<pre><code>${node.content ? this.nodesToHTML(node.content) : ''}</code></pre>`;

      case 'horizontalRule':
        return '<hr>';

      case 'hardBreak':
        return '<br>';

      case 'image': {
        const src = (node.attrs?.src as string) || '';
        const alt = (node.attrs?.alt as string) || '';
        const title = node.attrs?.title ? ` title="${this.escapeHTML(node.attrs.title as string)}"` : '';
        return `<img src="${this.escapeHTML(src)}" alt="${this.escapeHTML(alt)}"${title}>`;
      }

      case 'text': {
        let html = this.escapeHTML(node.text || '');

        // Apply marks (inline formatting)
        if (node.marks && node.marks.length > 0) {
          node.marks.forEach((mark) => {
            html = this.applyMark(html, mark);
          });
        }

        return html;
      }

      default:
        console.warn(`Unknown node type: ${node.type}`);
        return '';
    }
  }

  /**
   * Apply mark (inline formatting) to text
   */
  private applyMark(text: string, mark: EditorMark): string {
    switch (mark.type) {
      case 'bold':
        return `<strong>${text}</strong>`;
      case 'italic':
        return `<em>${text}</em>`;
      case 'underline':
        return `<u>${text}</u>`;
      case 'strike':
        return `<strike>${text}</strike>`;
      case 'code':
        return `<code>${text}</code>`;
      case 'link': {
        const href = (mark.attrs?.href as string) || '';
        const title = mark.attrs?.title ? ` title="${this.escapeHTML(mark.attrs.title as string)}"` : '';
        return `<a href="${this.escapeHTML(href)}"${title}>${text}</a>`;
      }
      default:
        return text;
    }
  }

  /**
   * Convert DOM nodes to editor nodes
   */
  private domNodesToEditorNodes(domNodes: Node[]): EditorNode[] {
    const nodes: EditorNode[] = [];

    for (const domNode of domNodes) {
      const editorNode = this.domNodeToEditorNode(domNode);
      if (editorNode) {
        nodes.push(editorNode);
      }
    }

    return nodes;
  }

  /**
   * Convert single DOM node to editor node
   */
  private domNodeToEditorNode(domNode: Node): EditorNode | null {
    // Text node
    if (domNode.nodeType === Node.TEXT_NODE) {
      const text = domNode.textContent || '';
      if (text.trim() === '') {
        return null;
      }
      return {
        type: 'text',
        text,
      };
    }

    // Element node
    if (domNode.nodeType === Node.ELEMENT_NODE) {
      const element = domNode as Element;
      const tagName = element.tagName.toLowerCase();

      switch (tagName) {
        case 'p':
          return {
            type: 'paragraph',
            content: this.domNodesToEditorNodes(Array.from(element.childNodes)),
          };

        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          return {
            type: 'heading',
            attrs: { level: parseInt(tagName[1], 10) },
            content: this.domNodesToEditorNodes(Array.from(element.childNodes)),
          };

        case 'blockquote':
          return {
            type: 'blockquote',
            content: this.domNodesToEditorNodes(Array.from(element.childNodes)),
          };

        case 'ul':
          return {
            type: 'bulletList',
            content: this.domNodesToEditorNodes(Array.from(element.childNodes)),
          };

        case 'ol':
          return {
            type: 'orderedList',
            content: this.domNodesToEditorNodes(Array.from(element.childNodes)),
          };

        case 'li':
          return {
            type: 'listItem',
            content: this.domNodesToEditorNodes(Array.from(element.childNodes)),
          };

        case 'pre': {
          const code = element.querySelector('code');
          return {
            type: 'codeBlock',
            content: code
              ? this.domNodesToEditorNodes(Array.from(code.childNodes))
              : this.domNodesToEditorNodes(Array.from(element.childNodes)),
          };
        }

        case 'hr':
          return {
            type: 'horizontalRule',
          };

        case 'br':
          return {
            type: 'hardBreak',
          };

        case 'img':
          return {
            type: 'image',
            attrs: {
              src: element.getAttribute('src') || '',
              alt: element.getAttribute('alt') || '',
              title: element.getAttribute('title') || undefined,
            },
          };

        // Inline formatting - convert to marks
        case 'strong':
        case 'b':
        case 'em':
        case 'i':
        case 'u':
        case 'strike':
        case 'code':
        case 'a': {
          const childNodes = this.domNodesToEditorNodes(Array.from(element.childNodes));
          return this.wrapNodesWithMark(childNodes, tagName, element);
        }

        default:
          // Unsupported tag - extract children
          return {
            type: 'paragraph',
            content: this.domNodesToEditorNodes(Array.from(element.childNodes)),
          };
      }
    }

    return null;
  }

  /**
   * Wrap editor nodes with a mark (inline formatting)
   */
  private wrapNodesWithMark(
    nodes: EditorNode[],
    tagName: string,
    element: Element
  ): EditorNode | null {
    let markType: string;

    switch (tagName) {
      case 'strong':
      case 'b':
        markType = 'bold';
        break;
      case 'em':
      case 'i':
        markType = 'italic';
        break;
      case 'u':
        markType = 'underline';
        break;
      case 'strike':
        markType = 'strike';
        break;
      case 'code':
        markType = 'code';
        break;
      case 'a':
        markType = 'link';
        break;
      default:
        return null;
    }

    const mark: EditorMark = {
      type: markType,
    };

    if (markType === 'link') {
      mark.attrs = {
        href: element.getAttribute('href') || '',
        title: element.getAttribute('title') || undefined,
      };
    }

    // Apply mark to all text nodes
    for (const node of nodes) {
      if (node.type === 'text') {
        if (!node.marks) {
          node.marks = [];
        }
        node.marks.push(mark);
      }
    }

    // If single text node, return it; otherwise wrap in paragraph
    if (nodes.length === 1 && nodes[0].type === 'text') {
      return nodes[0];
    }

    return {
      type: 'paragraph',
      content: nodes,
    };
  }

  /**
   * Recursively sanitize DOM node
   */
  private sanitizeNode(node: Node): void {
    const doc = node.ownerDocument;
    if (!doc) {
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    // Remove disallowed tags
    if (!this.ALLOWED_TAGS.has(tagName)) {
      // Replace with text content
      const textNode = doc.createTextNode(element.textContent || '');
      element.parentNode?.replaceChild(textNode, element);
      return;
    }

    // Remove disallowed attributes
    const allowedAttrs = this.ALLOWED_ATTRIBUTES[tagName];
    if (allowedAttrs) {
      const attrs = Array.from(element.attributes);
      for (const attr of attrs) {
        if (!allowedAttrs.has(attr.name)) {
          element.removeAttribute(attr.name);
        }
      }
    } else {
      // Remove all attributes if none are allowed
      const attrs = Array.from(element.attributes);
      for (const attr of attrs) {
        element.removeAttribute(attr.name);
      }
    }

    // Sanitize href and src attributes for security
    if (tagName === 'a') {
      const href = element.getAttribute('href');
      if (href && !this.isSafeURL(href)) {
        element.removeAttribute('href');
      }
    }

    if (tagName === 'img') {
      const src = element.getAttribute('src');
      if (src && !this.isSafeURL(src)) {
        element.removeAttribute('src');
      }
    }

    // Recursively sanitize children
    Array.from(element.childNodes).forEach((child) => {
      this.sanitizeNode(child);
    });
  }

  /**
   * Check if URL is safe (not javascript:, data:, etc.)
   */
  private isSafeURL(url: string): boolean {
    const trimmed = url.trim().toLowerCase();
    const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];
    return !dangerous.some((prefix) => trimmed.startsWith(prefix));
  }

  /**
   * Validate nodes recursively
   */
  private validateNodes(nodes: EditorNode[], errors: string[]): void {
    for (const node of nodes) {
      // Validate node type
      if (!this.NODE_TYPES.has(node.type)) {
        errors.push(`Invalid node type: ${node.type}`);
      }

      // Validate marks
      if (node.marks) {
        for (const mark of node.marks) {
          if (!this.MARK_TYPES.has(mark.type)) {
            errors.push(`Invalid mark type: ${mark.type}`);
          }
        }
      }

      // Recursively validate children
      if (node.content && Array.isArray(node.content)) {
        this.validateNodes(node.content, errors);
      }
    }
  }

  /**
   * Extract plain text from nodes
   */
  private nodesToPlainText(nodes: EditorNode[]): string {
    return nodes.map((node) => this.nodeToPlainText(node)).join('');
  }

  /**
   * Extract plain text from single node
   */
  private nodeToPlainText(node: EditorNode): string {
    switch (node.type) {
      case 'text':
        return node.text || '';

      case 'paragraph':
      case 'heading':
      case 'blockquote':
      case 'listItem':
        return (node.content ? this.nodesToPlainText(node.content) : '') + '\n';

      case 'bulletList':
      case 'orderedList':
        return (node.content ? this.nodesToPlainText(node.content) : '') + '\n';

      case 'codeBlock':
        return (node.content ? this.nodesToPlainText(node.content) : '') + '\n\n';

      case 'hardBreak':
        return '\n';

      case 'horizontalRule':
        return '\n---\n';

      default:
        return node.content ? this.nodesToPlainText(node.content) : '';
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };

    return text.replace(/[&<>"'/]/g, (char) => map[char]);
  }
}
