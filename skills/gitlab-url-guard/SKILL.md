---
name: gitlab-url-guard
description: 初始化和维护项目级 GitLab Web 地址配置，从资源 ID 构造规范的 MR、流水线、作业和提交链接，并规范化、校验 MR 描述、发布说明、评论及交付文本。遇到自托管 GitLab 链接遗漏端口、裸 !IID、直接采用 API web_url，或需要在 GitLab 内容写入前后校验链接时使用。
---

# GitLab 链接规范化与校验

使用项目根目录下的 `gitlab-url-guard.json` 作为唯一可信来源。无论从仓库根目录还是子目录执行脚本，默认都将配置解析为 `<项目根目录>/gitlab-url-guard.json`。配置只保存完整项目 Web 地址：

```json
{
  "version": 1,
  "projectUrl": "http://gitlab.example.com:29480/group/project"
}
```

不得从 GitLab API 的 `web_url` 推断基础地址；自托管 GitLab 的返回值可能遗漏端口。

## 依赖

- 使用 `git` 定位仓库根目录、读取 remote 并推断项目地址。
- 使用 Python 3 运行 `scripts/gitlab_url_guard.py`。
- 回读 GitLab 中的实际内容时，使用已完成认证的 `glab` CLI；先执行 `glab auth status`。

缺少 `glab` 时，仍可执行链接构造、规范化和本地校验，但不得声称已完成 GitLab 写入或回读校验。

## 能力探测

开始工作前：

1. 使用 `git remote -v` 确认目标项目和 GitLab 实例。
2. 使用本 Skill 配置中的 `projectUrl` 作为项目 Web 地址的唯一可信来源。
3. 涉及 GitLab 回读校验时执行 `glab auth status`。
4. 不使用 GitLab API 返回的 `web_url` 作为最终交付链接。

## 首次初始化

初始化默认在 Git 项目根目录创建 `gitlab-url-guard.json`，不得写入 `.codex/`、Skill 目录或当前子目录。

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

### 构造链接

只从资源 ID 构造链接：

```powershell
python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py url mr 291
python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py url pipeline 520
python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py url job 2044
python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py url commit 1aa816a6
```

### 规范化并校验文本

写入 MR 描述、评论、发布说明或交付文本前，先规范化文件，再严格校验：

```powershell
python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py normalize `
  --input '<content.md>' --output '<content.md>'

python .codex/skills/gitlab-url-guard/scripts/gitlab_url_guard.py validate `
  --input '<content.md>'
```

校验返回非零状态时，停止 `glab mr create`、`glab mr update`、评论、合并和发布通知等 GitLab 写操作。

### 回读校验

写入 GitLab 后：

1. 使用对应的 `glab` 命令或 API 回读实际内容。
2. 将实际内容保存到仓库外临时文件。
3. 再次执行严格校验。
4. 回读校验通过前，不进入后续合并、发布或交付步骤。

创建或更新 MR 时，使用 `glab mr view <iid> -F json` 回读实际描述。

## 与发布工作流协作

将本 Skill 作为 GitLab 发布流程的 URL 校验能力，不在本 Skill 中编排 MR、流水线、自动合并或部署：

1. GitLab 写入前执行 `normalize` 和 `validate`。
2. GitLab 写入后回读实际内容并再次执行 `validate`。
3. 使用资源 ID 调用 `url` 命令生成最终交付链接。
4. 缺少配置时先初始化，不猜测地址。

完整的 MR、流水线、自动合并和部署流程由 `gitlab-release-workflow` 编排。

## 链接规则

- MR：`{projectUrl}/-/merge_requests/{iid}`
- 流水线：`{projectUrl}/-/pipelines/{id}`
- 作业：`{projectUrl}/-/jobs/{id}`
- 提交：`{projectUrl}/-/commit/{sha}`
- 不保留裸 `!IID`。
- 同一 GitLab 主机的 URL 必须与配置中的协议和端口一致；允许引用该实例上的其他项目。
- 不改写外部网站 URL。
- 缺少配置时先初始化，不猜测地址。
