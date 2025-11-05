/**
 * Selection and Range utilities
 *
 * Helper functions for working with browser Selection and Range APIs
 */

import type { EditorSelection } from '../types';

/**
 * Get the current selection as an EditorSelection object
 */
export function getCurrentSelection(): EditorSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);

  return {
    range,
    collapsed: range.collapsed,
    startContainer: range.startContainer,
    endContainer: range.endContainer,
    commonAncestor: range.commonAncestorContainer,
  };
}

/**
 * Save the current selection (returns a range that can be restored later)
 */
export function saveSelection(): Range | null {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    return selection.getRangeAt(0).cloneRange();
  }
  return null;
}

/**
 * Restore a previously saved selection
 */
export function restoreSelection(range: Range): void {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

/**
 * Check if selection is within a specific element
 */
export function isSelectionInElement(element: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  return element.contains(range.commonAncestorContainer);
}

/**
 * Get the selected text content
 */
export function getSelectedText(): string {
  const selection = window.getSelection();
  return selection?.toString() || '';
}

/**
 * Check if there is a selection (non-collapsed)
 */
export function hasSelection(): boolean {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().length > 0);
}

/**
 * Create a range at the end of an element
 */
export function createRangeAtEnd(element: HTMLElement): Range {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false); // Collapse to end
  return range;
}

/**
 * Create a range at the start of an element
 */
export function createRangeAtStart(element: HTMLElement): Range {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(true); // Collapse to start
  return range;
}

/**
 * Set cursor position at the end of an element
 */
export function setCursorAtEnd(element: HTMLElement): void {
  const range = createRangeAtEnd(element);
  restoreSelection(range);
}

/**
 * Set cursor position at the start of an element
 */
export function setCursorAtStart(element: HTMLElement): void {
  const range = createRangeAtStart(element);
  restoreSelection(range);
}

/**
 * Get the closest parent element that matches a selector
 */
export function getClosestElement(node: Node | null, selector: string): HTMLElement | null {
  if (!node) {
    return null;
  }

  // If it's a text node, start with its parent
  let element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);

  while (element) {
    if (element.matches && element.matches(selector)) {
      return element;
    }
    element = element.parentElement;
  }

  return null;
}

/**
 * Check if the current selection is entirely within a specific tag
 */
export function isSelectionInTag(tagName: string): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;

  return Boolean(getClosestElement(container, tagName.toLowerCase()));
}

/**
 * Surround the current selection with a tag
 */
export function surroundSelectionWithTag(tagName: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const element = document.createElement(tagName);

  try {
    range.surroundContents(element);
  } catch (error) {
    // If surroundContents fails (e.g., selection spans multiple elements),
    // fall back to extracting contents and wrapping them
    const contents = range.extractContents();
    element.appendChild(contents);
    range.insertNode(element);
  }

  // Restore selection around the new element
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Remove a tag from the current selection (unwrap)
 */
export function removeTagFromSelection(tagName: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element = getClosestElement(container, tagName.toLowerCase());

  if (!element) {
    return;
  }

  // Replace the element with its contents
  const parent = element.parentNode;
  if (parent) {
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
  }
}

/**
 * Get all text nodes within a range
 */
export function getTextNodesInRange(range: Range): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (range.intersectsNode(node)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    }
  );

  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push(node as Text);
    }
  }

  return textNodes;
}

/**
 * Insert a node at the current cursor position
 */
export function insertNodeAtCursor(node: Node): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);

  // Move cursor after the inserted node
  range.setStartAfter(node);
  range.setEndAfter(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Replace the current selection with a node
 */
export function replaceSelectionWithNode(node: Node): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);

  // Place cursor after the inserted node
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Get the word at the current cursor position
 */
export function getWordAtCursor(): string | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const textNode = range.startContainer;

  if (textNode.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  const text = textNode.textContent || '';
  const offset = range.startOffset;

  // Find word boundaries
  const before = text.substring(0, offset);
  const after = text.substring(offset);

  const beforeMatch = before.match(/\S+$/);
  const afterMatch = after.match(/^\S+/);

  const wordBefore = beforeMatch ? beforeMatch[0] : '';
  const wordAfter = afterMatch ? afterMatch[0] : '';

  return wordBefore + wordAfter;
}

/**
 * Clear the current selection
 */
export function clearSelection(): void {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
}
