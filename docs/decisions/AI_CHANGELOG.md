# AI 变更日志

## 2026-06-30

- 新增 `docs/spec/202606301019-data-safety-baseline` 规格三件套，明确 P0-A 数据安全最小闭环的撤销/重做、按钮式保存确认、坏文件保护和窗口标题状态方案。
- 本次仅新增规格文档，未修改运行时代码；因此未执行 `npm test` 或 `npm run build`。

## 2026-06-29

- 新增轻量导图产品设计，以及 `docs/spec/lightweight-mindmap` 需求、接口、实施三件套。
- 实现 Tauri + React + TypeScript 的 Windows 桌面 MVP 骨架。
- 新增固定右向树编辑、键盘创建节点、删除、拖拽移动、折叠/展开、备注、视图状态，以及 JSON 文件打开/保存接入。
- 新增树操作和文档校验的聚焦单元测试。
- 已验证 `npm test`、`npm run build`、`npm audit` 和 `npm run tauri -- build`；Windows MSI 与 NSIS 安装包生成成功。
- 修复 release 版保存/打开 JSON 文件所需的 Tauri fs 读写权限，确保文件对话框授权路径可被 `readTextFile` 和 `writeTextFile` 使用。
- 将节点拖拽从原生 HTML5 drag/drop 改为指针驱动交互，补充目标高亮，提升 Tauri/WebView 中调整层级和顺序的稳定性。
