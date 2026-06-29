# 轻量导图接口契约

## 文档格式

导图文件是带版本号的 JSON 文档。

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

## TypeScript 契约

```ts
type MindMapNode = {
  id: string;
  text: string;
  note: string;
  collapsed: boolean;
  children: MindMapNode[];
};

type MindMapDocument = {
  version: 1;
  root: MindMapNode;
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
};
```

## 文件操作

- `newDocument()`：创建默认内存文档。
- `openDocument()`：通过 Tauri 文件对话框打开 JSON 文件，并校验文档结构。
- `saveDocument()`：写入当前文件路径；如果当前没有文件路径，则转为另存为。
- `saveDocumentAs()`：请求用户选择保存路径，并写入当前 JSON 文档。

## 校验规则

- `version` 必须是 `1`。
- `root` 必须是合法节点。
- 节点 `id` 和 `text` 必须是字符串。
- 节点 `note` 必须是字符串。
- 节点 `collapsed` 必须是布尔值。
- 节点 `children` 必须是合法节点数组。
- `viewport.x`、`viewport.y` 和 `viewport.zoom` 必须是有限数字。

## 错误码

UI 将内部错误映射为用户可理解的提示。

- `INVALID_JSON`：所选文件不是可解析的 JSON。
- `UNSUPPORTED_VERSION`：当前应用不支持该文档版本。
- `INVALID_DOCUMENT`：JSON 结构不是合法导图文档。
- `READ_FAILED`：无法读取文件。
- `WRITE_FAILED`：无法写入文件。
- `INVALID_MOVE`：拖拽操作会生成非法树结构。

## SQL 影响

本功能不涉及 SQL、数据库表结构、索引、升级脚本或初始化脚本变更。
