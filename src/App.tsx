import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createHistory,
  recordHistory,
  redoHistory,
  replaceHistoryPresent,
  resetHistory,
  undoHistory,
} from './lib/history';
import {
  isTauriRuntime,
  openMindMapFile,
  saveMindMapFile,
  saveMindMapFileAs,
} from './lib/fileStorage';
import { computeRightTreeLayout } from './lib/layout';
import {
  ROOT_ID,
  addChild,
  addSiblingAfter,
  createDefaultDocument,
  createNode,
  deleteNode,
  findNode,
  moveNode,
  toggleNodeCollapsed,
  updateNodeNote,
  updateNodeText,
  updateViewport,
  type DropPosition,
} from './lib/tree';
import { MindMapDocument, MindMapDocumentError, MindMapNode, Viewport } from './lib/types';

const zoomStep = 0.1;
const minZoom = 0.35;
const maxZoom = 2;
const dragThreshold = 6;

export function App() {
  const [history, setHistory] = useState(() => createHistory(createDefaultDocument()));
  const [selectedId, setSelectedId] = useState(ROOT_ID);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [noteOpen, setNoteOpen] = useState(true);
  const [status, setStatus] = useState('就绪');
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingDocumentAction | null>(null);
  const dirtyRef = useRef(dirty);
  const mindMapRef = useRef(history.present);
  const filePathRef = useRef(filePath);
  const closeUnlistenRef = useRef<(() => void) | null>(null);
  const panningRef = useRef<{ startX: number; startY: number; viewport: Viewport } | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const dropPreviewRef = useRef<DropPreview | null>(null);
  const suppressClickRef = useRef(false);

  const mindMap = history.present;
  const layout = useMemo(() => computeRightTreeLayout(mindMap.root), [mindMap.root]);
  const selectedNode = findNode(mindMap.root, selectedId) ?? mindMap.root;
  const displayTitle = `${dirty ? '*' : ''}${getFileName(filePath)}`;
  const windowTitle = `XZY Arbor - ${displayTitle}`;

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    mindMapRef.current = mindMap;
  }, [mindMap]);

  useEffect(() => {
    filePathRef.current = filePath;
  }, [filePath]);

  useEffect(() => {
    if (isTauriRuntime()) {
      void getCurrentWindow().setTitle(windowTitle);
      return;
    }

    document.title = windowTitle;
  }, [windowTitle]);

  useEffect(() => {
    if (!isTauriRuntime() || !dirty) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    getCurrentWindow()
      .onCloseRequested((event) => {
        event.preventDefault();
        setPendingAction('close');
      })
      .then((handler) => {
        if (disposed) {
          handler();
        } else {
          unlisten = handler;
          closeUnlistenRef.current = handler;
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
      if (closeUnlistenRef.current === unlisten) {
        closeUnlistenRef.current = null;
      }
    };
  }, [dirty]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTextInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      const usesModifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (usesModifier && key === 's') {
        event.preventDefault();
        void handleSave();
        return;
      }

      if (usesModifier && !isTextInput && (key === 'z' || key === 'y')) {
        event.preventDefault();
        if (key === 'y' || event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (editingNodeId || isTextInput) {
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const node = createNode();
        updateDocument(addSiblingAfter(mindMap, selectedId, node));
        setSelectedId(node.id);
        startEditing(node, node.text);
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        const node = createNode();
        updateDocument(addChild(mindMap, selectedId, node));
        setSelectedId(node.id);
        startEditing(node, node.text);
        return;
      }

      if (event.key === 'Delete') {
        event.preventDefault();
        updateDocument(deleteNode(mindMap, selectedId));
        if (selectedId !== ROOT_ID) {
          setSelectedId(ROOT_ID);
        }
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        startEditing(selectedNode, event.key);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingNodeId, history, mindMap, selectedId, selectedNode]);

  function updateDocument(nextDocument: MindMapDocument, record = true) {
    setHistory((currentHistory) => (
      record
        ? recordHistory(currentHistory, nextDocument)
        : replaceHistoryPresent(currentHistory, nextDocument)
    ));
    setDirty(true);
  }

  function updateStatus(message: string) {
    setStatus(message);
  }

  function startEditing(node: MindMapNode, text = node.text) {
    setSelectedId(node.id);
    setEditingNodeId(node.id);
    setEditingText(text);
  }

  function commitEditing() {
    if (!editingNodeId) {
      return;
    }

    updateDocument(updateNodeText(mindMap, editingNodeId, editingText));
    setEditingNodeId(null);
    setEditingText('');
  }

  function cancelEditing() {
    setEditingNodeId(null);
    setEditingText('');
  }

  function handleUndo() {
    setHistory((currentHistory) => {
      const nextHistory = undoHistory(currentHistory);
      if (nextHistory === currentHistory) {
        return currentHistory;
      }

      setEditingNodeId(null);
      setEditingText('');
      setDirty(true);
      setSelectedId((currentSelectedId) => (
        findNode(nextHistory.present.root, currentSelectedId) ? currentSelectedId : ROOT_ID
      ));
      updateStatus('已撤销上一步操作');
      return nextHistory;
    });
  }

  function handleRedo() {
    setHistory((currentHistory) => {
      const nextHistory = redoHistory(currentHistory);
      if (nextHistory === currentHistory) {
        return currentHistory;
      }

      setEditingNodeId(null);
      setEditingText('');
      setDirty(true);
      setSelectedId((currentSelectedId) => (
        findNode(nextHistory.present.root, currentSelectedId) ? currentSelectedId : ROOT_ID
      ));
      updateStatus('已重做上一步操作');
      return nextHistory;
    });
  }

  function setDropPreviewState(nextPreview: DropPreview | null) {
    const currentPreview = dropPreviewRef.current;
    if (
      currentPreview?.targetId === nextPreview?.targetId &&
      currentPreview?.position === nextPreview?.position
    ) {
      return;
    }

    dropPreviewRef.current = nextPreview;
    setDropPreview(nextPreview);
  }

  function clearDragState() {
    dragRef.current = null;
    setDropPreviewState(null);
  }

  function getDropPreviewFromPoint(clientX: number, clientY: number, sourceId: string): DropPreview | null {
    const element = document.elementFromPoint(clientX, clientY);
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    const nodeElement = element.closest<HTMLElement>('.mindmap-node');
    const targetId = nodeElement?.dataset.nodeId;
    if (!targetId || targetId === sourceId) {
      return null;
    }

    const sourceNode = findNode(mindMapRef.current.root, sourceId);
    if (sourceNode && findNode(sourceNode, targetId)) {
      return null;
    }

    const rect = nodeElement.getBoundingClientRect();
    return {
      targetId,
      position: targetId === ROOT_ID ? 'inside' : resolveDropPosition(clientY, rect),
    };
  }

  function requestDocumentAction(action: PendingDocumentAction) {
    if (dirtyRef.current) {
      setPendingAction(action);
      return;
    }

    void runDocumentAction(action);
  }

  async function handleUnsavedDecision(decision: UnsavedDecision) {
    const action = pendingAction;
    if (!action) {
      return;
    }

    if (decision === 'cancel') {
      setPendingAction(null);
      return;
    }

    if (decision === 'save') {
      const saved = await handleSave();
      setPendingAction(null);
      if (!saved) {
        return;
      }
      await runDocumentAction(action);
      return;
    }

    setPendingAction(null);
    await runDocumentAction(action);
  }

  async function runDocumentAction(action: PendingDocumentAction) {
    if (action === 'new') {
      const nextDocument = createDefaultDocument();
      setHistory(resetHistory(nextDocument));
      setSelectedId(ROOT_ID);
      setEditingNodeId(null);
      setEditingText('');
      setFilePath(null);
      setDirty(false);
      updateStatus('已创建新导图');
      return;
    }

    if (action === 'open') {
      try {
        const opened = await openMindMapFile();
        if (!opened) {
          return;
        }

        setHistory(resetHistory(opened.document));
        setSelectedId(opened.document.root.id);
        setEditingNodeId(null);
        setEditingText('');
        setFilePath(opened.path);
        setDirty(false);
        updateStatus('已打开导图');
      } catch (error) {
        updateStatus(toOpenUserMessage(error));
      }
      return;
    }

    if (!isTauriRuntime()) {
      window.close();
      return;
    }

    closeUnlistenRef.current?.();
    closeUnlistenRef.current = null;
    dirtyRef.current = false;
    await getCurrentWindow().destroy();
  }

  function handleNew() {
    requestDocumentAction('new');
  }

  function handleOpen() {
    requestDocumentAction('open');
  }

  async function handleSave(): Promise<boolean> {
    try {
      const savedPath = await saveMindMapFile(mindMapRef.current, filePathRef.current);
      if (!savedPath) {
        updateStatus('保存已取消，当前导图仍有未保存更改');
        return false;
      }

      setFilePath(savedPath);
      setDirty(false);
      updateStatus('已保存导图');
      return true;
    } catch (error) {
      updateStatus(toSaveUserMessage(error));
      return false;
    }
  }

  async function handleSaveAs() {
    try {
      const savedPath = await saveMindMapFileAs(mindMapRef.current);
      if (!savedPath) {
        return;
      }

      setFilePath(savedPath);
      setDirty(false);
      updateStatus('已另存为导图');
    } catch (error) {
      updateStatus(toSaveUserMessage(error));
    }
  }

  function handleToggleCollapse(nodeId: string) {
    updateDocument(toggleNodeCollapsed(mindMap, nodeId));
  }

  function handleNoteChange(note: string) {
    updateDocument(updateNodeNote(mindMap, selectedNode.id, note));
  }

  function handleNodePointerDown(event: React.PointerEvent<HTMLDivElement>, nodeId: string) {
    event.stopPropagation();
    if (event.button !== 0 || nodeId === ROOT_ID) {
      return;
    }

    dragRef.current = {
      sourceId: nodeId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleNodePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    if (!drag.started) {
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (distance < dragThreshold) {
        return;
      }

      drag.started = true;
      suppressClickRef.current = true;
    }

    setDropPreviewState(getDropPreviewFromPoint(event.clientX, event.clientY, drag.sourceId));
  }

  function handleNodePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const preview = drag.started
      ? getDropPreviewFromPoint(event.clientX, event.clientY, drag.sourceId) ?? dropPreviewRef.current
      : null;
    const sourceId = drag.sourceId;
    const started = drag.started;
    clearDragState();

    if (!started || !preview) {
      return;
    }

    try {
      updateDocument(moveNode(mindMapRef.current, sourceId, preview.targetId, preview.position));
      setSelectedId(sourceId);
      updateStatus(preview.position === 'inside' ? '已移动为子节点' : '已调整节点顺序');
    } catch (error) {
      updateStatus(toUserMessage(error));
    }
  }

  function handleNodePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    clearDragState();
  }

  function handleNodeClick(event: React.MouseEvent<HTMLDivElement>, nodeId: string) {
    event.stopPropagation();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    setSelectedId(nodeId);
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    panningRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      viewport: mindMap.viewport,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const panning = panningRef.current;
    if (!panning) {
      return;
    }

    updateDocument(
      updateViewport(mindMap, {
        ...panning.viewport,
        x: panning.viewport.x + event.clientX - panning.startX,
        y: panning.viewport.y + event.clientY - panning.startY,
      }),
      false,
    );
  }

  function handleCanvasPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    panningRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const nextZoom = clamp(mindMap.viewport.zoom + (event.deltaY > 0 ? -zoomStep : zoomStep), minZoom, maxZoom);
    updateDocument(updateViewport(mindMap, { ...mindMap.viewport, zoom: nextZoom }), false);
  }

  function handleZoom(delta: number) {
    updateDocument(
      updateViewport(mindMap, {
        ...mindMap.viewport,
        zoom: clamp(mindMap.viewport.zoom + delta, minZoom, maxZoom),
      }),
      false,
    );
  }

  return (
    <div className="app-shell">
      <header className="toolbar">
        <div>
          <h1>XZY Arbor</h1>
          <p>{displayTitle}</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={handleUndo} disabled={history.past.length === 0}>撤销</button>
          <button type="button" onClick={handleRedo} disabled={history.future.length === 0}>重做</button>
          <button type="button" onClick={handleNew}>新建</button>
          <button type="button" onClick={handleOpen}>打开</button>
          <button type="button" onClick={() => void handleSave()}>保存</button>
          <button type="button" onClick={handleSaveAs}>另存为</button>
          <button type="button" onClick={() => setNoteOpen((open) => !open)}>
            {noteOpen ? '隐藏备注' : '显示备注'}
          </button>
        </div>
      </header>

      <main className="workspace">
        <section
          className="mindmap-canvas"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onWheel={handleWheel}
        >
          <div className="canvas-help">
            Enter 同级 · Tab 子级 · Delete 删除 · 拖拽节点调整结构
          </div>
          <div className="zoom-controls">
            <button type="button" onClick={() => handleZoom(-zoomStep)}>-</button>
            <span>{Math.round(mindMap.viewport.zoom * 100)}%</span>
            <button type="button" onClick={() => handleZoom(zoomStep)}>+</button>
          </div>
          <div
            className="map-content"
            style={{
              width: layout.width,
              height: layout.height,
              transform: `translate(${mindMap.viewport.x}px, ${mindMap.viewport.y}px) scale(${mindMap.viewport.zoom})`,
            }}
          >
            <svg className="edges" width={layout.width} height={layout.height}>
              {layout.edges.map((edge) => (
                <path
                  key={edge.id}
                  d={`M ${edge.fromX} ${edge.fromY} C ${edge.fromX + 72} ${edge.fromY}, ${edge.toX - 72} ${edge.toY}, ${edge.toX} ${edge.toY}`}
                />
              ))}
            </svg>
            {layout.nodes.map((layoutNode) => {
              const node = layoutNode.node;
              const selected = selectedNode.id === node.id;
              const editing = editingNodeId === node.id;
              const previewPosition = dropPreview?.targetId === node.id ? dropPreview.position : null;
              return (
                <div
                  key={node.id}
                  className={`mindmap-node${selected ? ' selected' : ''}${node.id === ROOT_ID ? ' root' : ''}${previewPosition ? ` drop-${previewPosition}` : ''}`}
                  data-node-id={node.id}
                  style={{
                    left: layoutNode.x,
                    top: layoutNode.y,
                    width: layoutNode.width,
                    height: layoutNode.height,
                  }}
                  onClick={(event) => handleNodeClick(event, node.id)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    startEditing(node);
                  }}
                  onPointerDown={(event) => handleNodePointerDown(event, node.id)}
                  onPointerMove={handleNodePointerMove}
                  onPointerUp={handleNodePointerUp}
                  onPointerCancel={handleNodePointerCancel}
                >
                  {node.children.length > 0 && (
                    <button
                      type="button"
                      className="collapse-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleToggleCollapse(node.id);
                      }}
                    >
                      {node.collapsed ? '+' : '-'}
                    </button>
                  )}
                  {editing ? (
                    <input
                      className="node-editor"
                      value={editingText}
                      autoFocus
                      onChange={(event) => setEditingText(event.target.value)}
                      onBlur={commitEditing}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitEditing();
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelEditing();
                        }
                      }}
                    />
                  ) : (
                    <span className="node-text">{node.text}</span>
                  )}
                  {layoutNode.hiddenCount > 0 && <span className="hidden-count">{layoutNode.hiddenCount}</span>}
                  {node.note && <span className="note-dot" title="有备注" />}
                </div>
              );
            })}
          </div>
        </section>

        {noteOpen && (
          <aside className="notes-panel">
            <div className="panel-heading">
              <span>备注</span>
              <strong>{selectedNode.text}</strong>
            </div>
            <textarea
              value={selectedNode.note}
              onChange={(event) => handleNoteChange(event.target.value)}
              placeholder="为当前节点添加纯文本备注..."
            />
          </aside>
        )}
      </main>

      <footer className="statusbar">
        <span>{status}</span>
        <span>{dirty ? '有未保存更改' : '所有更改已保存'}</span>
      </footer>

      {pendingAction && (
        <div className="dialog-backdrop">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-dialog-title">
            <div>
              <span className="dialog-kicker">未保存更改</span>
              <h2 id="unsaved-dialog-title">当前导图有未保存更改</h2>
              <p>继续操作前，请选择保存当前导图、放弃更改或取消操作。</p>
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={() => void handleUnsavedDecision('save')}>保存</button>
              <button type="button" className="secondary-button" onClick={() => void handleUnsavedDecision('discard')}>
                放弃更改
              </button>
              <button type="button" className="ghost-button" onClick={() => void handleUnsavedDecision('cancel')}>
                取消
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

type DropPreview = {
  targetId: string;
  position: DropPosition;
};

type DragSession = {
  sourceId: string;
  pointerId: number;
  startX: number;
  startY: number;
  started: boolean;
};

type PendingDocumentAction = 'new' | 'open' | 'close';

type UnsavedDecision = 'save' | 'discard' | 'cancel';

function resolveDropPosition(clientY: number, rect: DOMRect): DropPosition {
  const ratio = (clientY - rect.top) / rect.height;
  if (ratio < 0.33) {
    return 'before';
  }
  if (ratio > 0.66) {
    return 'after';
  }
  return 'inside';
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function getFileName(path: string | null): string {
  return path ? path.split(/[\\/]/).pop() || path : '未命名导图';
}

function toOpenUserMessage(error: unknown): string {
  if (error instanceof MindMapDocumentError) {
    if (error.code === 'INVALID_JSON') {
      return '所选文件不是有效的 JSON，当前导图未被替换。';
    }
    if (error.code === 'UNSUPPORTED_VERSION') {
      return '所选导图版本暂不支持，当前导图未被替换。';
    }
    if (error.code === 'INVALID_DOCUMENT') {
      return '所选文件不是合法的 XZY Arbor 导图，当前导图未被替换。';
    }
    if (error.code === 'READ_FAILED') {
      return '读取文件失败，当前导图未被替换。';
    }
  }

  if (error instanceof Error) {
    return `${error.message}，当前导图未被替换。`;
  }

  return '打开失败，当前导图未被替换。';
}

function toSaveUserMessage(error: unknown): string {
  if (error instanceof MindMapDocumentError && error.code === 'WRITE_FAILED') {
    return '保存失败，当前导图仍有未保存更改。';
  }

  return '保存失败，当前导图仍有未保存更改。';
}

function toUserMessage(error: unknown): string {
  if (error instanceof MindMapDocumentError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '操作失败';
}
