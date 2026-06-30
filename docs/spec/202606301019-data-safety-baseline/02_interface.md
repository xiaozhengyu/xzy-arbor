# 数据安全最小闭环接口契约

## 文档格式

本轮不改变导图文件格式。保存到磁盘的 JSON 仍使用 MVP 的 `version: 1` 结构。

```json
{
  "version": 1,
  "root": {
    "id": "root",
    "text": "中心主题",
    "note": "",
    "collapsed": false,
    "children": []
  },
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  }
}
```

撤销 / 重做历史、确认弹窗状态和错误提示都是运行期 UI 状态，不写入导图 JSON 文件。

## 历史状态模型

```ts
type HistoryState = {
  past: MindMapDocument[];
  present: MindMapDocument;
  future: MindMapDocument[];
};
```

- `past` 保存可撤销的历史文档快照，最多 50 条。
- `present` 是当前正在编辑的导图文档。
- `future` 保存可重做的历史文档快照。
- 新的可记录编辑操作会把当前 `present` 推入 `past`，把新文档设为 `present`，并清空 `future`。
- 撤销会把当前 `present` 推入 `future`，并从 `past` 取出最近文档作为新的 `present`。
- 重做会把当前 `present` 推入 `past`，并从 `future` 取出最近文档作为新的 `present`。
- 历史栈只保存 `MindMapDocument`，不保存弹窗、文件路径、状态栏文本或拖拽过程状态。

## 可记录操作

以下操作必须通过统一的文档更新入口进入历史：

- `addSiblingAfter`
- `addChild`
- `deleteNode`
- `moveNode`
- `updateNodeText`
- `updateNodeNote`
- `toggleNodeCollapsed`

以下操作不进入历史：

- `updateViewport`
- 选择节点。
- 开始或取消编辑节点文本。
- 显示或隐藏备注面板。
- 文件打开成功后替换整个文档。
- 保存成功后更新文件路径或未保存状态。
- 新建空白导图。

## 撤销 / 重做 UI 契约

工具栏新增两个按钮：

- `撤销`：当 `past.length === 0` 时禁用。
- `重做`：当 `future.length === 0` 时禁用。

快捷键作为辅助入口：

- `Ctrl+Z`：撤销。
- `Ctrl+Y`：重做。
- `Ctrl+Shift+Z`：重做。

快捷键在以下场景不触发全局撤销 / 重做：

- 节点文本输入框正在编辑。
- 备注 `textarea` 获得焦点。
- 其他文本输入控件获得焦点。

状态栏提示建议：

- 撤销成功：`已撤销上一步操作`。
- 重做成功：`已重做上一步操作`。
- 没有可撤销操作：按钮禁用，不需要额外提示。
- 没有可重做操作：按钮禁用，不需要额外提示。

## 保存确认对话框契约

```ts
type PendingDocumentAction = 'new' | 'open' | 'close';

type UnsavedDecision = 'save' | 'discard' | 'cancel';

type UnsavedChangesDialogState = {
  action: PendingDocumentAction;
  open: boolean;
};
```

对话框显示文案：

- 标题：`当前导图有未保存更改`
- 说明：`继续操作前，请选择保存当前导图、放弃更改或取消操作。`
- 主按钮：`保存`
- 次按钮：`放弃更改`
- 取消按钮：`取消`

行为契约：

- `save`：调用当前保存流程。保存成功后继续执行挂起动作；保存失败或用户取消保存路径选择时，对话框关闭并保留当前导图。
- `discard`：直接继续执行挂起动作，不保存当前更改。
- `cancel`：关闭对话框，不执行挂起动作。
- 如果当前没有未保存更改，不显示对话框，直接执行目标动作。

## 新建、打开、关闭流程

### 新建

- 无未保存更改：直接创建默认文档。
- 有未保存更改：先打开确认对话框。
- 保存成功或放弃更改后：创建默认文档，清空文件路径，清空历史记录，选中根节点。
- 取消或保存失败后：当前文档、文件路径、历史记录和未保存状态保持不变。

### 打开

- 无未保存更改：直接打开文件对话框。
- 有未保存更改：先打开确认对话框。
- 保存成功或放弃更改后：打开文件对话框并读取所选文件。
- 打开成功后：替换当前文档，设置文件路径，清空历史记录，选中根节点，未保存状态为 false。
- 打开取消后：当前文档保持不变。
- 打开失败后：当前文档、文件路径、历史记录和未保存状态保持不变。

### 关闭

- 无未保存更改：允许关闭应用。
- 有未保存更改：阻止默认关闭行为并显示确认对话框。
- 保存成功或放弃更改后：继续关闭应用。
- 取消或保存失败后：保持应用打开。

## 文件错误提示契约

打开文件错误映射为以下用户提示：

- `INVALID_JSON`：`所选文件不是有效的 JSON，当前导图未被替换。`
- `UNSUPPORTED_VERSION`：`所选导图版本暂不支持，当前导图未被替换。`
- `INVALID_DOCUMENT`：`所选文件不是合法的 XZY Arbor 导图，当前导图未被替换。`
- `READ_FAILED`：`读取文件失败，当前导图未被替换。`

保存错误映射为以下用户提示：

- `WRITE_FAILED`：`保存失败，当前导图仍有未保存更改。`
- 其他错误：`保存失败，当前导图仍有未保存更改。`

## 窗口标题契约

```ts
type DocumentTitleState = {
  filePath: string | null;
  dirty: boolean;
};
```

标题生成规则：

- `filePath === null && dirty === false`：`XZY Arbor - 未命名导图`
- `filePath === null && dirty === true`：`XZY Arbor - *未命名导图`
- `filePath !== null && dirty === false`：`XZY Arbor - <文件名>`
- `filePath !== null && dirty === true`：`XZY Arbor - *<文件名>`

应用内工具栏可以继续只显示文件名部分，但未保存标记必须与系统窗口标题一致。

## SQL 影响

本功能不涉及 SQL、数据库表结构、索引、迁移脚本或初始化脚本变更。
