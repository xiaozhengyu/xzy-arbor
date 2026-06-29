# Lightweight Mindmap Interface

## Document Format

Mind map files are JSON documents with versioned structure.

```json
{
  "version": 1,
  "root": {
    "id": "root",
    "text": "中心主题",
    "note": "",
    "collapsed": false,
    "children": []
  },
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  }
}
```

## TypeScript Contracts

```ts
type MindMapNode = {
  id: string;
  text: string;
  note: string;
  collapsed: boolean;
  children: MindMapNode[];
};

type MindMapDocument = {
  version: 1;
  root: MindMapNode;
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
};
```

## File Operations

- `newDocument()`: creates a default in-memory document.
- `openDocument()`: opens a JSON file through Tauri dialog and validates the document shape.
- `saveDocument()`: writes to the current file path; if no path exists, delegates to save-as.
- `saveDocumentAs()`: asks for a path and writes the current JSON document.

## Validation Rules

- `version` must be `1`.
- `root` must be a valid node.
- Node `id` and `text` must be strings.
- Node `note` must be a string.
- Node `collapsed` must be boolean.
- Node `children` must be an array of valid nodes.
- `viewport.x`, `viewport.y`, and `viewport.zoom` must be finite numbers.

## Error Codes

The UI maps internal errors to user-facing messages.

- `INVALID_JSON`: selected file is not parseable JSON.
- `UNSUPPORTED_VERSION`: document version is not supported by this app.
- `INVALID_DOCUMENT`: JSON shape is not a valid mind map document.
- `READ_FAILED`: file cannot be read.
- `WRITE_FAILED`: file cannot be written.
- `INVALID_MOVE`: requested drag operation would create an invalid tree.

## SQL Impact

No SQL, database schema, index, upgrade script, or initialization script changes are required.
