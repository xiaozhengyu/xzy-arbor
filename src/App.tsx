import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useMemo, useRef, useState } from 'react';
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
} from './lib/tree';
import { MindMapDocument, MindMapDocumentError, MindMapNode, Viewport } from './lib/types';

const zoomStep = 0.1;
const minZoom = 0.35;
const maxZoom = 2;

export function App() {
  const [mindMap, setMindMap] = useState<MindMapDocument>(() => createDefaultDocument());
  const [selectedId, setSelectedId] = useState(ROOT_ID);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [noteOpen, setNoteOpen] = useState(true);
  const [status, setStatus] = useState('就绪');
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const dirtyRef = useRef(dirty);
  const mindMapRef = useRef(mindMap);
  const filePathRef = useRef(filePath);
  const panningRef = useRef<{ startX: number; startY: number; viewport: Viewport } | null>(null);

  const layout = useMemo(() => computeRightTreeLayout(mindMap.root), [mindMap.root]);
  const selectedNode = findNode(mindMap.root, selectedId) ?? mindMap.root;
  const title = `${filePath ? filePath.split(/[\\/]/).pop() : '未命名导图'}${dirty ? ' *' : ''}`;

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
    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (!dirtyRef.current) {
          return;
        }

        event.preventDefault();
        const shouldClose = window.confirm('当前导图有未保存更改。放弃更改并关闭应用？');
        if (shouldClose) {
          dirtyRef.current = false;
          await getCurrentWindow().close();
        }
      })
      .then((handler) => {
        if (disposed) {
          handler();
        } else {
          unlisten = handler;
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSave();
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTextInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
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
  }, [editingNodeId, mindMap, selectedId, selectedNode]);

  function updateDocument(nextDocument: MindMapDocument, markDirty = true) {
    setMindMap(nextDocument);
    if (markDirty) {
      setDirty(true);
    }
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

  async function confirmReplaceDocument(): Promise<boolean> {
    if (!dirtyRef.current) {
      return true;
    }

    const action = window.prompt('当前导图有未保存更改。输入 save 保存、discard 放弃、cancel 取消。', 'cancel');
    if (action === 'save') {
      return handleSave();
    }

    return action === 'discard';
  }

  async function handleNew() {
    if (!(await confirmReplaceDocument())) {
      return;
    }

    const nextDocument = createDefaultDocument();
    setMindMap(nextDocument);
    setSelectedId(ROOT_ID);
    setEditingNodeId(null);
    setFilePath(null);
    setDirty(false);
    updateStatus('已创建新导图');
  }

  async function handleOpen() {
    if (!(await confirmReplaceDocument())) {
      return;
    }

    try {
      const opened = await openMindMapFile();
      if (!opened) {
        return;
      }

      setMindMap(opened.document);
      setSelectedId(opened.document.root.id);
      setEditingNodeId(null);
      setFilePath(opened.path);
      setDirty(false);
      updateStatus('已打开导图');
    } catch (error) {
      updateStatus(toUserMessage(error));
    }
  }

  async function handleSave(): Promise<boolean> {
    try {
      const savedPath = await saveMindMapFile(mindMapRef.current, filePathRef.current);
      if (!savedPath) {
        return false;
      }

      setFilePath(savedPath);
      setDirty(false);
      updateStatus('已保存导图');
      return true;
    } catch (error) {
      updateStatus(toUserMessage(error));
      return false;
    }
  }

  async function handleSaveAs() {
    try {
      const savedPath = await saveMindMapFileAs(mindMap);
      if (!savedPath) {
        return;
      }

      setFilePath(savedPath);
      setDirty(false);
      updateStatus('已另存为导图');
    } catch (error) {
      updateStatus(toUserMessage(error));
    }
  }

  function handleToggleCollapse(nodeId: string) {
    updateDocument(toggleNodeCollapsed(mindMap, nodeId));
  }

  function handleNoteChange(note: string) {
    updateDocument(updateNodeNote(mindMap, selectedNode.id, note));
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    event.stopPropagation();

    const sourceId = dragSourceId;
    setDragSourceId(null);
    if (!sourceId) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const position = ratio < 0.33 ? 'before' : ratio > 0.66 ? 'after' : 'inside';

    try {
      updateDocument(moveNode(mindMap, sourceId, targetId, position));
      setSelectedId(sourceId);
      updateStatus(position === 'inside' ? '已移动为子节点' : '已调整节点顺序');
    } catch (error) {
      updateStatus(toUserMessage(error));
    }
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
    );
  }

  function handleCanvasPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    panningRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const nextZoom = clamp(mindMap.viewport.zoom + (event.deltaY > 0 ? -zoomStep : zoomStep), minZoom, maxZoom);
    updateDocument(updateViewport(mindMap, { ...mindMap.viewport, zoom: nextZoom }));
  }

  function handleZoom(delta: number) {
    updateDocument(
      updateViewport(mindMap, {
        ...mindMap.viewport,
        zoom: clamp(mindMap.viewport.zoom + delta, minZoom, maxZoom),
      }),
    );
  }

  return (
    <div className="app-shell">
      <header className="toolbar">
        <div>
          <h1>XZY Arbor</h1>
          <p>{title}</p>
        </div>
        <div className="toolbar-actions">
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
              return (
                <div
                  key={node.id}
                  className={`mindmap-node${selected ? ' selected' : ''}${node.id === ROOT_ID ? ' root' : ''}`}
                  style={{
                    left: layoutNode.x,
                    top: layoutNode.y,
                    width: layoutNode.width,
                    height: layoutNode.height,
                  }}
                  draggable={node.id !== ROOT_ID}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(node.id);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    startEditing(node);
                  }}
                  onDragStart={(event) => {
                    setDragSourceId(node.id);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', node.id);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, node.id)}
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
    </div>
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
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
