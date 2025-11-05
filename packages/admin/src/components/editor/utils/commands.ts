/**
 * Command execution utilities
 *
 * Wrappers and helpers for document.execCommand and custom commands
 */

/**
 * Execute a document command safely
 */
export function execCommand(command: string, value?: string): boolean {
  try {
    return document.execCommand(command, false, value);
  } catch (error) {
    console.error(`Failed to execute command "${command}":`, error);
    return false;
  }
}

/**
 * Query if a command is currently active
 */
export function queryCommandState(command: string): boolean {
  try {
    return document.queryCommandState(command);
  } catch (error) {
    return false;
  }
}

/**
 * Query the value of a command
 */
export function queryCommandValue(command: string): string {
  try {
    return document.queryCommandValue(command);
  } catch (error) {
    return '';
  }
}

/**
 * Check if a command is supported
 */
export function isCommandSupported(command: string): boolean {
  try {
    return document.queryCommandSupported(command);
  } catch (error) {
    return false;
  }
}

/**
 * Standard formatting commands
 */
export const FormattingCommands = {
  BOLD: 'bold',
  ITALIC: 'italic',
  UNDERLINE: 'underline',
  STRIKETHROUGH: 'strikeThrough',
  SUBSCRIPT: 'subscript',
  SUPERSCRIPT: 'superscript',
  FORMAT_BLOCK: 'formatBlock',
  HEADING_1: 'h1',
  HEADING_2: 'h2',
  HEADING_3: 'h3',
  HEADING_4: 'h4',
  HEADING_5: 'h5',
  HEADING_6: 'h6',
  PARAGRAPH: 'p',
  INSERT_UNORDERED_LIST: 'insertUnorderedList',
  INSERT_ORDERED_LIST: 'insertOrderedList',
  OUTDENT: 'outdent',
  INDENT: 'indent',
  JUSTIFY_LEFT: 'justifyLeft',
  JUSTIFY_CENTER: 'justifyCenter',
  JUSTIFY_RIGHT: 'justifyRight',
  JUSTIFY_FULL: 'justifyFull',
  REMOVE_FORMAT: 'removeFormat',
  INSERT_HTML: 'insertHTML',
  INSERT_TEXT: 'insertText',
  INSERT_IMAGE: 'insertImage',
  CREATE_LINK: 'createLink',
  UNLINK: 'unlink',
  FORE_COLOR: 'foreColor',
  BACK_COLOR: 'backColor',
  FONT_SIZE: 'fontSize',
  FONT_NAME: 'fontName',
  CUT: 'cut',
  COPY: 'copy',
  PASTE: 'paste',
  UNDO: 'undo',
  REDO: 'redo',
  SELECT_ALL: 'selectAll',
  DELETE: 'delete',
} as const;

export type FormattingCommand = typeof FormattingCommands[keyof typeof FormattingCommands];

/**
 * Apply bold formatting
 */
export function toggleBold(): boolean {
  return execCommand(FormattingCommands.BOLD);
}

/**
 * Apply italic formatting
 */
export function toggleItalic(): boolean {
  return execCommand(FormattingCommands.ITALIC);
}

/**
 * Apply underline formatting
 */
export function toggleUnderline(): boolean {
  return execCommand(FormattingCommands.UNDERLINE);
}

/**
 * Apply strikethrough formatting
 */
export function toggleStrikethrough(): boolean {
  return execCommand(FormattingCommands.STRIKETHROUGH);
}

/**
 * Format as heading
 */
export function formatAsHeading(level: 1 | 2 | 3 | 4 | 5 | 6): boolean {
  return execCommand(FormattingCommands.FORMAT_BLOCK, `h${level}`);
}

/**
 * Format as paragraph
 */
export function formatAsParagraph(): boolean {
  return execCommand(FormattingCommands.FORMAT_BLOCK, 'p');
}

/**
 * Insert unordered list
 */
export function toggleUnorderedList(): boolean {
  return execCommand(FormattingCommands.INSERT_UNORDERED_LIST);
}

/**
 * Insert ordered list
 */
export function toggleOrderedList(): boolean {
  return execCommand(FormattingCommands.INSERT_ORDERED_LIST);
}

/**
 * Increase indentation
 */
export function indent(): boolean {
  return execCommand(FormattingCommands.INDENT);
}

/**
 * Decrease indentation
 */
export function outdent(): boolean {
  return execCommand(FormattingCommands.OUTDENT);
}

/**
 * Insert a link
 */
export function insertLink(url: string): boolean {
  return execCommand(FormattingCommands.CREATE_LINK, url);
}

/**
 * Remove link from selection
 */
export function removeLink(): boolean {
  return execCommand(FormattingCommands.UNLINK);
}

/**
 * Insert HTML at cursor
 */
export function insertHTML(html: string): boolean {
  return execCommand(FormattingCommands.INSERT_HTML, html);
}

/**
 * Insert text at cursor
 */
export function insertText(text: string): boolean {
  return execCommand(FormattingCommands.INSERT_TEXT, text);
}

/**
 * Insert image
 */
export function insertImage(url: string): boolean {
  return execCommand(FormattingCommands.INSERT_IMAGE, url);
}

/**
 * Remove all formatting from selection
 */
export function removeFormat(): boolean {
  return execCommand(FormattingCommands.REMOVE_FORMAT);
}

/**
 * Set text color
 */
export function setTextColor(color: string): boolean {
  return execCommand(FormattingCommands.FORE_COLOR, color);
}

/**
 * Set background color
 */
export function setBackgroundColor(color: string): boolean {
  return execCommand(FormattingCommands.BACK_COLOR, color);
}

/**
 * Undo last action
 */
export function undo(): boolean {
  return execCommand(FormattingCommands.UNDO);
}

/**
 * Redo last undone action
 */
export function redo(): boolean {
  return execCommand(FormattingCommands.REDO);
}

/**
 * Select all content
 */
export function selectAll(): boolean {
  return execCommand(FormattingCommands.SELECT_ALL);
}

/**
 * Check if bold is active
 */
export function isBoldActive(): boolean {
  return queryCommandState(FormattingCommands.BOLD);
}

/**
 * Check if italic is active
 */
export function isItalicActive(): boolean {
  return queryCommandState(FormattingCommands.ITALIC);
}

/**
 * Check if underline is active
 */
export function isUnderlineActive(): boolean {
  return queryCommandState(FormattingCommands.UNDERLINE);
}

/**
 * Check if strikethrough is active
 */
export function isStrikethroughActive(): boolean {
  return queryCommandState(FormattingCommands.STRIKETHROUGH);
}

/**
 * Check if unordered list is active
 */
export function isUnorderedListActive(): boolean {
  return queryCommandState(FormattingCommands.INSERT_UNORDERED_LIST);
}

/**
 * Check if ordered list is active
 */
export function isOrderedListActive(): boolean {
  return queryCommandState(FormattingCommands.INSERT_ORDERED_LIST);
}

/**
 * Get current block format (h1, h2, p, etc.)
 */
export function getCurrentBlockFormat(): string {
  return queryCommandValue(FormattingCommands.FORMAT_BLOCK);
}
