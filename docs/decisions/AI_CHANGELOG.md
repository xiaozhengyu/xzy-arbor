# AI 变更日志

## 2026-06-29

- 新增轻量导图产品设计，以及 `docs/spec/lightweight-mindmap` 需求、接口、实施三件套。
- 实现 Tauri + React + TypeScript 的 Windows 桌面 MVP 骨架。
- 新增固定右向树编辑、键盘创建节点、删除、拖拽移动、折叠/展开、备注、视图状态，以及 JSON 文件打开/保存接入。
- 新增树操作和文档校验的聚焦单元测试。
- 已验证 `npm test`、`npm run build`、`npm audit` 和 `npm run tauri -- build`；Windows MSI 与 NSIS 安装包生成成功。
