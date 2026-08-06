# HJC Skills

个人 Agent Skills 聚合仓库。

## 目录结构

```text
.
├── skills/                # 对外发布、可被 skills CLI 发现的 Skill
│   └── <skill-name>/
│       └── SKILL.md
├── sources/               # 通过 Git submodule 引用的其他项目
├── scripts/               # Skill 同步脚本
├── .gitmodules            # 子模块来源配置
└── AGENTS.md              # 仓库维护约定
```

## 添加项目来源

```bash
git submodule add <repository-url> sources/<project-name>
git submodule update --init --recursive
```

`.gitmodules` 用于聚合其他项目的 Skill 源码。需要通过 `npx skills add`
发布的 Skill，应同步到主仓库的 `skills/<skill-name>/` 并提交；安装器通常不会递归拉取子模块。

## 更新 agent-git

`agent-git` 的源码来自 `sources/agent-git` 子模块，发布副本位于
`skills/agent-git`。

同步当前锁定版本：

```powershell
node scripts/sync-agent-git.mjs
```

更新到源仓库 `main` 的最新提交并同步：

```powershell
node scripts/sync-agent-git.mjs --update
```

更新后需要同时提交子模块指针和 `skills/agent-git` 的内容。

## 检查与安装

```bash
# 查看能够发现的 Skill
npx skills add . --list

# 从本地安装指定 Skill
npx skills add . --skill <skill-name>

# 安装 GitHub 仓库中的 Skill
npx skills add <owner>/<repo> --skill <skill-name>
```

每个 Skill 至少包含：

```text
skills/<skill-name>/SKILL.md
```

`SKILL.md` 的 YAML frontmatter 必须包含 `name` 和 `description`。
