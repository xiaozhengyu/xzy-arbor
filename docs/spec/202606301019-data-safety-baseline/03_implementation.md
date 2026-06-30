# 数据安全最小闭环实施方案

## 模块边界

本轮功能主要影响前端应用状态、UI 交互和少量 Tauri 窗口标题调用。

建议保持以下边界：

- `src/lib/tree.ts` 继续只负责纯树操作和文档校验。
- 新增历史管理纯逻辑，避免把撤销 / 重做细节散落在 `App.tsx` 中。
- 文件读写仍由 `src/lib/fileStorage.ts` 包装。
- 按钮式确认弹窗作为轻量 React UI，不引入额外弹窗依赖。
- Tauri shell 不新增后端命令，只复用现有窗口 API。

## 建议新增或调整文件

- `src/lib/history.ts`：新增撤销 / 重做历史管理纯函数。
- `src/lib/history.test.ts`：覆盖历史入栈、上限、撤销、重做和新操作清空重做栈。
- `src/App.tsx`：接入历史状态、确认弹窗、窗口标题同步和更具体的错误提示。
- `src/styles/app.css`：补充确认弹窗和撤销 / 重做按钮禁用态样式。
- `docs/decisions/AI_CHANGELOG.md`：实现后记录行为变化和验证结果。

如果实现时 `App.tsx` 继续膨胀明显，可以只顺手拆出一个小型确认弹窗组件，例如 `src/components/UnsavedChangesDialog.tsx`。不要在本轮做大规模组件重构。

## 实施步骤

### 1. 实现历史管理纯函数

新增 `HistoryState` 和以下操作：

- `createHistory(initialDocument)`
- `recordHistory(history, nextDocument)`
- `undoHistory(history)`
- `redoHistory(history)`
- `replaceHistoryPresent(history, document)`
- `resetHistory(document)`

约束：

- `past` 最多保留 50 条。
- 记录新操作时清空 `future`。
- 如果 `nextDocument` 与当前 `present` 是同一个引用，可以不重复记录。
- 文件打开、新建和保存不作为可撤销操作。

### 2. 接入 `App.tsx` 文档状态

将当前单独的 `mindMap` 状态调整为由历史状态承载当前文档：

- 当前文档来自 `history.present`。
- 现有 `mindMapRef` 同步当前 `history.present`。
- 原有会修改导图内容和结构的 `updateDocument` 改为记录历史。
- 视图平移和缩放使用不记录历史的更新入口。
- 打开文件和新建文件使用重置历史的更新入口。

需要检查的现有入口：

- `Enter` 新增同级节点。
- `Tab` 新增子节点。
- `Delete` 删除节点。
- 拖拽移动节点。
- 双击或直接输入后的节点文本提交。
- 备注输入。
- 折叠 / 展开。
- 画布平移。
- 滚轮缩放。
- 缩放按钮。

### 3. 增加撤销 / 重做入口

工具栏增加可点击按钮：

- `撤销`
- `重做`

按钮禁用规则：

- `past.length === 0` 禁用撤销。
- `future.length === 0` 禁用重做。

键盘入口：

- 在现有 `keydown` 监听中优先处理 `Ctrl+Z`、`Ctrl+Y`、`Ctrl+Shift+Z`。
- 当焦点位于 `INPUT` 或 `TEXTAREA` 时，不拦截这些快捷键。
- 撤销 / 重做后设置 `dirty = true`。
- 撤销 / 重做后如果当前选中节点已不存在，应回退选中根节点。

### 4. 替换未保存确认流程

用 React 状态替代 `window.prompt`：

- `pendingAction` 保存当前待执行动作。
- `confirmReplaceDocument` 不再直接返回 prompt 结果，而是在有未保存更改时打开确认弹窗。
- 新建、打开、关闭三个入口复用同一套确认逻辑。

推荐结构：

- `requestDocumentAction(action)`：如果有未保存更改则打开弹窗，否则直接执行。
- `runDocumentAction(action)`：实际执行新建、打开或关闭。
- `handleUnsavedDecision(decision)`：处理保存、放弃或取消。

关闭应用注意事项：

- Tauri `onCloseRequested` 中调用 `event.preventDefault()` 后设置待关闭动作。
- 用户选择保存且保存成功后，再调用 `getCurrentWindow().close()`。
- 为避免二次拦截关闭，可以在真正关闭前临时清除 dirty 引用或设置关闭确认已通过标记。

### 5. 增强打开和保存错误提示

调整错误映射函数，使打开文件和保存文件可以使用不同上下文提示：

- 打开失败提示必须包含“当前导图未被替换”。
- 保存失败提示必须包含“当前导图仍有未保存更改”。
- `openMindMapFile` 抛错时，不能修改 `mindMap`、`filePath`、`dirty` 或历史状态。
- `saveMindMapFile` 抛错时，不能清除 `dirty`。

可以保留 `MindMapDocumentError` 的内部错误码，不需要改动 JSON 校验结构。

### 6. 同步窗口标题

基于 `filePath` 和 `dirty` 生成统一标题：

- 应用内工具栏显示文件名部分。
- Tauri 运行时调用 `getCurrentWindow().setTitle(fullTitle)`。
- 非 Tauri 浏览器开发模式下可以设置 `document.title = fullTitle`。

建议用 `useEffect` 监听 `filePath` 和 `dirty`，避免在每个操作入口手动设置标题。

### 7. 补充样式

在 `src/styles/app.css` 中补充：

- 工具栏禁用按钮样式。
- 遮罩层样式。
- 确认弹窗容器样式。
- 弹窗按钮组样式。
- 危险或次要按钮样式。

弹窗应支持鼠标直接点击完成决策，不要求用户输入英文命令。

## 验证计划

### 单元测试

新增 `src/lib/history.test.ts` 覆盖：

- 初始历史不可撤销、不可重做。
- 记录一次操作后可以撤销。
- 撤销后可以重做。
- 撤销后记录新操作会清空重做栈。
- 历史超过 50 步后只保留最近 50 步。
- `resetHistory` 会清空过去和未来历史。
- `replaceHistoryPresent` 不产生可撤销记录。

继续运行现有树操作和文档校验测试，确保纯树逻辑没有回归。

### 构建验证

- 运行 `npm test`。
- 运行 `npm run build`。

### 桌面手动验证

在 Tauri 桌面模式下验证：

- 删除节点后点击撤销，节点恢复。
- 拖拽节点后点击撤销，层级和顺序恢复。
- 撤销后点击重做，变更重新应用。
- 修改备注时撤销 / 重做行为符合预期。
- 有未保存更改时点击新建，三个按钮路径都正确。
- 有未保存更改时点击打开，三个按钮路径都正确。
- 有未保存更改时关闭窗口，三个按钮路径都正确。
- 打开坏 JSON 文件，当前导图不变且提示清楚。
- 保存失败场景如可模拟，应确认导图仍处于未保存状态。
- 打开、保存、修改后，系统窗口标题和应用内标题同步更新。

## 风险与应对

- **备注历史过细**：如果每次输入都进入历史，撤销体验会偏碎。第一版可以先接受，后续再按 blur 或防抖合并；实现时不要为了合并历史引入复杂状态机。
- **关闭确认重复触发**：Tauri close 事件可能在调用 `close()` 时再次进入。用关闭确认通过标记处理，不要依赖延时或绕过事件。
- **App 组件继续变大**：本轮只拆历史纯函数和可选弹窗组件，避免为了 P4 重构扩大范围。
- **dirty 与历史不是同一概念**：撤销回保存时状态不一定等于已保存。第一版可以将撤销 / 重做后标记为未保存，不实现与保存快照的深度比较。

## 不做事项

- 不做自动保存和恢复。
- 不做最近文件列表。
- 不做导出、搜索、复制粘贴或模板。
- 不做命令面板。
- 不升级文件格式版本。
- 不引入数据库或后端服务。
