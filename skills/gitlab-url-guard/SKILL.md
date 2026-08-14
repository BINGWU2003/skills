---
name: gitlab-url-guard
description: 初始化项目级 GitLab Web 地址配置，并规范化、构造和校验 MR 描述、发布说明、评论及交付文本中的 MR、流水线、作业和提交链接。创建、更新或合并 GitLab MR，登记流水线成功后自动合并，使用 glab 进行有限状态查询，识别等待人工部署或审批的状态，生成验收证据，或发现自托管 GitLab 链接遗漏端口、使用裸 !IID、直接采用 API web_url 时使用；配合 glab 和 gitlab-mr-description 形成完整 GitLab 工作流。
---

# GitLab 链接规范化与校验

使用项目根目录 `.codex/gitlab-url-guard.json` 作为唯一可信来源。配置只保存完整项目 Web 地址：

```json
{
  "version": 1,
  "projectUrl": "http://gitlab.example.com:29480/group/project"
}
```

不得从 GitLab API 的 `web_url` 推断基础地址；自托管 GitLab 的返回值可能遗漏端口。

## 依赖与推荐协作能力

### 核心运行依赖

- 使用 `git` 定位仓库根目录、读取 remote 并推断项目地址。
- 使用 Python 3 运行 `scripts/gitlab_url_guard.py`。
- 执行 GitLab MR 读写或回读校验时，使用已完成认证的 `glab` CLI；先执行 `glab auth status`。

缺少 `glab` 时，仍可执行链接构造、规范化和本地校验，但不得声称已完成 GitLab 写入或回读校验。

### 推荐搭配的 Skill

以下能力属于推荐协作能力，不是本 Skill 的硬依赖。仅在当前环境可用且任务涉及对应阶段时加载；不得自动安装缺失的 Skill，除非用户明确要求。

| Skill                   | 使用阶段              | 职责边界                                                |
| ----------------------- | --------------------- | ------------------------------------------------------- |
| `glab`                  | 所有 GitLab 操作      | 创建、更新、查询、评论及合并 MR；读取流水线和 Job 状态  |
| `gitlab-mr-description` | 创建或更新 MR 前      | 根据分支差异生成结构化描述，再交给本 Skill 规范化和校验 |
| `gitlab-url-guard`      | MR 写入前后及最终交付 | 校验 GitLab URL，并从资源 ID 构造规范链接               |

缺少推荐 Skill 时，使用可用 CLI 完成对应步骤，但不得跳过本 Skill 的 URL 校验。

### 能力探测

开始工作前：

1. 检查当前可用 Skill，仅加载与当前阶段有关的协作 Skill。
2. 涉及 MR 写操作时执行 `glab auth status`。
3. 使用 `git remote -v` 确认目标项目和 GitLab 实例。
4. 使用本 Skill 配置中的 `projectUrl` 作为项目 Web 地址的唯一可信来源。
5. 不使用 GitLab API 返回的 `web_url` 作为最终交付链接。

## 首次初始化

1. 先预览推断结果，不写文件：

   ```powershell
   python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py init
   ```

2. 确认地址正确后写入配置：

   ```powershell
   python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py init --write
   ```

初始化优先使用 `--project-url`；否则读取 `--remote`、`origin` 或唯一 Git remote。只有 HTTP(S) remote 才允许自动推断，因为 SSH remote 无法可靠确定 Web 协议和端口：

```powershell
python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py init `
  --project-url 'http://gitlab.example.com:29480/group/project' --write
```

已有配置时禁止覆盖。需要修改时人工编辑并重新校验，不使用强制覆盖选项。

## 基础操作

1. 只从资源 ID 构造链接：

   ```powershell
   python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py url mr 291
   python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py url pipeline 520
   python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py url job 2044
   python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py url commit 1aa816a6
   ```

2. 创建或更新 MR 前，规范化描述文件，再严格校验：

   ```powershell
   python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py normalize `
     --input '<description.md>' --output '<description.md>'

   python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py validate `
     --input '<description.md>'
   ```

3. 校验返回非零状态时，停止 `glab mr create`、`glab mr update`、评论、合并和发布通知等 GitLab 写操作。

4. 写入 MR 后，用 `glab mr view <iid> -F json` 回读实际描述，保存到仓库外临时文件并再次校验。回读校验通过前，不进入合并步骤。

## 推荐工作流

### 创建或更新 MR

1. 使用 `git` 检查目标分支、提交和差异。
2. 如果可用，使用 `gitlab-mr-description` 生成描述文件。
3. 使用本 Skill 规范化并严格校验描述文件。
4. 校验通过后，按照 `glab` Skill 的约束执行 `glab mr create` 或 `glab mr update`；创建 MR 时显式传入 `--remove-source-branch=false`。
5. 使用 `glab mr view <iid> -F json` 回读实际描述。
6. 将实际描述保存到仓库外临时文件，并再次执行严格校验。
7. 使用资源 IID 调用 `url mr <iid>` 生成最终 MR 链接。

### 保留源分支

MR 合并后默认保留源分支，除非用户明确要求删除：

1. 创建 MR 时使用 `--remove-source-branch=false`，不要依赖项目默认值。
2. 对已有 MR，在登记 Auto-merge 前显式关闭删除选项：

   ```powershell
   glab api --method PUT `
     'projects/<url-encoded-project>/merge_requests/<iid>' `
     -f 'remove_source_branch=false'
   ```

3. 回读 MR，确认 `should_remove_source_branch` 和 `force_remove_source_branch` 都不是 `true`。
4. `glab mr merge` 不传 `--remove-source-branch`。
5. 若项目策略导致 `force_remove_source_branch=true`，停止登记 Auto-merge 并报告策略冲突；不得声称源分支会被保留。

### 登记自动合并

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
4. 使用本 Skill 构造 MR 和流水线链接：等待中的 MR 报告“已开启流水线成功后自动合并”；流水线已成功并完成合并时报告“流水线已成功，MR 已合并”。然后结束当前 Agent 任务。

登记 Auto-merge 后不要启动额外的持续监控。GitLab 负责等待 detached MR 流水线；流水线失败时不会合并。登记后的新提交会改变 MR SHA，必须重新回读并以新 SHA 重新确认合并策略，不得沿用旧的登记结果。

仅在以下情况进入同步等待流程：

- 用户明确要求“等到合并完成”“同步等待”或同等语义；
- GitLab 项目或当前 MR 无法启用 Auto-merge；
- 用户要求流水线失败后立即诊断。

### 按需同步等待

用户明确要求同步等待时，仅使用 `glab mr view` 或 `glab api` 做有限状态查询：每 20 秒查询一次，最多 30 分钟。

- `success`：使用 `glab mr merge --sha <head-sha>` 合并，再验证目标分支包含该提交。
- `failed`：停止等待并查询失败 Job；只有用户要求修复时才进入诊断和修改流程。
- `manual`、`skipped` 或 `blocked`：报告人工操作状态和规范链接后结束。
- 存在冲突：停止等待并处理或报告冲突。
- 超时或状态未知：复核一次 MR、流水线和 Job 状态后结束。

不要自动开始新的查询周期。只有新提交、新流水线或用户明确要求继续等待时，才重新查询。

### 部署授权边界

MR 合并与环境部署是两个独立动作：

- 用户只要求创建、检查或合并 MR 时，不触发手动部署 Job。
- 用户明确要求发布到对应环境时，才可触发该环境的手动部署 Job。
- 发现 `manual`、`blocked`、`scheduled` 或等待审批的 Job 时，报告 Job 名称和规范链接后结束，不持续查询。
- 任务涉及部署验收时，不只看流水线顶层状态；使用 `glab api 'projects/<url-encoded-project>/pipelines/<pipeline-id>/jobs?include_retried=true&per_page=100'` 查询对应部署 Job。
- 只有对应部署 Job 成功后，才报告环境部署完成。

默认顺序：`gitlab-mr-description` → `gitlab-url-guard` → `glab` 创建 MR → `glab` 登记 Auto-merge → `gitlab-url-guard` 生成交付链接。

明确要求同步等待时，只使用 `glab` 做有限状态查询；不要加载其他流水线监控 Skill。

## 链接规则

- MR：`{projectUrl}/-/merge_requests/{iid}`
- 流水线：`{projectUrl}/-/pipelines/{id}`
- 作业：`{projectUrl}/-/jobs/{id}`
- 提交：`{projectUrl}/-/commit/{sha}`
- 不保留裸 `!IID`。
- 同一 GitLab 主机的 URL 必须与配置中的协议和端口一致；允许引用该实例上的其他项目。
- 不改写外部网站 URL。

缺少配置时先初始化，不猜测地址。
