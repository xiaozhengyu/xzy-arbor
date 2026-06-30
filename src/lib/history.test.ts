import { describe, expect, it } from 'vitest';
import {
  createHistory,
  recordHistory,
  redoHistory,
  replaceHistoryPresent,
  resetHistory,
  undoHistory,
} from './history';
import type { MindMapDocument } from './types';

function createDocument(text: string): MindMapDocument {
  return {
    version: 1,
    root: {
      id: 'root',
      text,
      note: '',
      collapsed: false,
      children: [],
    },
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe('history operations', () => {
  it('starts without undo or redo entries', () => {
    const document = createDocument('Initial');
    const history = createHistory(document);

    expect(history).toEqual({ past: [], present: document, future: [] });
  });

  it('records a document and allows undo', () => {
    const initial = createDocument('Initial');
    const next = createDocument('Next');
    const history = undoHistory(recordHistory(createHistory(initial), next));

    expect(history.present.root.text).toBe('Initial');
    expect(history.future[0].root.text).toBe('Next');
  });

  it('allows redo after undo', () => {
    const initial = createDocument('Initial');
    const next = createDocument('Next');
    const history = redoHistory(undoHistory(recordHistory(createHistory(initial), next)));

    expect(history.present.root.text).toBe('Next');
    expect(history.past[0].root.text).toBe('Initial');
  });

  it('clears redo entries when recording a new document', () => {
    const initial = createDocument('Initial');
    const next = createDocument('Next');
    const replacement = createDocument('Replacement');
    const undone = undoHistory(recordHistory(createHistory(initial), next));
    const history = recordHistory(undone, replacement);

    expect(history.present.root.text).toBe('Replacement');
    expect(history.future).toEqual([]);
  });

  it('keeps only the latest 50 past entries', () => {
    let history = createHistory(createDocument('0'));

    for (let index = 1; index <= 55; index += 1) {
      history = recordHistory(history, createDocument(String(index)));
    }

    expect(history.past).toHaveLength(50);
    expect(history.past[0].root.text).toBe('5');
  });

  it('resets history around a document', () => {
    const initial = createDocument('Initial');
    const next = createDocument('Next');
    const history = resetHistory(next);

    expect(history).toEqual({ past: [], present: next, future: [] });
    expect(undoHistory(recordHistory(createHistory(initial), next)).present).not.toBe(history.present);
  });

  it('replaces the present document without changing undo or redo entries', () => {
    const initial = createDocument('Initial');
    const next = createDocument('Next');
    const replacement = createDocument('Replacement');
    const undone = undoHistory(recordHistory(createHistory(initial), next));
    const history = replaceHistoryPresent(undone, replacement);

    expect(history.past).toEqual(undone.past);
    expect(history.present).toBe(replacement);
    expect(history.future).toEqual(undone.future);
  });

  it('preserves the current viewport when undoing or redoing', () => {
    const initial = createDocument('Initial');
    const next = createDocument('Next');
    const panned = { ...next, viewport: { x: 100, y: 120, zoom: 1.5 } };
    const history = replaceHistoryPresent(recordHistory(createHistory(initial), next), panned);
    const undone = undoHistory(history);
    const redone = redoHistory(undone);

    expect(undone.present.viewport).toEqual(panned.viewport);
    expect(redone.present.viewport).toEqual(panned.viewport);
  });
});
