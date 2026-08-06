# 可用 Skills

本目录汇总仓库当前可安装的 Skill。通用安装方法见
[`README.md`](README.md#快速开始)。

| Skill | 用途 |
| --- | --- |
| [`agent-git`](skills/agent-git/) | 使用 checkpoint、status、undo 和 squash 工作流，帮助 Agent 安全管理 Git 修改。 |
| [`drawio-skill`](skills/drawio-skill/) | 创建 Draw.io 图表，并通过桌面版 CLI 导出 PNG、SVG、PDF 或 JPG。 |
| [`excalidraw-diagram`](skills/excalidraw-diagram/) | 根据自然语言创建 Excalidraw 图表，并通过渲染检查迭代优化视觉效果。 |
| [`grill-me`](skills/grill-me/) | 启动一轮深入访谈，系统梳理计划、设计或决策中的关键问题。 |
| [`grilling`](skills/grilling/) | 为 `grill-me` 提供可复用的结构化访谈流程。 |
| [`hello-skills`](skills/hello-skills/) | 验证 Skill 的发现、安装和显式调用流程。 |
| [`weekly-git-report`](skills/weekly-git-report/) | 根据 Git 提交记录生成、整理或保存周报。 |

## 特殊安装与依赖

### `grill-me`

`grill-me` 依赖 `grilling`，安装时需要同时选择两者：

```bash
npx skills add BINGWU2003/skills --skill grill-me grilling
```

### `excalidraw-diagram`

预览渲染器依赖 `uv` 和 Playwright。安装 Skill 后可让 Agent 按随附的
[`README.md`](skills/excalidraw-diagram/README.md#setup) 完成首次配置。

### `drawio-skill`

导出图片时需要安装 draw.io 桌面版，并确保其 CLI 可调用；Graphviz 仅在使用
可选的自动布局功能时需要。
