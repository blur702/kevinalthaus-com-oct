import type { PartialBlock, Block } from '@blocknote/core';

/**
 * Enhanced HTML to BlockNote blocks converter
 * Uses DOMParser for proper HTML parsing
 */
export function htmlToBlocks(html: string): PartialBlock[] {
  if (!html || html.trim() === '') {
    return [];
  }

  // Use DOMParser for proper HTML parsing
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  const blocks: PartialBlock[] = [];

  // Process each child node
  body.childNodes.forEach((node) => {
    const block = nodeToBlock(node);
    if (block) {
      blocks.push(block);
    }
  });

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', content: '' }];
}

/**
 * Convert DOM node to BlockNote block
 */
function nodeToBlock(node: Node): PartialBlock | null {
  // Skip empty text nodes
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (!text) return null;
    return { type: 'paragraph', content: text };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  switch (tagName) {
    case 'h1':
      return {
        type: 'heading',
        props: { level: 1 },
        content: extractInlineContent(element),
      };
    case 'h2':
      return {
        type: 'heading',
        props: { level: 2 },
        content: extractInlineContent(element),
      };
    case 'h3':
      return {
        type: 'heading',
        props: { level: 3 },
        content: extractInlineContent(element),
      };

    case 'p':
      return {
        type: 'paragraph',
        content: extractInlineContent(element),
      };

    case 'blockquote':
      // BlockNote v0.15.11 doesn't support quote type, use paragraph
      return {
        type: 'paragraph',
        content: extractInlineContent(element),
      };

    case 'pre':
      // BlockNote v0.15.11 doesn't support codeBlock, use paragraph for code
      const codeElement = element.querySelector('code');
      const code = codeElement ? codeElement.textContent || '' : element.textContent || '';
      return {
        type: 'paragraph',
        content: code,
      };

    case 'ul':
      // Convert list items
      const listItems: PartialBlock[] = [];
      element.querySelectorAll('li').forEach((li) => {
        listItems.push({
          type: 'bulletListItem',
          content: extractInlineContent(li),
        });
      });
      return listItems.length > 0 ? listItems[0] : null;

    case 'ol':
      // Convert numbered list items
      const numberedItems: PartialBlock[] = [];
      element.querySelectorAll('li').forEach((li) => {
        numberedItems.push({
          type: 'numberedListItem',
          content: extractInlineContent(li),
        });
      });
      return numberedItems.length > 0 ? numberedItems[0] : null;

    case 'img':
      return {
        type: 'image',
        props: {
          url: element.getAttribute('src') || '',
          caption: element.getAttribute('alt') || '',
        },
      };

    case 'figure':
      const img = element.querySelector('img');
      const figcaption = element.querySelector('figcaption');
      if (img) {
        return {
          type: 'image',
          props: {
            url: img.getAttribute('src') || '',
            caption: figcaption?.textContent || img.getAttribute('alt') || '',
          },
        };
      }
      return null;

    case 'div':
      // Check for custom blocks
      if (element.classList.contains('custom-video-block')) {
        const iframe = element.querySelector('iframe');
        return {
          type: 'video',
          props: {
            url: iframe?.getAttribute('src') || '',
          },
        };
      }
      // Regular div - process children
      const childBlocks: PartialBlock[] = [];
      element.childNodes.forEach((child) => {
        const block = nodeToBlock(child);
        if (block) {
          childBlocks.push(block);
        }
      });
      return childBlocks.length > 0 ? childBlocks[0] : null;

    default:
      // Unknown element - try to extract text content
      const text = element.textContent?.trim();
      if (text) {
        return { type: 'paragraph', content: text };
      }
      return null;
  }
}

/**
 * Extract inline content with formatting
 */
function extractInlineContent(element: HTMLElement): any[] | string {
  const content: any[] = [];

  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        content.push({
          type: 'text',
          text,
          styles: {},
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const text = el.textContent || '';
      if (!text) return;

      const styles: Record<string, boolean> = {};

      // Detect formatting
      if (el.tagName === 'STRONG' || el.tagName === 'B') {
        styles.bold = true;
      }
      if (el.tagName === 'EM' || el.tagName === 'I') {
        styles.italic = true;
      }
      if (el.tagName === 'U') {
        styles.underline = true;
      }
      if (el.tagName === 'S' || el.tagName === 'DEL') {
        styles.strikethrough = true;
      }
      if (el.tagName === 'CODE') {
        styles.code = true;
      }

      if (el.tagName === 'A') {
        content.push({
          type: 'link',
          href: el.getAttribute('href') || '',
          content: text,
        });
      } else {
        content.push({
          type: 'text',
          text,
          styles,
        });
      }
    }
  });

  return content.length > 0 ? content : element.textContent || '';
}

/**
 * Convert BlockNote blocks to HTML
 */
export async function blocksToHtml(blocks: Block[]): Promise<string> {
  if (!blocks || blocks.length === 0) {
    return '';
  }

  const htmlParts: string[] = [];

  for (const block of blocks) {
    const html = blockToHtml(block);
    if (html) {
      htmlParts.push(html);
    }
  }

  return htmlParts.join('\n');
}

/**
 * Convert a single block to HTML
 */
function blockToHtml(block: Block): string {
  const content = getBlockContent(block);

  switch (block.type) {
    case 'heading':
      const level = (block as any).props?.level || 1;
      return `<h${level}>${content}</h${level}>`;

    case 'paragraph':
      return `<p>${content}</p>`;

    case 'bulletListItem':
      return `<ul><li>${content}</li></ul>`;

    case 'numberedListItem':
      return `<ol><li>${content}</li></ol>`;

    case 'checkListItem':
      const checked = (block as any).props?.checked ? 'checked' : '';
      return `<ul><li><input type="checkbox" ${checked} disabled> ${content}</li></ul>`;

    case 'image':
      const url = (block as any).props?.url || '';
      const caption = (block as any).props?.caption || '';
      const alt = (block as any).props?.alt || caption || 'Image';
      const width = (block as any).props?.width;

      let imgTag = `<img src="${url}" alt="${escapeHtml(alt)}"`;
      if (width) {
        imgTag += ` width="${width}"`;
      }
      imgTag += ' />';

      if (caption) {
        return `<figure>${imgTag}<figcaption>${escapeHtml(caption)}</figcaption></figure>`;
      }
      return imgTag;

    case 'video':
      const videoUrl = (block as any).props?.url || '';
      const embedUrl = getVideoEmbedUrl(videoUrl);
      return `<div class="custom-video-block"><iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;

    case 'table':
      // Table rendering would be more complex
      return `<table>${content}</table>`;

    default:
      return `<div>${content}</div>`;
  }
}

/**
 * Extract text content from a block
 */
function getBlockContent(block: Block): string {
  const blockAny = block as any;
  if (typeof blockAny.content === 'string') {
    return blockAny.content;
  }

  if (Array.isArray(blockAny.content)) {
    return blockAny.content
      .map((item: any) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item.type === 'text') {
          let text = item.text || '';

          // Apply inline formatting
          if (item.styles) {
            if (item.styles.bold) text = `<strong>${text}</strong>`;
            if (item.styles.italic) text = `<em>${text}</em>`;
            if (item.styles.underline) text = `<u>${text}</u>`;
            if (item.styles.strikethrough) text = `<s>${text}</s>`;
            if (item.styles.code) text = `<code>${text}</code>`;
          }

          return text;
        }
        if (item.type === 'link') {
          return `<a href="${item.href}">${item.content}</a>`;
        }
        return '';
      })
      .join('');
  }

  // Handle nested blocks (like list items)
  if ((block as any).children && Array.isArray((block as any).children)) {
    return (block as any).children.map((child: Block) => blockToHtml(child)).join('');
  }

  return '';
}

/**
 * Convert video URLs to embed URLs
 */
function getVideoEmbedUrl(url: string): string {
  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // Return as-is if not recognized
  return url;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
