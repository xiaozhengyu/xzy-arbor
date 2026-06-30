import type { MindMapDocument } from './types';

const maxHistoryEntries = 50;

export type HistoryState = {
  past: MindMapDocument[];
  present: MindMapDocument;
  future: MindMapDocument[];
};

export function createHistory(initialDocument: MindMapDocument): HistoryState {
  return {
    past: [],
    present: initialDocument,
    future: [],
  };
}

export function recordHistory(history: HistoryState, nextDocument: MindMapDocument): HistoryState {
  if (history.present === nextDocument) {
    return history;
  }

  return {
    past: [...history.past, history.present].slice(-maxHistoryEntries),
    present: nextDocument,
    future: [],
  };
}

export function undoHistory(history: HistoryState): HistoryState {
  const previousDocument = history.past.at(-1);
  if (!previousDocument) {
    return history;
  }

  return {
    past: history.past.slice(0, -1),
    present: preserveViewport(previousDocument, history.present),
    future: [history.present, ...history.future],
  };
}

export function redoHistory(history: HistoryState): HistoryState {
  const nextDocument = history.future[0];
  if (!nextDocument) {
    return history;
  }

  return {
    past: [...history.past, history.present].slice(-maxHistoryEntries),
    present: preserveViewport(nextDocument, history.present),
    future: history.future.slice(1),
  };
}

export function replaceHistoryPresent(history: HistoryState, document: MindMapDocument): HistoryState {
  return {
    ...history,
    present: document,
  };
}

export function resetHistory(document: MindMapDocument): HistoryState {
  return createHistory(document);
}

function preserveViewport(document: MindMapDocument, currentDocument: MindMapDocument): MindMapDocument {
  return {
    ...document,
    viewport: currentDocument.viewport,
  };
}
