export type MindMapNode = {
  id: string;
  text: string;
  note: string;
  collapsed: boolean;
  children: MindMapNode[];
};

export type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

export type MindMapDocument = {
  version: 1;
  root: MindMapNode;
  viewport: Viewport;
};

export type DocumentErrorCode =
  | 'INVALID_JSON'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_DOCUMENT'
  | 'READ_FAILED'
  | 'WRITE_FAILED'
  | 'INVALID_MOVE';

export class MindMapDocumentError extends Error {
  constructor(
    readonly code: DocumentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MindMapDocumentError';
  }
}
