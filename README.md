# XZY Arbor

XZY Arbor 是一个轻量级右侧导图桌面应用，用于替代较重的 MindManager 基础导图场景。第一版专注固定右向树结构：中心主题在左侧，所有分支向右展开。

## 功能

- 固定右向树导图布局
- 节点创建、重命名、删除
- 键盘操作：`Enter` 新建同级节点，`Tab` 新建子节点，`Delete` 删除节点
- 拖拽调整同级顺序或移动到其他父节点下
- 分支折叠与展开
- 节点纯文本备注
- 画布平移与缩放
- JSON 文件保存、另存为和打开
- 未保存更改提示

## 技术栈

- Tauri 2
- React 19
- TypeScript
- Vite
- Vitest

## 环境要求

- Node.js 22+
- npm 10+
- Rust/Cargo
- Windows WebView2 Runtime

如果当前 shell 找不到 `cargo`，可以先确认 Rust 默认安装目录是否在 PATH 中。Windows 默认路径通常是：

```bash
/c/Users/14158/.cargo/bin
```

## 安装依赖

```bash
npm install
```

## 本地开发

运行前端开发服务器：

```bash
npm run dev
```

运行 Tauri 桌面开发模式：

```bash
npm run tauri -- dev
```

如果 `cargo` 未加入当前 bash 的 PATH，可以临时运行：

```bash
PATH="/c/Users/14158/.cargo/bin:$PATH" npm run tauri -- dev
```

## 构建

构建前端：

```bash
npm run build
```

构建 Windows 桌面安装包：

```bash
npm run tauri -- build
```

临时指定 Rust PATH：

```bash
PATH="/c/Users/14158/.cargo/bin:$PATH" npm run tauri -- build
```

构建成功后，安装包会生成在：

```text
src-tauri/target/release/bundle/
```

## 测试

运行单元测试：

```bash
npm test
```

检查依赖漏洞：

```bash
npm audit
```

## 文档

- 产品设计：`docs/superpowers/specs/2026-06-29-lightweight-mindmap-design.md`
- 需求规格：`docs/spec/lightweight-mindmap/01_requirement.md`
- 接口契约：`docs/spec/lightweight-mindmap/02_interface.md`
- 实施方案：`docs/spec/lightweight-mindmap/03_implementation.md`
- 变更审计：`docs/decisions/AI_CHANGELOG.md`

## 文件格式

导图保存为 JSON 文件，结构示例：

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

第一版不保存节点坐标，导图布局由树结构和折叠状态实时计算。

## 非目标

第一版暂不支持：

- 自由画布
- 图片、SVG、Markdown 导出
- 云同步或多人协作
- 多标签页
- 主题样式、图标、附件和富文本备注
- macOS 或 Linux 打包
