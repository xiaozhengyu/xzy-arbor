# Lightweight Mindmap Implementation

## Module Boundary

This feature introduces a new desktop app in the repository. It does not modify existing business modules because the repository is currently a new project.

## Implementation Steps

1. Create a Tauri + React + TypeScript project scaffold.
2. Add shared mind map document types and validation helpers.
3. Implement pure tree operations for create, delete, move, text update, note update, and collapse toggling.
4. Implement right-oriented tree layout from the current visible tree.
5. Build the React UI: toolbar, canvas, node rendering, and notes panel.
6. Wire keyboard shortcuts and drag interactions.
7. Wire Tauri file open, save, save-as, and close-before-save flows.
8. Add focused unit tests for tree operations and document validation.
9. Update `docs/decisions/AI_CHANGELOG.md` with the implementation summary.

## Files To Add

- `package.json`
- `index.html`
- `tsconfig*.json`
- `vite.config.ts`
- `src/**`
- `src-tauri/**`
- `docs/decisions/AI_CHANGELOG.md`

## Implementation Constraints

- Keep tree mutations in pure functions rather than React components.
- Do not save layout coordinates in JSON; compute layout from tree structure and collapse state.
- Keep notes as plain text.
- Keep first-version file format at `version: 1`.
- Do not introduce SQL or backend services.
- Do not add export formats in this iteration.

## Validation Plan

- Run TypeScript type check.
- Run unit tests for tree operations and validation.
- If Rust/Tauri toolchain is installed, run Tauri build or dev validation.
- Manually verify Windows desktop behavior after Rust/Tauri prerequisites are available.
