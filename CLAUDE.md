# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install dependencies: `npm install`
- Run Vite dev server: `npm run dev`
- Run Tauri desktop dev mode: `npm run tauri -- dev`
- Build frontend: `npm run build`
- Build Windows desktop installers: `npm run tauri -- build`
- Run all tests: `npm test`
- Run one test file: `npx vitest run src/lib/tree.test.ts`
- Run dependency audit: `npm audit`

If the bash shell cannot find Cargo on this Windows machine, prefix Tauri commands with the Rust path:

```bash
PATH="/c/Users/14158/.cargo/bin:$PATH" npm run tauri -- dev
PATH="/c/Users/14158/.cargo/bin:$PATH" npm run tauri -- build
```

Tauri build outputs are generated under `src-tauri/target/release/bundle/` and are ignored by git.

## Architecture

XZY Arbor is a Tauri 2 + React 19 + TypeScript desktop app for fixed right-oriented mind maps. The product scope is documented in `docs/spec/202606291633-mvp-version/` and the original design is in `docs/superpowers/specs/2026-06-29-lightweight-mindmap-design.md`.

The frontend owns the mind map editing model and UI:

- `src/App.tsx` coordinates application state, keyboard shortcuts, drag/drop, viewport updates, note editing, unsaved state, and Tauri file actions.
- `src/lib/types.ts` defines the versioned JSON document shape and error codes.
- `src/lib/tree.ts` contains pure tree/document operations: create, add sibling/child, delete, move, update text/note, toggle collapse, viewport update, serialize, parse, and validate.
- `src/lib/layout.ts` computes the visible fixed right-oriented tree layout from the current tree and collapse state. Node coordinates are not persisted.
- `src/lib/fileStorage.ts` wraps Tauri dialog/fs plugins for JSON open, save, and save-as.
- `src/lib/tree.test.ts` covers tree operations and document validation.

The Tauri shell is intentionally thin:

- `src-tauri/src/lib.rs` registers the dialog and filesystem plugins and starts the app.
- `src-tauri/tauri.conf.json` configures the app window, Vite dev/build commands, bundle settings, and icon.
- `src-tauri/capabilities/default.json` grants the desktop permissions used by local JSON file operations.

Mind map files are JSON documents with `version`, `root`, and `viewport`. Each node stores `id`, `text`, `note`, `collapsed`, and `children`; layout positions are recomputed from the tree.

## Project Workflow Notes

- Before behavior changes, check the relevant `docs/spec/<feature>/01_requirement.md`, `02_interface.md`, and `03_implementation.md` for scope and constraints.
- Spec feature directories under `docs/spec/` must use the format `YYYYMMDDHHmm-kebab-case-topic`, for example `202606291633-mvp-version`.
- When code behavior changes, update `docs/decisions/AI_CHANGELOG.md` with the implementation summary and validation performed.
- This project has no SQL/database layer; no migration or init scripts are currently expected.
- There is no lint script configured in `package.json`; use `npm run build`, `npm test`, and `npm audit` for current validation.
