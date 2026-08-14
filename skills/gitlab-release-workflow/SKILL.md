---
name: gitlab-release-workflow
description: 编排 GitLab MR 创建或更新、描述校验、源分支保留、detached MR 流水线确认、流水线成功后自动合并、有限状态等待、手动部署授权和发布验收。用户要求提交或合并 MR、等待流水线、发布到环境、检查部署结果或生成发布交付证据时使用；通过 glab 操作 GitLab，并使用 gitlab-url-guard 构造和校验所有交付链接。
---

# GitLab 发布工作流

编排从 MR 创建或更新到流水线、合并、部署验收和最终交付的完整流程。将 MR 合并与环境部署视为两个独立动作，并使用 `gitlab-url-guard` 处理所有 GitLab URL。

## 依赖与协作能力

### 核心运行依赖

- 使用 `git` 检查仓库、分支、提交和差异。
- 使用已完成认证的 `glab` CLI 创建、更新、查询、评论及合并 MR，并读取流水线和 Job 状态；先执行 `glab auth status`。
- 使用 `gitlab-url-guard` 规范化、构造和校验所有 GitLab 链接。

缺少 `glab` 时，不得声称已完成 GitLab 写入、状态查询、合并或部署操作。缺少 `gitlab-url-guard` 或其项目配置时，先完成初始化和校验，不得跳过 URL 校验。

### 推荐搭配的 Skill

仅在当前环境可用且任务涉及对应阶段时加载；不得自动安装缺失的 Skill，除非用户明确要求。

| Skill                   | 使用阶段              | 职责边界                                               |
| ----------------------- | --------------------- | ------------------------------------------------------ |
| `glab`                  | 所有 GitLab 操作      | 创建、更新、查询、评论及合并 MR；读取流水线和 Job 状态 |
| `gitlab-mr-description` | 创建或更新 MR 前      | 根据分支差异生成结构化描述                             |
| `gitlab-url-guard`      | MR 写入前后及最终交付 | 校验 GitLab URL，并从资源 ID 构造规范链接              |

缺少推荐 Skill 时，使用可用 CLI 完成对应步骤，但不得跳过 `gitlab-url-guard` 的 URL 校验。

## 能力探测

开始工作前：

1. 检查当前可用 Skill，仅加载与当前阶段有关的协作 Skill。
2. 执行 `glab auth status`。
3. 使用 `git remote -v` 确认目标项目和 GitLab 实例。
4. 确认 `gitlab-url-guard.json` 存在且其中的 `projectUrl` 正确。
5. 不使用 GitLab API 返回的 `web_url` 作为最终交付链接。

## URL 校验契约

所有 MR 描述、评论、发布说明和最终交付文本必须使用 `gitlab-url-guard` 规范化并校验：

1. GitLab 写入前执行 `normalize` 和 `validate`。
2. `validate` 返回非零状态时停止写入、评论、合并和发布通知。
3. GitLab 写入后回读实际内容，保存到仓库外临时文件并再次执行 `validate`。
4. 最终 MR、流水线、Job 和提交链接只使用资源 ID 调用 `gitlab-url-guard` 构造。

## 创建或更新 MR

1. 使用 `git` 检查目标分支、提交和差异。
2. 如果可用，使用 `gitlab-mr-description` 生成描述文件。
3. 使用 `gitlab-url-guard` 规范化并严格校验描述文件。
4. 校验通过后，按照 `glab` Skill 的约束执行 `glab mr create` 或 `glab mr update`；创建 MR 时显式传入 `--remove-source-branch=false`。
5. 使用 `glab mr view <iid> -F json` 回读实际描述。
6. 将实际描述保存到仓库外临时文件，并使用 `gitlab-url-guard` 再次执行严格校验。
7. 使用资源 IID 调用 `gitlab-url-guard` 的 `url mr <iid>` 生成最终 MR 链接。

## 保留源分支

MR 合并后默认保留源分支，除非用户明确要求删除：

1. 创建 MR 时使用 `--remove-source-branch=false`，不要依赖项目默认值。
2. 对已有 MR，在登记 Auto-merge 前显式关闭删除选项：

   ```powershell
   glab api --method PUT `
     'projects/<url-encoded-project>/merge_requests/<iid>' `
     -f 'remove_source_branch=false'
   ```

3. 回读 MR，确认 `should_remove_source_branch` 和 `force_remove_source_branch` 都不是 `true`。
4. 执行 `glab mr merge` 时不传 `--remove-source-branch`。
5. 若项目策略导致 `force_remove_source_branch=true`，停止登记 Auto-merge 并报告策略冲突；不得声称源分支会被保留。

## 登记自动合并

用户要求“提交 MR 并合并”或“流水线通过后合并”时，默认把等待委托给 GitLab Auto-merge，不由 Agent 持续轮询：

1. 回读 MR，确认源分支、目标分支、当前 `head-sha` 和 detached MR 流水线 SHA 一致。
   - 目标分支为 `test` 或 `main` 时都必须先创建 detached MR 流水线，不得跳过 `main` 的合并前检查。
   - MR 刚创建且 `head_pipeline` 尚未出现时，只为等待流水线挂载做短轮询：每 10 秒回读一次，最多 60 秒。
   - 该短轮询只确认流水线存在，不等待流水线执行完成。
   - 超时后仍无 detached 流水线，或流水线 SHA 与 MR SHA 不一致时，停止登记 Auto-merge 并报告当前状态。
2. 根据 detached MR 流水线状态执行：
   - `created`、`preparing`、`pending`、`running` 或 `waiting_for_resource`：使用 Merge API 显式设置“流水线成功后合并”。当前项目的 GitLab 13.10 使用 `merge_when_pipeline_succeeds=true`：

     ```powershell
     glab api --method PUT `
       'projects/<url-encoded-project>/merge_requests/<iid>/merge' `
       -f 'merge_when_pipeline_succeeds=true' `
       -f 'sha=<head-sha>'
     ```

   - `success`：流水线已经完成，可以使用 `glab mr merge <iid> -R <project> --auto-merge=false --sha <head-sha> --yes` 立即合并。
   - `failed`、`canceled`、`skipped`、`manual` 或 `blocked`：停止，不登记自动合并，也不直接合并。

   流水线未成功时，不使用 `glab mr merge --auto-merge`。不同 GitLab 与 `glab` 版本对该参数的兼容行为不同，可能在项目未启用强制流水线门禁时直接合并 MR。

3. 再回读 MR 和 detached 流水线，确认源分支不会被删除、MR SHA 仍等于登记时的 `head-sha`，并按调用前状态验收：
   - 调用前流水线正在运行：MR 保持 `opened` 且 `merge_when_pipeline_succeeds=true`，才视为登记成功。
   - 若登记调用期间流水线恰好成功并触发合并：只有同 SHA detached 流水线已为 `success`，才视为成功。
   - MR 已合并但同 SHA detached 流水线仍未成功：判定流程违规并报告，不得声称 Auto-merge 登记成功。
   - 调用前流水线已经成功：MR 状态为 `merged` 才视为合并成功。
4. 使用 `gitlab-url-guard` 构造 MR 和流水线链接：等待中的 MR 报告“已开启流水线成功后自动合并”；流水线已成功并完成合并时报告“流水线已成功，MR 已合并”。然后结束当前 Agent 任务。

登记 Auto-merge 后不要启动额外的持续监控。GitLab 负责等待 detached MR 流水线；流水线失败时不会合并。登记后的新提交会改变 MR SHA，必须重新回读并以新 SHA 重新确认合并策略，不得沿用旧的登记结果。

仅在以下情况进入同步等待流程：

- 用户明确要求“等到合并完成”“同步等待”或同等语义；
- GitLab 项目或当前 MR 无法启用 Auto-merge；
- 用户要求流水线失败后立即诊断。

## 按需同步等待

用户明确要求同步等待时，仅使用 `glab mr view` 或 `glab api` 做有限状态查询：每 20 秒查询一次，最多 30 分钟。

- `success`：使用 `glab mr merge --sha <head-sha>` 合并，再验证目标分支包含该提交。
- `failed`：停止等待并查询失败 Job；只有用户要求修复时才进入诊断和修改流程。
- `manual`、`skipped` 或 `blocked`：报告人工操作状态和规范链接后结束。
- 存在冲突：停止等待并处理或报告冲突。
- 超时或状态未知：复核一次 MR、流水线和 Job 状态后结束。

不要自动开始新的查询周期。只有新提交、新流水线或用户明确要求继续等待时，才重新查询。

明确要求同步等待时，只使用 `glab` 做有限状态查询；不要加载其他流水线监控 Skill。

## 部署授权边界

MR 合并与环境部署是两个独立动作：

- 用户只要求创建、检查或合并 MR 时，不触发手动部署 Job。
- 用户明确要求发布到对应环境时，才可触发该环境的手动部署 Job。
- 发现 `manual`、`blocked`、`scheduled` 或等待审批的 Job 时，报告 Job 名称和规范链接后结束，不持续查询。
- 任务涉及部署验收时，不只看流水线顶层状态；使用 `glab api 'projects/<url-encoded-project>/pipelines/<pipeline-id>/jobs?include_retried=true&per_page=100'` 查询对应部署 Job。
- 只有对应部署 Job 成功后，才报告环境部署完成。

默认顺序：`gitlab-mr-description` → `gitlab-url-guard` → `glab` 创建 MR → `glab` 登记 Auto-merge → `gitlab-url-guard` 生成交付链接。
