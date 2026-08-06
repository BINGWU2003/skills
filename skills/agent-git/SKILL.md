---
name: agent-git
description: 在 Git 仓库中修改代码时使用：通过 Agent-Git CLI 执行 checkpoint、status、undo 和 squash 工作流。
---

# Agent-Git

当你在 Git 仓库中修改代码，且用户没有明确禁用 checkpoint 工作流时，使用本 Skill。

Agent-Git 通过以下方式帮助 AI 编程助手安全管理 Git 历史：修改前创建临时 checkpoint，必要时查看仓库状态，失败或用户要求撤销时回滚，完成后把连续 checkpoint 和未提交变更压缩成一个整洁的正式提交。

## 运行方式

本 Skill 只允许通过 Agent-Git CLI 执行 Git 工作流，不要调用 MCP tools。

CLI 命令与 Agent-Git MCP tools 使用相同的业务语义，但本 Skill 的运行时入口始终是 CLI：

| MCP tool 语义 | CLI 命令 |
| --- | --- |
| `agent-git_status` | `agent-git status` |
| `agent-git_save` | `agent-git save` |
| `agent-git_undo` | `agent-git undo` |
| `agent-git_squash` | `agent-git squash` |

使用方式：

```sh
npx -y @agent-git/cli@latest status --workspace PATH
npx -y @agent-git/cli@latest save --workspace PATH --message "准备修改代码"
npx -y @agent-git/cli@latest undo --workspace PATH --steps 1
npx -y @agent-git/cli@latest squash --workspace PATH --summary "feat: 完成某项能力" --preview
npx -y @agent-git/cli@latest squash --workspace PATH --summary "feat: 完成某项能力"
```

`PATH` 必须是 Git 仓库根目录路径，优先使用绝对路径。不要把普通目录、子目录或用户主目录误当作 workspace。

## 命令语义

### `status`

查看当前 Git 状态快照：分支、工作区变更、待合并的 AI Checkpoint 数量及最近提交记录。在执行 agent-git_save / agent-git_squash 前调用，可帮助 AI 了解当前状态。

在以下场景调用：

- 创建 checkpoint 前不确定仓库状态。
- squash 前需要确认待合并 checkpoint 和未提交变更。
- 用户询问当前 Git 状态。

### `save`

在进行代码修改前，强制调用此工具进行 Git 碎片存档（Checkpoint）。

参数：

- `--workspace PATH`：Git 仓库根目录，建议绝对路径。
- `--message "..."`：checkpoint 备注，简述接下来要修改的内容。

使用规则：

- 修改代码前调用，不要等修改后才补 checkpoint。
- message 描述“接下来要做什么”，不是最终完成结果。
- 如果同一个编辑阶段已经创建 checkpoint，且还没有新的、有意义的变更，不要重复创建。

### `undo`

代码修改失败、报错，或用户要求撤销时，调用此工具将代码回滚。支持多步回滚。

参数：

- `--workspace PATH`：Git 仓库根目录，建议绝对路径。
- `--steps <number>`：回滚步数，默认 `1`。填 `2` 表示撤销最近两次，以此类推。

使用规则：

- 只在明确需要丢弃修改时调用。
- 用户只是要求解释问题、继续修复或查看状态时，不要主动 undo。
- 多步回滚前应先确认要丢弃的范围，必要时先执行 `status`。

### `squash`

当整个需求或一个阶段的任务全部完成后，调用此工具。它会自动识别并把之前产生的所有连续 AI Checkpoint 碎片提交，以及当前工作区未提交的变更，一起压缩合并成一个正式的、整洁的 Git 提交记录。建议先用 preview: true 预览，确认后再正式执行。

参数：

- `--workspace PATH`：Git 仓库根目录，建议绝对路径。
- `--summary "..."`：正式提交摘要，建议使用常规 commit message 格式。
- `--preview`：只预览将被合并的 checkpoint 和未提交变更，不创建正式提交。

使用规则：

- 正式 squash 前必须先执行 `--preview`。
- 预览内容正确后，再使用同一个 summary 去掉 `--preview` 正式执行。
- 如果没有清晰的提交摘要，不要执行正式 squash，先根据完成内容拟定或询问用户。
- 如果预览显示没有 checkpoint 且没有未提交变更，当前 Git 历史已经整洁，不需要继续 squash。

## 禁止事项

- 不要调用 `agent-git_status`、`agent-git_save`、`agent-git_undo`、`agent-git_squash` 等 MCP tools。
- 不要混用 MCP 和 CLI，同一个工作流步骤只能通过 CLI 执行。
- 不要手写 Git 命令替代 Agent-Git CLI，除非用户明确要求绕过 Agent-Git。

## 工作流

1. 确认当前目录属于 Git 仓库，并确定仓库根目录 `PATH`。
2. 修改代码前，如有必要先执行 `status` 查看状态。
3. 创建 checkpoint：`save --message "准备..."`。
4. 执行用户要求的代码修改。
5. 如果修改失败、出现严重错误，或用户要求撤销，使用 `undo` 回滚最近 checkpoint。
6. 当整个任务或一个清晰阶段完成后，执行 `squash --preview`。
7. 如果预览内容正确，执行不带 `--preview` 的 `squash` 创建正式 commit。

## 触发时机

- 修改代码前：优先创建 checkpoint。
- 执行风险较高的大改动前：创建 checkpoint。
- 用户要求查看 Git 状态：执行 `status`。
- 修改失败且需要丢弃变更：执行 `undo`。
- 任务完成且需要整理历史：先预览再正式 `squash`。

## 规则

- 不要在 Skill 中复制 Git 业务逻辑，必须通过 Agent-Git CLI 执行。
- 同一个编辑阶段不要重复创建多个 checkpoint，除非已经产生新的、有意义的变更。
- 不要在缺少清晰提交摘要时执行正式 squash。
- 正式 squash 前，必须先执行 `agent-git squash --preview` 预览。
- 回滚是破坏性操作，只在确实要丢弃修改时使用 undo。
- 如果 CLI 不可用，说明 Agent-Git CLI 不可用，并询问用户下一步怎么处理。

## 示例流程

修改前保存：

```sh
npx -y @agent-git/cli@latest status --workspace PATH
npx -y @agent-git/cli@latest save --workspace PATH --message "准备重构订单提交流程"
```

失败后回滚最近一步：

```sh
npx -y @agent-git/cli@latest undo --workspace PATH --steps 1
```

完成后先预览，再正式 squash：

```sh
npx -y @agent-git/cli@latest squash --workspace PATH --summary "feat: 重构订单提交流程" --preview
npx -y @agent-git/cli@latest squash --workspace PATH --summary "feat: 重构订单提交流程"
```

## 消息建议

checkpoint message 应描述“接下来要做什么”：

```txt
新增 Agent-Git CLI 和 Skill 适配包
```

squash summary 应使用正式 commit message：

```txt
feat: add Agent-Git CLI and skill adapters
```
