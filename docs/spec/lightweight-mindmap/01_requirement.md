# Lightweight Mindmap Requirement

## Background

Users frequently create right-oriented mind maps in MindManager, but MindManager is heavier than needed for simple diagrams. This feature provides a lightweight Windows desktop app focused on fixed right-oriented tree mind maps.

## Goals

- Provide a Windows desktop mind map application.
- Support fixed right-oriented tree layout with the root topic on the left and all branches expanding to the right.
- Support node creation, editing, deletion, drag-based structure changes, collapse/expand, notes, local save, and local open.
- Store documents as JSON files.

## In Scope

- Tauri + React + TypeScript desktop application.
- Keyboard operations: `Enter` for sibling node, `Tab` for child node, `Delete` for removing a selected non-root node.
- Node text editing through double click or direct typing.
- Dragging nodes to reorder siblings or move under another parent.
- Collapse and expand per branch.
- Plain text notes per node.
- Canvas panning and zooming.
- JSON save, save-as, open, and new document flows.
- Unsaved-change prompts before destructive document actions.

## Out of Scope

- Freeform canvas positioning.
- Image, SVG, Markdown, or other export formats.
- Cloud sync, collaboration, user accounts, or multi-tab editing.
- Themes, icons, attachments, rich-text notes, or plugin support.
- macOS or Linux packaging.
- SQL schema, migrations, or initialization scripts.

## Acceptance Criteria

- The app can run as a Windows desktop app when Tauri prerequisites are installed.
- Users can create, rename, delete, and drag nodes in a fixed right-oriented tree.
- Users can collapse and expand branches.
- Users can edit plain text notes for selected nodes.
- Users can save a mind map to JSON and open it again.
- Reopened files restore node text, hierarchy, notes, collapse state, and viewport.
- Invalid JSON, unsupported versions, read failures, write failures, and unsaved-close flows show clear user-facing messages.
