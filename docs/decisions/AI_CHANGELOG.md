# AI Changelog

## 2026-06-29

- Added lightweight mind map product design and `docs/spec/lightweight-mindmap` requirement/interface/implementation specs.
- Implemented a Tauri + React + TypeScript Windows desktop MVP scaffold.
- Added fixed right-oriented tree editing, keyboard node creation, deletion, drag-based moves, collapse/expand, notes, viewport state, and JSON file open/save wiring.
- Added focused unit tests for tree operations and document validation.
- Verified `npm test`, `npm run build`, `npm audit`, and `npm run tauri -- build`; Windows MSI and NSIS installers were generated successfully.
