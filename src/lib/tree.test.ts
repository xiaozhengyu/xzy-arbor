import { describe, expect, it } from 'vitest';
import {
  ROOT_ID,
  addChild,
  addSiblingAfter,
  createNode,
  deleteNode,
  findNode,
  moveNode,
  parseMindMapDocument,
  serializeMindMapDocument,
  toggleNodeCollapsed,
  updateNodeNote,
  updateNodeText,
  validateMindMapDocument,
} from './tree';
import { MindMapDocument, MindMapDocumentError } from './types';

function createTestDocument(): MindMapDocument {
  return {
    version: 1,
    root: {
      id: ROOT_ID,
      text: 'Root',
      note: '',
      collapsed: false,
      children: [
        {
          id: 'a',
          text: 'A',
          note: '',
          collapsed: false,
          children: [createNode('A1', 'a1')],
        },
        createNode('B', 'b'),
      ],
    },
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe('tree operations', () => {
  it('adds a child node', () => {
    const document = addChild(createTestDocument(), 'b', createNode('B1', 'b1'));

    expect(findNode(document.root, 'b')?.children[0].id).toBe('b1');
  });

  it('adds a sibling after the selected node', () => {
    const document = addSiblingAfter(createTestDocument(), 'a', createNode('C', 'c'));

    expect(document.root.children.map((node) => node.id)).toEqual(['a', 'c', 'b']);
  });

  it('deletes a node and its subtree', () => {
    const document = deleteNode(createTestDocument(), 'a');

    expect(findNode(document.root, 'a')).toBeNull();
    expect(findNode(document.root, 'a1')).toBeNull();
  });

  it('does not delete the root node', () => {
    const original = createTestDocument();
    const document = deleteNode(original, ROOT_ID);

    expect(document).toBe(original);
  });

  it('moves a node under another parent', () => {
    const document = moveNode(createTestDocument(), 'b', 'a', 'inside');

    expect(findNode(document.root, 'a')?.children.map((node) => node.id)).toEqual(['a1', 'b']);
    expect(document.root.children.map((node) => node.id)).toEqual(['a']);
  });

  it('moves a node before another sibling', () => {
    const document = moveNode(createTestDocument(), 'b', 'a', 'before');

    expect(document.root.children.map((node) => node.id)).toEqual(['b', 'a']);
  });

  it('rejects moving a node into its descendant', () => {
    expect(() => moveNode(createTestDocument(), 'a', 'a1', 'inside')).toThrow(MindMapDocumentError);
  });

  it('updates text, notes, and collapsed state', () => {
    let document = createTestDocument();
    document = updateNodeText(document, 'a', 'Updated');
    document = updateNodeNote(document, 'a', 'Note');
    document = toggleNodeCollapsed(document, 'a');

    expect(findNode(document.root, 'a')).toMatchObject({
      text: 'Updated',
      note: 'Note',
      collapsed: true,
    });
  });
});

describe('document validation', () => {
  it('serializes and parses a valid document', () => {
    const document = createTestDocument();
    const parsed = parseMindMapDocument(serializeMindMapDocument(document));

    expect(parsed).toEqual(document);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseMindMapDocument('{')).toThrow(MindMapDocumentError);
  });

  it('rejects unsupported versions', () => {
    expect(() => validateMindMapDocument({ ...createTestDocument(), version: 2 })).toThrow(MindMapDocumentError);
  });
});
