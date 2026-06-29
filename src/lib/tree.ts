import { MindMapDocument, MindMapDocumentError, MindMapNode, Viewport } from './types';

export const ROOT_ID = 'root';

const defaultViewport: Viewport = { x: 80, y: 320, zoom: 1 };

export function createNode(text = '新节点', id = createNodeId()): MindMapNode {
  return { id, text, note: '', collapsed: false, children: [] };
}

export function createDefaultDocument(): MindMapDocument {
  return {
    version: 1,
    root: {
      id: ROOT_ID,
      text: '中心主题',
      note: '',
      collapsed: false,
      children: [createNode('主要分支')],
    },
    viewport: { ...defaultViewport },
  };
}

export function createNodeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function findNode(root: MindMapNode, nodeId: string): MindMapNode | null {
  if (root.id === nodeId) {
    return root;
  }

  for (const child of root.children) {
    const found = findNode(child, nodeId);
    if (found) {
      return found;
    }
  }

  return null;
}

export function countDescendants(node: MindMapNode): number {
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}

export function addChild(document: MindMapDocument, parentId: string, node = createNode()): MindMapDocument {
  return updateNode(document, parentId, (target) => ({
    ...target,
    collapsed: false,
    children: [...target.children, node],
  }));
}

export function addSiblingAfter(document: MindMapDocument, siblingId: string, node = createNode()): MindMapDocument {
  if (siblingId === ROOT_ID) {
    return addChild(document, ROOT_ID, node);
  }

  const result = insertSibling(document.root, siblingId, node, 'after');
  if (!result.changed) {
    return document;
  }

  return { ...document, root: result.node };
}

export function deleteNode(document: MindMapDocument, nodeId: string): MindMapDocument {
  if (nodeId === ROOT_ID) {
    return document;
  }

  const result = removeNode(document.root, nodeId);
  if (!result.removed) {
    return document;
  }

  return { ...document, root: result.node };
}

export function updateNodeText(document: MindMapDocument, nodeId: string, text: string): MindMapDocument {
  const trimmed = text.trim();
  return updateNode(document, nodeId, (node) => ({ ...node, text: trimmed || '未命名节点' }));
}

export function updateNodeNote(document: MindMapDocument, nodeId: string, note: string): MindMapDocument {
  return updateNode(document, nodeId, (node) => ({ ...node, note }));
}

export function toggleNodeCollapsed(document: MindMapDocument, nodeId: string): MindMapDocument {
  return updateNode(document, nodeId, (node) => ({ ...node, collapsed: !node.collapsed }));
}

export function updateViewport(document: MindMapDocument, viewport: Viewport): MindMapDocument {
  return { ...document, viewport };
}

export type DropPosition = 'before' | 'inside' | 'after';

export function moveNode(
  document: MindMapDocument,
  sourceId: string,
  targetId: string,
  position: DropPosition,
): MindMapDocument {
  if (sourceId === ROOT_ID || sourceId === targetId || isDescendant(document.root, sourceId, targetId)) {
    throw new MindMapDocumentError('INVALID_MOVE', '不能移动到自身或子节点下');
  }

  if (position !== 'inside' && targetId === ROOT_ID) {
    throw new MindMapDocumentError('INVALID_MOVE', '根节点不能有同级节点');
  }

  const removed = removeNode(document.root, sourceId);
  if (!removed.removed) {
    return document;
  }

  const inserted =
    position === 'inside'
      ? insertChild(removed.node, targetId, removed.removed)
      : insertSibling(removed.node, targetId, removed.removed, position);

  if (!inserted.changed) {
    return document;
  }

  return { ...document, root: inserted.node };
}

export function parseMindMapDocument(json: string): MindMapDocument {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new MindMapDocumentError('INVALID_JSON', '文件不是有效 JSON');
  }

  return validateMindMapDocument(parsed);
}

export function serializeMindMapDocument(document: MindMapDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function validateMindMapDocument(value: unknown): MindMapDocument {
  if (!isRecord(value)) {
    throw new MindMapDocumentError('INVALID_DOCUMENT', '文件不是有效导图文件');
  }

  if (value.version !== 1) {
    throw new MindMapDocumentError('UNSUPPORTED_VERSION', '当前应用不支持该文件版本');
  }

  if (!isViewport(value.viewport) || !isNode(value.root)) {
    throw new MindMapDocumentError('INVALID_DOCUMENT', '文件不是有效导图文件');
  }

  return value as MindMapDocument;
}

function updateNode(
  document: MindMapDocument,
  nodeId: string,
  updater: (node: MindMapNode) => MindMapNode,
): MindMapDocument {
  const result = updateNodeInTree(document.root, nodeId, updater);
  if (!result.changed) {
    return document;
  }

  return { ...document, root: result.node };
}

function updateNodeInTree(
  node: MindMapNode,
  nodeId: string,
  updater: (node: MindMapNode) => MindMapNode,
): { node: MindMapNode; changed: boolean } {
  if (node.id === nodeId) {
    return { node: updater(node), changed: true };
  }

  let changed = false;
  const children = node.children.map((child) => {
    const result = updateNodeInTree(child, nodeId, updater);
    changed ||= result.changed;
    return result.node;
  });

  return changed ? { node: { ...node, children }, changed } : { node, changed };
}

function insertChild(
  node: MindMapNode,
  parentId: string,
  child: MindMapNode,
): { node: MindMapNode; changed: boolean } {
  if (node.id === parentId) {
    return {
      node: { ...node, collapsed: false, children: [...node.children, child] },
      changed: true,
    };
  }

  let changed = false;
  const children = node.children.map((currentChild) => {
    const result = insertChild(currentChild, parentId, child);
    changed ||= result.changed;
    return result.node;
  });

  return changed ? { node: { ...node, children }, changed } : { node, changed };
}

function insertSibling(
  node: MindMapNode,
  siblingId: string,
  sibling: MindMapNode,
  position: 'before' | 'after',
): { node: MindMapNode; changed: boolean } {
  const siblingIndex = node.children.findIndex((child) => child.id === siblingId);
  if (siblingIndex >= 0) {
    const insertionIndex = position === 'before' ? siblingIndex : siblingIndex + 1;
    const children = [...node.children];
    children.splice(insertionIndex, 0, sibling);
    return { node: { ...node, children }, changed: true };
  }

  let changed = false;
  const children = node.children.map((child) => {
    const result = insertSibling(child, siblingId, sibling, position);
    changed ||= result.changed;
    return result.node;
  });

  return changed ? { node: { ...node, children }, changed } : { node, changed };
}

function removeNode(
  node: MindMapNode,
  nodeId: string,
): { node: MindMapNode; removed: MindMapNode | null } {
  const directIndex = node.children.findIndex((child) => child.id === nodeId);
  if (directIndex >= 0) {
    const children = [...node.children];
    const [removed] = children.splice(directIndex, 1);
    return { node: { ...node, children }, removed };
  }

  let removed: MindMapNode | null = null;
  const children = node.children.map((child) => {
    if (removed) {
      return child;
    }

    const result = removeNode(child, nodeId);
    removed = result.removed;
    return result.node;
  });

  return removed ? { node: { ...node, children }, removed } : { node, removed };
}

function isDescendant(root: MindMapNode, ancestorId: string, candidateId: string): boolean {
  const ancestor = findNode(root, ancestorId);
  return ancestor ? Boolean(findNode(ancestor, candidateId)) : false;
}

function isNode(value: unknown): value is MindMapNode {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.note === 'string' &&
    typeof value.collapsed === 'boolean' &&
    Array.isArray(value.children) &&
    value.children.every(isNode)
  );
}

function isViewport(value: unknown): value is Viewport {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    typeof value.zoom === 'number' &&
    Number.isFinite(value.zoom) &&
    value.zoom > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
